import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getPartnerBannerText } from '../../data/probeStations/semishare';
import { PartnerAttestationBanner } from './PartnerAttestationBanner';
import { SchematicFigure } from './SchematicFigure';
import { SourcedSpecTable } from './SourcedSpecTable';
import { StationTypeComparison } from './StationTypeComparison';

describe('PartnerAttestationBanner', () => {
  it('renders the neutral registry wording and no badge images while the gate is off', () => {
    const { container } = render(<PartnerAttestationBanner />);
    // Expected value comes from the registry getter; the literal string is
    // pinned separately in src/data/probeStations/semishare.test.ts.
    expect(screen.getByText(getPartnerBannerText(false))).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('SourcedSpecTable', () => {
  const specs = [
    {
      label: 'Wafer size',
      value: 'Up to 200 mm',
      source: { url: 'https://www.semishareprober.com/example', capturedOn: '2026-07-12' },
    },
  ];

  it('renders spec rows with the OEM disclaimer and NO outbound source links', () => {
    const { container } = render(<SourcedSpecTable specs={specs} caption="X Series" />);
    expect(screen.getByText('Wafer size')).toBeInTheDocument();
    expect(screen.getByText('Up to 200 mm')).toBeInTheDocument();
    // The source stays in the data module (audit trail) but must not render:
    // per-row OEM links leaked visitors to the manufacturer's site.
    expect(container.querySelector('a')).toBeNull();
    expect(container.textContent).not.toContain('semishareprober.com');
    expect(
      screen.getByText(/from manufacturer public materials.*subject to OEM confirmation/i)
    ).toBeInTheDocument();
  });

  it('renders the request-specs fallback when there are no specs', () => {
    render(<SourcedSpecTable specs={[]} caption="A Series" />);
    expect(screen.getByText(/detailed specifications on request/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('SchematicFigure', () => {
  it('always renders the schematic disclaimer caption', () => {
    render(<SchematicFigure srcBase="/assets/images/insights/probe-station-anatomy" alt="Probe station schematic" caption="Core subsystems" />);
    expect(screen.getByAltText('Probe station schematic')).toBeInTheDocument();
    expect(screen.getByText(/Schematic illustration, not actual product appearance/i)).toBeInTheDocument();
    expect(screen.getByText(/Core subsystems/)).toBeInTheDocument();
  });

  it('renders responsive variants: -lg.png fallback img and a -sm.webp source', () => {
    const { container } = render(
      <SchematicFigure srcBase="/assets/images/insights/probe-station-anatomy" alt="Probe station schematic" caption="Core subsystems" />
    );
    const img = screen.getByAltText('Probe station schematic') as HTMLImageElement;
    expect(img.getAttribute('src')).toMatch(/\/probe-station-anatomy-lg\.png$/);
    const sources = Array.from(container.querySelectorAll('picture source'));
    expect(sources.some((s) => (s.getAttribute('srcset') ?? '').endsWith('/probe-station-anatomy-sm.webp'))).toBe(true);
  });
});

describe('StationTypeComparison', () => {
  it('compares the three automation levels qualitatively', () => {
    render(<StationTypeComparison />);
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Semi-automatic')).toBeInTheDocument();
    expect(screen.getByText('Fully automatic')).toBeInTheDocument();
    expect(screen.getByText(/Hand-driven micropositioners/i)).toBeInTheDocument();
  });
});
