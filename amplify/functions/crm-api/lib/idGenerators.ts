import crypto from 'node:crypto';

// Note: CRM does not generate org ids — the canonical orgId is the eTLD+1 domain owned by
// organization-api (see orgStore.findExistingOrgIdByEmail). Org creation is deferred to P2.

export function generateAuditId(): string {
    return `audit-${crypto.randomBytes(6).toString('hex')}`;
}
