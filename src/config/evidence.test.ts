import { describe, it, expect } from 'vitest';
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  evidenceTypeLabel,
  hasPayload,
  journalBadge,
  productPlatformLabel,
  selectShowcasePublications,
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

describe('selectShowcasePublications', () => {
  const p = (journal: string, title: string, year?: number) => ({ journal, title, year });

  it('orders by journal prestige (marquee first), then unranked by recency', () => {
    const picks = selectShowcasePublications([
      p('Some Obscure Journal', 'obscure', 2026),
      p('Nature Communications', 'natcomm', 2023),
      p('Lab on a Chip', 'labchip', 2026),
    ]);
    expect(picks.map((x) => x.title)).toEqual(['natcomm', 'labchip', 'obscure']);
  });

  it('dedupes to one card per journal, keeping the newest year', () => {
    const picks = selectShowcasePublications([
      p('Nature Communications', 'old', 2021),
      p('Nature Communications', 'new', 2026),
      p('Science Advances', 'sciadv', 2023),
    ]);
    expect(picks.map((x) => x.title)).toEqual(['new', 'sciadv']);
  });

  it('respects the limit and skips entries missing journal or title', () => {
    const picks = selectShowcasePublications(
      [
        p('Nature Communications', 'a', 2026),
        p('Science Advances', 'b', 2025),
        p('Light: Science & Applications', 'c', 2024),
        { journal: 'Advanced Materials', title: null, year: 2026 } as any, // dropped: no title
        { journal: null, title: 'no-journal', year: 2026 } as any, // dropped: no journal
      ],
      2,
    );
    expect(picks.map((x) => x.title)).toEqual(['a', 'b']);
  });
});
