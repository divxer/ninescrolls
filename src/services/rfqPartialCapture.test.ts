import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./rfqAttachmentService', () => ({ RFQ_API_URL: 'https://api.example.com/rfq' }));
const mockGetVisitorId = vi.fn();
vi.mock('./analyticsStorageService', () => ({ getVisitorId: () => mockGetVisitorId() }));

import { capturePartialRfq } from './rfqPartialCapture';

describe('capturePartialRfq', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true });
    global.fetch = mockFetch as never;
  });

  it('POSTs the capturePartial action with the visitorId + Step-1 fields', () => {
    mockGetVisitorId.mockReturnValue('v-xyz');
    capturePartialRfq({
      name: 'Ada', email: 'ada@lab.edu', institution: 'Lab',
      equipmentCategory: 'RIE', applicationDescription: 'desc',
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.example.com/rfq');
    expect(opts.method).toBe('POST');
    expect(opts.keepalive).toBe(true);
    expect(JSON.parse(opts.body)).toEqual({
      action: 'capturePartial', visitorId: 'v-xyz',
      name: 'Ada', email: 'ada@lab.edu', institution: 'Lab',
      equipmentCategory: 'RIE', applicationDescription: 'desc',
    });
  });

  it('skips entirely when there is no stable visitorId', () => {
    mockGetVisitorId.mockReturnValue('');
    capturePartialRfq({ name: 'Ada' });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('never throws even if the request rejects (fire-and-forget)', () => {
    mockGetVisitorId.mockReturnValue('v-xyz');
    mockFetch.mockRejectedValue(new Error('network down'));
    expect(() => capturePartialRfq({ name: 'Ada' })).not.toThrow();
  });
});
