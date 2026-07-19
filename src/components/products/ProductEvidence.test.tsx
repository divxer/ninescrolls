import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProductEvidence } from './ProductEvidence';

const fetchPublishedEvidence = vi.fn();
vi.mock('../../services/evidenceService', () => ({
  fetchPublishedEvidence: (slug: string) => fetchPublishedEvidence(slug),
}));

beforeEach(() => fetchPublishedEvidence.mockReset());

describe('ProductEvidence', () => {
  it('renders nothing when there is no published evidence', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([]);
    const { container } = render(<ProductEvidence productSlug="icp-etcher" />);
    await waitFor(() => expect(fetchPublishedEvidence).toHaveBeenCalledWith('icp-etcher'));
    expect(container.querySelector('section')).toBeNull();
  });

  it('lists publications with represented-platform intro, badge, summary and source link', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([
      { id: '1', type: 'publication', title: 'Metalens paper', journal: 'Laser & Photonics Reviews', year: 2024, sourceUrl: 'https://doi.org/10.1/lpr', publicSummary: 'Metalens patterned by etching.' },
      { id: '2', type: 'publication', title: 'Flow viz paper', journal: 'Light: Science & Applications', year: 2025, sourceUrl: 'https://doi.org/10.1/lsa' },
    ]);
    render(<ProductEvidence productSlug="icp-etcher" />);
    expect(await screen.findByText('Peer-reviewed research')).toBeInTheDocument();
    expect(screen.getByText(/the ICP etching platform we represent · 2 papers/)).toBeInTheDocument();
    expect(screen.getByText('Metalens paper')).toBeInTheDocument();
    expect(screen.getByText('LPR 2024')).toBeInTheDocument();
    expect(screen.getByText('Metalens patterned by etching.')).toBeInTheDocument();
    expect(screen.getByText('LSA 2025')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /view source/i });
    expect(links[0]).toHaveAttribute('href', 'https://doi.org/10.1/lpr');
  });

  it('ignores non-publication records and shows a Show-all toggle beyond the preview count', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: String(i), type: 'publication', title: `P${i}`, journal: 'Obscure J', year: 2020,
      sourceUrl: `https://doi.org/10/${i}`,
    }));
    fetchPublishedEvidence.mockResolvedValueOnce([...many, { id: 'n', type: 'application_note', title: 'a note' }]);
    render(<ProductEvidence productSlug="icp-etcher" />);
    expect(await screen.findByText('Show all 7 →')).toBeInTheDocument();
    expect(screen.queryByText('a note')).not.toBeInTheDocument();
  });
});
