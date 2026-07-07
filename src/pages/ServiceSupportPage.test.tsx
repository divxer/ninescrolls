import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ServiceSupportPage } from './ServiceSupportPage';

function renderServiceSupport() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ServiceSupportPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ServiceSupportPage', () => {
  it('presents support as an engineering service path with verified warranty copy only', () => {
    renderServiceSupport();

    expect(screen.getByRole('heading', { name: /Service support for process equipment/i })).toBeInTheDocument();
    expect(screen.getAllByText(/2-year standard warranty/i).length).toBeGreaterThanOrEqual(1);
    const serviceQuoteLinks = screen.getAllByRole('link', { name: /Request Service Quote/i });
    expect(serviceQuoteLinks.length).toBeGreaterThanOrEqual(1);
    serviceQuoteLinks.forEach((link) => {
      expect(link).toHaveAttribute('href', '/contact?topic=service');
    });
    expect(document.body).not.toHaveTextContent(/double the industry norm/i);
    expect(document.body).not.toHaveTextContent(/most major manufacturers/i);
    expect(document.body).not.toHaveTextContent(/competitor data/i);
  });
});
