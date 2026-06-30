import { describe, it, expect, vi, beforeEach } from 'vitest';
const getOrgIdByDomain = vi.fn(); const getOrgIdByName = vi.fn(); const getContactByEmail = vi.fn();
vi.mock('./orgStore', () => ({ getOrgIdByDomain: (d: string) => getOrgIdByDomain(d), getOrgIdByName: (n: string) => getOrgIdByName(n) }));
vi.mock('./contactStore', () => ({ getContactByEmail: (e: string) => getContactByEmail(e) }));

import { resolveLinks } from './resolveLinks';
beforeEach(() => { getOrgIdByDomain.mockReset(); getOrgIdByName.mockReset(); getContactByEmail.mockReset(); });
const base = { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' as const };

describe('resolveLinks ladder', () => {
  it('1 manual lock wins', async () => {
    expect(await resolveLinks({ ...base, lockedOrgId: 'org-l' }))
      .toMatchObject({ orgId: 'org-l', resolutionReason: 'manual', resolutionStatus: 'manually_linked', confidence: 1 });
  });
  it('2 matchedOrgId beats domain', async () => {
    const r = await resolveLinks({ ...base, matchedOrgId: 'org-m', email: 'a@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'org-m', resolutionReason: 'existing_matchedOrgId' });
    expect(getOrgIdByDomain).not.toHaveBeenCalled();
  });
  it('3 contact_email_exact beats domain (Terry case)', async () => {
    getContactByEmail.mockResolvedValueOnce({ contactId: 'ct-t', orgId: 'org-df' });
    const r = await resolveLinks({ ...base, email: 'terry@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'org-df', contactId: 'ct-t', resolutionReason: 'contact_email_exact', confidence: 0.9 });
    expect(getOrgIdByDomain).not.toHaveBeenCalled();
  });
  it('4 email_domain_exact', async () => {
    getContactByEmail.mockResolvedValueOnce(null); getOrgIdByDomain.mockResolvedValueOnce('org-df');
    expect(await resolveLinks({ ...base, email: 'new@diamondfoundry.com' }))
      .toMatchObject({ orgId: 'org-df', resolutionReason: 'email_domain_exact', confidence: 0.95 });
  });
  it('5 email_domain_new returns new-org intent (strong channel)', async () => {
    getContactByEmail.mockResolvedValueOnce(null); getOrgIdByDomain.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, email: 'first@newcorp.com' });
    expect(r).toMatchObject({ resolutionReason: 'email_domain_new', confidence: 0.8 });
    expect(r.orgId).toBe('new-org:newcorp.com');
  });
  it('5-guard analytics-only never auto-creates', async () => {
    getContactByEmail.mockResolvedValueOnce(null); getOrgIdByDomain.mockResolvedValueOnce(null); getOrgIdByName.mockResolvedValueOnce(null);
    const r = await resolveLinks({ sourceEntityType: 'analytics', sourceEntityId: 's1', channel: 'analytics', email: 'first@newcorp.com' });
    expect(r.resolutionReason).not.toBe('email_domain_new');
    expect(r.resolutionStatus).toBe('unresolved');
  });
  it('5-guard free domain skips domain steps', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, email: 'x@gmail.com' });
    expect(r.resolutionReason).not.toBe('email_domain_new');
    expect(getOrgIdByDomain).not.toHaveBeenCalled();
  });
  it('6 organization_name_match', async () => {
    getContactByEmail.mockResolvedValueOnce(null); getOrgIdByName.mockResolvedValueOnce('org-n');
    expect(await resolveLinks({ ...base, organizationName: 'Diamond Foundry, Inc.' }))
      .toMatchObject({ orgId: 'org-n', resolutionReason: 'organization_name_match', confidence: 0.7 });
  });
  it('7 visitor_prior_event analytics-only', async () => {
    expect(await resolveLinks({ sourceEntityType: 'analytics', sourceEntityId: 's1', channel: 'analytics', priorVisitorOrgId: 'org-v' }))
      .toMatchObject({ orgId: 'org-v', resolutionReason: 'visitor_prior_event', confidence: 0.5 });
  });
  it('7-guard rejected for strong channels', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, priorVisitorOrgId: 'org-v' });
    expect(r.resolutionReason).not.toBe('visitor_prior_event');
  });
  it('8 unresolved sentinel per-event', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    expect(await resolveLinks({ ...base }))
      .toMatchObject({ orgId: 'unresolved-rfq-rfq-1', resolutionReason: 'unresolved', resolutionStatus: 'unresolved', confidence: 0 });
  });
});
