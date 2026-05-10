import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RfqCtaCard } from './RfqCtaCard';
import type { InsightsPost } from '../../types';

const navigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigate };
});

const trackCustomEvent = vi.fn();
vi.mock('../../hooks/useCombinedAnalytics', () => ({
  useCombinedAnalytics: () => ({ trackCustomEvent }),
}));

const basePost = {
  slug: 'rie-guide',
  title: 'RIE Guide',
} as InsightsPost;

beforeEach(() => { vi.clearAllMocks(); });

function renderCard(post: InsightsPost) {
  return render(<MemoryRouter><RfqCtaCard post={post} ctaPosition="article-footer" /></MemoryRouter>);
}

describe('RfqCtaCard', () => {
  it('renders generic copy when no relatedProducts', () => {
    renderCard({ ...basePost, relatedProducts: [] });
    expect(screen.getByText(/Need help with this process/i)).toBeInTheDocument();
  });

  it('renders single-product copy when one relatedProduct', () => {
    renderCard({
      ...basePost,
      relatedProducts: [{ href: '/products/icp-rie-200', label: 'ICP-RIE 200' }],
    });
    expect(screen.getByText(/Looking to deploy ICP-RIE 200/i)).toBeInTheDocument();
  });

  it('renders multi-product copy when multiple relatedProducts', () => {
    renderCard({
      ...basePost,
      relatedProducts: [
        { href: '/products/a', label: 'A' },
        { href: '/products/b', label: 'B' },
      ],
    });
    expect(screen.getByText(/Compare and request quotes/i)).toBeInTheDocument();
  });

  it('navigates to /rfq with correct params on click', () => {
    renderCard({
      ...basePost,
      relatedProducts: [{ href: '/products/icp-rie-200', label: 'ICP-RIE 200' }],
    });
    fireEvent.click(screen.getByRole('link'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('products=icp-rie-200'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('source=insights%2Frie-guide'));
  });

  it('emits insights_cta_click analytics on click', () => {
    renderCard({ ...basePost, relatedProducts: [] });
    fireEvent.click(screen.getByRole('link'));
    expect(trackCustomEvent).toHaveBeenCalledWith('insights_cta_click', expect.objectContaining({
      ctaPosition: 'article-footer',
      articleSlug: 'rie-guide',
      productCount: 0,
      productSlugs: '',
    }));
  });
});
