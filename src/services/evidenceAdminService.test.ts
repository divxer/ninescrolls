import { describe, it, expect, vi, beforeEach } from 'vitest';

const model = {
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  listEvidenceBySlug: vi.fn(),
};
vi.mock('./amplifyClient', () => ({ getAmplifyDataClient: () => ({ models: { Evidence: model } }) }));

import { createEvidence, updateEvidence, listAllEvidence } from './evidenceAdminService';
import { EVIDENCE_STATUS, EVIDENCE_TYPE } from '../config/evidence';

const base = {
  slug: 'si-deep-etch',
  title: 'Silicon Deep Etch',
  type: EVIDENCE_TYPE.APPLICATION_NOTE,
  products: ['ald'],
  sourceUrl: 'https://example.com/note.pdf',
  status: EVIDENCE_STATUS.DRAFT,
};

beforeEach(() => Object.values(model).forEach((f) => f.mockReset()));

describe('createEvidence', () => {
  it('rejects a record with no payload target (empty images does not count)', async () => {
    await expect(createEvidence({ ...base, sourceUrl: '', articleSlug: '', pdfUrl: '', images: [] }))
      .rejects.toThrow(/payload/i);
    expect(model.create).not.toHaveBeenCalled();
    expect(model.listEvidenceBySlug).not.toHaveBeenCalled();
  });
  it('rejects a duplicate slug via the slug GSI query (nextToken in options param)', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [{ id: 'existing', slug: 'si-deep-etch' }], nextToken: null });
    await expect(createEvidence(base)).rejects.toThrow(/slug/i);
    expect(model.listEvidenceBySlug).toHaveBeenCalledWith({ slug: 'si-deep-etch' }, { authMode: 'userPool', nextToken: undefined });
    expect(model.create).not.toHaveBeenCalled();
  });
  it('detects a clash that appears only on the second GSI page (drains nextToken)', async () => {
    model.listEvidenceBySlug
      .mockResolvedValueOnce({ data: [], nextToken: 'p2' })
      .mockResolvedValueOnce({ data: [{ id: 'dup', slug: 'si-deep-etch' }], nextToken: null });
    await expect(createEvidence(base)).rejects.toThrow(/slug/i);
    expect(model.listEvidenceBySlug).toHaveBeenCalledTimes(2);
    expect(model.listEvidenceBySlug.mock.calls[1][1]).toEqual({ authMode: 'userPool', nextToken: 'p2' });
    expect(model.create).not.toHaveBeenCalled();
  });
  it('creates under userPool auth when slug is free and payload exists', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [], nextToken: null });
    model.create.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await createEvidence(base);
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'si-deep-etch' }), { authMode: 'userPool' });
  });
  it('auto-sets publishDate when created directly as published', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [], nextToken: null });
    model.create.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await createEvidence({ ...base, status: EVIDENCE_STATUS.PUBLISHED });
    expect(model.create.mock.calls[0][0].publishDate).toBeTruthy();
  });

  it('serializes metrics and meta as JSON STRINGS (AWSJSON rejects raw arrays/objects)', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [], nextToken: null });
    model.create.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await createEvidence({
      ...base,
      metrics: [{ label: 'Etch rate', value: '3.2', unit: 'μm/min' }],
      meta: { journal: 'Nature' },
    });
    const arg = model.create.mock.calls[0][0];
    expect(typeof arg.metrics).toBe('string');
    expect(JSON.parse(arg.metrics)).toEqual([{ label: 'Etch rate', value: '3.2', unit: 'μm/min' }]);
    expect(typeof arg.meta).toBe('string');
    expect(JSON.parse(arg.meta)).toEqual({ journal: 'Nature' });
  });

  it('sends null (not an empty array) for empty metrics', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [], nextToken: null });
    model.create.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await createEvidence({ ...base, metrics: [], meta: undefined });
    expect(model.create.mock.calls[0][0].metrics).toBeNull();
    expect(model.create.mock.calls[0][0].meta).toBeNull();
  });
});

describe('updateEvidence', () => {
  it('allows saving with the same slug on the same record (self is not a clash)', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [{ id: 'e-1', slug: 'si-deep-etch' }], nextToken: null });
    model.update.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await updateEvidence({ ...base, id: 'e-1' });
    expect(model.update).toHaveBeenCalled();
  });
  it('rejects when another record already owns the slug', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [{ id: 'other', slug: 'si-deep-etch' }], nextToken: null });
    await expect(updateEvidence({ ...base, id: 'e-1' })).rejects.toThrow(/slug/i);
    expect(model.update).not.toHaveBeenCalled();
  });
  it('rejects when only self is on page 1 but another id owns the slug on page 2', async () => {
    model.listEvidenceBySlug
      .mockResolvedValueOnce({ data: [{ id: 'e-1', slug: 'si-deep-etch' }], nextToken: 'p2' })
      .mockResolvedValueOnce({ data: [{ id: 'other', slug: 'si-deep-etch' }], nextToken: null });
    await expect(updateEvidence({ ...base, id: 'e-1' })).rejects.toThrow(/slug/i);
    expect(model.listEvidenceBySlug).toHaveBeenCalledTimes(2);
    expect(model.update).not.toHaveBeenCalled();
  });
  it('sets publishDate on first transition to published, and does not overwrite an existing one', async () => {
    model.listEvidenceBySlug.mockResolvedValue({ data: [], nextToken: null });
    model.update.mockResolvedValue({ data: { id: 'e-1' }, errors: null });
    await updateEvidence({ ...base, id: 'e-1', status: EVIDENCE_STATUS.PUBLISHED, publishDate: null });
    expect(model.update.mock.calls[0][0].publishDate).toBeTruthy();
    await updateEvidence({ ...base, id: 'e-1', status: EVIDENCE_STATUS.PUBLISHED, publishDate: '2026-01-01' });
    expect(model.update.mock.calls[1][0].publishDate).toBe('2026-01-01');
  });
});

describe('listAllEvidence', () => {
  it('drains nextToken across pages (admin list must not miss records)', async () => {
    model.list
      .mockResolvedValueOnce({ data: [{ id: 'e-1' }], nextToken: 'tok', errors: null })
      .mockResolvedValueOnce({ data: [{ id: 'e-2' }], nextToken: null, errors: null });
    const res = await listAllEvidence();
    expect(model.list).toHaveBeenCalledTimes(2);
    expect(model.list.mock.calls[0][0]).toEqual({ authMode: 'userPool', nextToken: undefined });
    expect(model.list.mock.calls[1][0]).toEqual({ authMode: 'userPool', nextToken: 'tok' });
    expect(res.map((r: { id: string }) => r.id)).toEqual(['e-1', 'e-2']);
  });
});
