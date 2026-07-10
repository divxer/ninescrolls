import { describe, it, expect } from 'vitest';
import type { GuideProduct, EquipmentGuideData } from './types';

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
