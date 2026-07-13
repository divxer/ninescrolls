import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { productLines, SEMISHARE_PUBLICATIONS } from '../../data/probeStations/semishare';
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

  it('renders the peer-reviewed research section with every publication title linked to its DOI', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 2, name: /Used in peer-reviewed research/i })
    ).toBeInTheDocument();
    expect(SEMISHARE_PUBLICATIONS.length).toBeGreaterThanOrEqual(3);
    for (const pub of SEMISHARE_PUBLICATIONS) {
      const link = screen.getByRole('link', { name: pub.title });
      expect(link).toHaveAttribute('href', `https://doi.org/${pub.doi}`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link.getAttribute('rel')).toContain('noopener');
    }
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
