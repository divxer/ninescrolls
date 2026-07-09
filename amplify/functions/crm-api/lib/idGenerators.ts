import crypto from 'node:crypto';

// Note: CRM does not generate org ids — the canonical orgId is the eTLD+1 domain owned by
// organization-api (see orgStore.findExistingOrgIdByEmail). Org creation is deferred to P2.

export function generateAuditId(): string {
    return `audit-${crypto.randomBytes(6).toString('hex')}`;
}

// Deterministic audit id so a repaired audit write is an idempotent no-op (attribute_not_exists(PK)),
// never a duplicate row. INVARIANT: derived ONLY from the COMMITTED target (unitKey + targetOrgId),
// never a stale request target. A corrective re-link to a different org gets its own id (targetOrgId in hash).
export function deterministicAuditId(reason: string, unitKey: string, targetOrgId: string): string {
  return `audit-${crypto.createHash('sha256').update(`${reason}|${unitKey}|${targetOrgId}`).digest('hex').slice(0, 16)}`;
}
