import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvidenceForm } from './EvidenceForm';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const fetchAllInsightsPosts = vi.fn();
vi.mock('../../services/insightsService', () => ({
  fetchAllInsightsPosts: () => fetchAllInsightsPosts(),
}));

const getContentImageUploadUrl = vi.fn();
const uploadImageToS3 = vi.fn();
vi.mock('../../services/insightsImageService', () => ({
  getContentImageUploadUrl: (...a: unknown[]) => getContentImageUploadUrl(...a),
  uploadImageToS3: (...a: unknown[]) => uploadImageToS3(...a),
}));

const noop = () => {};
beforeEach(() => {
  fetchAllInsightsPosts.mockReset().mockResolvedValue([{ slug: 'temporary-bonding' }, { slug: 'via-etch' }]);
  getContentImageUploadUrl.mockReset();
  uploadImageToS3.mockReset();
});

describe('EvidenceForm', () => {
  it('renders a product checkbox for every canonical product, including hy-4l and pluto-t', () => {
    render(<EvidenceForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText('ald')).toBeInTheDocument();
    expect(screen.getByLabelText('hy-4l')).toBeInTheDocument();
    expect(screen.getByLabelText('pluto-t')).toBeInTheDocument();
  });

  it('populates the article-slug select from existing insights posts', async () => {
    render(<EvidenceForm onSubmit={noop} onCancel={noop} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'temporary-bonding' })).toBeInTheDocument());
  });

  it('blocks submit and shows an error when no payload target is provided', () => {
    const onSubmit = vi.fn();
    render(<EvidenceForm onSubmit={onSubmit} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Deep Etch' } });
    fireEvent.change(screen.getByLabelText(/^Slug/i), { target: { value: 'deep-etch' } });
    fireEvent.click(screen.getByLabelText('ald'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one/i)).toBeInTheDocument();
  });

  it('uploads an image via the content pipeline and adds the returned cdnUrl as a payload', async () => {
    getContentImageUploadUrl.mockResolvedValueOnce({ uploadUrl: 'https://s3/put', s3Key: 'k', cdnUrl: 'https://cdn/x.webp' });
    uploadImageToS3.mockResolvedValueOnce(undefined);
    const onSubmit = vi.fn();
    render(<EvidenceForm onSubmit={onSubmit} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'SEM Set' } });
    fireEvent.change(screen.getByLabelText(/^Slug/i), { target: { value: 'sem-set' } });
    fireEvent.click(screen.getByLabelText('ald'));

    const file = new File(['x'], 'sem.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Upload image/i), { target: { files: [file] } });
    await waitFor(() => expect(uploadImageToS3).toHaveBeenCalledWith('https://s3/put', file));
    await waitFor(() => expect(screen.getByText('https://cdn/x.webp')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].images).toEqual(['https://cdn/x.webp']);
  });

  it('submits a valid record with selected products and a sourceUrl', () => {
    const onSubmit = vi.fn();
    render(<EvidenceForm onSubmit={onSubmit} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Deep Etch' } });
    fireEvent.change(screen.getByLabelText(/^Slug/i), { target: { value: 'deep-etch' } });
    fireEvent.change(screen.getByLabelText(/Source URL/i), { target: { value: 'https://x/y.pdf' } });
    fireEvent.click(screen.getByLabelText('ald'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Deep Etch', slug: 'deep-etch', products: ['ald'], sourceUrl: 'https://x/y.pdf',
      type: EVIDENCE_TYPE.APPLICATION_NOTE, status: EVIDENCE_STATUS.DRAFT,
    });
  });
});
