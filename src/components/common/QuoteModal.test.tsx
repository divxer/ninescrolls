import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { QuoteModal } from './QuoteModal';

vi.mock('../../hooks/useCombinedAnalytics', () => ({
  useCombinedAnalytics: () => ({
    trackRFQSubmission: vi.fn(),
    segment: { trackRFQSubmissionWithAnalysis: vi.fn() },
  }),
}));

vi.mock('../../services/analyticsStorageService', () => ({ getVisitorId: () => 'visitor-test' }));

function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText(/Enter your full name/i), { target: { value: 'Ada Lovelace' } });
  fireEvent.change(screen.getByPlaceholderText(/Enter your email address/i), { target: { value: 'ada@example.edu' } });
  fireEvent.change(screen.getByPlaceholderText(/specific requirements/i), {
    target: { value: 'Requesting a budgetary quote for an ICP etcher.' },
  });
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.unstubAllGlobals());

describe('QuoteModal submission errors', () => {
  it('surfaces the field-level validation detail from the /api/rfq rejection', async () => {
    // Real 400 shape from submit-rfq/handler.ts — `error` + `details[]`, no `message`.
    // Reading `data?.error` alone dropped the field detail and showed a bare "Failed".
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({
        success: false,
        error: 'Validation failed',
        details: [{ field: 'email', message: 'Invalid email address' }],
      }),
    })));

    render(<QuoteModal isOpen onClose={() => {}} productName="ICP Etcher" />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Submit Request/i }));

    expect(await screen.findByText(/Validation failed — email: Invalid email address/i)).toBeInTheDocument();
  });

  it('surfaces the server error when the rejection carries no field details', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => ({ success: false, error: 'Internal server error. Please try again later.' }),
    })));

    render(<QuoteModal isOpen onClose={() => {}} productName="ICP Etcher" />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Submit Request/i }));

    expect(await screen.findByText(/Internal server error\. Please try again later\./i)).toBeInTheDocument();
  });

  it('falls back to a generic message when the error body is unparseable', async () => {
    // response.json() rejects on an HTML 502; the component catches it as null.
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
    })));

    render(<QuoteModal isOpen onClose={() => {}} productName="ICP Etcher" />);
    fillRequired();
    fireEvent.click(screen.getByRole('button', { name: /Submit Request/i }));

    expect(await screen.findByText(/Failed to submit request\. Please try again\./i)).toBeInTheDocument();
  });
});
