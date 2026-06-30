export type ResolutionStatus = 'resolved' | 'unresolved' | 'manually_linked';
export type ResolutionReason =
  | 'manual' | 'existing_matchedOrgId' | 'contact_email_exact' | 'email_domain_exact'
  | 'email_domain_new' | 'organization_name_match' | 'visitor_prior_event' | 'unresolved';
export type TimelineSource =
  | 'analytics' | 'lead' | 'rfq' | 'quote' | 'order' | 'logistics' | 'manual'
  | 'gmail' | 'twilio' | 'support';

export interface TimelineEventItem {
  PK: string; SK: string;
  GSI1PK?: string; GSI1SK?: string;
  GSI2PK?: string; GSI2SK?: string;
  GSI3PK?: string; GSI3SK?: string;
  GSI4PK?: string; GSI4SK?: string;
  entityType: 'TIMELINE_EVENT';
  id: string;
  orgId: string;
  resolutionStatus: ResolutionStatus;
  resolutionReason: ResolutionReason;
  confidence: number;
  contactId: string | null;
  occurredAt: string;
  source: TimelineSource;
  kind: string;
  summary: string;
  sourceEntityType: string;
  sourceEntityId: string;
  isInternalOnly: boolean;
  voided: boolean;
  createdBy: string | null;
  payload: Record<string, unknown> | null;
  rollupApplied: boolean;
  // Durable repair evidence: an org whose rollup still needs recompute (the OLD org after a link
  // move). Set together with rollupApplied=false; cleared once recompute succeeds. Lets a crashed
  // re-emit be repaired on retry/sweep without losing the old org's identity. Internal (not GraphQL).
  rollupPendingOrgId: string | null;
  direction: 'inbound' | 'outbound' | null;
  externalId: string | null;
  threadId: string | null;
  from: string | null;
  to: string | null;
  subject: string | null;
  bodySnippet: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContactItem {
  PK: string; SK: string;
  GSI2PK?: string; GSI2SK?: string;
  GSI4PK?: string; GSI4SK?: string;
  entityType: 'CONTACT';
  contactId: string; email: string;
  name: string | null; title: string | null; role: string | null; phone: string | null;
  orgId: string; source: string;
  firstSeenAt: string; lastSeenAt: string;
  linkLocked: boolean;
  createdAt: string; updatedAt: string;
}

export interface LinkAuditLogItem {
  PK: string; SK: string;
  GSI2PK?: string; GSI2SK?: string;
  entityType: 'LINK_AUDIT';
  id: string;
  timelineEventId: string | null;
  contactId: string | null;
  orgId: string | null;
  oldOrgId: string | null; newOrgId: string | null;
  oldContactId: string | null; newContactId: string | null;
  operator: string; reason: string; timestamp: string;
}

export interface ResolveResult {
  orgId: string;
  contactId: string | null;
  resolutionStatus: ResolutionStatus;
  resolutionReason: ResolutionReason;
  confidence: number;
}
