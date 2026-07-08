import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
import { readSourceEmailForUnit, backfillTargetPk, sourceDomain } from './sourceEmail';
beforeEach(() => mockSend.mockReset());

describe('sourceEmail helpers', () => {
  it('order prefers GSI4 EMAIL#', async () => {
    mockSend.mockResolvedValueOnce({ Item: { PK: 'ORDER#o1', SK: 'META', GSI4PK: 'EMAIL#a@acme.com' } });
    expect(await readSourceEmailForUnit('order', 'o1', [])).toBe('a@acme.com');
  });
  it('order falls back to the linked RFQ email when no GSI4 EMAIL#', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { PK: 'ORDER#o1', SK: 'META', rfqId: 'r9' } })
      .mockResolvedValueOnce({ Item: { PK: 'RFQ#r9', SK: 'META', email: 'b@acme.com' } });
    expect(await readSourceEmailForUnit('order', 'o1', [])).toBe('b@acme.com');
  });
  it('logistics resolves the underlying order via relatedOrderId', async () => {
    mockSend.mockResolvedValueOnce({ Item: { PK: 'LOGISTICS#lc1', SK: 'META', relatedOrderId: 'o7' } });
    expect(await backfillTargetPk('logistics', 'lc1', [])).toBe('ORDER#o7');
  });
  it('quote resolves the underlying order via payload.orderId', async () => {
    expect(await backfillTargetPk('quote', 'doc1', [{ payload: { orderId: 'o3' } }] as never)).toBe('ORDER#o3');
  });
  it('sourceDomain extracts the domain', () => { expect(sourceDomain('x@nanofab.com')).toBe('nanofab.com'); });
});
