import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
const runRepair = vi.fn();
const acknowledge = vi.fn();
const baseHook = {
  data: { repairPending: { count: 2, more: false, sample: [{ unitType: 'structured', unitKey: 'u1', targetOrgId: 'acme.com', attemptCount: 1, lastError: 'x', createdAt: 't' }] },
          repairStuck: { count: 1, more: false, sample: [{ unitType: 'analytics', unitKey: 'v1', targetOrgId: 'b.com', stuckReason: 'source_conflict', createdAt: 't2' }] },
          // a.json() summaries arrive from AppSync as JSON *strings* (lastHotSweep), while an object
          // (lastRepairSummary) must still render — SummaryCard handles both.
          lastRepairSummary: { repaired: 3 }, lastHotSweep: '{"expected":9,"hasMore":false}', lastColdSweep: null, lastDirtyRollupSweep: null,
          mergeNeedsReviewCount: 1, mergeReviewMarkers: [{ fromOrgId: 'src.com', toOrgId: 'tgt.com', version: 3, residualsDetected: true, residualSamples: ['RFQ#1', 'ORDER#2'], probedAt: '2026-07-20T00:00:00Z' }] },
  loading: false, error: null, runMsg: null, reload: vi.fn(), runRepair,
  mergeReviewMarkers: [{ fromOrgId: 'src.com', toOrgId: 'tgt.com', version: 3, residualsDetected: true, residualSamples: ['RFQ#1', 'ORDER#2'], probedAt: '2026-07-20T00:00:00Z' }],
  ackInFlight: null as string | null, ackError: null as string | null, acknowledge,
};
let hookReturn = baseHook;
vi.mock('../../hooks/useCrmHealth', () => ({ useCrmHealth: () => hookReturn }));
import { CrmHealthPage } from './CrmHealthPage';

beforeEach(() => { vi.clearAllMocks(); hookReturn = baseHook; });

describe('CrmHealthPage', () => {
  it('renders pending + stuck counts and a Run repair now button', () => {
    render(<CrmHealthPage />);
    expect(screen.getByText(/CRM Health/i)).toBeInTheDocument();
    expect(screen.getByText('u1')).toBeInTheDocument();
    expect(screen.getByText(/source_conflict/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Run repair now/i }));
    expect(runRepair).toHaveBeenCalled();
  });

  it('renders a JSON-string summary as de-escaped pretty JSON (not a double-encoded string)', () => {
    render(<CrmHealthPage />);
    const body = document.body.textContent ?? '';
    expect(body).toContain('"expected": 9');    // parsed + pretty-printed
    expect(body).not.toContain('\\"expected\\"'); // NOT the escaped double-encoded form
  });

  it('renders a merge-review row (from→to, residualsDetected, sample count, probedAt) and fires acknowledge on click', () => {
    render(<CrmHealthPage />);
    expect(screen.getByText(/src\.com.*tgt\.com/)).toBeInTheDocument();
    expect(screen.getByText('2026-07-20T00:00:00Z')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Acknowledge/i }));
    expect(acknowledge).toHaveBeenCalledWith('src.com', 'tgt.com');
  });

  it('disables the Acknowledge button for the row currently in flight', () => {
    hookReturn = { ...baseHook, ackInFlight: 'src.com|tgt.com' };
    render(<CrmHealthPage />);
    const btn = screen.getByRole('button', { name: /Acknowledging/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
