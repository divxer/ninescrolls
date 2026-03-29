import { useState, useEffect, useRef } from 'react';
import { useArticleQuestions } from '../../hooks/useArticleQuestions';
import { submitQuestion } from '../../services/articleQuestionsService';

interface ArticleQASectionProps {
  slug: string;
}

/** Fixed sidebar "Ask" button + popup form modal */
export function FloatingAskButton({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', question: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Load Turnstile when modal opens
  useEffect(() => {
    if (!open || !turnstileSiteKey || !widgetRef.current) return;
    const ensureScript = () => new Promise<void>((resolve) => {
      if ((window as any).turnstile) return resolve();
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
    ensureScript().then(() => {
      try {
        const widget = widgetRef.current;
        const turnstile = (window as any).turnstile;
        if (!widget || !turnstile) return;
        widgetIdRef.current = turnstile.render(widget, {
          sitekey: turnstileSiteKey,
          callback: (t: string) => setToken(t),
        });
      } catch (err) {
        console.warn('Turnstile render failed:', err);
      }
    });
  }, [open, turnstileSiteKey]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (!form.email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (form.question.trim().length < 10) { setError('Please enter at least 10 characters for your question.'); return; }
    if (turnstileSiteKey && !token) { setError('Please complete the verification.'); return; }

    setIsSubmitting(true);
    try {
      const result = await submitQuestion({
        articleSlug: slug,
        name: form.name.trim(),
        email: form.email.trim(),
        question: form.question.trim(),
        turnstileToken: token || 'no-key',
      });

      if (!result.success) {
        setError(result.message || 'Submission failed. Please try again.');
        return;
      }

      setIsSuccess(true);
      setForm({ name: '', email: '', question: '' });
      setToken('');
      if (widgetIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.reset(widgetIdRef.current);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const resetAndClose = () => {
    setOpen(false);
    setIsSuccess(false);
    setError(null);
  };

  return (
    <>
      {/* Fixed sidebar button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 pl-3 pr-4 py-3 bg-primary text-on-primary rounded-l-full shadow-lg hover:shadow-xl hover:-translate-y-1/2 hover:pr-5 transition-all text-sm font-medium max-md:pl-2.5 max-md:pr-3 max-md:py-2.5"
        aria-label="Ask a question about this article"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <circle cx="12" cy="15" r="0.5" fill="currentColor" />
        </svg>
        <span className="max-md:hidden">Ask</span>
      </button>

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
                  onClick={() => { setIsSuccess(false); setForm({ name: '', email: '', question: '' }); }}
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

export function ArticleQASection({ slug }: ArticleQASectionProps) {
  const { questions, loading, refetch } = useArticleQuestions(slug);
  const [form, setForm] = useState({ name: '', email: '', question: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Load Turnstile
  useEffect(() => {
    if (!turnstileSiteKey || !widgetRef.current) return;
    const ensureScript = () => new Promise<void>((resolve) => {
      if ((window as any).turnstile) return resolve();
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
    ensureScript().then(() => {
      try {
        const widget = widgetRef.current;
        const turnstile = (window as any).turnstile;
        if (!widget || !turnstile) return;
        widgetIdRef.current = turnstile.render(widget, {
          sitekey: turnstileSiteKey,
          callback: (t: string) => setToken(t),
        });
      } catch (err) {
        console.warn('Turnstile render failed:', err);
      }
    });
  }, [turnstileSiteKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (form.name.trim().length < 2) { setError('Please enter your name.'); return; }
    if (!form.email.includes('@')) { setError('Please enter a valid email address.'); return; }
    if (form.question.trim().length < 10) { setError('Please enter at least 10 characters for your question.'); return; }
    if (turnstileSiteKey && !token) { setError('Please complete the verification.'); return; }

    setIsSubmitting(true);
    try {
      const result = await submitQuestion({
        articleSlug: slug,
        name: form.name.trim(),
        email: form.email.trim(),
        question: form.question.trim(),
        turnstileToken: token || 'no-key',
      });

      if (!result.success) {
        setError(result.message || 'Submission failed. Please try again.');
        return;
      }

      setIsSuccess(true);
      setForm({ name: '', email: '', question: '' });
      setToken('');
      if (widgetIdRef.current && (window as any).turnstile) {
        (window as any).turnstile.reset(widgetIdRef.current);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

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
            onClick={() => { setIsSuccess(false); refetch(); }}
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
