import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { IBERIBESystem } from './IBERIBESystem';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <IBERIBESystem />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('IBERIBESystem redesigned product page', () => {
  it('renders IBE/RIBE through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'IBE/RIBE Ion Beam Etching Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls IBE/RIBE ion beam etching platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/ibe-ribe-standardized.webp'
    );
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified IBE/RIBE specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('ibe-ribe-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Ion Source')).toBeInTheDocument();
    expect(within(specs).getByText('Kaufman <=6 in / RF <=12 in')).toBeInTheDocument();
    expect(within(specs).getByText('Tilt Angle')).toBeInTheDocument();
    expect(within(specs).getByText('0-90 deg')).toBeInTheDocument();
    expect(within(specs).getByText('Rotation')).toBeInTheDocument();
    expect(within(specs).getByText('1-10 rpm')).toBeInTheDocument();
    expect(within(specs).getByText('Base Pressure')).toBeInTheDocument();
    expect(within(specs).getByText('<7x10^-7 Torr')).toBeInTheDocument();
    expect(within(specs).getByText('Uniformity')).toBeInTheDocument();
    expect(within(specs).getByText('<5% non-uniformity')).toBeInTheDocument();
  });

  it('keeps IBE/RIBE conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=ibe-ribe');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=ibe-ribe');
    expect(screen.getByRole('link', { name: 'Compare RIE Etching' })).toHaveAttribute('href', '/products/rie-etcher');
  });

  it('uses real IBE/RIBE-related resource slugs', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Ion Beam Etching \(IBE\) & RIBE Guide/i })).toHaveAttribute(
      'href',
      '/insights/ion-beam-etching-ribe-guide'
    );
    expect(screen.getByRole('link', { name: /RIE vs Ion Milling/i })).toHaveAttribute(
      'href',
      '/insights/reactive-ion-etching-vs-ion-milling'
    );
    expect(screen.getByRole('link', { name: /Metal Etching Complete Guide/i })).toHaveAttribute(
      'href',
      '/insights/metal-etching-complete-guide'
    );
  });

  it('derives title, canonical, and product schema URLs from the IBE/RIBE slug', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('IBE/RIBE Ion Beam Etching Platform | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/ibe-ribe'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/ibe-ribe#product',
      offers: {
        url: 'https://ninescrolls.com/products/ibe-ribe',
      },
    });
  });
});
