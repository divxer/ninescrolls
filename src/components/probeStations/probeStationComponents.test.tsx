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

  it('renders each row with a source reference and the OEM disclaimer', () => {
    render(<SourcedSpecTable specs={specs} caption="X Series" />);
    expect(screen.getByText('Wafer size')).toBeInTheDocument();
    expect(screen.getByText('Up to 200 mm')).toBeInTheDocument();
    const sourceLink = screen.getByRole('link', { name: /source/i });
    expect(sourceLink).toHaveAttribute('href', 'https://www.semishareprober.com/example');
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
    render(<SchematicFigure src="/assets/x.webp" alt="Probe station schematic" caption="Core subsystems" />);
    expect(screen.getByAltText('Probe station schematic')).toBeInTheDocument();
    expect(screen.getByText(/Schematic illustration, not actual product appearance/i)).toBeInTheDocument();
    expect(screen.getByText(/Core subsystems/)).toBeInTheDocument();
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
