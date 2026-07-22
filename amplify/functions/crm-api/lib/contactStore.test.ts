import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { upsertContact } from './contactStore';
beforeEach(() => mockSend.mockReset());

// ---- test helpers (mirror this file's plain-mockSend style) --------------------------------
type Fields = Record<string, unknown>;

// Queues the next getContactByEmail (GSI4 Query) response. `null` = no existing contact.
function mockGetByEmail(fields: Fields | null) {
  mockSend.mockResolvedValueOnce({ Items: fields ? [fields] : [] });
}
const mockGetByEmailOnce = mockGetByEmail;

type CapturedPut = { Item: Fields; ConditionExpression?: string; ExpressionAttributeValues?: Fields };

// Flattens every Put actually issued so far — a bare PutCommand, or the Put element nested
// inside a TransactWriteCommand (the activeOrgFence path) — in call order.
function extractPuts(): CapturedPut[] {
  const puts: CapturedPut[] = [];
  for (const call of mockSend.mock.calls) {
    const cmd = call[0];
    if (cmd instanceof PutCommand) {
      puts.push(cmd.input as CapturedPut);
    } else if (cmd instanceof TransactWriteCommand) {
      const items = (cmd.input.TransactItems ?? []) as Array<{ Put?: CapturedPut }>;
      const putEl = items.find((i) => i.Put);
      if (putEl?.Put) puts.push(putEl.Put);
    }
  }
  return puts;
}
function putItem(): Fields { const p = extractPuts(); return p[p.length - 1].Item; }
function putItemAt(i: number): Fields { const p = extractPuts(); return p[i < 0 ? p.length + i : i].Item; }
function putInput(): CapturedPut { const p = extractPuts(); return p[p.length - 1]; }
function noPutHappened(): boolean { return extractPuts().length === 0; }

function transactCalls() {
  return mockSend.mock.calls
    .filter((c) => c[0] instanceof TransactWriteCommand)
    .map((c) => (c[0] as InstanceType<typeof TransactWriteCommand>).input);
}

