import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { productLines } from '../../data/probeStations/semishare';
import { SemishareBrandPage } from './SemishareBrandPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/wafer-probe-stations/semishare']}>
        <SemishareBrandPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('SemishareBrandPage', () => {
  it('sets the exact gated-OFF document title', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.title).toBe(
        'SEMISHARE Wafer Probe Stations | US & Canada Sales & Support | NineScrolls LLC'
      );
    });
  });

  it('renders every product line with a spec table or the request-specs fallback', () => {
    renderPage();
    for (const line of productLines) {
      expect(screen.getByRole('heading', { level: 3, name: line.name })).toBeInTheDocument();
    }
    // Traceability lives in the data module; the page must NOT leak visitors
    // to the OEM site — zero outbound semishareprober.com links.
    const oemLinks = Array.from(document.querySelectorAll('a')).filter((a) =>
      (a.getAttribute('href') ?? '').includes('semishareprober.com')
    );
    expect(oemLinks).toHaveLength(0);
    expect(productLines.reduce((n, l) => n + l.specs.length, 0)).toBeGreaterThan(0);
  });

  it('renders the neutral attestation banner, why-NineScrolls section, FAQ, and CTA', () => {
    renderPage();
    expect(
      screen.getByText(/NineScrolls provides US & Canada procurement, import, and support/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Why buy through NineScrolls/i })).toBeInTheDocument();
    expect(screen.getAllByText(/SAM\.gov/).length).toBeGreaterThan(0);
    const faqHeadings = screen.getAllByRole('heading', { level: 3 }).filter((h) => h.textContent?.endsWith('?'));
    expect(faqHeadings.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('link', { name: /Request a quote/i })).toHaveAttribute('href', '/request-quote?products=semishare-probe-station');
  });

  it('sources peer-reviewed research from the Evidence framework (dynamic), not a hardcoded list', () => {
    renderPage();
    // The former static SEMISHARE_PUBLICATIONS block is gone — publications now
    // come from <ProductEvidence productSlug="probe-station">, which fetches
    // published records at runtime. In this unit test there is no API, so the
    // module renders nothing (returns null on an empty set) rather than any
    // hardcoded DOI links.
    expect(
      screen.queryByRole('heading', { name: /Used in peer-reviewed research/i })
    ).not.toBeInTheDocument();
    expect(document.querySelector('[data-testid="product-evidence"]')).toBeNull();
  });

  it('emits Organization JSON-LD with the gated-OFF description and FAQPage matching visible FAQ', async () => {
    renderPage();
    await waitFor(() => {
      const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
        .map((s) => JSON.parse(s.textContent || '{}'));
      const org = jsonLd.find((s) => s['@type'] === 'Organization');
      expect(org?.description).toBe(
        'NineScrolls LLC is a US-based supplier providing procurement, import, and after-sales support for SEMISHARE wafer probe stations in the United States and Canada.'
      );
      const faqSchema = jsonLd.find((s) => s['@type'] === 'FAQPage');
      expect(faqSchema).toBeTruthy();
      for (const entry of faqSchema.mainEntity) {
        expect(screen.getByRole('heading', { level: 3, name: entry.name })).toBeInTheDocument();
      }
    });
  });
});
