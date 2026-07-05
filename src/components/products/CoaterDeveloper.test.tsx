import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CoaterDeveloper } from './CoaterDeveloper';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <CoaterDeveloper />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('CoaterDeveloper redesigned product page', () => {
  it('renders Coater/Developer through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Coater/Developer Photolithography Track Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls coater developer photolithography track system')).toHaveAttribute(
      'src',
      'https://cdn.ninescrolls.com/products/coater-developer/main.jpg'
    );
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified Coater/Developer specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('coater-developer-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('Pieces to 12 in')).toBeInTheDocument();
    expect(within(specs).getByText('Coater Speed')).toBeInTheDocument();
    expect(within(specs).getByText('Up to 8000 rpm +/-1 rpm')).toBeInTheDocument();
    expect(within(specs).getByText('Developer Speed')).toBeInTheDocument();
    expect(within(specs).getByText('Up to 5000 rpm +/-1 rpm')).toBeInTheDocument();
    expect(within(specs).getByText('Hotplate')).toBeInTheDocument();
    expect(within(specs).getByText('RT to 200 C')).toBeInTheDocument();
    expect(within(specs).getByText('Film Uniformity')).toBeInTheDocument();
    expect(within(specs).getByText('<0.5% 3 sigma')).toBeInTheDocument();
  });

  it('keeps Coater/Developer conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=coater-developer');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=coater-developer');
    expect(screen.getByRole('link', { name: 'Compare Striper' })).toHaveAttribute('href', '/products/striper');
  });

  it('uses real lithography resource slugs and omits unverified research claims', () => {
    renderPage();

    expect(screen.queryByText('Trusted by Leading Research Labs')).not.toBeInTheDocument();
    expect(screen.queryByText('60+')).not.toBeInTheDocument();
    expect(screen.queryByText('2800+')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /Coater\/Developer Equipment Guide/i })).toHaveAttribute(
      'href',
      '/insights/coater-developer-systems-equipment-guide'
    );
    expect(screen.getByRole('link', { name: /Spin Coating & Development Guide/i })).toHaveAttribute(
      'href',
      '/insights/spin-coating-development-guide'
    );
    expect(screen.getByRole('link', { name: /Lithography Process Integration/i })).toHaveAttribute(
      'href',
      '/insights/lithography-process-integration-guide'
    );
  });

  it('derives title, canonical, product schema URLs, and schema image from the Coater/Developer config', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('Coater/Developer Photolithography Track Platform | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/coater-developer'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; image?: string[]; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/coater-developer#product',
      image: ['https://cdn.ninescrolls.com/products/coater-developer/main.jpg'],
      offers: {
        url: 'https://ninescrolls.com/products/coater-developer',
      },
    });
  });
});
