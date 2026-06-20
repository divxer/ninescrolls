import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useLogisticsCases');
import { useLogisticsCases } from '../../hooks/useLogisticsCases';
import { LogisticsPanel } from './LogisticsPanel';

const mockHook = (over: Record<string, unknown>) =>
  vi.mocked(useLogisticsCases).mockReturnValue({
    cases: [], loading: false, loadingMore: false, hasMore: false, error: null,
    refresh: vi.fn(), loadMore: vi.fn(), ...over,
  } as never);

beforeEach(() => vi.mocked(useLogisticsCases).mockReset());

describe('LogisticsPanel', () => {
  it('renders linked cases with caseNumber link, stage badge, and customs label', () => {
    mockHook({ cases: [{
      caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0003', caseType: 'EQUIPMENT',
      currentStage: 'IN_TRANSIT', customsRequired: true, updatedAt: '2026-06-20T00:00:00Z',
    }] });
    render(<MemoryRouter><LogisticsPanel orderId="ord-1" /></MemoryRouter>);
    expect(screen.getByText('NS-LOG-2026-0003').closest('a')).toHaveAttribute('href', '/admin/logistics/lc-1');
    expect(screen.getByText('Equipment')).toBeInTheDocument();
    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('Customs required')).toBeInTheDocument();
  });

  it('renders nothing when there are no linked cases', () => {
    mockHook({ cases: [] });
    const { container } = render(<MemoryRouter><LogisticsPanel orderId="ord-1" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing while loading', () => {
    mockHook({ cases: [], loading: true });
    const { container } = render(<MemoryRouter><LogisticsPanel orderId="ord-1" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing and warns on error', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockHook({ cases: [], error: new Error('boom') });
    const { container } = render(<MemoryRouter><LogisticsPanel orderId="ord-1" /></MemoryRouter>);
    expect(container).toBeEmptyDOMElement();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
