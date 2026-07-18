import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { submitLead, type ContactLeadRequest } from './leadsService';

vi.mock('./analyticsStorageService', () => ({ getVisitorId: () => 'visitor-test' }));

const contact: ContactLeadRequest = {
  type: 'contact',
  name: 'Ada Lovelace',
  email: 'ada@example.edu',
  message: 'Requesting a quote for an ICP etcher.',
};

function respondWith(ok: boolean, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok, json: async () => body })));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('submitLead — success', () => {
  it('returns the parsed body', async () => {
    respondWith(true, { success: true, leadId: 'lead-1' });
    await expect(submitLead(contact)).resolves.toMatchObject({ success: true, leadId: 'lead-1' });
  });
});

describe('submitLead — failure', () => {
  it('rejects with the field-level detail rather than a bare "Validation failed"', async () => {
    // Real 400 shape from submit-lead/handler.ts — `error` + `details[]`, no `message`.
    // Reading `body.error` alone dropped the field name; the shared renderer keeps it.
    respondWith(false, {
      success: false,
      error: 'Validation failed',
      details: [{ field: 'email', message: 'Invalid email address' }],
    });
    await expect(submitLead(contact)).rejects.toThrow('Validation failed — email: Invalid email address');
  });

  it('rejects with the server error when there are no field details', async () => {
    respondWith(false, { success: false, error: 'CAPTCHA verification failed' });
    await expect(submitLead(contact)).rejects.toThrow('CAPTCHA verification failed');
  });

  it('rejects with a generic message when the body carries no reason', async () => {
    respondWith(false, {});
    await expect(submitLead(contact)).rejects.toThrow('Failed to submit request. Please try again.');
  });
});
