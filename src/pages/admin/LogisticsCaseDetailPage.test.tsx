import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../hooks/useLogisticsCases');
vi.mock('../../services/logisticsAdminService');

import { useLogisticsCase } from '../../hooks/useLogisticsCases';
import * as svc from '../../services/logisticsAdminService';
import { LogisticsCaseDetailPage } from './LogisticsCaseDetailPage';

const sampleCase = {
  caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0001', caseType: 'EQUIPMENT',
  customerName: 'HORIBA', contactName: 'Dr. X', customsRequired: true,
  currentStage: 'PRODUCTION', enabledStages: ['PRODUCTION', 'FAT_PASSED', 'DELIVERED', 'CLOSED'],
  legs: [{ legId: 'l1', direction: 'OUTBOUND', carrier: 'DHL', trackingNumber: 'T1', customsStatus: 'DOCS_READY' }],
  milestoneLog: [{ action: 'CASE_CREATED', toStage: 'DRAFT', operator: 'harvey', timestamp: '2026-06-19T00:00:00Z', internalOnly: false }],
  isCustomerVisible: false, createdAt: '2026-06-19T00:00:00Z', updatedAt: '2026-06-19T00:00:00Z', createdBy: 'u',
};

beforeEach(() => {
  vi.mocked(svc.advanceLogisticsStage).mockReset();
  vi.mocked(useLogisticsCase).mockReturnValue({
    logisticsCase: sampleCase, loading: false, error: null, refresh: vi.fn(),
  } as never);
});

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/admin/logistics/lc-1']}>
      <Routes><Route path="/admin/logistics/:caseId" element={<LogisticsCaseDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('LogisticsCaseDetailPage', () => {
  it('shows header, milestone progress, and legs', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByText('NS-LOG-2026-0001')).toBeInTheDocument());
    expect(screen.getByText('HORIBA')).toBeInTheDocument();
    // 'FAT Passed' appears in both the progress bar and the advance dropdown.
    expect(screen.getAllByText('FAT Passed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Testing')).not.toBeInTheDocument(); // not enabled for EQUIPMENT
    expect(screen.getByText('DHL')).toBeInTheDocument();
  });

  it('advances stage via the service', async () => {
    vi.mocked(svc.advanceLogisticsStage).mockResolvedValueOnce({ ...sampleCase, currentStage: 'FAT_PASSED' } as never);
    renderAt();
    fireEvent.change(screen.getByLabelText('Advance to stage'), { target: { value: 'FAT_PASSED' } });
    fireEvent.click(screen.getByText('Advance'));
    await waitFor(() => expect(svc.advanceLogisticsStage).toHaveBeenCalledWith('lc-1', 'FAT_PASSED', undefined, false));
  });
});
