import { describe, it, expect } from 'vitest';
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_TYPE_ORDER,
  evidenceTypeLabel,
  hasPayload,
  countEvidenceByType,
} from './evidence';
import { EVIDENCE_STATUS as SHARED_STATUS } from '../../amplify/lib/evidence/status';

describe('evidence constants', () => {
  it('re-exports the shared status object unchanged', () => {
    expect(EVIDENCE_STATUS).toBe(SHARED_STATUS);
    expect(EVIDENCE_STATUS).toEqual({ DRAFT: 'draft', PUBLISHED: 'published', ARCHIVED: 'archived' });
  });
  it('maps types to fixed public labels (validation is "Process Validation")', () => {
    expect(evidenceTypeLabel(EVIDENCE_TYPE.VALIDATION)).toBe('Process Validation');
    expect(evidenceTypeLabel(EVIDENCE_TYPE.PUBLICATION)).toBe('Published Research');
    expect(evidenceTypeLabel(EVIDENCE_TYPE.APPLICATION_NOTE)).toBe('Application Note');
  });
});
describe('hasPayload', () => {
  it('is false when every string target is blank/whitespace and images is empty/nullish', () => {
    expect(hasPayload({ articleSlug: '', pdfUrl: '  ', sourceUrl: undefined, images: [] })).toBe(false);
    expect(hasPayload({ images: null })).toBe(false);
    expect(hasPayload({})).toBe(false);
  });
  it('is true when any string target is non-blank', () => {
    expect(hasPayload({ sourceUrl: 'https://doi.org/x' })).toBe(true);
    expect(hasPayload({ articleSlug: 'temporary-bonding' })).toBe(true);
  });
  it('requires images.length > 0 — an empty array does not count', () => {
    expect(hasPayload({ images: [] })).toBe(false);
    expect(hasPayload({ images: ['sem-1.webp'] })).toBe(true);
  });
});
describe('countEvidenceByType', () => {
  it('returns per-type counts in canonical order, omitting zero-count types', () => {
    const records = [
      { type: EVIDENCE_TYPE.APPLICATION_NOTE }, { type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { type: EVIDENCE_TYPE.PUBLICATION }, { type: EVIDENCE_TYPE.VALIDATION },
      { type: EVIDENCE_TYPE.VALIDATION }, { type: EVIDENCE_TYPE.APPLICATION_NOTE },
    ];
    expect(countEvidenceByType(records)).toEqual([
      { type: EVIDENCE_TYPE.APPLICATION_NOTE, label: 'Application Note', count: 3 },
      { type: EVIDENCE_TYPE.PUBLICATION, label: 'Published Research', count: 1 },
      { type: EVIDENCE_TYPE.VALIDATION, label: 'Process Validation', count: 2 },
    ]);
  });
  it('follows EVIDENCE_TYPE_ORDER regardless of insertion order', () => {
    const out = countEvidenceByType([
      { type: EVIDENCE_TYPE.VALIDATION }, { type: EVIDENCE_TYPE.APPLICATION_NOTE },
    ]);
    expect(out.map((g) => g.type)).toEqual([EVIDENCE_TYPE.APPLICATION_NOTE, EVIDENCE_TYPE.VALIDATION]);
    expect(EVIDENCE_TYPE_ORDER[0]).toBe(EVIDENCE_TYPE.APPLICATION_NOTE);
  });
  it('returns [] for no records and ignores unknown types', () => {
    expect(countEvidenceByType([])).toEqual([]);
    expect(countEvidenceByType([{ type: 'bogus' }])).toEqual([]);
  });
});
