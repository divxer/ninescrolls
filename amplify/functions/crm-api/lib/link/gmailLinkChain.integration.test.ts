/* ------------------------------------------------------------------------------------------------
 * Task 10 (Part 2): cross-part integration chain test.
 *
 * HONEST SCOPE (plan-review R2): this is an INTEGRATION test over the real code chain with an
 * in-memory table fake — it is NOT DynamoDB E2E coverage. What the fake cannot prove (real
 * ConditionExpression grammar acceptance, transact semantics, IAM): covered by (a) the fake
 * evaluating the exact condition forms this plan uses (the shared harness from Part 1 Task 14),
 * and (b) the post-deploy runbook verification (first real sync + timeline spot-check).
 *
 * Chain under test — every function REAL, only the transport and storage boundaries faked:
 *   RAW Gmail `format=metadata` message
 *     → REAL mapMessage            (gmail-sync, Part 2 Task 3)
 *     → REAL projectMessage        (gmail-sync, Part 2 Task 4) with its invokeCrmApi transport
 *       mocked by the tiny adapter below calling the REAL crm-api emitTimelineEvent
 *     → REAL resolveLinks collapse (free-mail → unresolved-gmail-<email>)
 *     → REAL needsLinkingQueue     (representativeEventId + gmail signal enrichment)
 *     → REAL linkStructuredUnit    (by representativeEventId; org fence + marker + replay)
 *     → Contact created with the link generation
 *     → a SECOND raw message from the same address auto-resolves via contact_email_exact.
 *
 * Documented adaptations from the plan's sketch (landed-API naming / plumbing only):
 *  - mapMessage's emit variant is `kind: 'emit'` (the plan sketch wrote 'ingest').
 *  - projectMessage's transport is a module import, not a parameter — the plan's
 *    `invokeCrmApiToRealEmit` adapter is the vi.mock of amplify/lib/crm/invoke-crm-api below.
 *  - orgExists stays REAL and resolves from the seeded ORG#acme.com item (stronger than the
 *    plan's "orgExists mocked true": the org-active transact fence is exercised for real).
 *  - the harness needed NO GSI4 extension: contactStore's GSI4 email Query is already covered by
 *    the harness's INDEXES.GSI4, and `store.contactByEmail()` (the landed equivalent of the
 *    sketch's `table.byGsi4('EMAIL#…')`) is the fixture-side reader.
 *  - rollup pass-through exactly as Part 1 Task 14: recomputeRollupsForOrg records into
 *    store.dirtyRollups(); every other orgStore read/write stays real against the harness.
 * ---------------------------------------------------------------------------------------------- */
import { describe, it, expect, vi } from 'vitest';

const routed = vi.hoisted(() => ({ send: null as null | ((cmd: unknown) => Promise<unknown>) }));

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: class DynamoDBClient {} }));
vi.mock('@aws-sdk/lib-dynamodb', () => {
  class BaseCommand { input: unknown; constructor(input: unknown) { this.input = input; } }
  class GetCommand extends BaseCommand {}
  class PutCommand extends BaseCommand {}
  class UpdateCommand extends BaseCommand {}
  class DeleteCommand extends BaseCommand {}
  class QueryCommand extends BaseCommand {}
  class ScanCommand extends BaseCommand {}
  class BatchGetCommand extends BaseCommand {}
  class BatchWriteCommand extends BaseCommand {}
  class TransactWriteCommand extends BaseCommand {}
  class TransactGetCommand extends BaseCommand {}
  return {
    DynamoDBDocumentClient: { from: () => ({ send: (cmd: unknown) => routed.send!(cmd) }) },
    GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand, ScanCommand,
    BatchGetCommand, BatchWriteCommand, TransactWriteCommand, TransactGetCommand,
  };
});

// The plan's ~10-line `invokeCrmApiToRealEmit` adapter: the projector's crm-api payload goes to
// the REAL emitTimelineEvent directly — ONLY the Lambda transport is bypassed.
vi.mock('../../../../lib/crm/invoke-crm-api', () => ({
  invokeCrmApi: async (payload: { action: string; args: unknown }) => {
    if (payload.action !== 'emitTimelineEvent') throw new Error(`chain adapter: unexpected action ${payload.action}`);
    const { emitTimelineEvent } = await import('../emitTimelineEvent');
    await emitTimelineEvent(payload.args as import('../emitTimelineEvent').EmitArgs);
  },
}));

// Rollup pass-through (the ONLY non-transport, non-docClient mock, as Part 1 Task 14): recompute
// is recorded on the active harness store; orgExists and the rest of orgStore stay REAL.
vi.mock('../orgStore', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../orgStore')>();
  const { recordDirtyRollup } = await import('./linkTestHarness');
  return { ...actual, recomputeRollupsForOrg: async (orgId: string) => { recordDirtyRollup(orgId); } };
});

vi.stubEnv('INTELLIGENCE_TABLE', 'T');

