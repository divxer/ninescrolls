import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { RfqCtaSidebar } from './RfqCtaSidebar';
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

const post = {
  slug: 'rie-guide',
  title: 'RIE Guide',
  relatedProducts: [{ href: '/products/icp-rie-200', label: 'ICP-RIE 200' }],
} as InsightsPost;

beforeEach(() => { vi.clearAllMocks(); });

describe('RfqCtaSidebar', () => {
  it('renders quote button', () => {
    render(<MemoryRouter><RfqCtaSidebar post={post} ctaPosition="sidebar" /></MemoryRouter>);
    expect(screen.getByRole('link', { name: /Request a quote/i })).toBeInTheDocument();
  });

  it('navigates with correct URL on click', () => {
    render(<MemoryRouter><RfqCtaSidebar post={post} ctaPosition="sidebar" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('products=icp-rie-200'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('source=insights%2Frie-guide'));
  });

  it('emits sidebar analytics event', () => {
    render(<MemoryRouter><RfqCtaSidebar post={post} ctaPosition="sidebar" /></MemoryRouter>);
    fireEvent.click(screen.getByRole('link'));
    expect(trackCustomEvent).toHaveBeenCalledWith('insights_cta_click', expect.objectContaining({
      ctaPosition: 'sidebar',
    }));
  });
});
