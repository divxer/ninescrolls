import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ALDSystem } from './ALDSystem';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ALDSystem />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ALDSystem redesigned product page', () => {
  it('renders ALD through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'ALD Atomic Layer Deposition Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls ALD atomic layer deposition platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/ald-standardized.webp'
    );
    expect(screen.getByRole('heading', { level: 3, name: 'What is atomic layer deposition and how does it work?' })).toBeInTheDocument();
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified ALD specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('ald-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('4-12 in')).toBeInTheDocument();
    expect(within(specs).getByText('Wafer Temperature')).toBeInTheDocument();
    expect(within(specs).getByText('20 to 400 C')).toBeInTheDocument();
    expect(within(specs).getByText('Growth Rate')).toBeInTheDocument();
    expect(within(specs).getByText('0.5-2 A/cycle')).toBeInTheDocument();
    expect(within(specs).getByText('Uniformity')).toBeInTheDocument();
    expect(within(specs).getByText('<1%')).toBeInTheDocument();
    expect(within(specs).getByText('Step Coverage')).toBeInTheDocument();
    expect(within(specs).getByText('>98%')).toBeInTheDocument();
    expect(within(specs).getByText('Precursor Lines')).toBeInTheDocument();
    expect(within(specs).getByText('2-6 lines')).toBeInTheDocument();
    expect(within(specs).getByText('Remote Plasma')).toBeInTheDocument();
    expect(within(specs).getByText('300-1000 W optional')).toBeInTheDocument();
  });

  it('keeps ALD conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=ald');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=ald');
    expect(screen.getByRole('link', { name: 'Compare PECVD' })).toHaveAttribute('href', '/products/pecvd');
  });

  it('uses real ALD-related resource slugs', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Atomic Layer Deposition Guide/i })).toHaveAttribute(
      'href',
      '/insights/atomic-layer-deposition-ald-comprehensive-guide'
    );
    expect(screen.getByRole('link', { name: /PECVD vs ALD vs Sputtering/i })).toHaveAttribute(
      'href',
      '/insights/pecvd-vs-ald-vs-sputtering-comparison'
    );
    expect(screen.getByRole('link', { name: /2D Materials Device Fabrication/i })).toHaveAttribute(
      'href',
      '/insights/2d-materials-device-fabrication-guide'
    );
  });

  it('derives title, canonical, and product schema URLs from the ALD slug', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('ALD Atomic Layer Deposition Platform | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/ald'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/ald#product',
      offers: {
        url: 'https://ninescrolls.com/products/ald',
      },
    });
  });
});
