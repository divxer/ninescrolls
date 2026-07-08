import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const getTimelineEventMock = vi.fn();
vi.mock('../timelineStore', () => ({ getTimelineEvent: (id: string) => getTimelineEventMock(id) }));
const emitMock = vi.fn();
vi.mock('../emitTimelineEvent', () => ({ emitTimelineEvent: (a: unknown) => emitMock(a) }));

import { reconcileExpectedEvents, runExistencePage } from './existencePass';
beforeEach(() => { mockSend.mockReset(); getTimelineEventMock.mockReset(); emitMock.mockReset(); });

describe('existence pass — reconcileExpectedEvents (injected core)', () => {
  it('emits ONLY the missing events and counts them', async () => {
    const getTimelineEvent = vi.fn().mockResolvedValueOnce({ id: 'tev-a' }).mockResolvedValueOnce(null);
    const emit = vi.fn().mockResolvedValue(undefined);
    const expected = [ { id: 'tev-a', args: { kind: 'rfq_submitted' } }, { id: 'tev-b', args: { kind: 'lead_captured' } } ] as never[];
    const counters = { sourceScanned: 0, expected: 0, existing: 0, missingReemitted: 0, errors: 0 };
    await reconcileExpectedEvents(expected, { getTimelineEvent, emit }, counters);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith({ kind: 'lead_captured' });
    expect(counters).toMatchObject({ expected: 2, existing: 1, missingReemitted: 1, errors: 0 });
    expect(counters.expected).toBe(counters.existing + counters.missingReemitted + counters.errors);
  });
  it('isolates a per-event error and continues the batch', async () => {
    const getTimelineEvent = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const emit = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(undefined);
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const expected = [{ id: 'tev-a', args: {} }, { id: 'tev-b', args: {} }] as never[];
    const counters = { sourceScanned: 0, expected: 0, existing: 0, missingReemitted: 0, errors: 0 };
    await reconcileExpectedEvents(expected, { getTimelineEvent, emit }, counters);
    expect(counters).toMatchObject({ expected: 2, existing: 0, missingReemitted: 1, errors: 1 });
    expect(counters.expected).toBe(counters.existing + counters.missingReemitted + counters.errors);
    errSpy.mockRestore();
  });
});

