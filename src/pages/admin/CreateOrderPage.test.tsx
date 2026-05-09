import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CreateOrderPage } from './CreateOrderPage';

vi.mock('../../services/orderAdminService', () => ({
  createOrder: vi.fn().mockResolvedValue({ orderId: 'new1' }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateOrderPage />
    </MemoryRouter>,
  );
}

describe('CreateOrderPage — quote validity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('defaults Quote Valid Until to Quote Date + 30 days', () => {
    renderPage();
    const quoteDate = screen.getByLabelText(/Quote Date/i) as HTMLInputElement;
    const validUntil = screen.getByLabelText(/Quote Valid Until/i) as HTMLInputElement;
    const today = new Date().toISOString().slice(0, 10);
    expect(quoteDate.value).toBe(today);
    const expected = new Date(quoteDate.value);
    expected.setUTCDate(expected.getUTCDate() + 30);
    expect(validUntil.value).toBe(expected.toISOString().slice(0, 10));
  });

  it('updates validUntil when quoteDate changes (untouched)', async () => {
    const user = userEvent.setup();
    renderPage();
    const quoteDate = screen.getByLabelText(/Quote Date/i) as HTMLInputElement;
    const validUntil = screen.getByLabelText(/Quote Valid Until/i) as HTMLInputElement;

    await user.clear(quoteDate);
    await user.type(quoteDate, '2026-06-01');
    expect(validUntil.value).toBe('2026-07-01');
  });

  it('freezes validUntil after the user edits it', async () => {
    const user = userEvent.setup();
    renderPage();
    const quoteDate = screen.getByLabelText(/Quote Date/i) as HTMLInputElement;
    const validUntil = screen.getByLabelText(/Quote Valid Until/i) as HTMLInputElement;

    await user.clear(validUntil);
    await user.type(validUntil, '2026-12-31');

    await user.clear(quoteDate);
    await user.type(quoteDate, '2026-06-01');

    expect(validUntil.value).toBe('2026-12-31');
  });
});
