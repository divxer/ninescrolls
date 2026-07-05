import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { EBeamEvaporator } from './EBeamEvaporator';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <EBeamEvaporator />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('EBeamEvaporator redesigned product page', () => {
  it('renders E-Beam through the shared product detail template', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'MEB-600 E-Beam Evaporation Platform' })).toBeInTheDocument();
    expect(screen.getByAltText('NineScrolls MEB-600 e-beam evaporation platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/e-beam-standardized.webp'
    );
    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('uses verified MEB-600 specifications from the equipment summary', () => {
    renderPage();

    const specs = screen.getByTestId('e-beam-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Substrate')).toBeInTheDocument();
    expect(within(specs).getByText('1x8 in or 5x4 in')).toBeInTheDocument();
    expect(within(specs).getByText('E-Gun Crucible')).toBeInTheDocument();
    expect(within(specs).getByText('6 pockets, 17 cc each')).toBeInTheDocument();
    expect(within(specs).getByText('Uniformity')).toBeInTheDocument();
    expect(within(specs).getByText('+/-3-5%')).toBeInTheDocument();
    expect(within(specs).getByText('Vacuum')).toBeInTheDocument();
    expect(within(specs).getByText('~8x10^-4 Pa')).toBeInTheDocument();
    expect(within(specs).getByText('Modes')).toBeInTheDocument();
    expect(within(specs).getByText('Manual / semi-auto / full-auto')).toBeInTheDocument();
  });

  it('keeps E-Beam conversion and comparison paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute(
      'href',
      '/request-quote?products=e-beam-evaporator'
    );
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute(
      'href',
      '/contact?topic=expert&product=e-beam-evaporator'
    );
    expect(screen.getByRole('link', { name: 'Compare Sputtering' })).toHaveAttribute('href', '/products/sputter');
  });

  it('uses verified E-Beam research evidence and real resource slugs', () => {
    renderPage();

    expect(screen.getByText('ACS Applied Materials & Interfaces')).toBeInTheDocument();
    expect(screen.getByText('Dimension-Confined Growth of a Crack-Free PbS Microplate Array')).toBeInTheDocument();
    expect(screen.getByText('Journal of Infrared and Millimeter Waves')).toBeInTheDocument();
    expect(screen.getByText('Coronene Enhanced CMOS Image Sensor')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: /E-Beam vs Thermal vs Sputter/i })).toHaveAttribute(
      'href',
      '/insights/e-beam-vs-thermal-vs-sputter-pvd-system-selection'
    );
    expect(screen.getByRole('link', { name: /Hard Mask Processing/i })).toHaveAttribute(
      'href',
      '/insights/hard-mask-processing-materials-integration-and-pattern-transfer-strategies'
    );
    expect(screen.getByRole('link', { name: /Quantum Device Fabrication/i })).toHaveAttribute(
      'href',
      '/insights/quantum-device-micro-nanofabrication-guide'
    );
  });

  it('derives title, canonical, and product schema URLs from the E-Beam slug', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('MEB-600 E-Beam Evaporation Platform | NineScrolls LLC');
      expect(document.head.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://ninescrolls.com/products/e-beam-evaporator'
      );
    });

    const productSchema = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map(script => JSON.parse(script.textContent ?? '{}') as { '@type'?: string; '@id'?: string; offers?: { url?: string } })
      .find(schema => schema['@type'] === 'Product');

    expect(productSchema).toMatchObject({
      '@id': 'https://ninescrolls.com/products/e-beam-evaporator#product',
      offers: {
        url: 'https://ninescrolls.com/products/e-beam-evaporator',
      },
    });
  });
});
