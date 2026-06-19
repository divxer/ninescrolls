import { describe, it, expect } from 'vitest';
import {
  LOGISTICS_STAGES,
  ENABLED_STAGES,
  isStageEnabled,
  isValidStageTransition,
} from './stages.js';

describe('stages', () => {
  it('superset has all 22 stages including DRAFT and CANCELLED', () => {
    expect(LOGISTICS_STAGES).toContain('DRAFT');
    expect(LOGISTICS_STAGES).toContain('CANCELLED');
    expect(LOGISTICS_STAGES.length).toBe(22);
  });

  it('SAMPLE enables the round-trip subset but not equipment stages', () => {
    expect(ENABLED_STAGES.SAMPLE).toContain('TESTING');
    expect(ENABLED_STAGES.SAMPLE).toContain('RETURNED');
    expect(ENABLED_STAGES.SAMPLE).not.toContain('FAT_PASSED');
  });

  it('EQUIPMENT enables FAT/installation but not TESTING', () => {
    expect(ENABLED_STAGES.EQUIPMENT).toContain('FAT_PASSED');
    expect(ENABLED_STAGES.EQUIPMENT).toContain('ACCEPTED');
    expect(ENABLED_STAGES.EQUIPMENT).not.toContain('TESTING');
  });

  it('DEMO reuses the EQUIPMENT subset', () => {
    expect(ENABLED_STAGES.DEMO).toEqual(ENABLED_STAGES.EQUIPMENT);
  });

  it('isStageEnabled: DRAFT and CANCELLED are always allowed', () => {
    expect(isStageEnabled('SAMPLE', 'DRAFT')).toBe(true);
    expect(isStageEnabled('SAMPLE', 'CANCELLED')).toBe(true);
  });

  it('isStageEnabled: rejects a stage outside the case type subset', () => {
    expect(isStageEnabled('SPARE_PART', 'TESTING')).toBe(false);
    expect(isStageEnabled('SAMPLE', 'TESTING')).toBe(true);
  });

  it('isValidStageTransition: target must be enabled (or DRAFT/CANCELLED)', () => {
    expect(isValidStageTransition('EQUIPMENT', 'FAT_PASSED')).toBe(true);
    expect(isValidStageTransition('EQUIPMENT', 'TESTING')).toBe(false);
    expect(isValidStageTransition('EQUIPMENT', 'CANCELLED')).toBe(true);
  });
});
