import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { PlasmaCleanerOverviewPage } from './PlasmaCleanerOverviewPage';

function renderPlasmaCleanerOverviewPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/products/plasma-cleaner']}>
        <PlasmaCleanerOverviewPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('PlasmaCleanerOverviewPage', () => {
  it('uses standardized redesign thumbnails for the cleaner family cards', () => {
    renderPlasmaCleanerOverviewPage();

    const expectedAssets = [
      ['HY-4L - Compact RF/MF Plasma Cleaner', '/assets/images/redesign/products/hy-4l-standardized.webp'],
      ['PLUTO-T - 200W RF Plasma Cleaner', '/assets/images/redesign/products/pluto-t-standardized.webp'],
      ['HY-20L - Research-Grade Batch Plasma Processing System', '/assets/images/redesign/products/hy-20l-standardized.webp'],
      ['PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber', '/assets/images/redesign/products/pluto-m-standardized.webp'],
      ['HY-20LRF - Integrated RF Vacuum Plasma Cleaner', '/assets/images/redesign/products/hy-20lrf-standardized.webp'],
      ['PLUTO-F - 500W RF Flagship Plasma Cleaner', '/assets/images/redesign/products/pluto-f-standardized.webp'],
    ];

    expectedAssets.forEach(([alt, src]) => {
      expect(screen.getByAltText(alt)).toHaveAttribute('src', src);
    });
  });
});
