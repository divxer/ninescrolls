import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
const runRepair = vi.fn();
vi.mock('../../hooks/useCrmHealth', () => ({ useCrmHealth: () => ({
  data: { repairPending: { count: 2, more: false, sample: [{ unitType: 'structured', unitKey: 'u1', targetOrgId: 'acme.com', attemptCount: 1, lastError: 'x', createdAt: 't' }] },
          repairStuck: { count: 1, more: false, sample: [{ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'b.com', stuckReason: 'source_conflict', createdAt: 't2' }] },
          lastRepairSummary: { repaired: 3 }, lastHotSweep: { expected: 9, hasMore: false }, lastColdSweep: null, lastDirtyRollupSweep: null },
  loading: false, error: null, runMsg: null, reload: vi.fn(), runRepair,
}) }));
import { CrmHealthPage } from './CrmHealthPage';

describe('CrmHealthPage', () => {
  it('renders pending + stuck counts and a Run repair now button', () => {
    render(<CrmHealthPage />);
    expect(screen.getByText(/CRM Health/i)).toBeInTheDocument();
    expect(screen.getByText('u1')).toBeInTheDocument();
    expect(screen.getByText(/source_conflict/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Run repair now/i }));
    expect(runRepair).toHaveBeenCalled();
  });
});
