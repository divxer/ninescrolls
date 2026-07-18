import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RFQPage } from './RFQPage';
import { describeSubmitError } from './rfqSubmitError';
import { parseRfqUrlParams } from './rfqUrlParams';
import { RFQ_FIELD_LIMITS } from '../../amplify/lib/rfq/limits';
import { RFQ_EQUIPMENT_CATEGORY_VALUES } from '../../amplify/lib/rfq/contract';

const { trackCustomEvent, trackRFQSubmission, trackRFQSubmissionWithAnalysis } = vi.hoisted(() => ({
  trackCustomEvent: vi.fn(),
  trackRFQSubmission: vi.fn(),
  trackRFQSubmissionWithAnalysis: vi.fn(),
}));

vi.mock('../hooks/useCombinedAnalytics', () => ({
  useCombinedAnalytics: () => ({
    trackCustomEvent,
    trackRFQSubmission,
    segment: {
      trackRFQSubmissionWithAnalysis,
    },
  }),
}));

vi.mock('../services/behaviorAnalytics', () => ({
  behaviorAnalytics: {
    trackFormStarted: vi.fn(),
    trackFormInteraction: vi.fn(),
    trackFormAbandoned: vi.fn(),
    trackFormCompleted: vi.fn(),
  },
}));

vi.mock('../services/analyticsStorageService', () => ({
  getVisitorId: () => 'visitor-test',
}));

