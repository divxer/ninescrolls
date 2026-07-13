import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminEvidenceListPage } from './AdminEvidenceListPage';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const listAllEvidence = vi.fn();
vi.mock('../../services/evidenceAdminService', () => ({
  listAllEvidence: () => listAllEvidence(),
  deleteEvidence: vi.fn(),
}));
beforeEach(() => listAllEvidence.mockReset());

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
});
