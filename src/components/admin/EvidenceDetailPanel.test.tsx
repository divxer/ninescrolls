import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { EvidenceDetailPanel } from './EvidenceDetailPanel';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const baseRec = {
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

function renderPanel(props = {}, rec = baseRec) {
  return render(
    <MemoryRouter>
      <EvidenceDetailPanel record={rec} onClose={vi.fn()} onDelete={vi.fn()} {...props} />
    </MemoryRouter>
  );
}

describe('EvidenceDetailPanel', () => {
  it('is a labelled modal dialog', () => {
    renderPanel();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName(/Biomimetic sapphire windows/i);
  });
  it('shows title, summary (as "Summary"), and source metadata with a safe DOI link', () => {
    renderPanel();
    expect(screen.getByRole('heading', { name: /Biomimetic sapphire windows/i })).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText(/Peer-reviewed research using the ICP platform/i)).toBeInTheDocument();
    expect(screen.getByText('PhotoniX')).toBeInTheDocument();
    expect(screen.getByText('2022')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /View source/i })).toHaveAttribute('href', 'https://doi.org/10.1186/s43074-022-00047-3');
  });
  it('renders the publication verification checklist', () => {
    renderPanel();
    expect(screen.getByText('Publication verification')).toBeInTheDocument();
    expect(screen.getByText('Product selected')).toBeInTheDocument();
    expect(screen.getByText('DOI recorded')).toBeInTheDocument();
    expect(screen.getByText('Attribution disclosure present')).toBeInTheDocument();
  });
  it('closes on the close button and on Escape', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
  it('hides Delete until "More actions" is opened, then fires onDelete', () => {
    const onDelete = vi.fn();
    renderPanel({ onDelete });
    expect(screen.queryByRole('menuitem', { name: /Delete evidence/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /More actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Delete evidence/i }));
    expect(onDelete).toHaveBeenCalledWith('e1');
  });
  it('has an Edit link to the record', () => {
    renderPanel();
    expect(screen.getByRole('link', { name: /Edit evidence/i })).toHaveAttribute('href', '/admin/evidence/e1/edit');
  });
  it('does NOT render an unsafe javascript: sourceUrl as a clickable link', () => {
    renderPanel({}, { ...baseRec, sourceUrl: 'javascript:alert(1)', meta: JSON.stringify({}) });
    expect(screen.queryByRole('link', { name: /View source/i })).not.toBeInTheDocument();
  });
});

describe('EvidenceDetailPanel modal + link behaviour', () => {
  it('traps Tab / Shift+Tab focus within the dialog', () => {
    renderPanel();
    const closeBtn = screen.getByRole('button', { name: /close/i });
    closeBtn.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    const moreActions = screen.getByRole('button', { name: /More actions/i });
    expect(document.activeElement).toBe(moreActions);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);
  });
  it('falls back to the DOI link when sourceUrl is unsafe (does not suppress it)', () => {
    renderPanel({}, { ...baseRec, sourceUrl: 'javascript:alert(1)' });
    expect(screen.queryByRole('link', { name: /View source/i })).not.toBeInTheDocument();
    const doiLink = screen.getByRole('link', { name: /10\.1186\/s43074-022-00047-3/ });
    expect(doiLink).toHaveAttribute('href', 'https://doi.org/10.1186/s43074-022-00047-3');
  });
});
