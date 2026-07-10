import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RIEEtcher } from './RIEEtcher';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <RIEEtcher />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('RIEEtcher redesigned product page', () => {
  it('renders RIE through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'RIE Plasma Etching Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls RIE etcher platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/rie-standardized.webp'
    );
    expect(screen.getByRole('heading', { level: 3, name: 'What materials can the RIE platform process?' })).toBeInTheDocument();
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified RIE specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('rie-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('4-12 in')).toBeInTheDocument();
    expect(within(specs).getByText('RF Power')).toBeInTheDocument();
    expect(within(specs).getByText('300-1000 W')).toBeInTheDocument();
    expect(within(specs).getByText('Gas System')).toBeInTheDocument();
    expect(within(specs).getByText('4 gas lines')).toBeInTheDocument();
  });

  it('keeps RIE conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=rie-etcher');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=rie-etcher');
    expect(screen.getByRole('link', { name: 'Compare ICP-RIE' })).toHaveAttribute('href', '/products/icp-etcher');
  });

  it('uses real RIE-related resource slugs', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Reactive Ion Etching Guide/i })).toHaveAttribute(
      'href',
      '/insights/reactive-ion-etching-guide'
    );
    expect(screen.getByRole('link', { name: /PE vs RIE vs ICP-RIE/i })).toHaveAttribute(
      'href',
      '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching'
    );
    expect(screen.getByRole('link', { name: /RIE vs Ion Milling/i })).toHaveAttribute(
      'href',
      '/insights/reactive-ion-etching-vs-ion-milling'
    );
  });

  it('does not duplicate the brand in the SEO title', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('RIE Plasma Etching Platform | NineScrolls LLC');
    });
  });

  it('keeps the RIE meta description scoped to RIE selection intent', async () => {
    renderPage();

    await waitFor(() => {
      const metaDescription = document.head.querySelector('meta[name="description"]');
      expect(metaDescription).toHaveAttribute('content', expect.stringContaining('Reactive ion etching platform'));
      expect(metaDescription?.getAttribute('content')).not.toContain('ICP-RIE etching system');
    });
  });

  it('derives canonical and product schema URLs from the RIE slug', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/rie-etcher'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/rie-etcher#product',
      offers: {
        url: 'https://ninescrolls.com/products/rie-etcher',
      },
    });
  });
});
