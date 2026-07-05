import { render, screen, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProductDetailPage } from './ProductDetailPage';
import type { ProductDetailConfig } from './ProductDetailPage.types';
import { icpEtcherConfig } from './productDetailConfigs/icpEtcherConfig';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
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

describe('ProductDetailPage template', () => {
  it('renders ICP-RIE from a product detail config', () => {
    renderTemplate();

    expect(screen.getByRole('heading', { level: 1, name: 'ICP-RIE Plasma Etching Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls ICP-RIE plasma etching platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/icp-rie-standardized.webp'
    );
    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=icp-etcher');
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

  it('allows product configs to omit optional sections', () => {
    const { research: _research, resources: _resources, gallery: _gallery, ...baseConfig } = icpEtcherConfig;
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
    expect(screen.queryByTestId('product-detail-gallery')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="product-detail-hero-background"]')).toHaveStyle({
      backgroundImage:
        "linear-gradient(90deg,rgba(7,10,15,1) 0%,rgba(7,10,15,0.94) 42%,rgba(7,10,15,0.55) 100%),url('/assets/images/redesign/products/rie-standardized.webp')",
    });
  });

  it('renders optional product gallery images when configured', () => {
    const configWithGallery: ProductDetailConfig = {
      ...icpEtcherConfig,
      gallery: {
        eyebrow: 'Product Views',
        heading: 'System Details',
        copy: 'Inspect the process chamber and service-side interfaces before configuration review.',
        images: [
          {
            src: 'https://cdn.ninescrolls.com/products/example/front.jpg',
            alt: 'ICP-RIE front view with chamber door and HMI',
            label: 'Front view',
            width: 1024,
            height: 768,
          },
          {
            src: '/assets/images/redesign/products/example-rear.webp',
            alt: 'ICP-RIE rear panel with gas and vacuum connections',
            label: 'Rear panel',
            width: 1024,
            height: 700,
          },
        ],
      },
    };

    render(
      <HelmetProvider>
        <MemoryRouter>
          <ProductDetailPage config={configWithGallery} />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(screen.getByTestId('product-detail-gallery')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'System Details' })).toBeInTheDocument();
    expect(screen.getByText('Inspect the process chamber and service-side interfaces before configuration review.')).toBeInTheDocument();
    expect(screen.getByAltText('ICP-RIE front view with chamber door and HMI')).toHaveAttribute(
      'src',
      'https://cdn.ninescrolls.com/products/example/front.jpg'
    );
    expect(screen.getByAltText('ICP-RIE rear panel with gas and vacuum connections')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/example-rear.webp'
    );
    expect(screen.getByText('Front view')).toBeInTheDocument();
    expect(screen.getByText('Rear panel')).toBeInTheDocument();
  });
});
