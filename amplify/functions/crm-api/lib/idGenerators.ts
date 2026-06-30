import crypto from 'node:crypto';

export function generateOrgId(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `org-${date}-${crypto.randomBytes(2).toString('hex')}`;
}

export function generateAuditId(): string {
    return `audit-${crypto.randomBytes(6).toString('hex')}`;
}
