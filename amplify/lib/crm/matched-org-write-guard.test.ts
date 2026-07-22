import { describe, it, expect, vi } from 'vitest';
import {
  MATCHED_ORG_WRITE_GUARD_CONDITION,
  MATCHED_ORG_WRITE_GUARD_VALUES,
  isConditionalCheckFailed,
  logMatchedOrgWriteSuperseded,
} from './matched-org-write-guard';

describe('matched-org-write-guard', () => {
  it('condition refuses once a link generation exists, or once matchedOrgId already holds a real org', () => {
    expect(MATCHED_ORG_WRITE_GUARD_CONDITION).toContain('attribute_not_exists(matchedOrgLinkGeneration)');
    expect(MATCHED_ORG_WRITE_GUARD_CONDITION).toContain('attribute_type(matchedOrgId, :nullType)');
    expect(MATCHED_ORG_WRITE_GUARD_CONDITION).toMatch(
      /attribute_not_exists\(matchedOrgId\)|matchedOrgId = :empty|begins_with\(matchedOrgId, :unres\)/,
    );
  });

  it('exposes the matching ExpressionAttributeValues for the condition placeholders', () => {
    expect(MATCHED_ORG_WRITE_GUARD_VALUES).toEqual({ ':nullType': 'NULL', ':empty': '', ':unres': 'unresolved-' });
  });

  it('isConditionalCheckFailed recognizes a CCFE by name', () => {
    expect(isConditionalCheckFailed(Object.assign(new Error('x'), { name: 'ConditionalCheckFailedException' }))).toBe(true);
  });

  it('isConditionalCheckFailed rejects any other error shape', () => {
    expect(isConditionalCheckFailed(new Error('boom'))).toBe(false);
    expect(isConditionalCheckFailed(undefined)).toBe(false);
    expect(isConditionalCheckFailed({ name: 'ResourceNotFoundException' })).toBe(false);
  });

  it('logMatchedOrgWriteSuperseded logs under the crm.writer.superseded tag with event + details merged', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logMatchedOrgWriteSuperseded('submit-rfq.matched_org_backfill', { rfqId: 'rfq-1', attemptedOrgId: 'b.com' });
    expect(spy).toHaveBeenCalledWith('crm.writer.superseded', JSON.stringify({
      event: 'submit-rfq.matched_org_backfill', rfqId: 'rfq-1', attemptedOrgId: 'b.com',
    }));
    spy.mockRestore();
  });
});
