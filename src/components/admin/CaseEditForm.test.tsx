import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseEditForm } from './CaseEditForm';

const base = {
  caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0001', caseType: 'EQUIPMENT',
  customerName: 'HORIBA', customsRequired: true, currentStage: 'DRAFT',
  enabledStages: [], isCustomerVisible: false, createdAt: 'x', updatedAt: 'x', createdBy: 'u',
} as any;

describe('CaseEditForm', () => {
  it('submits only edited whitelisted fields', () => {
    const onSubmit = vi.fn();
    render(<CaseEditForm logisticsCase={base} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'BAE Systems' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ customerName: 'BAE Systems' });
    // never includes frozen fields
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('caseType');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('isCustomerVisible');
  });

  it('rejects relatedEntityType set without an ID', () => {
    const onSubmit = vi.fn();
    render(<CaseEditForm logisticsCase={base} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Related entity type'), { target: { value: 'LEAD' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/both/i)).toBeInTheDocument();
  });
});
