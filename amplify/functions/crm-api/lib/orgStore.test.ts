import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockSend = vi.fn();
vi.mock('./dynamodb', () => ({ docClient: { send: (...a: unknown[]) => mockSend(...a) }, TABLE_NAME: () => 'T' }));

import { getOrgIdByDomain, getOrgIdByName } from './orgStore';
import { getContactByEmail } from './contactStore';
import { getTimelineEvent } from './timelineStore';

beforeEach(() => mockSend.mockReset());

describe('lookups', () => {
  it('getOrgIdByDomain returns orgId or null', async () => {
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-1' } });
    expect(await getOrgIdByDomain('diamondfoundry.com')).toBe('org-1');
    mockSend.mockResolvedValueOnce({});
    expect(await getOrgIdByDomain('unknown.com')).toBeNull();
  });
  it('getOrgIdByName returns orgId', async () => {
    mockSend.mockResolvedValueOnce({ Item: { orgId: 'org-2' } });
    expect(await getOrgIdByName('diamond foundry inc')).toBe('org-2');
  });
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
