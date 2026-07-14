import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const catalog = {
  items: [
    {
      itemId: 'c1', sku: 'RIE-300', name: 'RIE Etcher', series: 'RIE', kind: 'MACHINE',
      requiredOptionSkus: [], requiresSkus: [], excludesSkus: [], createdAt: 'T', updatedAt: 'T',
    },
    {
      itemId: 'c2', sku: 'CHUCK-6', name: '6in Chuck', series: 'RIE', kind: 'OPTION',
      requiredOptionSkus: [], requiresSkus: [], excludesSkus: [], createdAt: 'T', updatedAt: 'T',
    },
  ],
};
const today = new Date();
const plus = (days: number) => new Date(today.getTime() + days * 86_400_000).toISOString().slice(0, 10);

vi.mock('../../services/priceAdminService', () => ({
  listCatalogItems: vi.fn(async () => catalog),
  listSuppliers: vi.fn(async () => ({ items: [{ supplierId: 's1', name: 'OEM', status: 'ACTIVE', currency: 'RMB', defaultValidityDays: 180, createdAt: 'T', updatedAt: 'T' }] })),
  listCostVersions: vi.fn(async (itemId: string) => ({
    items: itemId === 'c1'
      ? [{ itemId: 'c1', supplierId: 's1', unitCostFen: 725000, currency: 'RMB', effectiveFrom: plus(-100), effectiveTo: plus(100), priceSource: 'MANUAL_ENTRY', reviewStatus: 'APPROVED', createdAt: 'T', createdBy: 'x' }]
      : [],
  })),
  appendCostVersion: vi.fn(),
  createCatalogItem: vi.fn(),
  rmbFen: (fen: number | null | undefined) => (fen == null ? '—' : `¥${(fen / 100).toFixed(2)}`),
}));

import { PriceBookPage } from './PriceBookPage';

describe('PriceBookPage', () => {
  it('shows items grouped by series with validity badges and a needs-attention count', async () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><PriceBookPage /></MemoryRouter>);
    expect(await screen.findByText('RIE Etcher')).toBeInTheDocument();
    expect(await screen.findByText('MISSING')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByTestId('attention-count').textContent).toBe('1');
  });
});
