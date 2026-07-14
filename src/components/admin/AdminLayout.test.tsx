import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../contexts/useTheme', () => ({
  useTheme: () => ({ effectiveTheme: 'light', toggleTheme: vi.fn(), preference: 'auto' }),
}));

import { AdminShell } from './AdminLayout';

describe('AdminShell sidebar', () => {
  it('keeps account actions outside an independently scrollable navigation region', () => {
    render(
      <MemoryRouter initialEntries={['/admin/dashboard']}>
        <AdminShell loginId="admin@ninescrolls.com" signOut={vi.fn()} />
      </MemoryRouter>,
    );

    const navigation = screen.getByRole('navigation', { name: 'Admin navigation' });
    const accountActions = screen.getByTestId('admin-account-actions');

    expect(navigation).toHaveClass('min-h-0', 'overflow-y-auto');
    expect(within(navigation).queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument();
    expect(within(accountActions).getByRole('button', { name: 'Sign Out' })).toBeVisible();
    expect(accountActions).toHaveClass('shrink-0');
  });
});
