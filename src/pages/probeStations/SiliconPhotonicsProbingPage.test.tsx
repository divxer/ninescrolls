import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SiliconPhotonicsProbingPage } from './SiliconPhotonicsProbingPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/applications/silicon-photonics-probing']}>
        <SiliconPhotonicsProbingPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('SiliconPhotonicsProbingPage', () => {
  it('sets the exact document title', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.title).toBe(
        'Silicon Photonics Wafer-Level Testing: Probe Station Guide | NineScrolls LLC'
      );
    });
  });

  it('covers fiber coupling and links back to the hub and brand page', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /Silicon photonics/i })).toBeInTheDocument();
    expect(screen.getAllByText(/fiber/i).length).toBeGreaterThan(0);
    // Hub + Request-a-quote links now appear in the hero, body, and final CTA
    // (dark-theme bookends), so assert every instance points to the right place.
    const hubLinks = screen.getAllByRole('link', { name: /probe station selection hub/i });
    expect(hubLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of hubLinks) expect(link).toHaveAttribute('href', '/wafer-probe-stations');
    expect(screen.getByRole('link', { name: /SEMISHARE product lines/i })).toHaveAttribute('href', '/wafer-probe-stations/semishare');
    const quoteLinks = screen.getAllByRole('link', { name: /Request a quote/i });
    expect(quoteLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of quoteLinks) expect(link).toHaveAttribute('href', '/request-quote?products=silicon-photonics-probe-station');
  });
});
