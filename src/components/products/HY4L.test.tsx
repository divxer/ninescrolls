import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HY4L } from './HY4L';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage(initialEntry = '/products/hy-4l') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HY4L />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('HY4L redesigned product page', () => {
  it('renders HY-4L through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'HY-4L Compact Plasma Cleaner' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls HY-4L compact plasma cleaner')).toHaveAttribute(
      'src',
      'https://cdn.ninescrolls.com/products/ns-plasma-4r/main.jpg'
    );
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified HY-4L RF and mid-frequency specifications from llms-full', () => {
    renderPage();

    const specs = screen.getByTestId('hy-4l-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Price')).toBeInTheDocument();
    expect(within(specs).getByText('RF $7,999 / MF $6,499')).toBeInTheDocument();
    expect(within(specs).getByText('Chamber')).toBeInTheDocument();
    expect(within(specs).getByText('~4L')).toBeInTheDocument();
    expect(within(specs).getByText('RF Power')).toBeInTheDocument();
    expect(within(specs).getByText('150W @ 13.56 MHz')).toBeInTheDocument();
    expect(within(specs).getByText('MF Power')).toBeInTheDocument();
    expect(within(specs).getByText('300W @ 40 kHz')).toBeInTheDocument();
    expect(within(specs).getByText('Gas Channels')).toBeInTheDocument();
    expect(within(specs).getByText('2 channels')).toBeInTheDocument();
  });

  it('keeps cleaner-family conversion, comparison, and upgrade paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=hy-4l');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=hy-4l');
    expect(screen.getByRole('link', { name: 'Compare Plasma Cleaners' })).toHaveAttribute('href', '/products/plasma-cleaner/compare');
  });

  it('uses cleaner resources and does not claim stripping ownership or unverified research stats', () => {
    renderPage();

    expect(screen.queryByText('Trusted by Leading Research Labs')).not.toBeInTheDocument();
    expect(screen.queryByText('60+')).not.toBeInTheDocument();
    expect(screen.queryByText('2800+')).not.toBeInTheDocument();
    expect(screen.queryByText(/photoresist stripping/i)).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /What Is a Plasma Cleaner/i })).toHaveAttribute(
      'href',
      '/insights/what-is-plasma-cleaner-principles-types'
    );
    expect(screen.getByRole('link', { name: /Plasma Cleaner Buying Guide/i })).toHaveAttribute(
      'href',
      '/insights/plasma-cleaner-buying-guide'
    );
    expect(screen.getByRole('link', { name: /PLUTO vs HY Plasma Cleaners/i })).toHaveAttribute(
      'href',
      '/insights/pluto-vs-hy-plasma-cleaner-comparison'
    );
  });

  it('shows HY-4L product view gallery from verified CDN images', () => {
    renderPage();

    expect(screen.getByTestId('product-detail-gallery')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'HY-4L Product Views' })).toBeInTheDocument();
    expect(screen.getByAltText('HY-4L compact plasma cleaner front three-quarter product view')).toHaveAttribute(
      'src',
      'https://cdn.ninescrolls.com/products/ns-plasma-4r/main.jpg'
    );
    expect(screen.getByAltText('HY-4L compact plasma cleaner angled side product view')).toHaveAttribute(
      'src',
      'https://cdn.ninescrolls.com/products/ns-plasma-4r/image-1.jpg'
    );
    expect(screen.getByAltText('HY-4L compact plasma cleaner rear service-side product view')).toHaveAttribute(
      'src',
      'https://cdn.ninescrolls.com/products/ns-plasma-4r/image-2.jpg'
    );
    expect(screen.getByText('Front view')).toBeInTheDocument();
    expect(screen.getByText('Side view')).toBeInTheDocument();
    expect(screen.getByText('Rear service view')).toBeInTheDocument();
  });

  it('canonicalizes variant routes to the main HY-4L page', async () => {
    renderPage('/products/hy-4l-mf');

    await waitFor(() => {
      expect(document.title).toBe('HY-4L Compact Plasma Cleaner | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/hy-4l'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; image?: string[]; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/hy-4l#product',
      image: ['https://cdn.ninescrolls.com/products/ns-plasma-4r/main.jpg'],
      offers: {
        url: 'https://ninescrolls.com/products/hy-4l',
      },
    });
    expect(productSchema?.image).not.toContain('https://cdn.ninescrolls.com/products/ns-plasma-4r/image-1.jpg');
    expect(productSchema?.image).not.toContain('https://cdn.ninescrolls.com/products/ns-plasma-4r/image-2.jpg');
  });
});
