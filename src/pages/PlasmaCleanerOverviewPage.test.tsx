import { render, screen, waitFor } from '@testing-library/react';
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
  it('sets the Sprint 1A CTR title, meta description, visible FAQ, and FAQ schema without dropping ItemList schema', async () => {
    renderPlasmaCleanerOverviewPage();

    await waitFor(() => {
      expect(document.title).toBe('Plasma Cleaner Systems | Benchtop & Floor-Standing RF Plasma Cleaners | Request Pricing | NineScrolls LLC');
    });

    const metaDescription = document.head.querySelector('meta[name="description"]');
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('benchtop and floor-standing'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('request pricing'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('surface activation'));
    expect(metaDescription?.getAttribute('content')).not.toMatch(/online pricing/i);

    const faqHeadings = screen.getAllByRole('heading', { level: 3 }).filter((heading) => heading.textContent?.endsWith('?'));
    expect(faqHeadings).toHaveLength(5);
    expect(screen.getByRole('heading', { level: 3, name: 'How much does a plasma cleaner cost?' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'How do I choose the right benchtop plasma cleaner?' })).toBeInTheDocument();

    const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((script) => JSON.parse(script.textContent || '{}'));

    expect(jsonLd.some((schema) => schema['@type'] === 'ItemList')).toBe(true);
    const faqSchema = jsonLd.find((schema) => schema['@type'] === 'FAQPage');
    expect(faqSchema).toBeTruthy();
    expect(faqSchema.mainEntity).toHaveLength(5);
    expect(faqSchema.mainEntity.map((entry: { name: string }) => entry.name)).toContain('How much does a plasma cleaner cost?');
    expect(faqSchema.mainEntity.map((entry: { name: string }) => entry.name)).toContain('How do I choose the right benchtop plasma cleaner?');
  });

  it('frames the cleaner overview as a buy-online family selector without supplier disclosure', () => {
    renderPlasmaCleanerOverviewPage();

    expect(screen.getByRole('heading', { level: 1, name: /Plasma cleaners for surface activation and lab-scale cleaning/i })).toBeInTheDocument();
    expect(screen.getByText(/Buy online or request an institutional quote/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Choose by chamber size and workflow' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Quick comparison' })).toBeInTheDocument();

    expect(screen.getAllByText('Buy Online')).toHaveLength(3);
    expect(screen.getAllByText('$9,999').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$15,999').length).toBeGreaterThanOrEqual(1);

    // HY series delisted — no HY card, price, or link may survive on the overview.
    expect(screen.queryByText(/HY-4L|HY-20L|HY-20LRF/)).not.toBeInTheDocument();
    expect(screen.queryByText('From $6,499')).not.toBeInTheDocument();

    expect(screen.queryByText(/慧仪智控|沛沅仪器|supplier|OEM|distributor/i)).not.toBeInTheDocument();
  });

  it('uses standardized redesign thumbnails for the cleaner family cards', () => {
    renderPlasmaCleanerOverviewPage();

    const expectedAssets = [
      ['PLUTO-T - 200W RF Plasma Cleaner', '/assets/images/redesign/products/pluto-t-standardized.webp'],
      ['PLUTO-M - 200W RF Plasma Cleaner with 8L Chamber', '/assets/images/redesign/products/pluto-m-standardized.webp'],
      ['PLUTO-F - 500W RF Flagship Plasma Cleaner', '/assets/images/redesign/products/pluto-f-standardized.webp'],
    ];

    expectedAssets.forEach(([alt, src]) => {
      expect(screen.getByAltText(alt)).toHaveAttribute('src', src);
    });
  });
});
