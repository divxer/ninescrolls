import { normalizeEmail, domainOf, normalizeOrgName, isFreeEmailDomain, isDenylistedDomain } from './normalize';
import { getOrgIdByDomain, getOrgIdByName } from './orgStore';
import { getContactByEmail } from './contactStore';
import type { ResolveResult } from './types';

export type ResolveInput = {
  sourceEntityType: string;
  sourceEntityId: string;
  channel: 'analytics' | 'lead' | 'rfq' | 'quote' | 'order' | 'logistics' | 'manual';
  lockedOrgId?: string;
  lockedContactId?: string;
  matchedOrgId?: string;
  email?: string;
  organizationName?: string;
  priorVisitorOrgId?: string;
};

const STRONG_CHANNELS = new Set(['rfq', 'lead', 'order', 'quote', 'logistics']);

export async function resolveLinks(input: ResolveInput): Promise<ResolveResult> {
  if (input.lockedOrgId) {
    return { orgId: input.lockedOrgId, contactId: input.lockedContactId ?? null, resolutionStatus: 'manually_linked', resolutionReason: 'manual', confidence: 1.0 };
  }
  if (input.matchedOrgId) {
    return { orgId: input.matchedOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'existing_matchedOrgId', confidence: 1.0 };
  }

  const email = input.email ? normalizeEmail(input.email) : null;
  const domain = email ? domainOf(email) : null;

  if (email) {
    const contact = await getContactByEmail(email);
    if (contact?.orgId) {
      return { orgId: contact.orgId, contactId: contact.contactId, resolutionStatus: 'resolved', resolutionReason: 'contact_email_exact', confidence: 0.9 };
    }
  }

  if (domain && !isFreeEmailDomain(domain)) {
    const orgId = await getOrgIdByDomain(domain);
    if (orgId) {
      return { orgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_exact', confidence: 0.95 };
    }
    if (STRONG_CHANNELS.has(input.channel) && !isDenylistedDomain(domain)) {
      return { orgId: `new-org:${domain}`, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'email_domain_new', confidence: 0.8 };
    }
  }

  if (input.organizationName) {
    const orgId = await getOrgIdByName(normalizeOrgName(input.organizationName));
    if (orgId) {
      return { orgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'organization_name_match', confidence: 0.7 };
    }
  }

  if (input.channel === 'analytics' && input.priorVisitorOrgId) {
    return { orgId: input.priorVisitorOrgId, contactId: null, resolutionStatus: 'resolved', resolutionReason: 'visitor_prior_event', confidence: 0.5 };
  }

  return { orgId: `unresolved-${input.sourceEntityType}-${input.sourceEntityId}`, contactId: null, resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0 };
}
