import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RFQPage } from './RFQPage';
import { parseRfqUrlParams } from './rfqUrlParams';

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
