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
    expect(screen.getByRole('link', { name: /probe station selection hub/i })).toHaveAttribute('href', '/wafer-probe-stations');
    expect(screen.getByRole('link', { name: /SEMISHARE product lines/i })).toHaveAttribute('href', '/wafer-probe-stations/semishare');
    expect(screen.getByRole('link', { name: /Request a quote/i })).toHaveAttribute('href', '/request-quote?products=silicon-photonics-probe-station');
  });
});
