import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LegForm } from './LegForm';

beforeEach(() => vi.clearAllMocks());

describe('LegForm', () => {
  it('submits a new leg with direction + entered fields', () => {
    const onSubmit = vi.fn();
    render(<LegForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'INBOUND' } });
    fireEvent.change(screen.getByLabelText('Carrier'), { target: { value: 'FedEx' } });
    fireEvent.change(screen.getByLabelText('Tracking #'), { target: { value: 'T9' } });
    fireEvent.click(screen.getByText('Save leg'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input).toMatchObject({ direction: 'INBOUND', carrier: 'FedEx', trackingNumber: 'T9' });
  });

  it('prefills when editing an existing leg', () => {
    const onSubmit = vi.fn();
    render(<LegForm onSubmit={onSubmit} onCancel={() => {}} initial={{ legId: 'l1', direction: 'RETURN', carrier: 'DHL' }} />);
    expect((screen.getByLabelText('Carrier') as HTMLInputElement).value).toBe('DHL');
    fireEvent.click(screen.getByText('Save leg'));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ direction: 'RETURN', carrier: 'DHL' });
  });

  it('blocks submit on an invalid tracking URL', () => {
    const onSubmit = vi.fn();
    render(<LegForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Tracking URL'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('Save leg'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/http/i)).toBeInTheDocument();
  });
});
