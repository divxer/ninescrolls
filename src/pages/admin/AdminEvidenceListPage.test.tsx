import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminEvidenceListPage } from './AdminEvidenceListPage';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const listAllEvidence = vi.fn();
const deleteEvidence = vi.fn();
vi.mock('../../services/evidenceAdminService', () => ({
  listAllEvidence: () => listAllEvidence(),
  deleteEvidence: (id: string) => deleteEvidence(id),
}));
beforeEach(() => {
  listAllEvidence.mockReset();
  deleteEvidence.mockReset();
});

const rows = [
  { id: 'e-1', title: 'Draft Note', type: EVIDENCE_TYPE.APPLICATION_NOTE, status: EVIDENCE_STATUS.DRAFT, products: ['ald'] },
  { id: 'e-2', title: 'Pub Paper', type: EVIDENCE_TYPE.PUBLICATION, status: EVIDENCE_STATUS.PUBLISHED, products: ['rie-etcher'] },
  { id: 'e-3', title: 'Archived Val', type: EVIDENCE_TYPE.VALIDATION, status: EVIDENCE_STATUS.ARCHIVED, products: ['ald'] },
];

describe('AdminEvidenceListPage', () => {
  it('shows all statuses including draft and archived', async () => {
    listAllEvidence.mockResolvedValueOnce(rows);
    render(<MemoryRouter><AdminEvidenceListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Draft Note')).toBeInTheDocument());
    expect(screen.getByText('Pub Paper')).toBeInTheDocument();
    expect(screen.getByText('Archived Val')).toBeInTheDocument();
  });
  it('filters by status', async () => {
    listAllEvidence.mockResolvedValueOnce(rows);
    render(<MemoryRouter><AdminEvidenceListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Draft Note')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Filter by status/i), { target: { value: EVIDENCE_STATUS.PUBLISHED } });
    expect(screen.queryByText('Draft Note')).not.toBeInTheDocument();
    expect(screen.getByText('Pub Paper')).toBeInTheDocument();
  });
  it('shows an error (not an unhandled rejection) when the list fails to load', async () => {
    listAllEvidence.mockRejectedValueOnce(new Error('load boom'));
    render(<MemoryRouter><AdminEvidenceListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/load boom/i));
  });
  it('shows an error when a delete fails', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    listAllEvidence.mockResolvedValueOnce(rows);
    deleteEvidence.mockRejectedValueOnce(new Error('delete boom'));
    render(<MemoryRouter><AdminEvidenceListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Draft Note')).toBeInTheDocument());
    fireEvent.click(screen.getAllByRole('button', { name: /Delete/i })[0]);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/delete boom/i));
    confirmSpy.mockRestore();
  });
});
