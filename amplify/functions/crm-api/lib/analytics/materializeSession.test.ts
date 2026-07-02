import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('../dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));
const emitMock = vi.fn();
vi.mock('../emitTimelineEvent', () => ({ emitTimelineEvent: (a: unknown) => emitMock(a) }));
const loadFlushes = vi.fn();
vi.mock('./sessionWindow', async (orig) => ({ ...(await orig()), loadSessionFlushes: (s: string) => loadFlushes(s), ANALYTICS_TABLE: () => 'ANALYTICS' }));
const readMarkerMock = vi.fn(); const writeMarkerMock = vi.fn(); const listMarkersMock = vi.fn();
vi.mock('./sessionMarkers', () => ({ readMarker: (...a: unknown[]) => readMarkerMock(...a), writeMarker: (...a: unknown[]) => writeMarkerMock(...a), listMarkers: (...a: unknown[]) => listMarkersMock(...a) }));
const readBridgeMock = vi.fn();
vi.mock('../../../../lib/crm/visitor-bridge', () => ({
  readVisitorBridge: (...a: unknown[]) => readBridgeMock(...a),
  toSend: (dc: { send: (c: unknown) => unknown }) => (c: unknown) => dc.send(c), // passthrough adapter
}));

import { materializeSession, computeInputHash } from './materializeSession';
beforeEach(() => { mockSend.mockReset(); emitMock.mockReset(); loadFlushes.mockReset(); readMarkerMock.mockReset(); writeMarkerMock.mockReset(); listMarkersMock.mockReset(); readBridgeMock.mockReset(); listMarkersMock.mockResolvedValue({ markers: [] }); });

const FLUSH = (over: Record<string, unknown> = {}) => ({ eventType: 'page_time_flush', sessionId: 's-1', visitorId: 'v-1', pageViewId: 'p-1', pathname: '/products/icp-etcher', timestamp: '2026-07-01T00:00:00Z', activeSeconds: 60, maxScrollDepth: 80, isBot: false, ...over });
const PV = (over: Record<string, unknown> = {}) => ({ Item: { id: 'pv-p-1', pathname: '/products/icp-etcher', productPagesViewed: 1, pdfDownloads: 0, returnVisits: 0, orgName: 'Some ISP', utmSource: 'g', trafficChannel: 'paid', country: 'US', region: 'CA', ...over } });

describe('materializeSession', () => {
  it('emits site_visit_session with deterministic id + tier-3 unresolved resolveInput (no bridge, no prior)', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());          // pv join
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce(null);
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('emitted');
    const args = emitMock.mock.calls[0][0];
    expect(args.kind).toBe('site_visit_session');
    expect(args.idInput).toEqual({ kind: 'site_visit_session', sessionId: 's-1' });
    expect(args.resolveInput).toMatchObject({ channel: 'analytics', sourceEntityType: 'analytics', sourceEntityId: 's-1' });
    expect(args.resolveInput.matchedOrgId).toBeUndefined();
    expect(args.occurredAt).toBe('2026-07-01T00:00:00Z');  // earliest flush ts
    expect(args.payload).toMatchObject({ visitorId: 'v-1', pageCount: 1, productPagesViewed: 1, orgNameDisplay: 'Some ISP' });
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'unresolved', timelineEventId: 'tev-analytics-session-s-1' }));
  });
  it('tier-1: bridge {matchedOrgId,email} flows into resolveInput; marker resolved', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'lab.edu', email: 'a@lab.edu' });
    readMarkerMock.mockResolvedValueOnce(null);
    emitMock.mockResolvedValueOnce(undefined);
    await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(emitMock.mock.calls[0][0].resolveInput).toMatchObject({ matchedOrgId: 'lab.edu', email: 'a@lab.edu' });
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'resolved', resolvedOrgId: 'lab.edu' }));
  });
  it('email-only bridge is emitted for resolver use but marker remains unresolved locally', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: null, email: 'a@newcorp.example' });
    readMarkerMock.mockResolvedValueOnce(null);
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.resolutionSource).toBe('unresolved');
    expect(emitMock.mock.calls[0][0].resolveInput).toMatchObject({ email: 'a@newcorp.example' });
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'unresolved', resolvedOrgId: null }));
  });
  it('tier-2: no bridge but a prior resolved marker → priorVisitorOrgId passed', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce(null);
    listMarkersMock.mockResolvedValue({ markers: [{ sessionId: 's-0', resolutionStatus: 'resolved', resolvedOrgId: 'lab.edu', emittedAt: '2026-06-30T00:00:00Z' }] });
    emitMock.mockResolvedValueOnce(undefined);
    await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(emitMock.mock.calls[0][0].resolveInput.priorVisitorOrgId).toBe('lab.edu');
  });
  it('tier-2 paginates marker lookup until it finds a prior resolved marker', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH()]);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce(null);
    listMarkersMock
      .mockResolvedValueOnce({ markers: [{ sessionId: 's-x', resolutionStatus: 'unresolved', resolvedOrgId: null, emittedAt: '2026-06-29T00:00:00Z' }], lastKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-x' } })
      .mockResolvedValueOnce({ markers: [{ sessionId: 's-0', resolutionStatus: 'resolved', resolvedOrgId: 'lab.edu', emittedAt: '2026-06-30T00:00:00Z' }] });
    emitMock.mockResolvedValueOnce(undefined);
    await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(listMarkersMock).toHaveBeenCalledTimes(2);
    expect(listMarkersMock.mock.calls[1][1]).toMatchObject({ startKey: { PK: 'VISITOR#v-1', SK: 'SESSION#s-x' } });
    expect(emitMock.mock.calls[0][0].resolveInput.priorVisitorOrgId).toBe('lab.edu');
  });
  it('below threshold (1 non-product page, no downloads) → marker below_threshold, NO emit', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH({ pathname: '/', pageViewId: 'p-9' })]);
    mockSend.mockResolvedValueOnce({ Item: { id: 'pv-p-9', pathname: '/', productPagesViewed: 0, pdfDownloads: 0, returnVisits: 0 } });
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce(null);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('below_threshold');
    expect(emitMock).not.toHaveBeenCalled();
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'below_threshold' }));
  });
  it('throws on transient pv join failure instead of writing below_threshold from incomplete inputs', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH({ pathname: '/', pageViewId: 'p-9' })]);
    mockSend.mockRejectedValueOnce(new Error('ddb throttled'));
    await expect(materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' }))
      .rejects.toThrow(/pv.*p-9/i);
    expect(emitMock).not.toHaveBeenCalled();
    expect(writeMarkerMock).not.toHaveBeenCalled();
  });
  it('fast-skip: unchanged inputHash + no resolution upgrade + not forceReemit → skipped, no emit, no marker rewrite', async () => {
    const flushes = [FLUSH()];
    loadFlushes.mockResolvedValueOnce(flushes);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce(null);
    const hash = computeInputHash(flushes as never, [PV().Item as never]);
    readMarkerMock.mockResolvedValueOnce({ sessionId: 's-1', resolutionStatus: 'unresolved', inputHash: hash });
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('skipped');
    expect(emitMock).not.toHaveBeenCalled();
    expect(writeMarkerMock).not.toHaveBeenCalled();
  });
  it('unchanged hash BUT bridge now offers an upgrade → re-emits (resolution upgrade beats fast-skip)', async () => {
    const flushes = [FLUSH()];
    loadFlushes.mockResolvedValueOnce(flushes);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'lab.edu', email: 'a@lab.edu' });
    const hash = computeInputHash(flushes as never, [PV().Item as never]);
    readMarkerMock.mockResolvedValueOnce({ sessionId: 's-1', resolutionStatus: 'unresolved', inputHash: hash });
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('emitted');
  });
  it('forceReemit re-emits an unresolved session with unchanged hash even without upgrade check shortcuts', async () => {
    const flushes = [FLUSH()];
    loadFlushes.mockResolvedValueOnce(flushes);
    mockSend.mockResolvedValueOnce(PV());
    readBridgeMock.mockResolvedValueOnce({ matchedOrgId: 'lab.edu', email: 'a@lab.edu' });
    const hash = computeInputHash(flushes as never, [PV().Item as never]);
    readMarkerMock.mockResolvedValueOnce({ sessionId: 's-1', resolutionStatus: 'unresolved', inputHash: hash });
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z', forceReemit: true });
    expect(out.outcome).toBe('emitted');
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ resolutionStatus: 'resolved', resolvedOrgId: 'lab.edu' }));
  });
  it('below→above threshold on inputHash change → re-emits; occurredAt=earliest, lastFlushTs=latest', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH(), FLUSH({ pageViewId: 'p-2', timestamp: '2026-07-01T00:05:00Z' })]);
    mockSend.mockResolvedValue(PV());
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce({ sessionId: 's-1', resolutionStatus: 'below_threshold', resolvedOrgId: null, inputHash: 'stale-hash' });
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('emitted');
    expect(emitMock.mock.calls[0][0].occurredAt).toBe('2026-07-01T00:00:00Z');
    expect(writeMarkerMock).toHaveBeenCalledWith('v-1', expect.objectContaining({ lastFlushTs: '2026-07-01T00:05:00Z', resolutionStatus: 'unresolved' }));
  });
  it('uses max activeSeconds per pageViewId because page_time_flush values are cumulative snapshots', async () => {
    loadFlushes.mockResolvedValueOnce([
      FLUSH({ activeSeconds: 30, flushReason: 'hidden', timestamp: '2026-07-01T00:00:30Z' }),
      FLUSH({ activeSeconds: 60, flushReason: 'pagehide', timestamp: '2026-07-01T00:01:00Z' }),
      FLUSH({ pageViewId: 'p-2', activeSeconds: 15, timestamp: '2026-07-01T00:02:00Z' }),
    ]);
    mockSend.mockResolvedValue(PV());
    readBridgeMock.mockResolvedValueOnce(null);
    readMarkerMock.mockResolvedValueOnce(null);
    emitMock.mockResolvedValueOnce(undefined);
    await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(emitMock.mock.calls[0][0].payload.activeSeconds).toBe(75);
  });
  it('session with NO visitorId still emits (valid sessionId id) but writes NO marker', async () => {
    loadFlushes.mockResolvedValueOnce([FLUSH({ visitorId: undefined }), FLUSH({ visitorId: undefined, pageViewId: 'p-2' }), FLUSH({ visitorId: undefined, pageViewId: 'p-3' })]);
    mockSend.mockResolvedValue({ Item: { pathname: '/x', productPagesViewed: 0, pdfDownloads: 0, returnVisits: 0 } });
    emitMock.mockResolvedValueOnce(undefined);
    const out = await materializeSession({ sessionId: 's-1', nowIso: '2026-07-01T01:00:00.000Z' });
    expect(out.outcome).toBe('emitted');                      // ≥3 pages passes threshold
    expect(readBridgeMock).not.toHaveBeenCalled();
    expect(writeMarkerMock).not.toHaveBeenCalled();
  });
});
