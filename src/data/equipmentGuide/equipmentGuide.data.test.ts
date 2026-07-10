import { describe, it, expect } from 'vitest';
import type { GuideProduct, EquipmentGuideData } from './types';
import { about, evidence, contact } from './guideMeta';

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
