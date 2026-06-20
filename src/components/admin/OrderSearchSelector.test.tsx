import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

vi.mock('../../services/orderAdminService');
import { listOrders } from '../../services/orderAdminService';
import { OrderSearchSelector } from './OrderSearchSelector';

// Fake timers make the 300ms debounce deterministic (no CI flakiness). Because timers
// are faked, do NOT use findBy/waitFor here — advance the debounce + flush the resolved
// listOrders promise via advanceTimersByTimeAsync (wrapped in act for the state update),
// then query synchronously.
beforeEach(() => { vi.useFakeTimers(); vi.mocked(listOrders).mockReset(); });
afterEach(() => { vi.useRealTimers(); });

async function flushDebounce() {
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}

describe('OrderSearchSelector', () => {
  it('debounced-searches with the trimmed term and lets you pick an order', async () => {
    vi.mocked(listOrders).mockResolvedValue({
      items: [{ orderId: 'ord-1', institution: 'HORIBA', quoteNumber: 'NS-Q-2026-HRB-001', productModel: '4" RIE' }],
      nextToken: null,
    } as never);
    const onSelect = vi.fn();
    render(<OrderSearchSelector value="" onSelect={onSelect} />);
    fireEvent.change(screen.getByLabelText('Search order'), { target: { value: '  horiba  ' } });
    await flushDebounce();
    expect(listOrders).toHaveBeenCalledWith({ search: 'horiba', limit: 10 });
    fireEvent.click(screen.getByText('NS-Q-2026-HRB-001'));
    expect(onSelect).toHaveBeenCalledWith({ orderId: 'ord-1', institution: 'HORIBA' });
  });

  it('shows a plain "Linked order" label for a preset value and never reverse-looks-up', () => {
    render(<OrderSearchSelector value="ord-77" onSelect={vi.fn()} />);
    expect(screen.getByText('Linked order: ord-77')).toBeInTheDocument();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('uses selectedLabel for a preset value when provided', () => {
    render(<OrderSearchSelector value="ord-77" selectedLabel="NS-Q-9 · ACME" onSelect={vi.fn()} />);
    expect(screen.getByText('NS-Q-9 · ACME')).toBeInTheDocument();
  });

  it('clear calls onSelect(null)', () => {
    const onSelect = vi.fn();
    render(<OrderSearchSelector value="ord-77" onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Clear'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('does not call listOrders for an empty/whitespace query', async () => {
    render(<OrderSearchSelector value="" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search order'), { target: { value: '   ' } });
    await flushDebounce();
    expect(listOrders).not.toHaveBeenCalled();
  });

  it('shows an inline error and does not throw on search failure', async () => {
    vi.mocked(listOrders).mockRejectedValueOnce(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<OrderSearchSelector value="" onSelect={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Search order'), { target: { value: 'x' } });
    await flushDebounce();
    expect(screen.getByText('Search failed')).toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
