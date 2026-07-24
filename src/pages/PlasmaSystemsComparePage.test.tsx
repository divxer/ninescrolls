import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PlasmaSystemsComparePage } from './PlasmaSystemsComparePage';

function renderComparePage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/products/plasma-cleaner/compare']}>
        <PlasmaSystemsComparePage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('PlasmaSystemsComparePage', () => {
  it('renders a cleaner decision matrix without supplier disclosure', () => {
    renderComparePage();

    expect(screen.getByRole('heading', { level: 1, name: 'Compare plasma cleaners by chamber, power, and workflow.' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Side-by-side model matrix' })).toBeInTheDocument();
    expect(screen.getByText('Buy Online')).toBeInTheDocument();
    expect(screen.getByText('$9,999')).toBeInTheDocument();
    expect(screen.getByText('$15,999')).toBeInTheDocument();

    // HY series delisted — the matrix must not surface HY rows or pricing.
    expect(screen.queryByText(/HY-4L|HY-20L|HY-20LRF/)).not.toBeInTheDocument();
    expect(screen.queryByText('From $6,499')).not.toBeInTheDocument();

    expect(screen.queryByText(/慧仪智控|沛沅仪器|supplier|OEM|distributor/i)).not.toBeInTheDocument();
  });

  it('links every compared model to its product detail page', () => {
    renderComparePage();

    [
      ['PLUTO-T', '/products/pluto-t'],
      ['PLUTO-M', '/products/pluto-m'],
      ['PLUTO-F', '/products/pluto-f'],
    ].forEach(([name, href]) => {
      expect(screen.getByRole('link', { name: `View ${name}` })).toHaveAttribute('href', href);
    });
  });
});
