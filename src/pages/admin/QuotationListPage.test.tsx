import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/priceAdminService', () => ({
  usd: (c: number | null) => c == null ? '—' : `$${(c / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
  marginPct: (bp: number | null) => bp == null ? '—' : `${(bp / 100).toFixed(1)}%`,
  listQuotations: vi.fn(),
  listHistoricalQuotations: vi.fn(),
}));

import * as service from '../../services/priceAdminService';
import { QuotationListPage } from './QuotationListPage';

const live = (number: string) => ({
  quotationNumber: number, version: 1, revision: 1, status: 'DRAFT' as const,
  schemeLabel: 'Standard', customerName: `Customer ${number}`,
  totalCostUsdCents: 100000, suggestedTotalUsdCents: 160000,
  actualTotalUsdCents: 155000, actualMarginBp: 3548, belowMinMargin: false,
  incomplete: false, lineCount: 3, createdAt: 'T', updatedAt: '2026-07-14T00:00:00Z',
});

const historical = (id: string, overrides: Record<string, unknown> = {}) => ({
  historicalId: id, status: 'HISTORICAL' as const, customerName: `Customer ${id}`,
  productName: `Project ${id}`, configuration: 'Configured', supplierId: 'supplier',
  supplierQuoteText: 'RMB 1', customerQuoteText: '$1', sourceDocument: 'source.xlsx',
  sourceDocumentHash: 'hash', sourceRow: 7, importBatchId: 'batch',
  historicalFxProvenance: 'CONFIRMED' as const, dataQualityFlags: [], contentHash: id,
  importedAt: '2026-07-14T00:00:00Z', sourceQuotationNumber: null,
  legacyStatus: 'Won', customerAmountUsdCents: 123450, quotedAt: '2020-06-15T00:00:00Z',
  ...overrides,
});

const renderPage = () => render(<MemoryRouter><QuotationListPage /></MemoryRouter>);
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

describe('QuotationListPage', () => {
  beforeEach(() => {
    vi.mocked(service.listQuotations).mockReset().mockResolvedValue({ items: [live('Q-2026-0008')], nextToken: null });
    vi.mocked(service.listHistoricalQuotations).mockReset().mockResolvedValue({ items: [], nextToken: null });
  });

  it('queries Live initially and lazily queries Historical only when selected', async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByText('Q-2026-0008')).toBeInTheDocument();
    expect(service.listQuotations).toHaveBeenCalledWith({});
    expect(service.listHistoricalQuotations).not.toHaveBeenCalled();
    expect(screen.getByRole('tab', { name: 'Live' })).toHaveAttribute('aria-selected', 'true');

    await user.click(screen.getByRole('tab', { name: 'Historical' }));
    expect(service.listHistoricalQuotations).toHaveBeenCalledWith({});
    expect(screen.getByRole('tab', { name: 'Historical' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Historical' })).toBeInTheDocument();
  });

  it('uses roving focus and selects tabs with Arrow keys, Home, and End', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('Q-2026-0008');
    const liveTab = screen.getByRole('tab', { name: 'Live' });
    const historicalTab = screen.getByRole('tab', { name: 'Historical' });
    expect(liveTab).toHaveAttribute('tabindex', '0');
    expect(historicalTab).toHaveAttribute('tabindex', '-1');

    liveTab.focus();
    await user.keyboard('{ArrowRight}');
    expect(historicalTab).toHaveFocus();
    expect(historicalTab).toHaveAttribute('aria-selected', 'true');
    expect(historicalTab).toHaveAttribute('tabindex', '0');
    expect(service.listHistoricalQuotations).toHaveBeenCalledTimes(1);

    await user.keyboard('{ArrowRight}');
    expect(liveTab).toHaveFocus();
    expect(liveTab).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowLeft}');
    expect(historicalTab).toHaveFocus();
    expect(historicalTab).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(liveTab).toHaveFocus();
    expect(liveTab).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{End}');
    expect(historicalTab).toHaveFocus();
    expect(historicalTab).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}');
    expect(liveTab).toHaveFocus();
    expect(liveTab).toHaveAttribute('aria-selected', 'true');
    expect(service.listHistoricalQuotations).toHaveBeenCalledTimes(1);
  });

  it('keeps independent items, loading, errors, cursors, and load-more targets across tab switches', async () => {
    const user = userEvent.setup();
    const historicalPage = deferred<{ items: ReturnType<typeof historical>[]; nextToken: string | null }>();
    vi.mocked(service.listQuotations)
      .mockResolvedValueOnce({ items: [live('LIVE-1')], nextToken: 'live-next' })
      .mockResolvedValueOnce({ items: [live('LIVE-2')], nextToken: null });
    vi.mocked(service.listHistoricalQuotations)
      .mockReturnValueOnce(historicalPage.promise)
      .mockRejectedValueOnce(new Error('Historical page failed'));
    renderPage();
    expect(await screen.findByText('LIVE-1')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Historical' }));
    expect(screen.getByText('Loading historical quotations…')).toBeInTheDocument();
    expect(screen.queryByText('LIVE-1')).not.toBeInTheDocument();
    historicalPage.resolve({ items: [historical('hist-1')], nextToken: 'history-next' });
    expect(await screen.findByText('Historical #7')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(service.listHistoricalQuotations).toHaveBeenLastCalledWith({ nextToken: 'history-next' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Historical page failed');

    await user.click(screen.getByRole('tab', { name: 'Live' }));
    expect(screen.getByText('LIVE-1')).toBeInTheDocument();
    expect(screen.queryByText('Historical page failed')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load more' }));
    expect(service.listQuotations).toHaveBeenLastCalledWith({ nextToken: 'live-next' });
    expect(await screen.findByText('LIVE-2')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Historical' }));
    expect(screen.getByText('Historical #7')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Historical page failed');
    expect(service.listHistoricalQuotations).toHaveBeenCalledTimes(2);
  });

  it('renders historical rows with historicalId keys and the exact read-only fields', async () => {
    const user = userEvent.setup();
    vi.mocked(service.listHistoricalQuotations).mockResolvedValue({ items: [
      historical('hist-a', { sourceQuotationNumber: 'LEGACY-42', sourceRow: 4, dataQualityFlags: ['CONFLICT_RESOLVED'] }),
      historical('hist-b', { sourceRow: 9, dataQualityFlags: ['CONFLICT_RESOLVED', 'UNCONFIRMED', 'INCOMPLETE'] }),
    ], nextToken: null });
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Historical' }));

    const firstRow = await screen.findByTestId('hist-a');
    const secondRow = screen.getByTestId('hist-b');
    expect(firstRow).not.toBe(secondRow);
    expect(screen.getAllByTestId(/^hist-/)).toHaveLength(2);
    expect(within(firstRow).getByRole('link', { name: 'LEGACY-42' })).toHaveAttribute('href', '/admin/quotations/historical/hist-a');
    expect(within(secondRow).getByRole('link', { name: 'Historical #9' })).toHaveAttribute('href', '/admin/quotations/historical/hist-b');
    expect(within(secondRow).getByText('Project hist-b')).toBeInTheDocument();
    expect(within(secondRow).getByText('Won')).toBeInTheDocument();
    expect(within(secondRow).getByText('$1,234.50')).toBeInTheDocument();
    expect(within(secondRow).getByText('2020-06-15')).toBeInTheDocument();
    expect(within(secondRow).getByText('INCOMPLETE')).toBeInTheDocument();
    expect(within(secondRow).getByText('+2')).toBeInTheDocument();
  });

  it('renders concrete live actions and columns only in Live', async () => {
    const user = userEvent.setup();
    vi.mocked(service.listHistoricalQuotations).mockResolvedValue({ items: [historical('hist-only')], nextToken: null });
    renderPage();
    const liveLink = await screen.findByRole('link', { name: 'Q-2026-0008' });
    expect(liveLink).toHaveAttribute('href', '/admin/quotations/Q-2026-0008');
    expect(screen.getByRole('link', { name: 'Create quotation' })).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    for (const name of ['Scheme', 'Cost', 'Suggested', 'Actual', 'Margin']) {
      expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
    }

    await user.click(screen.getByRole('tab', { name: 'Historical' }));
    await screen.findByTestId('hist-only');
    expect(screen.queryByRole('link', { name: 'Create quotation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Q-2026-0008' })).not.toBeInTheDocument();
    expect(screen.queryByText('v1')).not.toBeInTheDocument();
    for (const name of ['Scheme', 'Cost', 'Suggested', 'Actual', 'Margin']) {
      expect(screen.queryByRole('columnheader', { name })).not.toBeInTheDocument();
    }
  });

  it('keeps the live list and guides setup through Suppliers, Price Book, and New quotation', async () => {
    vi.mocked(service.listQuotations).mockResolvedValue({ items: [], nextToken: null });
    renderPage();
    expect(await screen.findByText('No live quotations yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Suppliers' })).toHaveAttribute('href', '/admin/suppliers');
    expect(screen.getByRole('link', { name: 'Price Book' })).toHaveAttribute('href', '/admin/price-book');
    expect(screen.getByRole('link', { name: 'New quotation' })).toHaveAttribute('href', '/admin/quotations/new');
    expect(screen.getByRole('link', { name: 'Create quotation' })).toHaveAttribute('href', '/admin/quotations/new');
  });

  it('explains that an empty Historical list is populated by script only without upload UI', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('tab', { name: 'Historical' }));
    expect(await screen.findByText(/script-only administrative import/i)).toBeInTheDocument();
    expect(screen.queryByText(/upload/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
  });
});
