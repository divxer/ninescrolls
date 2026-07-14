import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../services/priceAdminService', () => ({
  listSuppliers: vi.fn(async () => ({
    items: [{
      supplierId: 's1', name: 'Probe OEM', contact: 'Ms. Li', currency: 'RMB',
      defaultValidityDays: 180, status: 'ACTIVE', createdAt: 'T', updatedAt: 'T',
    }],
  })),
  createSupplier: vi.fn(),
  updateSupplier: vi.fn(),
}));

import { SuppliersPage } from './SuppliersPage';

describe('SuppliersPage', () => {
  it('renders supplier cards from the service', async () => {
    render(<SuppliersPage />);
    expect(await screen.findByText('Probe OEM')).toBeInTheDocument();
    expect(screen.getByText(/ACTIVE/)).toBeInTheDocument();
  });
});
