import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { ContactPage } from './ContactPage';

// ContactFormInline drags in analytics + amplify; stub it so these tests
// stay focused on ContactPage's routing / hook-order behavior.
vi.mock('../components/common/ContactFormInline', () => ({
  ContactFormInline: () => <div data-testid="contact-form" />,
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
