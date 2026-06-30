import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));

import { findExistingOrgIdByEmail } from './orgStore';
import { getContactByEmail } from './contactStore';
import { getTimelineEvent } from './timelineStore';

beforeEach(() => mockSend.mockReset());

describe('findExistingOrgIdByEmail (canonical eTLD+1 + ORG_DOMAIN# lookup)', () => {
  it('resolves a corporate email to an existing org via the ORG_DOMAIN# GSI2 lookup', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ orgId: 'diamondfoundry.com' }] });
    const orgId = await findExistingOrgIdByEmail('Terry@DiamondFoundry.com');
    expect(orgId).toBe('diamondfoundry.com');
    const q = mockSend.mock.calls[0][0].input;
    expect(q.IndexName).toBe('GSI2');
    expect(q.ExpressionAttributeValues[':pk']).toBe('ORG_DOMAIN#diamondfoundry.com');
  });
  it('returns null when no org exists for the domain (P1 does not create one)', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    expect(await findExistingOrgIdByEmail('first@newcorp.com')).toBeNull();
  });
  it('returns null for free-mail domains without querying', async () => {
    expect(await findExistingOrgIdByEmail('someone@gmail.com')).toBeNull();
    expect(mockSend).not.toHaveBeenCalled();
  });
  it('checks the alias/subdomain before the canonical eTLD+1', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ orgId: 'diamondfoundry.com' }] }); // alias hit on the subdomain
    const orgId = await findExistingOrgIdByEmail('terry@mail.diamondfoundry.com');
    expect(orgId).toBe('diamondfoundry.com');
    expect(mockSend.mock.calls[0][0].input.ExpressionAttributeValues[':pk']).toBe('ORG_DOMAIN#mail.diamondfoundry.com');
  });
});

describe('store reads', () => {
  it('getContactByEmail returns contact or null', async () => {
    mockSend.mockResolvedValueOnce({ Items: [{ contactId: 'ct-x', orgId: 'org-1', email: 'a@b.com' }] });
    expect((await getContactByEmail('a@b.com'))?.contactId).toBe('ct-x');
    mockSend.mockResolvedValueOnce({ Items: [] });
    expect(await getContactByEmail('a@b.com')).toBeNull();
  });
  it('getTimelineEvent returns item or null by id', async () => {
    mockSend.mockResolvedValueOnce({ Item: { id: 'tev-x', orgId: 'org-1' } });
    expect((await getTimelineEvent('tev-x'))?.orgId).toBe('org-1');
  });
});
