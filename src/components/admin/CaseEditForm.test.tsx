import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('./OrderSearchSelector', () => ({
  OrderSearchSelector: ({ value, onSelect }: { value: string; onSelect: (o: { orderId: string; institution: string } | null) => void }) => (
    <div data-testid="order-selector">
      <span>val:{value}</span>
      <button type="button" onClick={() => onSelect({ orderId: 'ord-5', institution: 'ACME' })}>pick-order</button>
      <button type="button" onClick={() => onSelect(null)}>clear-order</button>
    </div>
  ),
}));

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

  it('selecting an order sets relatedOrderId without touching customerName or entity fields', () => {
    const onSubmit = vi.fn();
    render(<CaseEditForm logisticsCase={base} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('pick-order'));
    fireEvent.click(screen.getByText('Save'));
    const input = onSubmit.mock.calls[0][0];
    expect(input.relatedOrderId).toBe('ord-5');
    expect(input.customerName).toBe('HORIBA');     // edit form never auto-overwrites the customer
    expect(input.relatedEntityType).toBeNull();     // order pick must NOT set relatedEntityType
  });

  it('clearing the order submits an empty relatedOrderId', () => {
    const onSubmit = vi.fn();
    render(<CaseEditForm logisticsCase={{ ...base, relatedOrderId: 'ord-9' }} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.click(screen.getByText('clear-order'));
    fireEvent.click(screen.getByText('Save'));
    expect(onSubmit.mock.calls[0][0].relatedOrderId).toBe('');
  });
});
