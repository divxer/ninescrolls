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

vi.mock('../../services/evidenceService', () => ({
  fetchPublishedEvidence: vi.fn().mockResolvedValue([{ id: '1', type: 'application_note' }]),
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

function getFaqJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'FAQPage');
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

    expect(screen.getByRole('link', { name: /Learn ICP-RIE Technology/i })).toHaveAttribute(
      'href',
      '/insights/icp-rie-technology-advanced-etching'
    );
    expect(screen.getByRole('link', { name: /Compare ICP-RIE vs RIE/i })).toHaveAttribute(
      'href',
      '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching'
    );
    expect(screen.getByRole('link', { name: /Deep Silicon Bosch Process/i })).toHaveAttribute(
      'href',
      '/insights/deep-reactive-ion-etching-bosch-process'
    );
    expect(screen.getByRole('link', { name: /Diamond Semiconductor Processing/i })).toHaveAttribute(
      'href',
      '/insights/diamond-semiconductor-processing-icp-etching-deposition'
    );
  });

  it('renders visible FAQ content from the same source as FAQPage schema', async () => {
    renderTemplate();

    expect(screen.getByRole('heading', { level: 2, name: 'Frequently Asked Questions' })).toBeInTheDocument();

    await waitFor(() => {
      expect(getFaqJsonLd()).toBeTruthy();
    });
    const faqSchema = getFaqJsonLd();
    expect(faqSchema.mainEntity).toHaveLength(icpEtcherConfig.faq.length);

    for (const item of icpEtcherConfig.faq) {
      expect(screen.getByRole('heading', { level: 3, name: item.question })).toBeInTheDocument();
      expect(screen.getByText(item.answer)).toBeInTheDocument();
    }

    expect(faqSchema.mainEntity.map((entry: { name: string }) => entry.name)).toEqual(
      icpEtcherConfig.faq.map(item => item.question)
    );
    expect(
      faqSchema.mainEntity.map((entry: { acceptedAnswer: { text: string } }) => entry.acceptedAnswer.text)
    ).toEqual(icpEtcherConfig.faq.map(item => item.answer));
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

  it('omits visible FAQ and FAQPage schema when a future config has no FAQ items', async () => {
    const configWithoutFaq: ProductDetailConfig = {
      ...icpEtcherConfig,
      slug: 'no-faq-platform',
      faq: [],
      hero: {
        ...icpEtcherConfig.hero,
        title: 'No FAQ Platform',
      },
    };

    render(
      <HelmetProvider>
        <MemoryRouter>
          <ProductDetailPage config={configWithoutFaq} />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(screen.getByRole('heading', { level: 1, name: 'No FAQ Platform' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: 'Frequently Asked Questions' })).not.toBeInTheDocument();
    await waitFor(() => {
      expect(getProductJsonLd()).toBeTruthy();
    });
    expect(getFaqJsonLd()).toBeUndefined();
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

  it('uses a real-price Offer for single-variant commerce products', async () => {
    const commerceConfig: ProductDetailConfig = {
      ...icpEtcherConfig,
      slug: 'single-commerce',
      commerce: {
        variants: [
          { sku: 'single-commerce-rf', label: 'RF (13.56 MHz)', price: 14999 },
        ],
        quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=single-commerce' },
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
        '@type': 'Offer',
        price: '14999',
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        url: 'https://ninescrolls.com/products/single-commerce',
      });
    });
    expect(getProductJsonLd().offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(getProductJsonLd().offers).not.toHaveProperty('lowPrice');
    expect(getProductJsonLd().offers).not.toHaveProperty('offerCount');
  });

  it('renders the Evidence module after applications and before the gallery', async () => {
    const configWithGallery: ProductDetailConfig = {
      ...icpEtcherConfig,
      gallery: {
        heading: 'Gallery Fixture',
        images: [{ src: '/x.webp', alt: 'x', width: 100, height: 100 }],
      },
    };
    const { getByTestId, findByText, getByText } = render(
      <HelmetProvider>
        <MemoryRouter>
          <ProductDetailPage config={configWithGallery} />
        </MemoryRouter>
      </HelmetProvider>
    );

    const evidence = await findByText('Evidence');
    const evidenceSection = getByTestId('product-evidence');
    const applications = getByTestId('product-applications');
    const gallery = getByText('Gallery Fixture');

    expect(applications.compareDocumentPosition(evidenceSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(evidenceSection.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(evidence).toBeInTheDocument();
  });
});
