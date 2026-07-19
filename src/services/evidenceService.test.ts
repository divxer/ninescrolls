import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = { listPublishedEvidence: vi.fn(), getEvidenceStats: vi.fn() };
vi.mock('./amplifyClient', () => ({ getAmplifyDataClient: () => ({ queries }) }));

import { fetchPublishedEvidence, fetchEvidenceStats } from './evidenceService';

beforeEach(() => {
  queries.listPublishedEvidence.mockReset();
  queries.getEvidenceStats.mockReset();
});

describe('fetchPublishedEvidence', () => {
  it('calls the query with productSlug under apiKey auth and returns the array', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: [{ id: '1', type: 'application_note' }], errors: null });
    const res = await fetchPublishedEvidence('ald');
    expect(queries.listPublishedEvidence).toHaveBeenCalledWith({ productSlug: 'ald' }, { authMode: 'apiKey' });
    expect(res).toEqual([{ id: '1', type: 'application_note' }]);
  });
  it('unwraps a JSON-string payload', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: JSON.stringify([{ id: '2', type: 'publication' }]), errors: null });
    expect(await fetchPublishedEvidence('rie-etcher')).toEqual([{ id: '2', type: 'publication' }]);
  });
  it('returns [] on errors and on null data (public page must not crash)', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: null, errors: [{ message: 'boom' }] });
    expect(await fetchPublishedEvidence('ald')).toEqual([]);
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: null, errors: null });
    expect(await fetchPublishedEvidence('ald')).toEqual([]);
  });
});

describe('fetchEvidenceStats', () => {
  it('returns the verified count from an object (or JSON-string) payload', async () => {
    queries.getEvidenceStats.mockResolvedValueOnce({ data: { verifiedPublications: 56 }, errors: null });
    expect(await fetchEvidenceStats()).toEqual({ verifiedPublications: 56 });
    expect(queries.getEvidenceStats).toHaveBeenCalledWith({ authMode: 'apiKey' });

    queries.getEvidenceStats.mockResolvedValueOnce({ data: JSON.stringify({ verifiedPublications: 42 }), errors: null });
    expect(await fetchEvidenceStats()).toEqual({ verifiedPublications: 42 });
  });

  // Shape-guard: this is the frontend half of the fall-through defense. A stats
  // request that fell through to the list branch returns an ARRAY; a malformed
  // payload has a missing/non-number field. All must yield null → caller falls
  // back to the published count.
  it('returns null for an unexpected shape (array fall-through / missing / non-number)', async () => {
    for (const data of [
      [{ id: '1', type: 'publication' }],        // list fall-through (wrong query routed)
      { somethingElse: 1 },                       // missing field
      { verifiedPublications: '56' },             // non-number
      JSON.stringify([{ id: 'x' }]),              // JSON-string array
    ]) {
      queries.getEvidenceStats.mockResolvedValueOnce({ data, errors: null });
      expect(await fetchEvidenceStats()).toBeNull();
    }
  });

  it('returns null on errors / null data / thrown client (never crashes the page)', async () => {
    queries.getEvidenceStats.mockResolvedValueOnce({ data: null, errors: [{ message: 'boom' }] });
    expect(await fetchEvidenceStats()).toBeNull();
    queries.getEvidenceStats.mockRejectedValueOnce(new Error('network'));
    expect(await fetchEvidenceStats()).toBeNull();
  });
});
