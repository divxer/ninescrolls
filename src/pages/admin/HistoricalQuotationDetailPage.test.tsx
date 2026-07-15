import { render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/priceAdminService', () => ({
  getHistoricalQuotation: vi.fn(),
  usd: (c: number | null | undefined) => c == null ? '—' : `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  rmbFen: (f: number | null | undefined) => f == null ? '—' : `¥${(f / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`,
}));

import * as service from '../../services/priceAdminService';
import type { HistoricalQuotationDetail } from '../../services/priceAdminService';
import { HistoricalQuotationDetailPage } from './HistoricalQuotationDetailPage';

const detail = (overrides: Record<string, unknown> = {}) => ({
  historicalId: 'hist-42', status: 'HISTORICAL' as const, customerName: 'Central University',
  productName: 'NineScrolls Lab System', configuration: 'Dual station, HEPA', supplierId: 'supplier-9',
  supplierQuoteText: 'Supplier raw quote RMB 88,000', customerQuoteText: 'Customer raw quote USD 19,500',
  supplierQuoteBasis: 'FOB Shanghai', supplierEvidenceType: 'EMAIL_ATTACHMENT',
  supplierQuotedAt: '2020-05-01T00:00:00Z', supplierAmountFen: 8_800_000,
  sourceDocument: 'legacy-quotes.xlsx', sourceDocumentHash: 'sha256-source-123', sourceRow: 17,
  sourceQuotationNumber: 'LEGACY-Q-77', quotedAt: '2020-05-12T00:00:00Z', legacyStatus: 'Won',
  customerAmountUsdCents: 1_950_000, importBatchId: 'batch-2026-07',
  historicalFxProvenance: 'CONFIRMED' as const, historicalFxRate: '7.0912',
  historicalFxSource: 'PBOC archive', historicalFxNote: 'Rate confirmed from dated archive.',
  dataQualityFlags: ['INCOMPLETE', 'UNCONFIRMED', 'CONFLICT_RESOLVED'] as HistoricalQuotationDetail['dataQualityFlags'],
  dataQualityNotes: ['Missing freight breakdown', 'Customer date confirmed manually'],
  contentHash: 'sha256-content-456', importedAt: '2026-07-14T00:00:00Z', importedBy: 'historical-import-script',
  ...overrides,
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const renderPage = (id = 'hist-42') => render(
  <MemoryRouter initialEntries={[`/admin/quotations/historical/${id}`]}>
    <Routes><Route path="/admin/quotations/historical/:historicalId" element={<HistoricalQuotationDetailPage />} /></Routes>
  </MemoryRouter>,
);

describe('HistoricalQuotationDetailPage', () => {
  beforeEach(() => {
    vi.mocked(service.getHistoricalQuotation).mockReset();
  });

  it('shows loading while requesting the route historicalId', async () => {
    const request = deferred<ReturnType<typeof detail>>();
    vi.mocked(service.getHistoricalQuotation).mockReturnValue(request.promise);
    renderPage('hist-route-id');
    expect(screen.getByText('Loading historical quotation…')).toBeInTheDocument();
    expect(service.getHistoricalQuotation).toHaveBeenCalledWith('hist-route-id');
    request.resolve(detail({ historicalId: 'hist-route-id' }));
    expect(await screen.findByRole('heading', { name: 'LEGACY-Q-77' })).toBeInTheDocument();
  });

  it('shows service errors', async () => {
    vi.mocked(service.getHistoricalQuotation).mockImplementation(() => { throw new Error('Archive unavailable'); });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Archive unavailable');
  });

  it('shows not found when the service returns no record', async () => {
    vi.mocked(service.getHistoricalQuotation).mockResolvedValue(null as never);
    renderPage();
    expect(await screen.findByText('Historical quotation not found.')).toBeInTheDocument();
  });

  it('renders the immutable historical record and its full lineage', async () => {
    vi.mocked(service.getHistoricalQuotation).mockResolvedValue(detail());
    renderPage();

    expect(await screen.findByRole('heading', { name: 'LEGACY-Q-77' })).toBeInTheDocument();
    expect(screen.getByText('Historical')).toBeInTheDocument();
    expect(screen.getByText('Central University')).toBeInTheDocument();
    expect(screen.getByText('NineScrolls Lab System')).toBeInTheDocument();
    expect(screen.getByText('Dual station, HEPA')).toBeInTheDocument();
    expect(screen.getByText('Supplier raw quote RMB 88,000')).toBeInTheDocument();
    expect(screen.getByText('Customer raw quote USD 19,500')).toBeInTheDocument();
    expect(screen.getByText('FOB Shanghai')).toBeInTheDocument();
    expect(screen.getByText('EMAIL_ATTACHMENT')).toBeInTheDocument();
    expect(screen.getByText('2020-05-01')).toBeInTheDocument();
    expect(screen.getByText('2020-05-12')).toBeInTheDocument();
    expect(screen.getByText('Won')).toBeInTheDocument();
    expect(screen.getByText('¥88,000.00')).toBeInTheDocument();
    expect(screen.getByText('$19,500.00')).toBeInTheDocument();

    const quality = screen.getByRole('region', { name: 'Data quality' });
    for (const text of ['INCOMPLETE', 'UNCONFIRMED', 'CONFLICT_RESOLVED', 'Missing freight breakdown', 'Customer date confirmed manually']) {
      expect(within(quality).getByText(text)).toBeInTheDocument();
    }

    const fx = screen.getByRole('region', { name: 'Historical FX' });
    for (const text of ['Confirmed', '7.0912', 'PBOC archive', 'Rate confirmed from dated archive.']) {
      expect(within(fx).getByText(text)).toBeInTheDocument();
    }

    const lineage = screen.getByRole('region', { name: 'Source lineage' });
    for (const text of ['legacy-quotes.xlsx', '17', 'sha256-source-123', 'sha256-content-456', 'batch-2026-07', 'historical-import-script', '2026-07-14']) {
      expect(within(lineage).getByText(text)).toBeInTheDocument();
    }
  });

  it('omits absent structured money and visibly labels inferred FX', async () => {
    vi.mocked(service.getHistoricalQuotation).mockResolvedValue(detail({
      supplierAmountFen: null, customerAmountUsdCents: null,
      historicalFxProvenance: 'INFERRED', historicalFxRate: '7.0000', historicalFxSource: null,
    }));
    renderPage();
    expect(await screen.findByText('Inferred')).toBeInTheDocument();
    expect(screen.queryByText('¥88,000.00')).not.toBeInTheDocument();
    expect(screen.queryByText('$19,500.00')).not.toBeInTheDocument();
    expect(screen.queryByText('Supplier amount')).not.toBeInTheDocument();
    expect(screen.queryByText('Customer amount')).not.toBeInTheDocument();
  });

  it('does not manufacture an FX rate or margin for UNKNOWN provenance', async () => {
    vi.mocked(service.getHistoricalQuotation).mockResolvedValue(detail({
      historicalFxProvenance: 'UNKNOWN', historicalFxRate: null,
      historicalFxSource: null, historicalFxNote: null,
    }));
    renderPage();
    expect(await screen.findByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText('7.0912')).not.toBeInTheDocument();
    expect(screen.queryByText(/margin/i)).not.toBeInTheDocument();
  });

  it('offers no mutating or workflow actions', async () => {
    vi.mocked(service.getHistoricalQuotation).mockResolvedValue(detail());
    renderPage();
    await screen.findByRole('heading', { name: 'LEGACY-Q-77' });
    for (const action of [/edit/i, /save/i, /pdf/i, /send/i, /convert/i, /create order/i, /view order/i]) {
      expect(screen.queryByRole('button', { name: action })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: action })).not.toBeInTheDocument();
    }
  });
});
