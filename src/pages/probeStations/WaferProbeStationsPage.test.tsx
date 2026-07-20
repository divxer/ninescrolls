import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { WaferProbeStationsPage } from './WaferProbeStationsPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/wafer-probe-stations']}>
        <WaferProbeStationsPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('WaferProbeStationsPage', () => {
  it('sets the exact document title and meta description', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.title).toBe(
        'Wafer Probe Stations for Research Labs | Manual, Semi-Automatic & Cryogenic | NineScrolls LLC'
      );
    });
    const metaDescription = document.head.querySelector('meta[name="description"]');
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('probe station'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('university'));
  });

  it('renders the hub content, comparison, FAQ, and internal links', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /Wafer probe stations for research labs/i })
    ).toBeInTheDocument();
    // A cell unique to StationTypeComparison (the automation labels themselves
    // now also appear in the hero at-a-glance panel).
    expect(screen.getByText('Recipe-assisted multi-site stepping')).toBeInTheDocument();
    // SEMISHARE + Request-a-quote links now appear in the hero, body, and final
    // CTA (dark-theme bookends), so assert every instance points to the right place.
    const semishareLinks = screen.getAllByRole('link', { name: /SEMISHARE product lines/i });
    expect(semishareLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of semishareLinks) expect(link).toHaveAttribute('href', '/wafer-probe-stations/semishare');
    expect(screen.getByRole('link', { name: /Cryogenic probing guide/i })).toHaveAttribute(
      'href', '/applications/cryogenic-probing'
    );
    expect(screen.getByRole('link', { name: /Silicon photonics probing guide/i })).toHaveAttribute(
      'href', '/applications/silicon-photonics-probing'
    );
    const quoteLinks = screen.getAllByRole('link', { name: /Request a quote/i });
    expect(quoteLinks.length).toBe(2); // hero + final-CTA bookends
    for (const link of quoteLinks) expect(link).toHaveAttribute('href', '/request-quote?products=wafer-probe-station');
    const faqHeadings = screen.getAllByRole('heading', { level: 3 }).filter((h) => h.textContent?.endsWith('?'));
    expect(faqHeadings.length).toBeGreaterThanOrEqual(4);
  });

  it('renders the anatomy schematic as a responsive <picture> (-lg.png fallback + -sm.webp source)', () => {
    const { container } = renderPage();
    const img = screen.getByAltText(
      'Probe station core subsystems: chuck, micropositioners, optics, signal path'
    ) as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/\/probe-station-anatomy-lg\.png$/);
    const sources = Array.from(container.querySelectorAll('picture source'));
    expect(sources.some((s) => (s.getAttribute('srcset') ?? '').endsWith('/probe-station-anatomy-sm.webp'))).toBe(true);
  });

  it('emits FAQPage JSON-LD that matches the visible FAQ', async () => {
    renderPage();
    let faqSchema: { mainEntity: { name: string }[] } | undefined;
    await waitFor(() => {
      const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
        .map((s) => JSON.parse(s.textContent || '{}'));
      faqSchema = jsonLd.find((s) => s['@type'] === 'FAQPage');
      expect(faqSchema).toBeTruthy();
    });
    for (const entry of faqSchema!.mainEntity) {
      expect(screen.getByRole('heading', { level: 3, name: entry.name })).toBeInTheDocument();
    }
  });
});
