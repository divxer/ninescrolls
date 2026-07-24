import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProductsPage } from './ProductsPage';

function renderProductsPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/products']}>
        <ProductsPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ProductsPage', () => {
  it('presents the product catalog as a process-led platform selector without supplier disclosure', () => {
    renderProductsPage();

    expect(screen.getByRole('heading', { level: 1, name: /Choose the platform that matches your process window/i })).toBeInTheDocument();
    expect(screen.getByText(/Process-led equipment selection/i)).toBeInTheDocument();

    expect(screen.getByRole('heading', { level: 2, name: 'Etching Platforms' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Deposition Platforms' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Lithography & Resist Processing' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Plasma Cleaning Systems' })).toBeInTheDocument();

    expect(screen.queryByText(/Trusted Manufacturer Partner/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Beijing Tailong/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/supplier-provided/i)).not.toBeInTheDocument();
  });

  it('does not claim an unverifiable aggregate citation count', () => {
    renderProductsPage();

    const pageText = document.body.textContent ?? '';
    // The compact trust-signal strip cannot carry the represented-platform
    // qualifier, so a bare "500+ Peer-reviewed publications" tile there is
    // always mis-attributable. It must not render.
    expect(pageText).not.toContain('500+');
    expect(pageText).not.toContain('Peer-reviewed publications');
  });

  it('distinguishes RFQ platforms from buy-online plasma cleaners', () => {
    renderProductsPage();

    expect(screen.getAllByText('RFQ Platform').length).toBeGreaterThanOrEqual(10);
    expect(screen.getAllByText('Buy Online').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('$9,999')).toBeInTheDocument();
    expect(screen.getByText('$12,999')).toBeInTheDocument();
    expect(screen.getByText('$15,999')).toBeInTheDocument();

    // HY series delisted — no HY card may remain in the catalog.
    expect(screen.queryByText(/HY-4L|HY-20L|HY-20LRF/)).not.toBeInTheDocument();
    expect(screen.queryByText('From $6,499')).not.toBeInTheDocument();
  });

  it('filters the catalog by process family', async () => {
    const user = userEvent.setup();
    renderProductsPage();

    await user.click(screen.getByRole('button', { name: 'Deposition' }));

    expect(screen.getByRole('heading', { level: 3, name: 'PECVD' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'ALD' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'ICP-RIE' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'HY-4L' })).not.toBeInTheDocument();
  });

  it('uses standardized redesign thumbnails for every product card', () => {
    renderProductsPage();

    const expectedAssets = [
      ['ICP‑RIE plasma etching system in cleanroom', '/assets/images/redesign/products/icp-rie-standardized.webp'],
      ['Reactive Ion Etching system (RIE) for anisotropic etch', '/assets/images/redesign/products/rie-standardized.webp'],
      ['Compact RIE Etcher (SV-RIE) - compact reactive ion etching system', '/assets/images/redesign/products/compact-rie-standardized.webp'],
      ['HDP‑CVD system for high‑density plasma chemical vapor deposition', '/assets/images/redesign/products/hdp-cvd-standardized.webp'],
      ['PECVD thin film deposition system', '/assets/images/redesign/products/pecvd-standardized.webp'],
      ['Atomic Layer Deposition (ALD) system', '/assets/images/redesign/products/ald-standardized.webp'],
      ['Sputter deposition system for high‑quality PVD coatings', '/assets/images/redesign/products/sputter-standardized.webp'],
      ['MEB-600 e-beam and thermal evaporation system for IR and photonic thin films', '/assets/images/redesign/products/e-beam-standardized.webp'],
      ['Ion Beam Etching (IBE/RIBE) system for directional etch', '/assets/images/redesign/products/ibe-ribe-standardized.webp'],
      ['Plasma photoresist stripping system', '/assets/images/redesign/products/striper-standardized.webp'],
      ['PLUTO-T - Compact RF Plasma Cleaner', '/assets/images/redesign/products/pluto-t-standardized.webp'],
      ['PLUTO-M - Mid-Size RF Plasma Cleaner', '/assets/images/redesign/products/pluto-m-standardized.webp'],
      ['PLUTO-F - Flagship RF Plasma Cleaner', '/assets/images/redesign/products/pluto-f-standardized.webp'],
      ['Coater/Developer system for photolithography', '/assets/images/redesign/products/coater-developer-standardized.webp'],
    ];

    expectedAssets.forEach(([alt, src]) => {
      expect(screen.getByAltText(alt)).toHaveAttribute('src', src);
    });
  });

  it('lists the wafer probe stations category card linking to the capability hub', () => {
    renderProductsPage();
    const card = screen.getByRole('link', { name: /Wafer Probe Stations/i });
    expect(card).toHaveAttribute('href', '/wafer-probe-stations');
  });
});
