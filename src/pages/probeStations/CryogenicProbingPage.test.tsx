import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CryogenicProbingPage } from './CryogenicProbingPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/applications/cryogenic-probing']}>
        <CryogenicProbingPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('CryogenicProbingPage', () => {
  it('sets the exact document title', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.title).toBe(
        'Cryogenic Probe Stations: Low-Temperature Wafer Probing Guide | NineScrolls LLC'
      );
    });
  });

  it('covers the temperature regimes and links back to the hub and brand page', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /Cryogenic probe stations/i })).toBeInTheDocument();
    expect(screen.getByText(/liquid nitrogen/i)).toBeInTheDocument();
    expect(screen.getByText(/liquid helium/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /probe station selection hub/i })).toHaveAttribute('href', '/wafer-probe-stations');
    expect(screen.getByRole('link', { name: /SEMISHARE product lines/i })).toHaveAttribute('href', '/wafer-probe-stations/semishare');
    expect(screen.getByRole('link', { name: /Request a quote/i })).toHaveAttribute('href', '/request-quote?products=cryogenic-probe-station');
  });

  it('renders the temperature-regimes schematic as a responsive <picture> (-lg.png fallback + -sm.webp source)', () => {
    const { container } = renderPage();
    const img = screen.getByAltText(
      'Ambient, thermal-chuck, and cryogenic-vacuum probing regimes with example applications'
    ) as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/\/probe-station-temperature-regimes-lg\.png$/);
    const sources = Array.from(container.querySelectorAll('picture source'));
    expect(sources.some((s) => (s.getAttribute('srcset') ?? '').endsWith('/probe-station-temperature-regimes-sm.webp'))).toBe(true);
  });
});
