import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../hooks/useLogisticsCases');

import { useLogisticsCases, useLogisticsStats } from '../../hooks/useLogisticsCases';
import { LogisticsCaseListPage } from './LogisticsCaseListPage';

beforeEach(() => {
  vi.mocked(useLogisticsCases).mockReturnValue({
    cases: [{
      caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0001', caseType: 'EQUIPMENT',
      customerName: 'HORIBA', currentStage: 'IN_TRANSIT', customsRequired: true,
      legs: [{ legId: 'l1' }], updatedAt: '2026-06-19T00:00:00Z',
    }],
    loading: false, loadingMore: false, hasMore: false, error: null, loadMore: vi.fn(),
  } as never);
  vi.mocked(useLogisticsStats).mockReturnValue({
    stats: { totalActive: 1, byType: '{"EQUIPMENT":1}', byStage: '{"IN_TRANSIT":1}', customsInProgress: 1, stalledCases: 0 },
    loading: false, error: null,
  } as never);
});

describe('LogisticsCaseListPage', () => {
  it('renders cases with caseNumber link and stage badge', async () => {
    render(<MemoryRouter><LogisticsCaseListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('NS-LOG-2026-0001')).toBeInTheDocument());
    expect(screen.getByText('HORIBA')).toBeInTheDocument();
    // "In Transit" appears in both the stage filter <option> and the StageBadge;
    // scope to the badge (a <span>) to assert the stage badge specifically.
    expect(screen.getByText('In Transit', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText('NS-LOG-2026-0001').closest('a')).toHaveAttribute('href', '/admin/logistics/lc-1');
  });

  it('uses the loaded Material Symbols font for the new case icon', () => {
    render(<MemoryRouter><LogisticsCaseListPage /></MemoryRouter>);

    const newCaseLink = screen.getByRole('link', { name: /new case/i });
    expect(newCaseLink.querySelector('.material-symbols-outlined')).toHaveTextContent('add');
    expect(newCaseLink.querySelector('.material-symbols-rounded')).not.toBeInTheDocument();
  });
});
