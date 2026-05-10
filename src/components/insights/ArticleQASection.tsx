import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useArticleQuestions } from '../../hooks/useArticleQuestions';
import { useArticleQuestionForm } from '../../hooks/useArticleQuestionForm';
import { buildRfqUrl, relatedProductsToSlugs } from '../../utils/rfqAttribution';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';
import type { InsightsPost } from '../../types';

interface ArticleQASectionProps {
  slug: string;
  post?: InsightsPost;
}

/** Fixed sidebar "Ask" button + popup form modal */
export function FloatingAskButton({ slug, post }: { slug: string; post?: InsightsPost }) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const analytics = useCombinedAnalytics();
  const {
    form, update, handleSubmit, setPurchaseIntent,
    isSubmitting, isSuccess, error, turnstileSiteKey, widgetRef, token, reset,
  } = useArticleQuestionForm({
    slug,
    onPurchaseIntentSubmit: ({ questionLength }) => {
      analytics.trackCustomEvent('insights_question_with_purchase_intent', {
        articleSlug: slug,
        questionLength,
      });
    },
    onSuccessRedirect: () => {
      navigate(buildRfqUrl({
        products: relatedProductsToSlugs(post?.relatedProducts),
        sourceSlug: slug,
        extraParams: { via: 'ask-checkbox' },
      }));
    },
  });

  // Show after 400px scroll, hide when Q&A section is near viewport
  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY;
      const qaSection = document.getElementById('article-qa-section');
      if (!qaSection) {
        setVisible(scrollY > 400);
        return;
      }
      const qaSectionTop = qaSection.getBoundingClientRect().top + scrollY;
      setVisible(scrollY > 400 && scrollY < qaSectionTop - window.innerHeight * 0.5);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const resetAndClose = () => { setOpen(false); reset(); };

  return (
    <>
      {/* Fixed sidebar button — visible after 400px scroll, hides near Q&A section */}
      {visible && <button
        onClick={() => setOpen(true)}
        className="fixed left-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 pl-4 pr-3 py-3 bg-primary text-on-primary rounded-r-full shadow-lg hover:shadow-xl hover:-translate-y-1/2 hover:pl-5 transition-all text-sm font-medium max-md:pl-3 max-md:pr-2.5 max-md:py-2.5"
        aria-label="Ask a question about this article"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="15" r="0.5" fill="currentColor" />
        </svg>
        <span className="max-md:hidden">Ask</span>
      </button>}

      {/* Modal overlay + form */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={resetAndClose}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div
            className="relative bg-surface rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={resetAndClose}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-surface-container-low transition-colors text-on-surface-variant border-none bg-transparent cursor-pointer"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {isSuccess ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3 text-green-600">&#10003;</div>
                <h4 className="text-lg font-semibold text-on-surface mb-2">Question Submitted!</h4>
                <p className="text-on-surface-variant text-sm mb-4">
                  Thank you! Our team will review and respond soon.
                </p>
                <button
                  onClick={reset}
                  className="px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
                >
                  Ask Another Question
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-on-surface mb-1 pr-8">Ask a Question</h3>
                <p className="text-sm text-on-surface-variant mb-5">Our team will review and respond on this article page.</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
                    <div>
                      <label htmlFor="fab-name" className="block text-sm font-medium text-on-surface-variant mb-1">Name *</label>
                      <input
                        id="fab-name"
                        name="name"
                        type="text"
                        value={form.name}
                        onChange={update}
                        required
                        className="w-full px-3 py-2 border border-outline-variant/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="Your name"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label htmlFor="fab-email" className="block text-sm font-medium text-on-surface-variant mb-1">Email *</label>
                      <input
                        id="fab-email"
                        name="email"
                        type="email"
                        value={form.email}
                        onChange={update}
                        required
                        className="w-full px-3 py-2 border border-outline-variant/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                        placeholder="your@email.com"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="fab-question" className="block text-sm font-medium text-on-surface-variant mb-1">Your Question *</label>
                    <textarea
                      id="fab-question"
                      name="question"
                      value={form.question}
                      onChange={update}
                      required
                      rows={4}
                      maxLength={2000}
                      className="w-full px-3 py-2 border border-outline-variant/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-y"
                      placeholder="What would you like to know about this topic?"
                    />
                    <p className="text-xs text-on-surface-variant mt-1">{form.question.length}/2000</p>
                  </div>

                  {turnstileSiteKey && <div ref={widgetRef} className="flex justify-center" />}

                  {error && (
                    <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
                  )}

                  <label className="flex items-start gap-2 cursor-pointer text-sm text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={form.purchaseIntent}
                      onChange={(e) => setPurchaseIntent(e.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      I'm also evaluating equipment for purchase
                      <span className="block text-xs text-on-surface-variant/70 mt-0.5">
                        Optional — if checked, we'll redirect you to our quote form after submitting your question.
                      </span>
                    </span>
                  </label>

                  <div className="flex items-center justify-between gap-4 pt-1">
                    <p className="text-xs text-on-surface-variant">
                      Your email will not be published.
                    </p>
                    <button
                      type="submit"
                      disabled={isSubmitting || (!!turnstileSiteKey && !token)}
                      className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                      {isSubmitting ? 'Submitting...' : 'Submit'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function ArticleQASection({ slug, post }: ArticleQASectionProps) {
  const { questions, loading, refetch } = useArticleQuestions(slug);
  const navigate = useNavigate();
  const analytics = useCombinedAnalytics();
  const {
    form, update, handleSubmit, reset, setPurchaseIntent,
    isSubmitting, isSuccess, error, turnstileSiteKey, widgetRef, token,
  } = useArticleQuestionForm({
    slug,
    onPurchaseIntentSubmit: ({ questionLength }) => {
      analytics.trackCustomEvent('insights_question_with_purchase_intent', {
        articleSlug: slug,
        questionLength,
      });
    },
    onSuccessRedirect: () => {
      navigate(buildRfqUrl({
        products: relatedProductsToSlugs(post?.relatedProducts),
        sourceSlug: slug,
        extraParams: { via: 'ask-checkbox' },
      }));
    },
  });

  return (
    <section id="article-qa-section" className="mt-10 pt-8 border-t border-outline-variant/20">
      <h3 className="text-xl font-semibold mb-6 text-on-surface">Questions & Answers</h3>

      {/* Q&A List */}
      {loading ? (
        <p className="text-on-surface-variant text-sm">Loading questions...</p>
      ) : questions.length > 0 ? (
        <div className="space-y-6 mb-10">
          {questions.map(q => (
            <div key={q.id} className="bg-surface-container-lowest rounded-lg p-5 border border-outline-variant/10">
              <div className="flex items-start gap-3 mb-3">
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0 mt-0.5">Q</span>
                <div>
                  <p className="text-on-surface font-medium leading-relaxed">{q.question}</p>
                  <p className="text-xs text-on-surface-variant mt-1">— {q.name}</p>
                </div>
              </div>
              {q.answer && (
                <div className="flex items-start gap-3 ml-2 pl-8 border-l-2 border-primary/20">
                  <div>
                    <p className="text-on-surface leading-relaxed">{q.answer}</p>
                    <p className="text-xs text-on-surface-variant mt-1">
                      — NineScrolls Team
                      {q.answeredAt && <span> · {new Date(q.answeredAt).toLocaleDateString()}</span>}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant text-sm mb-8">No questions yet. Be the first to ask!</p>
      )}

      {/* Ask a Question Form */}
      {isSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="text-3xl mb-2">&#10003;</div>
          <h4 className="text-lg font-semibold text-green-800 mb-2">Question Submitted!</h4>
          <p className="text-green-700 text-sm">
            Thank you for your question. Our team will review and respond soon.
            Approved Q&A will appear on this page.
          </p>
          <button
            onClick={() => { reset(); refetch(); }}
            className="mt-4 px-4 py-2 text-sm font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
          >
            Ask Another Question
          </button>
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-lg p-6 border border-outline-variant/10">
          <h4 className="text-base font-semibold mb-4 text-on-surface">Ask a Question</h4>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
              <div>
                <label htmlFor="qa-name" className="block text-sm font-medium text-on-surface-variant mb-1">Name *</label>
                <input
                  id="qa-name"
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={update}
                  required
                  className="w-full px-3 py-2 border border-outline-variant/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="qa-email" className="block text-sm font-medium text-on-surface-variant mb-1">Email *</label>
                <input
                  id="qa-email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={update}
                  required
                  className="w-full px-3 py-2 border border-outline-variant/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="your@email.com"
                />
              </div>
            </div>
            <div>
              <label htmlFor="qa-question" className="block text-sm font-medium text-on-surface-variant mb-1">Your Question *</label>
              <textarea
                id="qa-question"
                name="question"
                value={form.question}
                onChange={update}
                required
                rows={3}
                maxLength={2000}
                className="w-full px-3 py-2 border border-outline-variant/30 rounded-lg text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-y"
                placeholder="What would you like to know about this topic?"
              />
              <p className="text-xs text-on-surface-variant mt-1">{form.question.length}/2000</p>
            </div>

            {turnstileSiteKey && <div ref={widgetRef} className="flex justify-center" />}

            {error && (
              <p className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <label className="flex items-start gap-2 cursor-pointer text-sm text-on-surface-variant">
              <input
                type="checkbox"
                checked={form.purchaseIntent}
                onChange={(e) => setPurchaseIntent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I'm also evaluating equipment for purchase
                <span className="block text-xs text-on-surface-variant/70 mt-0.5">
                  Optional — if checked, we'll redirect you to our quote form after submitting your question.
                </span>
              </span>
            </label>

            <button
              type="submit"
              disabled={isSubmitting || (!!turnstileSiteKey && !token)}
              className="px-6 py-2.5 bg-primary text-on-primary rounded-lg font-medium text-sm hover:bg-primary-container transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Question'}
            </button>

            <p className="text-xs text-on-surface-variant">
              Your email will not be published. Questions are reviewed before posting.
            </p>
          </form>
        </div>
      )}
    </section>
  );
}
