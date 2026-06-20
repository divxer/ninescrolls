import { describe, it, expect } from 'vitest';
import {
  LOGISTICS_STAGES, ENABLED_STAGES, CASE_TYPES, STAGE_LABELS,
  enabledStagesFor, isCustomsStage, nextAdvanceableStages,
} from './logistics';

describe('logistics types', () => {
  it('has 22 stages and a label for every one', () => {
    expect(LOGISTICS_STAGES).toHaveLength(22);
    for (const s of LOGISTICS_STAGES) expect(STAGE_LABELS[s]).toBeTruthy();
  });

  it('enabledStagesFor falls back to a caseType subset', () => {
    expect(enabledStagesFor('EQUIPMENT')).toContain('FAT_PASSED');
    expect(enabledStagesFor('SAMPLE')).toContain('TESTING');
    expect(enabledStagesFor('SAMPLE')).not.toContain('FAT_PASSED');
  });

  it('enabledStagesFor prefers a stored override when present', () => {
    expect(enabledStagesFor('EQUIPMENT', ['PRODUCTION', 'CLOSED'])).toEqual(['PRODUCTION', 'CLOSED']);
    // empty/nullish override → fall back to the default subset
    expect(enabledStagesFor('EQUIPMENT', [])).toEqual(enabledStagesFor('EQUIPMENT'));
  });

  it('DEMO mirrors EQUIPMENT', () => {
    expect(ENABLED_STAGES.DEMO).toEqual(ENABLED_STAGES.EQUIPMENT);
  });

  it('isCustomsStage flags the three customs stages', () => {
    expect(isCustomsStage('IMPORT_CUSTOMS')).toBe(true);
    expect(isCustomsStage('CUSTOMS_HOLD')).toBe(true);
    expect(isCustomsStage('TESTING')).toBe(false);
  });

  it('CASE_TYPES has the five Phase 1 types', () => {
    expect(CASE_TYPES).toEqual(['SAMPLE', 'EQUIPMENT', 'SPARE_PART', 'RMA', 'DEMO']);
  });

  it('nextAdvanceableStages: from DRAFT offers the first enabled stage + CANCELLED', () => {
    expect(nextAdvanceableStages('DRAFT', ENABLED_STAGES.EQUIPMENT)).toEqual(['PRODUCTION', 'CANCELLED']);
  });

  it('nextAdvanceableStages: a single forward step, never a far skip', () => {
    const r = nextAdvanceableStages('PRODUCTION', ENABLED_STAGES.EQUIPMENT);
    expect(r).toContain('FAT_SCHEDULED');
    expect(r).not.toContain('CLOSED');
  });

  it('nextAdvanceableStages: on a customs stage, offers the CUSTOMS_HOLD branch and the next happy stage', () => {
    const r = nextAdvanceableStages('IMPORT_CUSTOMS', ENABLED_STAGES.EQUIPMENT);
    expect(r).toContain('CUSTOMS_HOLD'); // can branch to hold
    expect(r).toContain('DELIVERED');    // or skip the exception when not held
  });

  it('nextAdvanceableStages: from CUSTOMS_HOLD resumes the happy path', () => {
    expect(nextAdvanceableStages('CUSTOMS_HOLD', ENABLED_STAGES.EQUIPMENT)).toContain('DELIVERED');
  });

  it('nextAdvanceableStages: terminal stages return nothing', () => {
    expect(nextAdvanceableStages('CLOSED', ENABLED_STAGES.EQUIPMENT)).toEqual([]);
    expect(nextAdvanceableStages('CANCELLED', ENABLED_STAGES.EQUIPMENT)).toEqual([]);
  });
});
