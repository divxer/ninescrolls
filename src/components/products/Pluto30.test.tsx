import { render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { Pluto30 } from './Pluto30';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <Pluto30 />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('Pluto30 product page', () => {
  it('renders PLUTO-30 through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'PLUTO-30 Batch RF Plasma System' })).toBeInTheDocument();
    expect(screen.getByAltText('PLUTO-30 batch RF plasma system')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/pluto-30-standardized.webp'
    );
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses PLUTO-30 specifications reconciled to the OEM spec sheet', () => {
    renderPage();

    const specs = screen.getByTestId('pluto-30-specifications');
    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('30 L, 300 x 280 x 366 mm')).toBeInTheDocument();
    expect(within(specs).getByText('30 mm')).toBeInTheDocument();
    expect(within(specs).getByText('500 W, 13.56 MHz auto-match')).toBeInTheDocument();
    expect(within(specs).getByText('706 x 804 x 735 mm')).toBeInTheDocument();
  });

  it('keeps PLUTO-30 quote conversion paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=pluto-30');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=pluto-30');
  });
});