function renderRfq(initialEntry: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <RFQPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ referenceNumber: 'RFQ-123456-TEST', rfqId: 'rfq-test' }),
  })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('parseRfqUrlParams', () => {
  it('parses single product from ?products=', () => {
    const r = parseRfqUrlParams('?products=icp-rie-200&source=insights/foo');
    expect(r.urlProduct).toBe('icp-rie-200');
    expect(r.productsList).toEqual(['icp-rie-200']);
    expect(r.referrerSource).toBe('insights/foo');
    expect(r.productListText).toBe('');
  });

  it('parses multiple products and uses first as primary', () => {
    const r = parseRfqUrlParams('?products=a-100,b-200,c-300&source=insights/foo');
    expect(r.urlProduct).toBe('a-100');
    expect(r.productsList).toEqual(['a-100', 'b-200', 'c-300']);
  });

  it('builds productListText for multi-product (>=2)', () => {
    const r = parseRfqUrlParams('?products=a-100,b-200&source=insights/foo');
    expect(r.productListText).toContain('Products of interest');
    expect(r.productListText).toContain('- a-100');
    expect(r.productListText).toContain('- b-200');
  });

  it('returns empty productListText for single product', () => {
    const r = parseRfqUrlParams('?products=only-one');
    expect(r.productListText).toBe('');
  });

  it('honors legacy ?product= when no ?products=', () => {
    const r = parseRfqUrlParams('?product=legacy-model&category=etching');
    expect(r.urlProduct).toBe('legacy-model');
    expect(r.urlCategory).toBe('etching');
    expect(r.productsList).toEqual([]);
  });

  it('?products= takes precedence over ?product=', () => {
    const r = parseRfqUrlParams('?products=new-model&product=legacy-model');
    expect(r.urlProduct).toBe('new-model');
  });

  it('truncates product list to 5 items', () => {
    const r = parseRfqUrlParams('?products=a,b,c,d,e,f,g');
    expect(r.productsList).toHaveLength(5);
    expect(r.productsList).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('returns empty referrerSource when source absent', () => {
    const r = parseRfqUrlParams('?product=foo');
    expect(r.referrerSource).toBe('');
  });

  it('exposes via param when present', () => {
    const r = parseRfqUrlParams('?source=insights/foo&via=ask-checkbox');
    expect(r.via).toBe('ask-checkbox');
  });

  it('handles empty search string', () => {
    const r = parseRfqUrlParams('');
    expect(r.urlProduct).toBe('');
    expect(r.productsList).toEqual([]);
    expect(r.referrerSource).toBe('');
  });

  it('trims and filters empty product slugs', () => {
    const r = parseRfqUrlParams('?products= a , ,b ,');
    expect(r.productsList).toEqual(['a', 'b']);
  });
});

describe('RFQPage URL attribution contract', () => {
  it('renders equipment-category options exactly matching the shared RFQ contract', () => {
    // Guards the ACTUAL rendered <select>, not just the rfqEquipmentOptions module:
    // catches a future regression that re-inlines a category list in the form and
    // stops importing the shared contract (the 2026-07-15 enum-drift shape).
    renderRfq('/request-quote');
    const select = screen.getByLabelText(/Equipment Category/i) as HTMLSelectElement;
    // Drop the leading empty-value placeholder option.
    const rendered = Array.from(select.options)
      .map((o) => o.value)
      .filter(Boolean)
      .sort();
    const canonical = [...RFQ_EQUIPMENT_CATEGORY_VALUES].sort();
    expect(rendered).toEqual(canonical);
  });

  it('pre-selects the Wafer Probe Station category from probe-station page links', () => {
    renderRfq('/request-quote?products=semishare-probe-station');
    const select = screen.getByLabelText(/Equipment Category/i) as HTMLSelectElement;
    expect(select.value).toBe('Probe-Station');
    // The slug also lands in the specific-model prefill (existing ?products= contract)
  });

  it('pre-selects the correct category for EVERY product-page CTA slug', () => {
    // Contract table: every ?products=<slug> a product page can send must
    // resolve to a non-empty category. Extend when adding product pages.
    const SLUG_CATEGORY: Record<string, string> = {
      'icp-etcher': 'ICP',
      'rie-etcher': 'RIE',
      'compact-rie': 'RIE',
      'ibe-ribe': 'IBE',
      'ald': 'ALD',
      'pecvd': 'PECVD',
      'hdp-cvd': 'HDP-CVD',
      'sputter': 'Sputter',
      'e-beam-evaporator': 'E-Beam',
      'coater-developer': 'Coater-Developer',
      'striper': 'Stripper',
      'plasma-cleaner': 'Plasma-Cleaner',
      'hy-4l': 'Plasma-Cleaner',
      'hy-20l': 'Plasma-Cleaner',
      'hy-20lrf': 'Plasma-Cleaner',
      'pluto-t': 'Plasma-Cleaner',
      'pluto-m': 'Plasma-Cleaner',
      'pluto-f': 'Plasma-Cleaner',
      'pluto-30': 'Plasma-Cleaner',
      'wafer-probe-station': 'Probe-Station',
      'semishare-probe-station': 'Probe-Station',
      'cryogenic-probe-station': 'Probe-Station',
      'silicon-photonics-probe-station': 'Probe-Station',
    };
    for (const [slug, expected] of Object.entries(SLUG_CATEGORY)) {
      const { unmount } = renderRfq(`/request-quote?products=${slug}`);
      const select = screen.getByLabelText(/Equipment Category/i) as HTMLSelectElement;
      expect(select.value, slug).toBe(expected);
      unmount();
    }
  });

  it('pre-selects the probe-station category for each probe page slug', () => {
    for (const slug of ['wafer-probe-station', 'cryogenic-probe-station', 'silicon-photonics-probe-station']) {
      const { unmount } = renderRfq(`/request-quote?products=${slug}`);
      const select = screen.getByLabelText(/Equipment Category/i) as HTMLSelectElement;
      expect(select.value, slug).toBe('Probe-Station');
      unmount();
    }
  });

  it('renders the redesigned RFQ header while preserving URL prefill', async () => {
    renderRfq('/request-quote?products=icp-etcher,rie-etcher&category=ICP&source=insights/test&via=ask-checkbox');

    expect(screen.getByRole('heading', { name: /Request a process equipment quote/i })).toBeInTheDocument();
    expect(screen.getByText('Engineering review')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'ada@example.edu' } });
    fireEvent.change(screen.getByLabelText(/Institution/i), { target: { value: 'Example Lab' } });
    fireEvent.change(screen.getByLabelText(/Application \/ Research Goal/i), {
      target: { value: 'Deep silicon etching process development for MEMS sensors.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Project Details/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Preferred Model/i)).toHaveValue('icp-etcher');
    });
  });

  it('announces validation errors accessibly', async () => {
    renderRfq('/request-quote');

    fireEvent.click(screen.getByRole('button', { name: /Continue to Project Details/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/complete the required fields/i);
  });

  it('associates invalid fields with their error messages for assistive tech', async () => {
    renderRfq('/request-quote');

    fireEvent.click(screen.getByRole('button', { name: /Continue to Project Details/i }));
    await screen.findByRole('alert');

    const nameInput = screen.getByLabelText(/Full Name/i);
    expect(nameInput).toHaveAttribute('aria-invalid', 'true');
    const describedBy = nameInput.getAttribute('aria-describedby');
    expect(describedBy).toBe('rfq-error-name');
    // the referenced error node must exist and carry the visible message
    expect(document.getElementById(describedBy!)).toHaveTextContent(/./);
  });

  it('prefills product, category, source, via, and multi-product comments from URL params', () => {
    renderRfq('/request-quote?products=icp-etcher,rie-etcher&category=ICP&source=insights/test&via=ask-checkbox');

    expect(screen.getByLabelText(/Equipment Category/i)).toHaveValue('ICP');
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'ada@example.edu' } });
    fireEvent.change(screen.getByLabelText(/Institution/i), { target: { value: 'Example Lab' } });
    fireEvent.change(screen.getByLabelText(/Application \/ Research Goal/i), {
      target: { value: 'Deep silicon etching process development for MEMS sensors.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Continue to Project Details/i }));

    expect(screen.getByLabelText(/Preferred Model/i)).toHaveValue('icp-etcher');
    const comments = screen.getByLabelText(/Special Requirements/i) as HTMLTextAreaElement;
    expect(comments.value).toContain('- icp-etcher');
    expect(comments.value).toContain('- rie-etcher');
  });

  it('keeps required labels associated with visible controls', () => {
    renderRfq('/request-quote?product=pecvd');

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Institution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Application \/ Research Goal/i)).toBeInTheDocument();
  });

  // Advance the form to step 2 with valid step-1 input.
  async function goToStep2() {
    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'ada@example.edu' } });
    fireEvent.change(screen.getByLabelText(/Institution/i), { target: { value: 'Example Lab' } });
    fireEvent.change(screen.getByLabelText(/Equipment Category/i), { target: { value: 'ICP' } });
    fireEvent.change(screen.getByLabelText(/Application \/ Research Goal/i), {
      target: { value: 'Deep silicon etching process development for MEMS sensors.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Project Details/i }));
    await waitFor(() => expect(screen.getByLabelText(/Preferred Model/i)).toBeInTheDocument());
  }

  it('caps step-1 text fields at the shared server length limits', () => {
    renderRfq('/request-quote');
    expect(screen.getByLabelText(/Full Name/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.name.max));
    expect(screen.getByLabelText(/^Email/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.email.max));
    expect(screen.getByLabelText(/Institution/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.institution.max));
    expect(screen.getByLabelText(/Department/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.department.max));
    expect(screen.getByLabelText(/Application \/ Research Goal/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.applicationDescription.max));
  });

  it('caps step-2 optional text fields at the shared server length limits', async () => {
    renderRfq('/request-quote');
    await goToStep2();
    expect(screen.getByLabelText(/Preferred Model/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.specificModel.max));
    expect(screen.getByLabelText(/Technical Requirements/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.keySpecifications.max));
    expect(screen.getByLabelText(/Existing Equipment/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.existingEquipment.max));
    expect(screen.getByLabelText(/Special Requirements/i)).toHaveAttribute('maxlength', String(RFQ_FIELD_LIMITS.additionalComments.max));
  });

  it('flags a specificModel that exceeds the shared max on blur', async () => {
    renderRfq('/request-quote');
    await goToStep2();
    const model = screen.getByLabelText(/Preferred Model/i);
    // fireEvent.change bypasses the maxLength attribute, simulating paste/prefill overflow
    fireEvent.change(model, { target: { value: 'x'.repeat(RFQ_FIELD_LIMITS.specificModel.max + 1) } });
    fireEvent.blur(model);
    expect(await screen.findByText(/Preferred model must be under 100 characters/i)).toBeInTheDocument();
  });

  it('blocks submit when an optional capped field exceeds its max', async () => {
    renderRfq('/request-quote');
    await goToStep2();
    fireEvent.change(screen.getByLabelText(/Existing Equipment/i), {
      target: { value: 'e'.repeat(RFQ_FIELD_LIMITS.existingEquipment.max + 1) },
    });
    fireEvent.click(screen.getByRole('button', { name: /Request Proposal/i }));
    // The over-max field must surface an inline error and the request must not fire.
    expect(await screen.findByText(/under 2000 characters/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('submits rendered URL attribution fields in the RFQ payload and analytics event', async () => {
    renderRfq('/request-quote?products=icp-etcher,rie-etcher&category=ICP&source=insights/test&via=ask-checkbox');

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ada Lovelace' } });
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'ada@example.edu' } });
    fireEvent.change(screen.getByLabelText(/Institution/i), { target: { value: 'Example Lab' } });
    fireEvent.change(screen.getByLabelText(/Application \/ Research Goal/i), {
      target: { value: 'Deep silicon etching process development for MEMS sensors.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Continue to Project Details/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Preferred Model/i)).toHaveValue('icp-etcher');
    });
    fireEvent.click(screen.getByRole('button', { name: /Request Proposal/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('https://api.ninescrolls.com/api/rfq', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });
    const fetchMock = fetch as unknown as { mock: { calls: Array<[string, RequestInit]> } };
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.edu',
      institution: 'Example Lab',
      equipmentCategory: 'ICP',
      specificModel: 'icp-etcher',
      referrerSource: 'insights/test',
      visitorId: 'visitor-test',
    });
    expect(body.additionalComments).toContain('- icp-etcher');
    expect(body.additionalComments).toContain('- rie-etcher');
    expect(trackCustomEvent).toHaveBeenCalledWith('rfq_submit_attribution', {
      referrerSource: 'insights/test',
      productCount: 2,
      viaAskCheckbox: true,
    });
  });
});

// The RFQ API rejects with { success:false, error, details? } and never sends a
// `message` key. Reading the wrong key collapsed every 400/403/500 into one
// generic retry string, which hid a live enum-drift outage on Probe-Station RFQs.
describe('describeSubmitError', () => {
  it('names the offending field for a validation failure', () => {
    expect(
      describeSubmitError({
        success: false,
        error: 'Validation failed',
        details: [{ field: 'equipmentCategory', message: 'Invalid enum value.' }],
      }),
    ).toContain('equipmentCategory');
  });

  it('lists every offending field', () => {
    const msg = describeSubmitError({
      success: false,
      error: 'Validation failed',
      details: [
        { field: 'email', message: 'Invalid email' },
        { field: 'quantity', message: 'Expected number' },
      ],
    });
    expect(msg).toContain('email');
    expect(msg).toContain('quantity');
  });

  it('surfaces a detail-less API error such as the CAPTCHA gate', () => {
    expect(
      describeSubmitError({ success: false, error: 'CAPTCHA verification required' }),
    ).toContain('CAPTCHA verification required');
  });

  it('falls back to a generic message when the body is unreadable', () => {
    expect(describeSubmitError(null)).toBe('Failed to submit request. Please try again.');
  });

  it('ignores an empty details array rather than reporting an empty field list', () => {
    expect(describeSubmitError({ success: false, error: 'Validation failed', details: [] }))
      .toContain('Validation failed');
  });
});

// ---------------------------------------------------------------------------
// Attachments — presigned S3 upload flow
//
// These deliberately route each of the three requests an attachment submission
// makes (presign → S3 PUT → submit RFQ) instead of blanket-mocking `ok: true`.
// A blanket mock is what let the old multipart path look healthy while every
// RFQ with a file 400'd in production.
// ---------------------------------------------------------------------------
const PRESIGNED_PUT_URL = 'https://s3.example.com/temp-put?sig=abc';
const TEMP_KEY = 'temp/rfq/0123456789abcdef/spec.pdf';

function makeFile(name = 'spec.pdf', type = 'application/pdf') {
  return new File(['spec-bytes'], name, { type });
}

type FetchStep = () => unknown;

function stubAttachmentFetch(overrides: { presign?: FetchStep; put?: FetchStep; submit?: FetchStep } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    // Check upload-url first — it also contains the '/api/rfq' substring.
    if (url.includes('/api/rfq/upload-url')) {
      return (overrides.presign?.() ?? {
        ok: true,
        json: async () => ({ success: true, uploadUrl: PRESIGNED_PUT_URL, s3Key: TEMP_KEY, expiresAt: 'x' }),
      }) as Response;
    }
    if (url === PRESIGNED_PUT_URL) {
      return (overrides.put?.() ?? { ok: true, status: 200 }) as Response;
    }
    void init;
    return (overrides.submit?.() ?? {
      ok: true,
      json: async () => ({ referenceNumber: 'RFQ-123456-TEST', rfqId: 'rfq-test' }),
    }) as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function callsTo(fetchMock: ReturnType<typeof stubAttachmentFetch>, match: (url: string) => boolean) {
  return fetchMock.mock.calls.filter(([url]) => match(url as string));
}

async function submitWithFile(file?: File) {
  renderRfq('/request-quote?category=ICP');

  fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Ada Lovelace' } });
  fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'ada@example.edu' } });
  fireEvent.change(screen.getByLabelText(/Institution/i), { target: { value: 'Example Lab' } });
  fireEvent.change(screen.getByLabelText(/Application \/ Research Goal/i), {
    target: { value: 'Deep silicon etching process development for MEMS sensors.' },
  });
  fireEvent.click(screen.getByRole('button', { name: /Continue to Project Details/i }));

  await waitFor(() => {
    expect(screen.getByRole('button', { name: /Request Proposal/i })).toBeInTheDocument();
  });

  if (file) {
    const input = document.getElementById('rfq-file-upload') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(file.name)).toBeInTheDocument();
    });
  }

  fireEvent.click(screen.getByRole('button', { name: /Request Proposal/i }));
}

