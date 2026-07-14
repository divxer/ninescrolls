import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
vi.mock('../../services/priceAdminService', () => ({
  usd: (c: number) => `$${(c / 100).toFixed(2)}`,
  marginPct: (bp: number) => `${(bp / 100).toFixed(1)}%`,
  listQuotations: vi.fn(async () => ({ items: [{ quotationNumber: 'Q-2026-0008', version: 1, revision: 1, status: 'DRAFT', schemeLabel: 'Standard', customerName: 'MIT Nano', totalCostUsdCents: 100000, suggestedTotalUsdCents: 160000, actualTotalUsdCents: 155000, actualMarginBp: 3548, belowMinMargin: false, incomplete: false, lineCount: 3, createdAt: 'T', updatedAt: '2026-07-14T00:00:00Z' }], nextToken: null })),
}));
import { QuotationListPage } from './QuotationListPage';
describe('QuotationListPage', () => { it('lists quotations with margin and status', async () => { render(<MemoryRouter><QuotationListPage /></MemoryRouter>); expect(await screen.findByText('Q-2026-0008')).toBeInTheDocument(); expect(screen.getByText('MIT Nano')).toBeInTheDocument(); expect(screen.getByText('35.5%')).toBeInTheDocument(); }); });
