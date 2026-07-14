import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const { createQuotationDraft, updateQuotationDraft, snapshot } = vi.hoisted(() => {
const snapshot = {
  quotationNumber: 'Q-2026-0009', version: 1, revision: 1, status: 'DRAFT' as const,
  schemeLabel: 'Standard', customerName: 'MIT Nano', totalCostUsdCents: 100000,
  suggestedTotalUsdCents: 160000, actualTotalUsdCents: 160000, actualMarginBp: 3750,
  belowMinMargin: false, incomplete: true, lineCount: 1, createdAt: 'T', updatedAt: 'T',
  lines: [{ lineNo: 1, itemId: 'c1', sku: 'RIE-300', name: 'ICP-RIE Advanced', series: 'RIE', kind: 'MACHINE', qty: 1, lineType: 'NORMAL', unitCostFen: 72500000, previousUnitCostFen: 70000000, costDeltaFen: 2500000, costStatus: 'ACTIVE', fxRmbPerUsdMilli: 7250, marginBpApplied: 3500, unitCostUsdCents: 100000, suggestedUnitUsdCents: 160000, actualUnitUsdCents: 160000, overrideReason: null, overriddenBy: null, overriddenAt: null, actualLineTotalUsdCents: 160000 }],
};
return { snapshot, createQuotationDraft: vi.fn(async () => snapshot), updateQuotationDraft: vi.fn(async () => ({ ...snapshot, revision: 2, actualMarginBp: 3500 })) };
});

vi.mock('../../services/priceAdminService', () => ({
  usd: (c: number | null | undefined) => c == null ? '—' : `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  rmbFen: (c: number | null | undefined) => c == null ? '—' : `¥${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  marginPct: (bp: number | null | undefined) => bp == null ? '—' : `${(bp / 100).toFixed(1)}%`,
  listCatalogItems: vi.fn(async () => ({ items: [{ itemId: 'c1', sku: 'RIE-300', name: 'ICP-RIE Advanced', series: 'RIE', kind: 'MACHINE', requiredOptionSkus: [], requiresSkus: [], excludesSkus: [], createdAt: 'T', updatedAt: 'T' }] })),
  createQuotationDraft, updateQuotationDraft,
  getQuotation: vi.fn(async () => ({ scheme: null, versions: [snapshot] })),
}));

import { QuotationWorkbenchPage } from './QuotationWorkbenchPage';

const renderPage = (path = '/admin/quotations/new') => render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/admin/quotations/new" element={<QuotationWorkbenchPage />} /><Route path="/admin/quotations/:quotationNumber" element={<QuotationWorkbenchPage />} /></Routes></MemoryRouter>);

describe('QuotationWorkbenchPage', () => {
  it('creates a quote and renders server-authoritative pricing', async () => {
    renderPage();
    fireEvent.change(await screen.findByPlaceholderText('Customer name'), { target: { value: 'MIT Nano' } });
    fireEvent.click(screen.getByRole('button', { name: /add item/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /option/i }));
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    await waitFor(() => expect(createQuotationDraft).toHaveBeenCalled());
    expect(await screen.findByText(/Q-2026-0009/)).toBeInTheDocument();
    expect(screen.getAllByText('37.5%').length).toBeGreaterThan(0);
  });

  it('commits actual price on Enter, cancels on Escape, and expands validation', async () => {
    renderPage('/admin/quotations/Q-2026-0009');
    fireEvent.click(await screen.findByRole('button', { name: /edit actual price/i }));
    const input = screen.getByRole('textbox', { name: /actual price/i });
    fireEvent.change(input, { target: { value: '1500' } });
    expect(screen.getByText(/Margin preview/)).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('textbox', { name: /actual price/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /edit actual price/i }));
    fireEvent.keyDown(screen.getByRole('textbox', { name: /actual price/i }), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: /Validation \(1\)/i }));
    expect(screen.getByText(/Pricing incomplete/)).toBeInTheDocument();
  });

  it('keeps preview disabled with the required tooltip', async () => {
    renderPage('/admin/quotations/Q-2026-0009');
    expect(await screen.findByTitle('PDF template required')).toBeDisabled();
  });
});