import { seedStore, harnessSend, orgItem } from './linkTestHarness';
// gmail-sync side: mapMessage is pure; emitMessage's only side-effect import is the mocked
// transport above. Neither imports gmailClient (google-auth-library / SecretsManager stay unloaded).
import { mapMessage, type GmailMessage } from '../../../gmail-sync/lib/mapMessage';
import { projectMessage } from '../../../gmail-sync/lib/emitMessage';
// crm-api side: all real.
import { timelineId } from '../timelineId';
import { needsLinkingQueue } from '../read/needsLinkingQueue';
import { linkStructuredUnit } from './linkStructuredUnit';

routed.send = harnessSend;

const MAILBOX = 'info@ninescrolls.com';
const T_BASE = Date.parse('2026-07-01T00:00:00.000Z');

// Realistic `users.messages.get?format=metadata` response shape (Gmail API reference: id,
// threadId, labelIds, snippet, historyId, internalDate, sizeEstimate, payload with mimeType +
// headers array only — no body parts in metadata format).
function rawGmailMetadataMessage(id: string, h: { from: string; to: string; subject?: string }): GmailMessage {
  const seq = Number(/(\d+)$/.exec(id)?.[1] ?? 0);
  return {
    id,
    threadId: `thread-${id}`,
    labelIds: ['UNREAD', 'CATEGORY_PERSONAL', 'INBOX'],
    snippet: 'Hi, I am interested in a quote for the plasma cleaner.',
    internalDate: String(T_BASE + seq * 60_000),
    payload: {
      headers: [
        { name: 'Delivered-To', value: h.to },
        { name: 'MIME-Version', value: '1.0' },
        { name: 'Date', value: 'Tue, 1 Jul 2026 00:00:00 +0000' },
        { name: 'Message-ID', value: `<${id}@mail.gmail.com>` },
        { name: 'Subject', value: h.subject ?? `Quote request (${id})` },
        { name: 'From', value: h.from },
        { name: 'To', value: h.to },
        { name: 'Content-Type', value: 'multipart/alternative; boundary="0000000000009"' },
      ],
    },
  };
}

// The REAL deterministic id the chain assigns (Message-ID present → sha256 of the normalized id).
const idOf = (mid: string) => timelineId({ source: 'gmail', rfc822MessageId: `<${mid}@mail.gmail.com>` });

describe('gmail cross-part integration chain (real mapper → projector → emit → queue → link)', () => {
  it('raw message → mapped → emitted unresolved → queue unit → link → Contact → exact resolution', async () => {
    const store = seedStore([orgItem('acme.com')]);

    // 0. the real mapper+projector run on a raw metadata-format message fixture
    const mapped = mapMessage(rawGmailMetadataMessage('m1', { from: 'Bob <bob@gmail.com>', to: 'info@ninescrolls.com' }), MAILBOX);
    expect(mapped.kind).toBe('emit');                       // not skipped by the alias/label rules
    if (mapped.kind !== 'emit') return;
    const projected = await projectMessage(mapped.emit);    // transport mock → REAL emitTimelineEvent
    expect(projected).toEqual({ outcome: 'persisted' });

    // 1. the emitted gmail event resolved to the collapse partition (free-mail → unresolved-gmail-<email>)
    expect(store.get(`TLEVENT#${idOf('m1')}`).orgId).toBe('unresolved-gmail-bob@gmail.com');

    // 2. queue collapses to ONE unit with a representativeEventId + the gmail email signal
    const q = await needsLinkingQueue({});
    const units = q.items.filter((i) => i.unitKey === 'unresolved-gmail-bob@gmail.com');
    expect(units).toHaveLength(1);
    const unit = units[0];
    expect(unit.linkUnitType).toBe('structured');
    expect(unit.representativeEventId).toBe(idOf('m1'));
    expect(unit.signal.email).toBe('bob@gmail.com');
    expect(unit.signal.enrichmentStatus).toBe('ok');

    // 3. link by representative → event moves + Contact created with the link generation
    const res = await linkStructuredUnit({
      representativeEventId: unit.representativeEventId, targetOrgId: 'acme.com', operator: 'admin@ninescrolls.com',
    });
    expect(res.moved).toBe(1);
    expect(res.postCommitStatus).toBe('ok');
    expect(store.get(`TLEVENT#${idOf('m1')}`).orgId).toBe('acme.com');
    const contact = store.contactByEmail('bob@gmail.com');
    expect(contact).toBeDefined();
    expect(contact.orgId).toBe('acme.com');
    expect(contact.lastLinkGeneration).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);   // plain ULID generation (spec R10 final)

    // 4. a SUBSEQUENT raw message from the same address flows mapper→projector→emit and auto-resolves
    const mapped2 = mapMessage(rawGmailMetadataMessage('m2', { from: 'Bob <bob@gmail.com>', to: 'sales@ninescrolls.com' }), MAILBOX);
    expect(mapped2.kind).toBe('emit');
    if (mapped2.kind !== 'emit') return;
    const projected2 = await projectMessage(mapped2.emit);
    expect(projected2).toEqual({ outcome: 'persisted' });
    const ev2 = store.get(`TLEVENT#${idOf('m2')}`);
    expect(ev2.orgId).toBe('acme.com');
    expect(ev2.resolutionStatus).toBe('resolved');
    expect(ev2.resolutionReason).toBe('contact_email_exact');
  });
});
