import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProductDetailPage } from './ProductDetailPage';
import type { ProductDetailConfig } from './ProductDetailPage.types';
import { icpEtcherConfig } from './productDetailConfigs/icpEtcherConfig';

const { addToCart } = vi.hoisted(() => ({
  addToCart: vi.fn(),
}));

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

function renderTemplate() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ProductDetailPage config={icpEtcherConfig} />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}

describe('ProductDetailPage template', () => {
  it('renders ICP-RIE from a product detail config', async () => {
    renderTemplate();

    expect(screen.getByRole('heading', { level: 1, name: 'ICP-RIE Plasma Etching Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls ICP-RIE plasma etching platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/icp-rie-standardized.webp'
    );
    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=icp-etcher');
    await waitFor(() => {
      expect(getProductJsonLd().offers).toMatchObject({
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        url: 'https://ninescrolls.com/products/icp-etcher',
      });
    });
  });

  it('keeps the template landmark and specification semantics safe for product clones', () => {
    renderTemplate();

    expect(document.body.querySelector('main')).not.toBeInTheDocument();

    const specs = screen.getByTestId('icp-rie-specifications');
    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size').closest('dl')).toBe(specs);
  });

  it('uses product-specific resource destinations from config', () => {
    renderTemplate();

    expect(screen.getByRole('link', { name: /Diamond Processing/i })).toHaveAttribute(
      'href',
      '/insights/diamond-semiconductor-processing-icp-etching-deposition'
    );
  });

  it('allows product configs to omit research and resource sections', () => {
    const { research: _research, resources: _resources, ...baseConfig } = icpEtcherConfig;
    const configWithoutOptionalSections: ProductDetailConfig = {
      ...baseConfig,
      slug: 'minimal-platform',
      hero: {
        ...baseConfig.hero,
        title: 'Minimal Platform',
        backgroundImage: '/assets/images/redesign/products/rie-standardized.webp',
      },
      finalCta: {
        ...baseConfig.finalCta,
        backgroundImage: '/assets/images/redesign/products/rie-standardized.webp',
      },
    };

    const { container } = render(
      <HelmetProvider>
        <MemoryRouter>
          <ProductDetailPage config={configWithoutOptionalSections} />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'Minimal Platform' })).toBeInTheDocument();
    expect(screen.queryByText('Research Validation')).not.toBeInTheDocument();
    expect(screen.queryByText('Related Resources')).not.toBeInTheDocument();
    expect(screen.queryByTestId('product-commerce-panel')).not.toBeInTheDocument();
    expect(screen.queryByText('Product Views')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="product-detail-hero-background"]')).toHaveStyle({
      backgroundImage:
        "linear-gradient(90deg,rgba(7,10,15,1) 0%,rgba(7,10,15,0.94) 42%,rgba(7,10,15,0.55) 100%),url('/assets/images/redesign/products/rie-standardized.webp')",
    });
  });

  it('renders commerce controls and gallery only when configured', () => {
    const commerceConfig: ProductDetailConfig = {
      ...icpEtcherConfig,
      slug: 'commerce-prototype',
      commerce: {
        variants: [
          { sku: 'commerce-rf', label: 'RF (13.56 MHz)', price: 7999 },
          { sku: 'commerce-mf', label: 'Mid-Frequency (40 kHz)', price: 6499 },
        ],
        quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=commerce-prototype' },
      },
      gallery: {
        eyebrow: 'System Views',
        heading: 'Product Views',
        copy: 'Use these actual system photos to review the compact enclosure.',
        images: [
          {
            src: 'https://cdn.ninescrolls.com/products/ns-plasma-4r/main.jpg',
            alt: 'Commerce prototype front view',
            label: 'Front view',
            width: 1024,
            height: 666,
          },
        ],
      },
    };

    render(
      <HelmetProvider>
        <MemoryRouter>
          <ProductDetailPage config={commerceConfig} />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(screen.getByTestId('product-commerce-panel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Product Views' })).toBeInTheDocument();
    expect(screen.getByAltText('Commerce prototype front view')).toHaveAttribute(
      'src',
      'https://cdn.ninescrolls.com/products/ns-plasma-4r/main.jpg'
    );
  });

  it('uses AggregateOffer for multi-variant commerce products', async () => {
    const commerceConfig: ProductDetailConfig = {
      ...icpEtcherConfig,
      slug: 'hy-4l',
      schema: {
        ...icpEtcherConfig.schema,
        name: 'HY-4L Plasma Cleaner',
        sku: 'hy-4l',
      },
      commerce: {
        variants: [
          { sku: 'hy-4l-rf', label: 'RF (13.56 MHz)', price: 7999 },
          { sku: 'hy-4l-mf', label: 'Mid-Frequency (40 kHz)', price: 6499 },
        ],
        quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-4l' },
      },
    };

    render(
      <HelmetProvider>
        <MemoryRouter>
          <ProductDetailPage config={commerceConfig} />
        </MemoryRouter>
      </HelmetProvider>
    );

    await waitFor(() => {
      expect(getProductJsonLd().offers).toMatchObject({
        '@type': 'AggregateOffer',
        lowPrice: '6499',
        highPrice: '7999',
        offerCount: 2,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: 'https://ninescrolls.com/products/hy-4l',
      });
    });
    expect(getProductJsonLd().offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
