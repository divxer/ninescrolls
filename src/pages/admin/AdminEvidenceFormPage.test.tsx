import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminEvidenceFormPage } from './AdminEvidenceFormPage';

const getEvidence = vi.fn();
vi.mock('../../services/evidenceAdminService', () => ({
  getEvidence: (id: string) => getEvidence(id),
  createEvidence: vi.fn(),
  updateEvidence: vi.fn(),
}));
vi.mock('../../components/admin/EvidenceForm', () => ({
  EvidenceForm: () => <div data-testid="evidence-form" />,
}));

beforeEach(() => getEvidence.mockReset());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/evidence/new" element={<AdminEvidenceFormPage />} />
        <Route path="/admin/evidence/:id/edit" element={<AdminEvidenceFormPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminEvidenceFormPage', () => {
  it('shows a load error when fetching the record fails', async () => {
    getEvidence.mockRejectedValueOnce(new Error('not found'));
    renderAt('/admin/evidence/e-1/edit');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not found/i));
    expect(screen.queryByTestId('evidence-form')).not.toBeInTheDocument();
  });
  it('renders the form for the new route without loading', () => {
    renderAt('/admin/evidence/new');
    expect(screen.getByTestId('evidence-form')).toBeInTheDocument();
    expect(getEvidence).not.toHaveBeenCalled();
  });
});
