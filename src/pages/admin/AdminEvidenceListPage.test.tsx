import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminEvidenceListPage } from './AdminEvidenceListPage';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const listAllEvidence = vi.fn();
const deleteEvidence = vi.fn();
const setEvidenceStatus = vi.fn();
vi.mock('../../services/evidenceAdminService', () => ({
  listAllEvidence: () => listAllEvidence(),
  deleteEvidence: (id: string) => deleteEvidence(id),
  setEvidenceStatus: (id: string, status: string) => setEvidenceStatus(id, status),
}));

const rows = [
  { id: 'e-1', title: 'Alpha publication', type: EVIDENCE_TYPE.PUBLICATION, status: EVIDENCE_STATUS.DRAFT, products: ['icp-etcher'], summary: 'sum a', sourceUrl: 'https://doi.org/x', updatedAt: '2026-07-13T00:00:00Z', meta: JSON.stringify({ doi: 'x', journal: 'PhotoniX', year: 2022, verifiedAt: '2026-07-13', relationshipDisclosure: 'd' }) },
  { id: 'e-2', title: 'Beta note', type: EVIDENCE_TYPE.APPLICATION_NOTE, status: EVIDENCE_STATUS.PUBLISHED, products: ['rie-etcher'], summary: 'sum b', sourceUrl: 'https://x/y.pdf', updatedAt: '2026-07-10T00:00:00Z', meta: null },
];
const manyRows = Array.from({ length: 30 }, (_, i) => ({
  id: `m-${i}`, title: `Row ${String(i).padStart(2, '0')}`, type: EVIDENCE_TYPE.PUBLICATION,
  status: EVIDENCE_STATUS.DRAFT, products: ['icp-etcher'], summary: 's', sourceUrl: 'https://doi.org/z',
  // Monotonic descending dates (Row 00 newest) so the default updatedAt-desc
  // sort yields Row 00..29 in numeric order → Row 00 on page 1, Row 25 on page 2.
  updatedAt: `2026-06-${String(30 - i).padStart(2, '0')}T00:00:00Z`, meta: null,
}));

beforeEach(() => {
  listAllEvidence.mockReset().mockResolvedValue(rows);
  deleteEvidence.mockReset();
  setEvidenceStatus.mockReset();
});

const renderPage = () => render(<MemoryRouter><AdminEvidenceListPage /></MemoryRouter>);

describe('AdminEvidenceListPage (redesign)', () => {
  it('shows all records with type labels and statuses', async () => {
    renderPage();
    expect(await screen.findByText('Alpha publication')).toBeInTheDocument();
    expect(screen.getByText('Beta note')).toBeInTheDocument();
    expect(screen.getAllByText('Published Research').length).toBeGreaterThan(0);
  });
  it('searches by title (via the labelled search box)', async () => {
    renderPage();
    await screen.findByText('Alpha publication');
    fireEvent.change(screen.getByRole('textbox', { name: /Search evidence/i }), { target: { value: 'beta' } });
    expect(screen.queryByText('Alpha publication')).not.toBeInTheDocument();
    expect(screen.getByText('Beta note')).toBeInTheDocument();
  });
  it('filters by status', async () => {
    renderPage();
    await screen.findByText('Alpha publication');
    fireEvent.change(screen.getByLabelText(/Status/i), { target: { value: EVIDENCE_STATUS.PUBLISHED } });
    expect(screen.queryByText('Alpha publication')).not.toBeInTheDocument();
    expect(screen.getByText('Beta note')).toBeInTheDocument();
  });
  it('opens the detail panel when the title button is clicked', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Alpha publication' }));
    const panel = await screen.findByRole('dialog');
    expect(within(panel).getByText('Publication verification')).toBeInTheDocument();
  });
  it('archives selected rows', async () => {
    setEvidenceStatus.mockResolvedValue({});
    renderPage();
    await screen.findByText('Alpha publication');
    fireEvent.click(screen.getByRole('checkbox', { name: /Select Alpha publication/i }));
    fireEvent.click(screen.getByRole('button', { name: /Archive selected/i }));
    await waitFor(() => expect(setEvidenceStatus).toHaveBeenCalledWith('e-1', EVIDENCE_STATUS.ARCHIVED));
  });
  it('keeps only the failed record selected after a partial archive failure', async () => {
    setEvidenceStatus
      .mockRejectedValueOnce(new Error('boom'))   // e-1 fails
      .mockResolvedValueOnce({});                 // e-2 ok
    renderPage();
    await screen.findByText('Alpha publication');
    fireEvent.click(screen.getByRole('checkbox', { name: /Select all/i }));
    fireEvent.click(screen.getByRole('button', { name: /Archive selected/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/Failed to archive 1 of 2/i));
    // e-1 remains selected, e-2 was cleared
    await waitFor(() => expect((screen.getByRole('checkbox', { name: /Select Alpha publication/i }) as HTMLInputElement).checked).toBe(true));
  });
  it('clears selection when the filter changes (never archives a hidden record)', async () => {
    renderPage();
    await screen.findByText('Alpha publication');
    fireEvent.click(screen.getByRole('checkbox', { name: /Select Alpha publication/i }));
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: EVIDENCE_TYPE.APPLICATION_NOTE } });
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: 'all' } });
    expect((screen.getByRole('checkbox', { name: /Select Alpha publication/i }) as HTMLInputElement).checked).toBe(false);
  });
  it('paginates — 30 rows split into pages, Next reveals page 2', async () => {
    listAllEvidence.mockReset().mockResolvedValue(manyRows);
    renderPage();
    await screen.findByText('Row 00');
    expect(screen.queryByText('Row 25')).not.toBeInTheDocument();
    expect(screen.getByText(/1.25 of 30/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/i }));
    expect(await screen.findByText('Row 25')).toBeInTheDocument();
    expect(screen.queryByText('Row 00')).not.toBeInTheDocument();
  });
  it('sets aria-sort on the active sort column', async () => {
    renderPage();
    await screen.findByText('Alpha publication');
    fireEvent.click(screen.getByRole('button', { name: /^Title/i }));
    const titleHeader = screen.getByRole('columnheader', { name: /Title/i });
    expect(['ascending', 'descending']).toContain(titleHeader.getAttribute('aria-sort'));
  });
  it('shows an error when loading fails', async () => {
    listAllEvidence.mockReset().mockRejectedValueOnce(new Error('load boom'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/load boom/i));
  });
});
