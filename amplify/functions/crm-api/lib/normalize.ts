const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
  'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'aol.com', 'proton.me',
  'protonmail.com', 'qq.com', '163.com', '126.com', 'sina.com', 'foxmail.com',
]);

const INFRA_DOMAINS = new Set([
  'amazonaws.com', 'cloudfront.net', 'azure.com', 'googleusercontent.com',
  'cloudflare.com', 'akamai.com', 'fastly.net', 'herokuapp.com', 'vercel.app',
]);

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function domainOf(email: string): string | null {
  const at = email.indexOf('@');
  if (at < 0 || at === email.length - 1) return null;
  return email.slice(at + 1).trim().toLowerCase() || null;
}

export function normalizeOrgName(raw: string): string {
  return raw.toLowerCase().replace(/[.,]/g, ' ').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

export function isFreeEmailDomain(domain: string): boolean {
  return FREE_EMAIL_DOMAINS.has(domain.toLowerCase());
}

export function isDenylistedDomain(domain: string): boolean {
  const d = domain.toLowerCase();
  return FREE_EMAIL_DOMAINS.has(d) || INFRA_DOMAINS.has(d);
}

export function normalizeRfc822MessageId(raw: string): string {
  const t = raw.trim();
  return (t.startsWith('<') && t.endsWith('>') ? t.slice(1, -1) : t).toLowerCase();
}
