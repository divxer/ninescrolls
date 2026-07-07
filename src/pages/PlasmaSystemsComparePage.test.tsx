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
    expect(screen.getByText('From $6,499')).toBeInTheDocument();
    expect(screen.getByText('$15,999')).toBeInTheDocument();

    expect(screen.queryByText(/慧仪智控|沛沅仪器|supplier|OEM|distributor/i)).not.toBeInTheDocument();
  });

  it('links every compared model to its product detail page', () => {
    renderComparePage();

    [
      ['HY-4L', '/products/hy-4l'],
      ['PLUTO-T', '/products/pluto-t'],
      ['HY-20L', '/products/hy-20l'],
      ['PLUTO-M', '/products/pluto-m'],
      ['HY-20LRF', '/products/hy-20lrf'],
      ['PLUTO-F', '/products/pluto-f'],
    ].forEach(([name, href]) => {
      expect(screen.getByRole('link', { name: `View ${name}` })).toHaveAttribute('href', href);
    });
  });
});