describe('RFQPage attachments', () => {
  it('uploads the file to S3 and submits its key as attachmentKeys', async () => {
    const fetchMock = stubAttachmentFetch();

    await submitWithFile(makeFile());

    await waitFor(() => {
      expect(callsTo(fetchMock, (u) => u === 'https://api.ninescrolls.com/api/rfq')).toHaveLength(1);
    });

    // 1. Presign request describes the exact file.
    const [, presignInit] = callsTo(fetchMock, (u) => u.includes('/upload-url'))[0];
    expect(JSON.parse((presignInit as RequestInit).body as string)).toMatchObject({
      action: 'getUploadUrl',
      fileName: 'spec.pdf',
      mimeType: 'application/pdf',
    });

    // 2. Bytes go straight to S3 via PUT.
    const [, putInit] = callsTo(fetchMock, (u) => u === PRESIGNED_PUT_URL)[0];
    expect((putInit as RequestInit).method).toBe('PUT');

    // 3. The RFQ itself stays JSON and carries only the key.
    const [, submitInit] = callsTo(fetchMock, (u) => u === 'https://api.ninescrolls.com/api/rfq')[0];
    const init = submitInit as RequestInit;
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(init.body).not.toBeInstanceOf(FormData);
    expect(JSON.parse(init.body as string).attachmentKeys).toEqual([TEMP_KEY]);
  });

  it('never sends multipart/form-data — the body the Lambda cannot parse', async () => {
    const fetchMock = stubAttachmentFetch();

    await submitWithFile(makeFile());

    await waitFor(() => {
      expect(callsTo(fetchMock, (u) => u === 'https://api.ninescrolls.com/api/rfq')).toHaveLength(1);
    });
    for (const [, init] of fetchMock.mock.calls) {
      expect((init as RequestInit | undefined)?.body).not.toBeInstanceOf(FormData);
    }
  });

  it('omits attachmentKeys and skips presigning when no file is attached', async () => {
    const fetchMock = stubAttachmentFetch();

    await submitWithFile();

    await waitFor(() => {
      expect(callsTo(fetchMock, (u) => u === 'https://api.ninescrolls.com/api/rfq')).toHaveLength(1);
    });
    expect(callsTo(fetchMock, (u) => u.includes('/upload-url'))).toHaveLength(0);

    const [, submitInit] = callsTo(fetchMock, (u) => u === 'https://api.ninescrolls.com/api/rfq')[0];
    expect(JSON.parse((submitInit as RequestInit).body as string).attachmentKeys).toBeUndefined();
  });

  it('surfaces the server error and submits nothing when presigning fails', async () => {
    const fetchMock = stubAttachmentFetch({
      presign: () => ({
        ok: false,
        json: async () => ({ success: false, error: 'Unsupported file type: text/html' }),
      }),
    });

    await submitWithFile(makeFile());

    // The { success, error } contract — reading `.message` here would show a generic
    // fallback and hide what the server actually said.
    expect(await screen.findByText(/Unsupported file type: text\/html/i)).toBeInTheDocument();
    expect(callsTo(fetchMock, (u) => u === 'https://api.ninescrolls.com/api/rfq')).toHaveLength(0);
  });

  it('surfaces an error and submits nothing when the S3 upload fails', async () => {
    const fetchMock = stubAttachmentFetch({
      put: () => ({ ok: false, status: 403 }),
    });

    await submitWithFile(makeFile());

    expect(await screen.findByText(/Upload failed for "spec\.pdf"/i)).toBeInTheDocument();
    // Never silently submit an RFQ missing the attachment the user chose.
    expect(callsTo(fetchMock, (u) => u === 'https://api.ninescrolls.com/api/rfq')).toHaveLength(0);
  });

  it('surfaces the server error contract when the RFQ submit itself fails', async () => {
    stubAttachmentFetch({
      submit: () => ({
        ok: false,
        json: async () => ({ success: false, error: 'Invalid equipment category' }),
      }),
    });

    await submitWithFile(makeFile());

    expect(await screen.findByText(/Invalid equipment category/i)).toBeInTheDocument();
  });
});