describe('upsertContact', () => {
  it('creates with deterministic id; firstSeenAt=occurredAt, createdAt is a separate now', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] }); // getContactByEmail
    mockSend.mockResolvedValueOnce({});            // put
    const { contactId } = await upsertContact({ email: 'Terry@DiamondFoundry.com', orgId: 'org-1', source: 'rfq', occurredAt: '2026-06-19T10:00:00Z', name: 'Terry' });
    expect(contactId).toMatch(/^ct-[0-9a-f]{12}$/);
    const item = mockSend.mock.calls[1][0].input.Item;
    expect(item.email).toBe('terry@diamondfoundry.com');
    expect(item.firstSeenAt).toBe('2026-06-19T10:00:00Z');
    expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
  it('advances lastSeenAt monotonically, preserves firstSeenAt, respects linkLocked', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ contactId: 'ct-x', email: 'a@b.com', orgId: 'org-OLD', linkLocked: true, firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z', source: 'rfq' }] });
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'a@b.com', orgId: 'org-NEW', source: 'lead', occurredAt: '2026-06-01T00:00:00Z' });
    const item = mockSend.mock.calls[1][0].input.Item;
    expect(item.orgId).toBe('org-OLD');
    expect(item.lastSeenAt).toBe('2026-06-01T00:00:00Z');
    expect(item.firstSeenAt).toBe('2026-01-01T00:00:00Z');
    expect(item.createdAt).toBe('2026-01-01T00:00:00Z');
  });

  // ---- generation-aware: primary 4 -------------------------------------------------------
  it('non-generational upsert CARRIES lastLinkGeneration forward (never drops it)', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…', firstSeenAt: 't0', lastSeenAt: 't0' });
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'rfq', occurredAt: 't1' });
    expect(putItem().lastLinkGeneration).toBe('01J0AAAA…');
  });
  it('generational upsert with a NEWER generation writes org + generation via condition', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockResolvedValueOnce({});
    const r = await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0BBBB…' });
    expect(r.outcome).toBe('written');
    expect(putInput().ConditionExpression).toContain('lastLinkGeneration');
    expect(putItem().lastLinkGeneration).toBe('01J0BBBB…');
  });
  it('generational upsert with an OLDER generation → superseded SUCCESS no-op (also on CCFE race)', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'b.com', linkLocked: false, lastLinkGeneration: '01J0BBBB…' });
    const r = await upsertContact({ email: 'b@x.com', orgId: 'a.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0AAAA…' });
    expect(r.outcome).toBe('superseded');
    expect(noPutHappened()).toBe(true);
  });
  it('linkLocked contact is never re-orged by ANY generation → locked SUCCESS no-op', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: true, lastLinkGeneration: null });
    const r = await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0BBBB…' });
    expect(r.outcome).toBe('locked');
  });

  // ---- additional required tests (a)-(d) ------------------------------------------------
  it('(a) CCFE retry rebuilds org+lock+stamp as a coherent PAIR from the fresh read (never mixes generations)', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'org-old', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockRejectedValueOnce(Object.assign(new Error('raced'), { name: 'ConditionalCheckFailedException' }));
    // Between read1 and read2, the contact got link-locked to a DIFFERENT org and a newer stamp landed.
    mockGetByEmail({ contactId: 'ct-1', orgId: 'org-locked', linkLocked: true, lastLinkGeneration: '01J0BBBB…' });
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'b@x.com', orgId: 'org-attempt', source: 'rfq', occurredAt: 't1' });
    const finalItem = putItemAt(-1);
    expect(finalItem.orgId).toBe('org-locked');            // from the SECOND (fresh) read, not the first
    expect(finalItem.lastLinkGeneration).toBe('01J0BBBB…'); // paired with that SAME second read
  });
  it('(b) generational retry returns locked when the contact became linkLocked between read and write (no second Put attempted)', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'org-a', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockRejectedValueOnce(Object.assign(new Error('raced'), { name: 'ConditionalCheckFailedException' }));
    mockGetByEmail({ contactId: 'ct-1', orgId: 'org-a', linkLocked: true, lastLinkGeneration: '01J0AAAA…' });
    const r = await upsertContact({ email: 'b@x.com', orgId: 'org-b', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0BBBB…' });
    expect(r.outcome).toBe('locked');
    expect(extractPuts()).toHaveLength(1); // only the first (raced) Put attempt — the retry short-circuited before building a second
  });
  it('(c) null-observed branch: no existing contact yet', async () => {
    mockGetByEmail(null);
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'new@x.com', orgId: 'org-1', source: 'rfq', occurredAt: 't1' });
    expect(putInput().ConditionExpression).toContain('attribute_not_exists(lastLinkGeneration)');
    expect((putInput().ExpressionAttributeValues as Fields)[':null']).toBeNull();
    expect(putItem().lastLinkGeneration).toBeNull();
  });
  it('(c) null-observed branch: existing stamp is explicitly null', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'org-1', linkLocked: false, lastLinkGeneration: null });
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'b@x.com', orgId: 'org-2', source: 'rfq', occurredAt: 't1' });
    expect(putInput().ConditionExpression).toContain('attribute_not_exists(lastLinkGeneration)');
    expect(putItem().lastLinkGeneration).toBeNull();
  });
  it('(c) value-observed branch: existing stamp is a real value', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'org-1', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'b@x.com', orgId: 'org-2', source: 'rfq', occurredAt: 't1' });
    expect(putInput().ConditionExpression).toContain('lastLinkGeneration = :obs');
    expect((putInput().ExpressionAttributeValues as Fields)[':obs']).toBe('01J0AAAA…');
    expect(putItem().lastLinkGeneration).toBe('01J0AAAA…');
  });
  it('(d) three consecutive CCFEs → throws the bounded-contention error', async () => {
    for (let i = 0; i < 3; i++) {
      mockGetByEmail({ contactId: 'ct-1', orgId: 'org-1', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
      mockSend.mockRejectedValueOnce(Object.assign(new Error('raced'), { name: 'ConditionalCheckFailedException' }));
    }
    await expect(upsertContact({ email: 'b@x.com', orgId: 'org-2', source: 'rfq', occurredAt: 't1' }))
      .rejects.toThrow(/contended repeatedly/);
  });

  // ---- race test -------------------------------------------------------------------------
  it('non-generational write CASes on the observed generation and retries after a racing generational update', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockRejectedValueOnce(Object.assign(new Error('raced'), { name: 'ConditionalCheckFailedException' })); // Put v1 fails
    mockGetByEmailOnce({ contactId: 'ct-1', orgId: 'b.com', linkLocked: false, lastLinkGeneration: '01J0BBBB…' });   // re-read sees newer
    mockSend.mockResolvedValueOnce({});                                                                             // retry Put succeeds
    await upsertContact({ email: 'b@x.com', orgId: 'c.com', source: 'rfq', occurredAt: 't1' });
    const finalItem = putItemAt(-1);
    expect(finalItem.lastLinkGeneration).toBe('01J0BBBB…'); // carried forward the FRESH stamp, not the stale one
  });

  // ---- activeOrgFence: (e)-(g) ------------------------------------------------------------
  it('(e) activeOrgFence=true wraps the Put in a TransactWriteItems with an org ConditionCheck, preserving the Put condition', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockResolvedValueOnce({});
    const r = await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0BBBB…', activeOrgFence: true });
    expect(r.outcome).toBe('written');
    const tx = transactCalls();
    expect(tx).toHaveLength(1);
    const items = tx[0].TransactItems as Array<{ ConditionCheck?: Fields; Put?: CapturedPut }>;
    expect(items).toHaveLength(2);
    expect((items[0].ConditionCheck as Fields).Key).toEqual({ PK: 'ORG#b.com', SK: 'META' });
    expect(items[1].Put!.ConditionExpression).toContain('lastLinkGeneration');
    expect(items[1].Put!.Item.lastLinkGeneration).toBe('01J0BBBB…');
  });
  it('(f) activeOrgFence org-check cancellation ⇒ org_inactive, no retry loop consumed', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockRejectedValueOnce(Object.assign(new Error('cancelled'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'ConditionalCheckFailed' }, { Code: 'None' }],
    }));
    const r = await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0BBBB…', activeOrgFence: true });
    expect(r.outcome).toBe('org_inactive');
    expect(mockSend).toHaveBeenCalledTimes(2); // one get + one cancelled transact write — no retry consumed
  });
  it('(g) activeOrgFence absent ⇒ plain PutCommand (snapshot-pin)', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockResolvedValueOnce({});
    await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0BBBB…' });
    expect(mockSend.mock.calls[1][0]).toBeInstanceOf(PutCommand);
  });
  it('activeOrgFence contact-condition cancellation feeds the existing retry loop (org check passed, Put condition raced)', async () => {
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0AAAA…' });
    mockSend.mockRejectedValueOnce(Object.assign(new Error('cancelled'), {
      name: 'TransactionCanceledException',
      CancellationReasons: [{ Code: 'None' }, { Code: 'ConditionalCheckFailed' }],
    }));
    mockGetByEmail({ contactId: 'ct-1', orgId: 'a.com', linkLocked: false, lastLinkGeneration: '01J0BBBB…' });
    mockSend.mockResolvedValueOnce({});
    const r = await upsertContact({ email: 'b@x.com', orgId: 'b.com', source: 'gmail', occurredAt: 't1', linkGeneration: '01J0CCCC…', activeOrgFence: true });
    expect(r.outcome).toBe('written');
    expect(transactCalls()).toHaveLength(2); // one cancelled, one succeeded — retry rebuilt from a fresh read
  });
});
