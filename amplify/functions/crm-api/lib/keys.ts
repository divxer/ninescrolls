import crypto from 'node:crypto';

export function timelineEventKeys(e: {
  id: string; orgId: string; contactId?: string | null; occurredAt: string;
  resolutionStatus: string; sourceEntityType: string; sourceEntityId: string;
}) {
  const tlSk = `TLEVENT#${e.occurredAt}#${e.id}`;
  const keys: Record<string, string> = {
    PK: `TLEVENT#${e.id}`,
    SK: 'A',
    GSI2PK: `ORG#${e.orgId}`,
    GSI2SK: tlSk,
    GSI3PK: `SRC#${e.sourceEntityType}#${e.sourceEntityId}`,
    GSI3SK: tlSk,
  };
  if (e.resolutionStatus === 'unresolved') {
    keys.GSI1PK = 'TLEVENT_STATUS#unresolved';
    keys.GSI1SK = `${e.occurredAt}#${e.id}`;
  }
  if (e.contactId) {
    keys.GSI4PK = `CONTACT#${e.contactId}`;
    keys.GSI4SK = tlSk;
  }
  return keys;
}

export function contactKeys(c: { contactId: string; email: string; orgId: string }) {
  return {
    PK: `CONTACT#${c.contactId}`, SK: 'A',
    GSI4PK: `EMAIL#${c.email}`, GSI4SK: 'CONTACT#A',
    GSI2PK: `ORG#${c.orgId}`, GSI2SK: `CONTACT#${c.email}`,
  };
}

export function auditKeys(a: { id: string; orgId?: string | null; timestamp: string }) {
  const keys: Record<string, string> = { PK: `AUDIT#${a.id}`, SK: 'A' };
  if (a.orgId) {
    keys.GSI2PK = `ORG#${a.orgId}`;
    keys.GSI2SK = `AUDIT#${a.timestamp}#${a.id}`;
  }
  return keys;
}

export function contactIdForEmail(normalizedEmail: string): string {
  return `ct-${crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 12)}`;
}
