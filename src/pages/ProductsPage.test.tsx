import { render, screen } from '@testing-library/react';
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
      ['HY-20L - Compact RF Plasma Processing System', '/assets/images/redesign/products/hy-20l-standardized.webp'],
      ['HY-4L - Compact RF Plasma System', '/assets/images/redesign/products/hy-4l-standardized.webp'],
      ['HY-20LRF - Research-Grade Batch Plasma Cleaning', '/assets/images/redesign/products/hy-20lrf-standardized.webp'],
      ['PLUTO-T - Compact RF Plasma Cleaner', '/assets/images/redesign/products/pluto-t-standardized.webp'],
      ['PLUTO-M - Mid-Size RF Plasma Cleaner', '/assets/images/redesign/products/pluto-m-standardized.webp'],
      ['PLUTO-F - Flagship RF Plasma Cleaner', '/assets/images/redesign/products/pluto-f-standardized.webp'],
      ['Coater/Developer system for photolithography', '/assets/images/redesign/products/coater-developer-standardized.webp'],
    ];

    expectedAssets.forEach(([alt, src]) => {
      expect(screen.getByAltText(alt)).toHaveAttribute('src', src);
    });
  });
});
