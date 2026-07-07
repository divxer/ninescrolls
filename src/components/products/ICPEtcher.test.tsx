import { render, screen, waitFor, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ICPEtcher } from './ICPEtcher';

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ICPEtcher />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('ICPEtcher redesigned product page', () => {
  it('presents ICP-RIE as a process-led product detail page', () => {
    renderPage();

    const expectedStory = [
      'ICP-RIE Plasma Etching Platform',
      'Configure the etch process before the chamber.',
      'Core Process Windows',
      'Technical Specifications',
      'Applications',
      'Research Validation',
      'Related Resources',
      'Build an ICP-RIE process window with NineScrolls',
    ];

    const pageText = document.body.textContent ?? '';
    let previousIndex = -1;

    expectedStory.forEach(copy => {
      const currentIndex = pageText.indexOf(copy);
      expect(currentIndex, `${copy} should be present`).toBeGreaterThan(-1);
      expect(currentIndex, `${copy} should appear after the prior section`).toBeGreaterThan(previousIndex);
      previousIndex = currentIndex;
    });
  });

  it('uses the standardized real product asset and PDF-corrected specifications', () => {
    renderPage();

    expect(screen.getByAltText('NineScrolls ICP-RIE plasma etching platform')).toHaveAttribute(
      'src',
      '/assets/images/redesign/products/icp-rie-standardized.webp'
    );

    const specs = screen.getByTestId('icp-rie-specifications');

    expect(within(specs).getByText('Wafer Size')).toBeInTheDocument();
    expect(within(specs).getByText('4-12 in')).toBeInTheDocument();
    expect(within(specs).getByText('Gas System')).toBeInTheDocument();
    expect(within(specs).getByText('5 lines std.')).toBeInTheDocument();
    expect(within(specs).getByText('Stage Temp')).toBeInTheDocument();
    expect(within(specs).getByText('-70 to 200 C')).toBeInTheDocument();
    expect(within(specs).getByText('RF Power')).toBeInTheDocument();
    expect(within(specs).getByText('1000-3000 W')).toBeInTheDocument();
  });

  it('keeps quote and product navigation paths visible', () => {
    renderPage();

    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote?products=icp-etcher');
    expect(screen.getByRole('link', { name: 'Talk to an Engineer' })).toHaveAttribute('href', '/contact?topic=expert&product=icp-etcher');
    expect(screen.getByRole('link', { name: 'Compare RIE' })).toHaveAttribute('href', '/products/rie-etcher');
  });

  it('positions the ICP-RIE product page for equipment-selection intent', async () => {
    renderPage();

    await waitFor(() => {
      expect(document.title).toBe('ICP-RIE Etching System for Research Labs | NineScrolls LLC');
    });

    const metaDescription = document.head.querySelector('meta[name="description"]');
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('ICP-RIE etching system'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('request a quote'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('silicon'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('diamond'));
  });

  it('does not render a nested main landmark inside the layout main', () => {
    renderPage();

    expect(document.body.querySelector('main')).not.toBeInTheDocument();
  });

  it('does not ship internal research placeholder copy', () => {
    renderPage();

    expect(screen.queryByText(/verified publication data before final production copy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/internal/i)).not.toBeInTheDocument();
  });

  it('uses intent-specific resource anchors without dropping the diamond deep link', () => {
    renderPage();

    expect(screen.getByRole('link', { name: /Learn ICP-RIE Technology/i })).toHaveAttribute(
      'href',
      '/insights/icp-rie-technology-advanced-etching'
    );
    expect(screen.getByRole('link', { name: /Compare ICP-RIE vs RIE/i })).toHaveAttribute(
      'href',
      '/insights/understanding-differences-pe-rie-icp-rie-plasma-etching'
    );
    expect(screen.getByRole('link', { name: /Deep Silicon Bosch Process/i })).toHaveAttribute(
      'href',
      '/insights/deep-reactive-ion-etching-bosch-process'
    );
    expect(screen.getByRole('link', { name: /Diamond Semiconductor Processing/i })).toHaveAttribute(
      'href',
      '/insights/diamond-semiconductor-processing-icp-etching-deposition'
    );
  });

  it('groups technical specification terms and values in a definition list', () => {
    renderPage();

    const specs = screen.getByTestId('icp-rie-specifications');

    expect(specs.tagName).toBe('DL');
    expect(within(specs).getByText('Wafer Size').closest('dl')).toBe(specs);
    expect(within(specs).getByText('4-12 in').closest('dl')).toBe(specs);
  });
});
