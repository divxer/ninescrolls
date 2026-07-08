import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UnitDetail } from './UnitDetail';

const structuredUnit = { unitKey: 'unresolved-rfq-r1', linkUnitType: 'structured', source: 'rfq', kind: 'rfq_submitted', occurredAt: '2026-03-01T00:00:00Z', eventCount: 1, sourceEntityId: 'r1', signal: { email: 'j@nanofab.com', domain: 'nanofab.com', productModel: null, equipmentCategory: 'ICP', orgNameDisplay: null, country: null, region: null, topPaths: null, enrichmentStatus: 'ok' } } as never;
const analyticsUnit = { unitKey: 'v1', linkUnitType: 'analytics', source: 'analytics', kind: 'site_visit_session', occurredAt: '2026-03-02T00:00:00Z', eventCount: 3, visitorId: 'v1', signal: { orgNameDisplay: 'Verizon Business', country: 'US', region: 'New York', topPaths: ['/x'], enrichmentStatus: 'ok', email: null, domain: null, productModel: null, equipmentCategory: null } } as never;

describe('UnitDetail', () => {
  it('structured: renders email/domain signal, disables Link until an org is selected, then calls onLink', async () => {
    const searchOrgs = vi.fn().mockResolvedValue([{ orgId: 'nanofabsolutions.com', displayName: 'NanoFab Solutions Inc' }]);
    const onLink = vi.fn();
    render(<UnitDetail unit={structuredUnit} searchOrgs={searchOrgs} onLink={onLink} />);
    expect(screen.getByText('j@nanofab.com')).toBeTruthy();
    expect(screen.getByText('nanofab.com')).toBeTruthy();
    const linkBtn = screen.getByRole('button', { name: /link/i }) as HTMLButtonElement;
    expect(linkBtn.disabled).toBe(true);                       // disabled until selected
    fireEvent.change(screen.getByRole('textbox', { name: /search organizations/i }), { target: { value: 'nanofab' } });
    await waitFor(() => expect(searchOrgs).toHaveBeenCalledWith('nanofab'));
    fireEvent.click(await screen.findByText('NanoFab Solutions Inc'));            // select candidate
    await waitFor(() => expect((screen.getByRole('button', { name: /link/i }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole('button', { name: /link/i }));
    expect(onLink).toHaveBeenCalledWith('nanofabsolutions.com');
  });

  it('analytics: renders IP-org/geo signal and a visitor-oriented impact preview', () => {
    render(<UnitDetail unit={analyticsUnit} searchOrgs={vi.fn()} onLink={vi.fn()} />);
    expect(screen.getByText('Verizon Business')).toBeTruthy();
    expect(screen.getByText(/US/)).toBeTruthy();
    expect(screen.getByText(/visitor|session/i)).toBeTruthy();   // impact copy is visitor-oriented
  });
});
