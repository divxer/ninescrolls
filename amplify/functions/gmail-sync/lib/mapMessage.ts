// Pure message→emit mapper (spec §5). All decisions here so the engine stays orchestration-only.
const OUR_DOMAIN = '@ninescrolls.com';
export const CUSTOMER_ALIASES = new Set(['info', 'sales', 'support']);   // spec §5 allowlist (config)

export type MapResult =
  | { kind: 'emit'; emit: GmailEmit }
  | { kind: 'skip'; reason: 'all_internal' | 'draft_or_chat' | 'non_customer_alias' | 'no_customer' };

export interface GmailEmit {
  idInput: { source: 'gmail'; rfc822MessageId: string } | { source: 'gmail'; mailbox: string; gmailMessageId: string };
  direction: 'inbound' | 'outbound';
  occurredAt: string; externalId: string; threadId: string | null;
  from: string; to: string; subject: string; bodySnippet: string;
  resolveInput: { sourceEntityType: 'gmail'; sourceEntityId: string; channel: 'gmail'; email: string };
  payload: { customerEmail: string; gmailLink: string | null; mailbox: string; cc?: string };
}

const header = (m: GmailMessage, name: string) =>
  m.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
const addresses = (raw: string) => (raw.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+/g) ?? []).map((a) => a.toLowerCase());
const isOurs = (a: string) => a.endsWith(OUR_DOMAIN);
// PATTERNED after crm-api's normalizeRfc822MessageId (lib/normalize.ts) — duplicated locally rather
// than imported: gmail-sync is a separate Lambda bundle and mapMessage must stay pure/dependency-free
// (same rationale as gmailSyncState's note re: crm-api's sweepState not being importable).
const normalizeMsgId = (raw: string) => { const t = raw.trim(); return (t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1) : t).toLowerCase(); };

export interface GmailMessage {
  id: string; threadId?: string; internalDate?: string; snippet?: string; labelIds?: string[];
  payload?: { headers?: { name: string; value: string }[] };
}

export function mapMessage(m: GmailMessage, mailbox: string): MapResult {
  if (m.labelIds?.some((l) => l === 'DRAFT' || l === 'CHAT')) return { kind: 'skip', reason: 'draft_or_chat' };

  const from = addresses(header(m, 'From'));
  const toCc = [...addresses(header(m, 'To')), ...addresses(header(m, 'Cc'))];
  const bcc = addresses(header(m, 'Bcc'));
  const all = [...from, ...toCc, ...bcc];
  if (all.length > 0 && all.every(isOurs)) return { kind: 'skip', reason: 'all_internal' };

  // Alias allowlist (plan-review fix): the mail MUST visibly touch an approved customer alias.
  // Zero of-our-addresses in the headers (e.g. reached us only via Bcc/Delivered-To) is unverifiable
  // → skip, same reason. Never ingest on absence of evidence.
  const ourAddresses = all.filter(isOurs);
  const touchesCustomerAlias = ourAddresses.some((a) => CUSTOMER_ALIASES.has(a.split('@')[0]));
  if (!touchesCustomerAlias) return { kind: 'skip', reason: 'non_customer_alias' };

  const inbound = from.length > 0 && !isOurs(from[0]);
  const customer = inbound ? from[0]
    : (toCc.find((a) => !isOurs(a)) ?? bcc.find((a) => !isOurs(a)));
  if (!customer) return { kind: 'skip', reason: 'no_customer' };

  const rawMsgId = header(m, 'Message-ID').trim();
  const hasMsgId = rawMsgId.length > 0;
  const normId = hasMsgId ? normalizeMsgId(rawMsgId) : `${mailbox}:${m.id}`;
  const gmailLink = hasMsgId
    ? `https://mail.google.com/mail/u/0/#search/rfc822msgid:${encodeURIComponent(normId)}`
    : (m.threadId ? `https://mail.google.com/mail/u/0/#all/${m.threadId}` : null);

  return { kind: 'emit', emit: {
    idInput: hasMsgId ? { source: 'gmail', rfc822MessageId: rawMsgId } : { source: 'gmail', mailbox, gmailMessageId: m.id },
    direction: inbound ? 'inbound' : 'outbound',
    occurredAt: new Date(Number(m.internalDate ?? Date.now())).toISOString(),   // internalDate canonical (R2)
    externalId: normId, threadId: m.threadId ?? null,
    from: header(m, 'From'), to: header(m, 'To'), subject: header(m, 'Subject'), bodySnippet: m.snippet ?? '',
    resolveInput: { sourceEntityType: 'gmail', sourceEntityId: normId, channel: 'gmail', email: customer },
    payload: { customerEmail: customer, gmailLink, mailbox, ...(header(m, 'Cc') ? { cc: header(m, 'Cc') } : {}) },
  }};
}
