import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GuideProduct, EquipmentGuideData } from './types';
import { about, evidence, contact } from './guideMeta';
import { products } from './products';
import { equipmentGuideData } from './index';
import { aldSystemConfig } from '../../components/products/productDetailConfigs/aldSystemConfig';
import { coaterDeveloperConfig } from '../../components/products/productDetailConfigs/coaterDeveloperConfig';
import { eBeamEvaporatorConfig } from '../../components/products/productDetailConfigs/eBeamEvaporatorConfig';
import { hdpCvdSystemConfig } from '../../components/products/productDetailConfigs/hdpCvdSystemConfig';
import { ibeRibeSystemConfig } from '../../components/products/productDetailConfigs/ibeRibeSystemConfig';
import { icpEtcherConfig } from '../../components/products/productDetailConfigs/icpEtcherConfig';
import { pecvdSystemConfig } from '../../components/products/productDetailConfigs/pecvdSystemConfig';
import { rieEtcherConfig } from '../../components/products/productDetailConfigs/rieEtcherConfig';
import { sputterSystemConfig } from '../../components/products/productDetailConfigs/sputterSystemConfig';
import { striperSystemConfig } from '../../components/products/productDetailConfigs/striperSystemConfig';

const WEBSITE_CONFIGS = {
  ald: aldSystemConfig,
  'coater-developer': coaterDeveloperConfig,
  'e-beam-evaporator': eBeamEvaporatorConfig,
  'hdp-cvd': hdpCvdSystemConfig,
  'ibe-ribe': ibeRibeSystemConfig,
  'icp-etcher': icpEtcherConfig,
  pecvd: pecvdSystemConfig,
  'rie-etcher': rieEtcherConfig,
  sputter: sputterSystemConfig,
  striper: striperSystemConfig,
} as const;

// Normalize a spec value the same way parity checks declare it.
function norm(v: string): string {
  return v.toLowerCase().replace(/[\s,]/g, '').replace(/optional|:/g, '');
}

describe('equipmentGuide types', () => {
  it('SpecRow supports one- and two-column values', () => {
    const oneCol: GuideProduct['specs'][number] = { label: 'Vacuum', value: 'TMP&Mechanical Pump' };
    const twoCol: GuideProduct['specs'][number] = { label: 'Wafer Size Range', value: 'up to 6 inch', value2: 'up to 12 inch' };
    expect(oneCol.value).toBeTruthy();
    expect(twoCol.value2).toBe('up to 12 inch');
  });

  it('EquipmentGuideData has the four top sections', () => {
    const keys: (keyof EquipmentGuideData)[] = ['about', 'evidence', 'products', 'contact'];
    expect(keys).toHaveLength(4);
  });
});

describe('guideMeta content integrity', () => {
  const BANNED_VENDOR = /tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i;
  const BANNED_CLAIMS = /trusted manufacturer partner|1000\+|300\+|30\+ years|years of experience|global installations|research institutions served/i;

  const metaText = JSON.stringify({ about, evidence, contact });

  it('names no OEM/supplier anywhere in meta content', () => {
    expect(metaText).not.toMatch(BANNED_VENDOR);
  });

  it('makes no mis-attributed scale claims', () => {
    expect(metaText).not.toMatch(BANNED_CLAIMS);
  });

  it('backs every journal named in the evidence subtitle with a listed study', () => {
    // "Nature Portfolio" is an umbrella term, legitimately backed by any Nature-family study.
    const naturePortfolioBacked = evidence.studies.some(
      s => s.journal === 'Nature Communications' || s.journal === 'Light: Science & Applications',
    );

    // The union of journal names the subtitle is allowed to name: every concrete
    // journal actually present in evidence.studies, plus the Nature Portfolio umbrella
    // (only when a Nature-family study backs it). Derived from the data, not hardcoded,
    // so a newly added/removed study automatically re-scopes what the subtitle may claim.
    const allowed = new Set<string>(evidence.studies.map(s => s.journal));
    if (naturePortfolioBacked) allowed.add('Nature Portfolio');

    // Candidate universe of distinct journal names we scan the subtitle for. Deliberately
    // includes journals NOT in our data (ACS Nano, Applied Physics Letters, etc.) so that
    // naming an UNBACKED journal in the subtitle is caught by the negative branch below.
    // (Bare "Nature"/"Science" are omitted on purpose: they are substrings of allowed names
    // like "Nature Portfolio" and "Light: Science & Applications", so they cannot be
    // word-detected via substring matching; flagship-Nature misuse is guarded separately.)
    const CANDIDATE_JOURNALS = [
      'Nature Portfolio', 'Nature Communications', 'Light: Science & Applications',
      'Advanced Materials', 'Materials Today', 'Scientific Reports',
      'ACS Nano', 'Applied Physics Letters', 'Advanced Functional Materials', 'Small',
    ];

    for (const j of CANDIDATE_JOURNALS) {
      const named = evidence.subtitle.includes(j);
      if (allowed.has(j)) {
        // A journal the subtitle is allowed to name must, if actually named, be backed.
        if (named && j !== 'Nature Portfolio') {
          expect(
            evidence.studies.some(s => s.journal.startsWith(j)),
            `journal "${j}" named in subtitle must have a listed study`,
          ).toBe(true);
        }
      } else {
        // A journal outside the allowed union must NOT appear in the subtitle.
        expect(named, `subtitle names unbacked journal "${j}"`).toBe(false);
      }
    }
  });

  it('never claims flagship Nature and stamps any citation count with an as-of date', () => {
    expect(evidence.studies.some(s => s.journal === 'Nature')).toBe(false);
    for (const s of evidence.studies) {
      if (s.citations !== undefined) expect(s.citationsAsOf, `${s.title} needs citationsAsOf`).toBeTruthy();
    }
  });

  it('ships no Task-0 placeholders and every listed study has a DOI/source', () => {
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toMatch(/<<|TASK-0|CONFIRMED TITLE|TODO|TBD/i);
    for (const s of evidence.studies) {
      expect(s.title.trim(), `${s.journal} needs a real title`).not.toHaveLength(0);
      expect(s.doi, `${s.title} needs a DOI before shipping`).toMatch(/^10\./);
    }
  });
});

