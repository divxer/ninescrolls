import { useState, FormEvent } from 'react';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

interface NewsletterSubscribeProps {
  className?: string;
  variant?: 'footer' | 'inline';
}

export function NewsletterSubscribe({ className = '', variant = 'footer' }: NewsletterSubscribeProps) {
  const analytics = useCombinedAnalytics();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Validate email
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call newsletter subscription API
      const response = await fetch('https://api.ninescrolls.com/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: email.trim(),
          source: variant,
          timestamp: new Date().toISOString()
        })
      });

      // Handle 404 or 501 - API not implemented yet, use fallback
      if (response.status === 404 || response.status === 501) {
        console.warn('Newsletter API not implemented, using fallback to contact form');
        // Fallback: redirect to contact page with newsletter topic
        window.location.href = `/contact?topic=newsletter&email=${encodeURIComponent(email.trim())}`;
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Subscription failed' }));
        throw new Error(errorData.message || 'Failed to subscribe. Please try again.');
      }

      // Success
      setIsSuccess(true);
      setEmail('');

      // Track subscription event
      analytics.trackCustomEvent('newsletter_subscribe', {
        source: variant,
        email_domain: email.split('@')[1]
      });

      // Reset success message after 5 seconds
      setTimeout(() => {
        setIsSuccess(false);
      }, 5000);

    } catch (error) {
      console.error('Newsletter subscription error:', error);
      // If it's a network error and not a user-facing error, show fallback option
      if (error instanceof TypeError && error.message.includes('fetch')) {
        setError('Network error. Please try again or visit our contact page.');
      } else {
        setError(error instanceof Error ? error.message : 'Failed to subscribe. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (variant === 'footer') {
    return (
      <div className={className}>
        <h5 className="mb-3 text-[0.95rem]">Newsletter</h5>
        <p className="text-sm text-white/80 mb-3">
          Stay updated with our latest insights
        </p>

        {isSuccess ? (
          <div className="p-3 bg-green-500/20 rounded-md border border-green-500/30 text-sm text-green-300">
            ✓ Successfully subscribed! Check your email to confirm.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="Enter your email"
              required
              disabled={isSubmitting}
              className={`px-3 py-2.5 text-sm rounded-md border bg-white/10 text-white outline-none transition-all focus:border-white/40 focus:bg-white/15 ${error ? 'border-red-500' : 'border-white/20'}`}
            />
            {error && (
              <div className="text-sm text-red-300 py-1">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="text-sm py-2.5 px-4 w-full rounded-md font-bold bg-white text-slate-600 border border-slate-300 hover:bg-slate-50 transition-all disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        )}

        <p className="text-xs text-white/60 mt-2 leading-snug">
          1–2 emails/month. Unsubscribe anytime.
        </p>
      </div>
    );
  }

  // Inline variant (for use in other sections)
  return (
    <div className={className}>
      <form onSubmit={handleSubmit} className="flex gap-2 items-start">
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="Enter your email"
          required
          disabled={isSubmitting}
          className={`flex-1 px-3 py-3 text-[0.95rem] rounded-md border outline-none transition-all focus:border-primary ${error ? 'border-red-500' : 'border-gray-200'}`}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-6 py-3 whitespace-nowrap rounded-lg font-bold bg-primary text-white hover:bg-primary-container transition-all disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>
      {error && (
        <div className="mt-2 text-sm text-red-500">
          {error}
        </div>
      )}
      {isSuccess && (
        <div className="mt-2 p-3 bg-green-100 rounded-md border border-green-300 text-sm text-green-800">
          ✓ Successfully subscribed! Check your email to confirm.
        </div>
      )}
    </div>
  );
}
