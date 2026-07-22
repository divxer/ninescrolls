import { describe, it, expect, vi, beforeEach } from 'vitest';
const getContactByEmail = vi.fn();
const findExistingOrgIdByEmail = vi.fn();
vi.mock('./contactStore', () => ({ getContactByEmail: (e: string) => getContactByEmail(e) }));
vi.mock('./orgStore', () => ({ findExistingOrgIdByEmail: (e: string) => findExistingOrgIdByEmail(e) }));

import { resolveLinks } from './resolveLinks';
beforeEach(() => { getContactByEmail.mockReset(); findExistingOrgIdByEmail.mockReset(); });
const base = { sourceEntityType: 'rfq', sourceEntityId: 'rfq-1', channel: 'rfq' as const };

describe('resolveLinks ladder (P1: resolve existing orgs only, never create)', () => {
  it('1 manual lock wins', async () => {
    expect(await resolveLinks({ ...base, lockedOrgId: 'org-l' }))
      .toMatchObject({ orgId: 'org-l', resolutionReason: 'manual', resolutionStatus: 'manually_linked', confidence: 1 });
  });
  it('2 matchedOrgId beats domain lookup', async () => {
    const r = await resolveLinks({ ...base, matchedOrgId: 'org-m', email: 'a@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'org-m', resolutionReason: 'existing_matchedOrgId' });
    expect(findExistingOrgIdByEmail).not.toHaveBeenCalled();
  });
  it('3 contact_email_exact beats domain lookup (Terry case)', async () => {
    getContactByEmail.mockResolvedValueOnce({ contactId: 'ct-t', orgId: 'diamondfoundry.com' });
    const r = await resolveLinks({ ...base, email: 'terry@diamondfoundry.com' });
    expect(r).toMatchObject({ orgId: 'diamondfoundry.com', contactId: 'ct-t', resolutionReason: 'contact_email_exact', confidence: 0.9 });
    expect(findExistingOrgIdByEmail).not.toHaveBeenCalled();
  });
  it('4 email_domain_exact resolves to an EXISTING canonical (eTLD+1) org', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    findExistingOrgIdByEmail.mockResolvedValueOnce('diamondfoundry.com');
    expect(await resolveLinks({ ...base, email: 'new@diamondfoundry.com' }))
      .toMatchObject({ orgId: 'diamondfoundry.com', resolutionReason: 'email_domain_exact', confidence: 0.95 });
  });
  it('corporate domain with NO existing org → unresolved (no auto-create in P1)', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    findExistingOrgIdByEmail.mockResolvedValueOnce(null);
    expect(await resolveLinks({ ...base, email: 'first@newcorp.com' }))
      .toMatchObject({ orgId: 'unresolved-rfq-rfq-1', resolutionStatus: 'unresolved', resolutionReason: 'unresolved', confidence: 0 });
  });
  it('5 visitor_prior_event analytics-only', async () => {
    expect(await resolveLinks({ sourceEntityType: 'analytics', sourceEntityId: 's1', channel: 'analytics', priorVisitorOrgId: 'org-v' }))
      .toMatchObject({ orgId: 'org-v', resolutionReason: 'visitor_prior_event', confidence: 0.5 });
  });
  it('5-guard visitor_prior_event rejected for strong channels', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    findExistingOrgIdByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ ...base, priorVisitorOrgId: 'org-v' });
    expect(r.resolutionReason).not.toBe('visitor_prior_event');
    expect(r.resolutionStatus).toBe('unresolved');
  });
  it('6 unresolved sentinel per-event when there is no email and no signal', async () => {
    expect(await resolveLinks({ ...base }))
      .toMatchObject({ orgId: 'unresolved-rfq-rfq-1', resolutionReason: 'unresolved', resolutionStatus: 'unresolved', confidence: 0 });
  });
  it("gmail unresolved collapses by normalized customer email, not sourceEntityId", async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    findExistingOrgIdByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ sourceEntityType: 'gmail', sourceEntityId: 'mid-123',
      channel: 'gmail', email: '  Bob@Gmail.Com ' } as never);
    expect(r.orgId).toBe('unresolved-gmail-bob@gmail.com');
    expect(r.resolutionStatus).toBe('unresolved');
  });
  it('gmail unresolved WITHOUT an email falls back to the sourceEntityId form (defensive)', async () => {
    const r = await resolveLinks({ sourceEntityType: 'gmail', sourceEntityId: 'mid-9', channel: 'gmail' } as never);
    expect(r.orgId).toBe('unresolved-gmail-mid-9');
  });
  it('non-gmail unresolved id is unchanged', async () => {
    getContactByEmail.mockResolvedValueOnce(null);
    findExistingOrgIdByEmail.mockResolvedValueOnce(null);
    const r = await resolveLinks({ sourceEntityType: 'rfq', sourceEntityId: 'r1', channel: 'rfq', email: 'x@nohit.com' } as never);
    expect(r.orgId).toBe('unresolved-rfq-r1');
  });
});
