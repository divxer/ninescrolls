import { useCallback, useEffect, useRef, useState } from 'react';
import { submitQuestion } from '../services/articleQuestionsService';

interface UseArticleQuestionFormOpts {
  slug: string;
  onSuccessRedirect?: (form: { purchaseIntent: boolean }) => void;
  onPurchaseIntentSubmit?: (form: { questionLength: number }) => void;
}

interface FormState {
  name: string;
  email: string;
  question: string;
  purchaseIntent: boolean;
}

const INITIAL: FormState = { name: '', email: '', question: '', purchaseIntent: false };

export function useArticleQuestionForm({ slug, onSuccessRedirect, onPurchaseIntentSubmit }: UseArticleQuestionFormOpts) {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

  // Load Turnstile widget when ref attaches
  useEffect(() => {
    if (!turnstileSiteKey || !widgetRef.current) return;
    const ensureScript = () =>
      new Promise<void>((resolve) => {
        if ((window as unknown as { turnstile?: unknown }).turnstile) return resolve();
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
        const turnstile = (window as unknown as { turnstile?: { render: Function; reset: Function } }).turnstile;
        if (!widget || !turnstile) return;
        widgetIdRef.current = turnstile.render(widget, {
          sitekey: turnstileSiteKey,
          callback: (t: string) => setToken(t),
        }) as string;
      } catch (err) {
        console.warn('Turnstile render failed:', err);
      }
    });
  }, [turnstileSiteKey]);

  const update = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const setPurchaseIntent = useCallback((v: boolean) => {
    setForm((prev) => ({ ...prev, purchaseIntent: v }));
  }, []);

  const resetToken = useCallback(() => {
    setToken('');
    const turnstile = (window as unknown as { turnstile?: { reset: Function } }).turnstile;
    if (widgetIdRef.current && turnstile) {
      turnstile.reset(widgetIdRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    setForm(INITIAL);
    setIsSuccess(false);
    setError(null);
    resetToken();
  }, [resetToken]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
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
          purchaseIntent: form.purchaseIntent,
        });
        if (!result.success) {
          setError(result.message || 'Submission failed. Please try again.');
          return;
        }
        const wasPurchaseIntent = form.purchaseIntent;
        const submittedQuestionLength = form.question.trim().length;
        setIsSuccess(true);
        setForm(INITIAL);
        resetToken();
        if (wasPurchaseIntent) {
          onPurchaseIntentSubmit?.({ questionLength: submittedQuestionLength });
          onSuccessRedirect?.({ purchaseIntent: true });
        }
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [form, slug, token, turnstileSiteKey, onSuccessRedirect, onPurchaseIntentSubmit, resetToken],
  );

  return {
    form,
    update,
    setPurchaseIntent,
    handleSubmit,
    isSubmitting,
    isSuccess,
    error,
    reset,
    turnstileSiteKey,
    widgetRef,
    token,
  };
}
