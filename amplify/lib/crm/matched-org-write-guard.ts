// R10/critical (Task 8b): guard for every DELAYED matchedOrgId writer that lives OUTSIDE the
// crm-api link/replay/merge path — creation-time org resolution in submit-rfq/submit-lead, and the
// order-creation/RFQ-conversion backfills. Those writers UPDATE a record that was already created a
// moment earlier (fresh PK, so the initial Put can't collide), but the org-api round-trip in between
// leaves a window where an admin link (which stamps matchedOrgLinkGeneration) can land first. Without
// this guard, the delayed writer would blindly overwrite the linked org while leaving the stamp behind
// — an unrepairable {newOrg, staleGeneration} pair. This condition makes that unrepresentable: it
// refuses to write once a link generation exists, or once matchedOrgId already holds a REAL org.
//
// Mirrors the fenced clause in crm-api/lib/repair/replaySideEffects.ts and lib/crm/visitor-bridge.ts,
// minus their generation-comparison branch — these writers never carry a generation of their own to
// compare, they only ever go first-or-not-at-all.
export const MATCHED_ORG_WRITE_GUARD_CONDITION =
  'attribute_not_exists(matchedOrgLinkGeneration) AND (attribute_not_exists(matchedOrgId) OR attribute_type(matchedOrgId, :nullType) OR matchedOrgId = :empty OR begins_with(matchedOrgId, :unres))';

export const MATCHED_ORG_WRITE_GUARD_VALUES: Record<string, string> = {
  ':nullType': 'NULL',
  ':empty': '',
  ':unres': 'unresolved-',
};

export function isConditionalCheckFailed(err: unknown): boolean {
  return (err as { name?: string } | undefined)?.name === 'ConditionalCheckFailedException';
}

// The admin decision stands; the delayed writer's own submission/conversion must NOT fail because of
// it. Always call this (never a generic console.error) so the no-op is distinguishable from a real
// failure in logs/alarms.
export function logMatchedOrgWriteSuperseded(event: string, details: Record<string, unknown>): void {
  console.log('crm.writer.superseded', JSON.stringify({ event, ...details }));
}
