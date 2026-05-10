import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { ArticleQASection } from './ArticleQASection';
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

vi.mock('../../hooks/useArticleQuestions', () => ({
  useArticleQuestions: () => ({ questions: [], loading: false, refetch: vi.fn() }),
}));

vi.mock('../../services/articleQuestionsService', () => ({
  submitQuestion: vi.fn().mockResolvedValue({ success: true, message: '' }),
}));

const post = {
  slug: 'rie-guide',
  title: 'RIE Guide',
  relatedProducts: [{ href: '/products/icp-rie-200', label: 'ICP-RIE 200' }],
} as InsightsPost;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
});

function renderSection() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <ArticleQASection slug="rie-guide" post={post} />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe('ArticleQASection — purchase intent checkbox', () => {
  it('renders the purchase intent checkbox unchecked by default', () => {
    renderSection();
    const checkbox = screen.getByRole('checkbox', { name: /evaluating equipment for purchase/i });
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).not.toBeChecked();
  });

  it('toggles checkbox on click', () => {
    renderSection();
    const checkbox = screen.getByRole('checkbox', { name: /evaluating equipment for purchase/i });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('redirects to /rfq with article context when checkbox is checked and submit succeeds', async () => {
    renderSection();
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'alice@test.co' } });
    fireEvent.change(screen.getByPlaceholderText(/What would you like to know/i), {
      target: { value: 'A long enough question about RIE etching parameters' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /evaluating equipment for purchase/i }));
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith(
        expect.stringContaining('products=icp-rie-200'),
      );
    });
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('source=insights%2Frie-guide'));
    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('via=ask-checkbox'));
  });

  it('does NOT redirect when checkbox is unchecked', async () => {
    renderSection();
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'alice@test.co' } });
    fireEvent.change(screen.getByPlaceholderText(/What would you like to know/i), {
      target: { value: 'A long enough question about RIE etching parameters' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    // Wait a tick so any async submit logic settles, then assert no redirect
    await new Promise((r) => setTimeout(r, 50));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('emits insights_question_with_purchase_intent analytics on success with checkbox', async () => {
    renderSection();
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Alice' } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: 'alice@test.co' } });
    const question = 'A long enough question about RIE etching parameters';
    fireEvent.change(screen.getByPlaceholderText(/What would you like to know/i), { target: { value: question } });
    fireEvent.click(screen.getByRole('checkbox', { name: /evaluating equipment for purchase/i }));
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    await waitFor(() => {
      expect(trackCustomEvent).toHaveBeenCalledWith('insights_question_with_purchase_intent', {
        articleSlug: 'rie-guide',
        questionLength: question.length,
      });
    });
  });
});