describe('products completeness', () => {
  it('has exactly 11 series in stable order', () => {
    expect(products).toHaveLength(11);
    const orders = products.map(p => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(11);
  });

  it('every product has a real standardized image, series, bullets, and specs', () => {
    for (const p of products) {
      expect(p.series, p.id).toBeTruthy();
      expect(p.bullets.length, p.id).toBeGreaterThan(0);
      expect(p.specs.length, p.id).toBeGreaterThan(0);
      expect(p.image, p.id).toMatch(/-standardized\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'public', p.image.replace(/^\//, ''))), `${p.id} image missing`).toBe(true);
    }
  });

  it('names no OEM/supplier and no scale claims in product content', () => {
    const text = JSON.stringify(products);
    expect(text).not.toMatch(/tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i);
    expect(text).not.toMatch(/1000\+|300\+|30\+ years|global installations|trusted manufacturer partner|years of experience|research institutions served/i);
  });
});

describe('assembled EquipmentGuideData', () => {
  it('assembles all four sections and 11 products', () => {
    expect(equipmentGuideData.products).toHaveLength(11);
    expect(equipmentGuideData.about.pillars).toHaveLength(4);
    expect(equipmentGuideData.evidence.studies.length).toBeGreaterThanOrEqual(4);
    expect(equipmentGuideData.contact.contacts.length).toBeGreaterThan(0);
  });
});

describe('spec-parity guard (guide vs website configs)', () => {
  it('requires parity checks for every website-backed guide product', () => {
    const expected = Object.keys(WEBSITE_CONFIGS).sort();
    const actual = equipmentGuideData.products
      .filter(p => p.websiteSpecParity)
      .map(p => p.websiteSpecParity!.productSlug)
      .sort();
    expect(actual).toEqual(expected);
    for (const p of equipmentGuideData.products.filter(p => p.websiteSpecParity)) {
      expect(p.websiteSpecParity!.checks.length, `${p.id} needs at least two parity checks`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every declared websiteSpecParity check matches both sources', () => {
    for (const p of equipmentGuideData.products) {
      if (!p.websiteSpecParity) continue;
      const cfg = WEBSITE_CONFIGS[p.websiteSpecParity.productSlug as keyof typeof WEBSITE_CONFIGS];
      expect(cfg, `config for ${p.websiteSpecParity.productSlug} not found`).toBeTruthy();
      const items: { label: string; value: string }[] = cfg.specifications.items;
      for (const check of p.websiteSpecParity.checks) {
        const guideRow = p.specs.find(s => s.label === check.guideLabel);
        expect(guideRow, `${p.id} missing guide row ${check.guideLabel}`).toBeTruthy();
        const siteItem = items.find(i => i.label === check.websiteLabel);
        expect(siteItem, `${p.websiteSpecParity!.productSlug} missing website row ${check.websiteLabel}`).toBeTruthy();
        expect(norm(guideRow!.value + (guideRow!.value2 ?? '')), `${p.id} ${check.guideLabel} guide value`).toContain(check.guideExpected);
        expect(norm(siteItem!.value), `${p.websiteSpecParity!.productSlug} ${check.websiteLabel} website value`).toContain(check.websiteExpected);
      }
    }
  });
});
