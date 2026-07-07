import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HDPCVDSystem } from './HDPCVDSystem';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <HDPCVDSystem />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('HDPCVDSystem redesigned product page', () => {
  it('renders HDP-CVD through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'HDP-CVD Gap-Fill Deposition Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls HDP-CVD high-density plasma CVD platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/hdp-cvd-standardized.webp'
    );
    expect(screen.getByRole('heading', { level: 3, name: 'What is HDP-CVD used for?' })).toBeInTheDocument();
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified HDP-CVD specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('hdp-cvd-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('4-12 in')).toBeInTheDocument();
    expect(within(specs).getByText('Source RF')).toBeInTheDocument();
    expect(within(specs).getByText('1000-3000 W')).toBeInTheDocument();
    expect(within(specs).getByText('Bias RF')).toBeInTheDocument();
    expect(within(specs).getByText('300-1000 W')).toBeInTheDocument();
    expect(within(specs).getByText('Temperature')).toBeInTheDocument();
    expect(within(specs).getByText('20 to 200 C')).toBeInTheDocument();
    expect(within(specs).getByText('Gas System')).toBeInTheDocument();
    expect(within(specs).getByText('6 gas lines')).toBeInTheDocument();
    expect(within(specs).getByText('Uniformity')).toBeInTheDocument();
    expect(within(specs).getByText('<5%')).toBeInTheDocument();
  });

  it('keeps HDP-CVD conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=hdp-cvd');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=hdp-cvd');
    expect(screen.getByRole('link', { name: 'Compare PECVD' })).toHaveAttribute('href', '/products/pecvd');
  });

  it('uses real HDP-CVD resource slugs and omits unverified research claims', () => {
    renderPage();

    expect(screen.queryByText('Trusted by Leading Research Labs')).not.toBeInTheDocument();
    expect(screen.queryByText('60+')).not.toBeInTheDocument();
    expect(screen.queryByText('2800+')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: /HDP-CVD In-Depth Guide/i })).toHaveAttribute(
      'href',
      '/insights/hdp-cvd-in-depth-guide-practical-handbook'
    );
    expect(screen.getByRole('link', { name: /HDP-CVD Applications/i })).toHaveAttribute(
      'href',
      '/insights/hdp-cvd-applications-gap-fill-dielectrics'
    );
    expect(screen.getByRole('link', { name: /PECVD vs ALD vs Sputtering/i })).toHaveAttribute(
      'href',
      '/insights/pecvd-vs-ald-vs-sputtering-comparison'
    );
  });

  it('derives title, canonical, product schema URLs, and schema image from the HDP-CVD config', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('HDP-CVD Gap-Fill Deposition Platform | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/hdp-cvd'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; image?: string[]; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/hdp-cvd#product',
      image: ['https://ninescrolls.com/assets/images/redesign/products/hdp-cvd-standardized.webp'],
      offers: {
        url: 'https://ninescrolls.com/products/hdp-cvd',
      },
    });
  });
});
