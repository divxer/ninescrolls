import { describe, it, expect } from 'vitest';
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  evidenceTypeLabel,
  hasPayload,
  journalBadge,
  productPlatformLabel,
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
describe('journalBadge', () => {
  it('maps curated journals to short badges and returns null otherwise', () => {
    expect(journalBadge('Light: Science & Applications')).toBe('LSA');
    expect(journalBadge('Laser & Photonics Reviews')).toBe('LPR');
    expect(journalBadge('Some Obscure Journal')).toBeNull();
    expect(journalBadge(undefined)).toBeNull();
  });
  it('tolerates case/whitespace drift in the journal name', () => {
    expect(journalBadge('  light: science & applications ')).toBe('LSA');
  });
});

describe('productPlatformLabel', () => {
  it('is represented-platform framed and never names an OEM', () => {
    expect(productPlatformLabel('icp-etcher')).toBe('the ICP etching platform we represent');
    expect(productPlatformLabel('unknown-slug')).toBe('the platform we represent');
  });
});