describe('existence pass — runExistencePage (PK-prefix channels + channel cursor)', () => {
  it('discriminates rfq by PK prefix, emits the missing rfq_submitted, advances the cursor to lead', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ PK: 'RFQ#rfq-1', SK: 'META', submittedAt: '2026-06-19T10:00:00Z', email: 'a@x.com', equipmentCategory: 'ICP', matchedOrgId: 'x.com' }] });
    getTimelineEventMock.mockResolvedValueOnce(null); // missing → emit
    emitMock.mockResolvedValueOnce(undefined);
    const out = await runExistencePage({ mode: 'cold', limit: 100 });
    const scan = mockSend.mock.calls[0][0].input;
    expect(scan.ExpressionAttributeValues[':pre']).toBe('RFQ#'); // discriminated by PK prefix, NOT entityType
    expect(emitMock).toHaveBeenCalledWith(expect.objectContaining({ kind: 'rfq_submitted', sourceEntityId: 'rfq-1' }));
    expect(out.counters).toMatchObject({ sourceScanned: 1, expected: 1, existing: 0, missingReemitted: 1 });
    expect(out.cursor).toEqual({ channel: 'lead' }); // channel advanced (no LastEvaluatedKey)
    expect(out.hasMore).toBe(true);
  });
  it('hot mode filters each channel by its OWN recency field (rfq → submittedAt)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await runExistencePage({ mode: 'hot', limit: 100, cutoffIso: '2026-06-29T00:00:00Z' });
    const scan = mockSend.mock.calls[0][0].input;
    expect(scan.ExpressionAttributeNames['#r']).toBe('submittedAt');
    expect(scan.FilterExpression).toContain('#r > :cut');
  });
  it('a page with a LastEvaluatedKey keeps the same channel + carries the key', async () => {
    mockSend.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: { PK: 'RFQ#rfq-9' } });
    const out = await runExistencePage({ mode: 'cold', limit: 100 });
    expect(out.cursor).toEqual({ channel: 'rfq', key: { PK: 'RFQ#rfq-9' } });
    expect(out.hasMore).toBe(true);
  });
  it('the LAST channel exhausted (no LastEvaluatedKey) → hasMore false, cursor cleared', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const out = await runExistencePage({ mode: 'cold', limit: 100, cursor: { channel: 'logistics' } });
    expect(out.hasMore).toBe(false);
    expect(out.cursor).toBeUndefined();
  });
  it('order channel expands created + PAGINATED STATUS_CHANGE log + QUOTATION doc into three events', async () => {
    // 1) order META scan page (single item, no LEK → channel advances). GSI4PK carries the primary
    //    contact email (manual createOrder path) — orderEmail reads it inline, no extra send.
    mockSend.mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-1', SK: 'META', GSI4PK: 'EMAIL#buyer@lab.edu', createdAt: '2026-03-01T00:00:00Z', productModel: 'X', matchedOrgId: 'x.com', rfqId: null }] });
    // 2) loadOrderChildren query — PAGE 1: a STATUS_CHANGE log + a LastEvaluatedKey (forces a 2nd page)
    mockSend.mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-1', SK: 'LOG#olog-a', id: 'olog-a', action: 'STATUS_CHANGE', toStatus: 'SHIPPED', fromStatus: 'IN_PRODUCTION', timestamp: '2026-04-01T00:00:00Z' }], LastEvaluatedKey: { PK: 'ORDER#ord-1', SK: 'LOG#olog-a' } });
    // 3) loadOrderChildren query — PAGE 2: a QUOTATION doc, no LEK → pagination stops
    mockSend.mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-1', SK: 'DOC#quote#doc-1', docId: 'doc-1', docType: 'QUOTATION', fileName: 'q.pdf', uploadedAt: '2026-03-05T00:00:00Z' }] });
    getTimelineEventMock.mockResolvedValue(null); // all three missing → all re-emitted
    emitMock.mockResolvedValue(undefined);

    const out = await runExistencePage({ mode: 'cold', limit: 100, cursor: { channel: 'order' } });

    // Child query paginated: page 2 carried the page-1 LastEvaluatedKey
    expect(mockSend.mock.calls[1][0].input.ExclusiveStartKey).toBeUndefined();
    expect(mockSend.mock.calls[2][0].input.ExclusiveStartKey).toEqual({ PK: 'ORDER#ord-1', SK: 'LOG#olog-a' });
    // All three expected events (created + stage + quote) emitted
    const kinds = emitMock.mock.calls.map((c) => c[0].kind).sort();
    expect(kinds).toEqual(['order_created', 'order_stage_changed', 'quote_sent']);
    // order_created mirrors live emit's resolveInput.email (from GSI4PK EMAIL#…)
    const created = emitMock.mock.calls.map((c) => c[0]).find((a) => a.kind === 'order_created');
    expect(created.resolveInput).toMatchObject({ email: 'buyer@lab.edu' });
    expect(out.counters).toMatchObject({ sourceScanned: 1, expected: 3, existing: 0, missingReemitted: 3, errors: 0 });
    expect(out.cursor).toEqual({ channel: 'logistics' }); // order exhausted → advance
  });
  it('order channel with NO GSI4PK falls back to the linked RFQ email (RFQ-conversion path)', async () => {
    // unmatched order (matchedOrgId '') created from an RFQ — email lives on the RFQ, not the order META
    mockSend.mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-9', SK: 'META', createdAt: '2026-03-02T00:00:00Z', productModel: 'Y', matchedOrgId: '', rfqId: 'rfq-7' }] });
    mockSend.mockResolvedValueOnce({ Items: [] });                                   // loadOrderChildren: no children
    mockSend.mockResolvedValueOnce({ Item: { email: 'pi@uni.edu' } });               // orderEmail → RFQ#rfq-7/META
    getTimelineEventMock.mockResolvedValue(null);
    emitMock.mockResolvedValue(undefined);

    const out = await runExistencePage({ mode: 'cold', limit: 100, cursor: { channel: 'order' } });

    expect(mockSend.mock.calls[2][0].input.Key).toEqual({ PK: 'RFQ#rfq-7', SK: 'META' }); // fallback read
    const created = emitMock.mock.calls.map((c) => c[0]).find((a) => a.kind === 'order_created');
    expect(created.resolveInput).toMatchObject({ email: 'pi@uni.edu' });   // recovered email drives resolution
    expect(created.resolveInput.matchedOrgId).toBeUndefined();             // unmatched → resolves by email, not org
    expect(out.counters).toMatchObject({ sourceScanned: 1, expected: 1, existing: 0, missingReemitted: 1, errors: 0 });
  });
  it('counts sourceScanned per source record and expected per expanded event', async () => {
    mockSend
      .mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-1', SK: 'META', createdAt: '2026-03-01T00:00:00Z', productModel: 'X', matchedOrgId: 'acme.com' }] })
      .mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-1', SK: 'LOG#olog-1', id: 'olog-1', action: 'STATUS_CHANGE', toStatus: 'SHIPPED', fromStatus: 'IN_PRODUCTION', timestamp: '2026-04-01T00:00:00Z' }] });
    getTimelineEventMock.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'exists' });
    emitMock.mockResolvedValue(undefined);
    const out = await runExistencePage({ mode: 'cold', limit: 100, cursor: { channel: 'order' } });
    expect(out.counters.sourceScanned).toBe(1);
    expect(out.counters.expected).toBe(out.counters.existing + out.counters.missingReemitted + out.counters.errors);
    expect(out.counters.missingReemitted).toBe(1);
    expect(out.counters.existing).toBe(1);
  });
  it('an expand failure increments sourceErrors (not event errors) and preserves the event invariant', async () => {
    // one order META record whose child-load (loadOrderChildren) throws → channel.expand rejects
    mockSend
      .mockResolvedValueOnce({ Items: [{ PK: 'ORDER#ord-1', SK: 'META', createdAt: '2026-03-01T00:00:00Z', productModel: 'X', matchedOrgId: 'acme.com' }] }) // channel scan
      .mockRejectedValueOnce(new Error('child load boom')); // loadOrderChildren query throws inside expand
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await runExistencePage({ mode: 'cold', limit: 100, cursor: { channel: 'order' } });
    expect(out.counters.sourceScanned).toBe(1);
    expect(out.counters.sourceErrors).toBe(1);
    expect(out.counters.errors).toBe(0);           // event-level errors untouched
    expect(out.counters.expected).toBe(out.counters.existing + out.counters.missingReemitted + out.counters.errors); // invariant holds
    errSpy.mockRestore();
  });
});
