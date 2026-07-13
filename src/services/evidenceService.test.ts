import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = { listPublishedEvidence: vi.fn() };
vi.mock('./amplifyClient', () => ({ getAmplifyDataClient: () => ({ queries }) }));

import { fetchPublishedEvidence } from './evidenceService';

beforeEach(() => queries.listPublishedEvidence.mockReset());

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
