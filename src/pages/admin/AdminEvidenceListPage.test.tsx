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
  it('searches by title', async () => {
    renderPage();
    await screen.findByText('Alpha publication');
    fireEvent.change(screen.getByPlaceholderText(/Search/i), { target: { value: 'beta' } });
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
  it('opens the detail panel when a row is clicked', async () => {
    renderPage();
    fireEvent.click(await screen.findByText('Alpha publication'));
    const panel = await screen.findByRole('complementary', { name: /Evidence detail/i });
    expect(within(panel).getByText('Publication verification')).toBeInTheDocument();
  });
  it('archives selected rows', async () => {
    setEvidenceStatus.mockResolvedValue({});
    renderPage();
    await screen.findByText('Alpha publication');
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole('button', { name: /Archive selected/i }));
    await waitFor(() => expect(setEvidenceStatus).toHaveBeenCalledWith('e-1', EVIDENCE_STATUS.ARCHIVED));
  });
  it('shows an error when loading fails', async () => {
    listAllEvidence.mockReset().mockRejectedValueOnce(new Error('load boom'));
    renderPage();
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/load boom/i));
  });
});
