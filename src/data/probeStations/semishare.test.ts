import { describe, expect, it } from 'vitest';
import {
  ATTESTATION_CONFIRMED,
  FORBIDDEN_ATTESTATION_PATTERNS,
  PARTNER_BADGE_ASSETS,
  SEMISHARE_PUBLICATIONS,
  getBrandPageSeoTitle,
  getPartnerBannerText,
  getPartnerJsonLdDescription,
  productLines,
} from './semishare';

describe('attestation registry', () => {
  it('ships with the gate OFF', () => {
    expect(ATTESTATION_CONFIRMED).toBe(false);
  });

  it('returns neutral wording when not confirmed', () => {
    expect(getPartnerBannerText(false)).toBe(
      'NineScrolls provides US & Canada procurement, import, and support for SEMISHARE wafer probe stations.'
    );
    expect(getBrandPageSeoTitle(false)).toBe(
      'SEMISHARE Wafer Probe Stations | US & Canada Sales & Support'
    );
    expect(getPartnerJsonLdDescription(false)).toBe(
      'NineScrolls LLC is a US-based supplier providing procurement, import, and after-sales support for SEMISHARE wafer probe stations in the United States and Canada.'
    );
  });

  it('returns attestation wording only when confirmed', () => {
    expect(getPartnerBannerText(true)).toBe(
      'Authorized channel partner for SEMISHARE wafer probe stations (US & Canada, non-exclusive).'
    );
    expect(getBrandPageSeoTitle(true)).toBe(
      'SEMISHARE Wafer Probe Stations | US & Canada Channel Partner'
    );
    expect(getPartnerJsonLdDescription(true)).toBe(
      'NineScrolls LLC is an authorized, non-exclusive channel partner for SEMISHARE wafer probe stations in the United States and Canada.'
    );
  });

  it('neutral wording does not itself trip the forbidden patterns', () => {
    for (const text of [
      getPartnerBannerText(false),
      getBrandPageSeoTitle(false),
      getPartnerJsonLdDescription(false),
    ]) {
      for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    }
  });

  it('defines no badge assets until written confirmation', () => {
    expect(PARTNER_BADGE_ASSETS).toEqual([]);
  });
});

describe('spec traceability (spec Constraint 3/7)', () => {
  const allSpecs = productLines.flatMap((line) =>
    line.specs.map((spec) => ({ line: line.key, ...spec }))
  );

  it('every spec entry has an https semishareprober.com source URL', () => {
    for (const spec of allSpecs) {
      const url = new URL(spec.source.url); // throws on unparseable
      expect(url.protocol, `${spec.line}/${spec.label}`).toBe('https:');
      expect(
        ['semishareprober.com', 'www.semishareprober.com'],
        `${spec.line}/${spec.label}: ${url.hostname}`
      ).toContain(url.hostname);
    }
  });

  it('every capturedOn is a real, non-future calendar date', () => {
    for (const spec of allSpecs) {
      const s = spec.source.capturedOn;
      expect(s, `${spec.line}/${spec.label}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(`${s}T00:00:00Z`);
      // Round-trip: rejects rollover dates like 2026-02-30
      expect(parsed.toISOString().slice(0, 10), `${spec.line}/${spec.label}`).toBe(s);
      expect(parsed.getTime()).toBeLessThanOrEqual(Date.now() + 24 * 60 * 60 * 1000); // +24h: capturedOn is a date, not an instant — tolerate capturer timezones ahead of UTC
    }
  });

  it('every product line has substantial qualitative positioning', () => {
    for (const line of productLines) {
      expect(line.positioning.length, line.key).toBeGreaterThan(20);
    }
  });
});

describe('SEMISHARE_PUBLICATIONS (verified peer-reviewed usage)', () => {
  it('has at least 3 verified entries', () => {
    expect(SEMISHARE_PUBLICATIONS.length).toBeGreaterThanOrEqual(3);
  });

  it('every entry has non-empty title/authors/venue/application/verification', () => {
    for (const pub of SEMISHARE_PUBLICATIONS) {
      expect(pub.title.trim().length, pub.doi).toBeGreaterThan(0);
      expect(pub.authors.trim().length, pub.doi).toBeGreaterThan(0);
      expect(pub.venue.trim().length, pub.doi).toBeGreaterThan(0);
      expect(pub.application.trim().length, pub.doi).toBeGreaterThan(0);
      expect(pub.verification.trim().length, pub.doi).toBeGreaterThan(0);
    }
  });

  it('every year is a plausible publication year (2015–2026)', () => {
    for (const pub of SEMISHARE_PUBLICATIONS) {
      expect(pub.year, pub.title).toBeGreaterThanOrEqual(2015);
      expect(pub.year, pub.title).toBeLessThanOrEqual(2026);
    }
  });

  it('every doi is a bare, well-formed DOI (no URL prefix)', () => {
    for (const pub of SEMISHARE_PUBLICATIONS) {
      expect(pub.doi, pub.title).toMatch(/^10\.\d{4,9}\/\S+$/);
    }
  });

  it('does not upgrade a journal to flagship "Nature" (Nature Communications ≠ Nature)', () => {
    for (const pub of SEMISHARE_PUBLICATIONS) {
      if (pub.venue === 'Nature') {
        // flagship Nature main journal carries the s41586 DOI prefix
        expect(pub.doi.startsWith('10.1038/s41586'), pub.title).toBe(true);
      }
    }
  });

  it('carries no citation counts or count-like numeric fields (year is the only number)', () => {
    for (const pub of SEMISHARE_PUBLICATIONS) {
      expect(Object.keys(pub)).not.toContain('citations');
      const numericKeys = Object.entries(pub)
        .filter(([, value]) => typeof value === 'number')
        .map(([key]) => key);
      expect(numericKeys, pub.title).toEqual(['year']);
    }
  });
});
