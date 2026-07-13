import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EvidenceDetailPanel } from './EvidenceDetailPanel';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const rec = {
  id: 'e1',
  title: 'Biomimetic sapphire windows enabled by inside-out femtosecond laser deep-scribing',
  type: EVIDENCE_TYPE.PUBLICATION,
  status: EVIDENCE_STATUS.DRAFT,
  products: ['icp-etcher'],
  summary: 'Peer-reviewed research using the ICP platform for which NineScrolls is the authorized distributor.',
  sourceUrl: 'https://doi.org/10.1186/s43074-022-00047-3',
  images: null, pdfUrl: null, articleSlug: null,
  updatedAt: '2026-07-13T00:00:00Z',
  meta: JSON.stringify({ doi: '10.1186/s43074-022-00047-3', journal: 'PhotoniX', year: 2022, verifiedAt: '2026-07-13', relationshipDisclosure: 'disclosed' }),
};

function renderPanel(props = {}) {
  return render(
    <MemoryRouter>
      <EvidenceDetailPanel record={rec} onClose={vi.fn()} onDelete={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe('EvidenceDetailPanel', () => {
  it('shows title, summary (as "Summary"), and source metadata', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: /Biomimetic sapphire windows/i })).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText(/Peer-reviewed research using the ICP platform/i)).toBeInTheDocument();
    expect(screen.getByText('PhotoniX')).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();
    const source = screen.getByRole('link', { name: /View source/i });
    expect(source).toHaveAttribute('href', 'https://doi.org/10.1186/s43074-022-00047-3');
  });
  it('renders the publication verification checklist from the record', () => {
    renderPanel();
    expect(screen.getByText('Publication verification')).toBeInTheDocument();
    expect(screen.getByText('Product selected')).toBeInTheDocument();
    expect(screen.getByText('DOI recorded')).toBeInTheDocument();
    expect(screen.getByText('Attribution disclosure present')).toBeInTheDocument();
  });
  it('has an Edit link to the record and fires onClose / onDelete', () => {
    const onClose = vi.fn(); const onDelete = vi.fn();
    renderPanel({ onClose, onDelete });
    expect(screen.getByRole('link', { name: /Edit evidence/i })).toHaveAttribute('href', '/admin/evidence/e1/edit');
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Delete evidence/i }));
    expect(onDelete).toHaveBeenCalledWith('e1');
  });
});
