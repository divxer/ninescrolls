import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ContactPage } from './ContactPage';

// ContactFormInline drags in analytics + amplify; stub it so these tests
// stay focused on ContactPage's routing / hook-order behavior.
vi.mock('../components/common/ContactFormInline', () => ({
  ContactFormInline: ({ inquiryType, prefillEmail }: { inquiryType?: string; prefillEmail?: string }) => (
    <div data-testid="contact-form" data-inquiry-type={inquiryType || ''} data-prefill-email={prefillEmail || ''} />
  ),
}));

function renderAt(initialEntry: string, extra?: React.ReactNode) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        {extra}
        <Routes>
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/request-quote" element={<div>RFQ PAGE</div>} />
        </Routes>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ContactPage', () => {
  it('renders the contact form for a normal topic without redirecting', () => {
    renderAt('/contact?topic=expert');
    expect(screen.getByTestId('contact-form')).toBeInTheDocument();
    expect(screen.queryByText('RFQ PAGE')).not.toBeInTheDocument();
  });

  it('redirects to /request-quote when topic=quote on first render', () => {
    renderAt('/contact?topic=quote');
    expect(screen.getByText('RFQ PAGE')).toBeInTheDocument();
    expect(screen.queryByTestId('contact-form')).not.toBeInTheDocument();
  });

  it('selects engineer consultation for topic=expert', () => {
    renderAt('/contact?topic=expert');
    expect(screen.getByTestId('contact-form')).toHaveAttribute('data-inquiry-type', 'engineer');
  });

  it('selects feasibility for topic=application', () => {
    renderAt('/contact?topic=application');
    expect(screen.getByTestId('contact-form')).toHaveAttribute('data-inquiry-type', 'feasibility');
  });

  it('passes email query prefill to the inline form', () => {
    renderAt('/contact?topic=expert&email=buyer%40lab.edu');
    expect(screen.getByTestId('contact-form')).toHaveAttribute('data-prefill-email', 'buyer@lab.edu');
  });

  it('presents the redesigned engineering contact entry points without breaking the form contract', () => {
    renderAt('/contact?topic=expert&email=buyer%40lab.edu');

    expect(screen.getByRole('heading', { name: /Talk to a NineScrolls engineer/i })).toBeInTheDocument();
    expect(screen.getByText('San Diego based')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Request Quote/i })).toHaveAttribute('href', '/request-quote');
    expect(screen.getByTestId('contact-form')).toHaveAttribute('data-inquiry-type', 'engineer');
    expect(screen.getByTestId('contact-form')).toHaveAttribute('data-prefill-email', 'buyer@lab.edu');
  });

  // Regression for the hooks-order bug: the conditional `return <Navigate>`
  // used to sit before two useEffect calls, so switching topic from a
  // non-quote value to "quote" on the same component instance changed the
  // number of hooks invoked between renders and crashed React.
  it('handles switching from a non-quote topic to topic=quote without a hook-order crash', async () => {
    const user = userEvent.setup();

    function GoQuote() {
      const navigate = useNavigate();
      return (
        <button type="button" onClick={() => navigate('/contact?topic=quote')}>
          go-quote
        </button>
      );
    }

    renderAt('/contact?topic=expert', <GoQuote />);

    // Starts on the contact form (non-quote topic).
    expect(screen.getByTestId('contact-form')).toBeInTheDocument();

    // Navigating to topic=quote re-renders the SAME ContactPage instance with
    // a different topic. With the bug this threw "rendered fewer hooks than
    // expected"; with the fix it cleanly redirects.
    await user.click(screen.getByText('go-quote'));

    expect(screen.getByText('RFQ PAGE')).toBeInTheDocument();
    expect(screen.queryByTestId('contact-form')).not.toBeInTheDocument();
  });
});
