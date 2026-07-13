import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProductEvidence } from './ProductEvidence';
import { EVIDENCE_TYPE } from '../../config/evidence';

const fetchPublishedEvidence = vi.fn();
vi.mock('../../services/evidenceService', () => ({
  fetchPublishedEvidence: (slug: string) => fetchPublishedEvidence(slug),
}));

beforeEach(() => fetchPublishedEvidence.mockReset());

describe('ProductEvidence', () => {
  it('renders nothing when there is no published evidence', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([]);
    const { container } = render(<ProductEvidence productSlug="ald" />);
    await waitFor(() => expect(fetchPublishedEvidence).toHaveBeenCalledWith('ald'));
    expect(container.querySelector('section')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('renders grouped counts with fixed labels when evidence exists', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([
      { id: '1', type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { id: '2', type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { id: '3', type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { id: '4', type: EVIDENCE_TYPE.PUBLICATION },
      { id: '5', type: EVIDENCE_TYPE.VALIDATION },
      { id: '6', type: EVIDENCE_TYPE.VALIDATION },
    ]);
    render(<ProductEvidence productSlug="ald" />);
    expect(await screen.findByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('3 Application Notes')).toBeInTheDocument();
    expect(screen.getByText('1 Published Research')).toBeInTheDocument();
    expect(screen.getByText('2 Process Validation')).toBeInTheDocument();
  });
});
