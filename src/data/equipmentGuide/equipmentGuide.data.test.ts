import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { GuideProduct, EquipmentGuideData } from './types';
import { about, evidence, contact } from './guideMeta';
import { products } from './products';

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
    const named = ['Nature Portfolio', 'ACS', 'Advanced Materials', 'Materials Today', 'Scientific Reports']
      .filter(j => evidence.subtitle.includes(j));
    for (const j of named) {
      const family = j === 'Nature Portfolio'
        ? evidence.studies.some(s => s.journal === 'Nature Communications' || s.journal === 'Light: Science & Applications')
        : evidence.studies.some(s => s.journal.startsWith(j));
      expect(family, `journal "${j}" named in subtitle must have a study`).toBe(true);
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
    expect(text).not.toMatch(/1000\+|300\+|30\+ years|global installations/i);
  });
});
