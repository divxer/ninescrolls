import { normalizeEmail } from './normalize';
import { getContactByEmail } from './contactStore';
import { findExistingOrgIdByEmail } from './orgStore';
import type { ResolveResult } from './types';

export type ResolveInput = {
  sourceEntityType: string;
  sourceEntityId: string;
  channel: 'analytics' | 'lead' | 'rfq' | 'quote' | 'order' | 'logistics' | 'manual' | 'gmail';
  lockedOrgId?: string;
  lockedContactId?: string;
  matchedOrgId?: string;
  email?: string;
  priorVisitorOrgId?: string;
};

// P1 resolution ladder. It RESOLVES against existing orgs only — it never creates an org.
// Org identity is the canonical eTLD+1 model owned by organization-api; auto-create of a new
// review org for an unknown corporate domain is deferred to P2. A corporate domain with no
// existing org therefore falls through to `unresolved` (→ Needs-Linking queue).
//
// Ladder: manual → existing_matchedOrgId → contact_email_exact → email_domain_exact
//       → visitor_prior_event (analytics only) → unresolved.
// (organization_name_match and email_domain_new are reserved ResolutionReason values for P2.)
export async function resolveLinks(input: ResolveInput): Promise<ResolveResult> {
  if (input.lockedOrgId) {
    return { orgId: input.lockedOrgId, contactId: input.lockedContactId ?? null, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1.0 };
  }
  if (input.matchedOrgId) {
    return { orgId: input.matchedOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: 1.0 };
  }

  const email = input.email ? normalizeEmail(input.email) : null;
  if (email) {
    // A curated Contact outranks domain logic (the Terry/Diamond Foundry case).
    const contact = await getContactByEmail(email);
    if (contact?.orgId) {
      return { orgId: contact.orgId, contactId: contact.contactId, resolutionStatus: 'resolved', resolutionReason: 'contact_email_exact', confidence: 0.9 };
    }
    // Existing org by canonical eTLD+1 domain (free-mail domains return null inside the lookup).
    const existingOrgId = await findExistingOrgIdByEmail(email);
    if (existingOrgId) {
      return { orgId: existingOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 };
    }
  }

  if (input.channel === 'analytics' && input.priorVisitorOrgId) {
    return { orgId: input.priorVisitorOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'visitor_prior_event', confidence: 0.5 };
  }

  const unresolvedKey = input.channel === 'gmail' && input.email
    ? `unresolved-gmail-${normalizeEmail(input.email)}`
    : `unresolved-${input.sourceEntityType}-${input.sourceEntityId}`;
  return { orgId: unresolvedKey, contactId: null, resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0 };
}
