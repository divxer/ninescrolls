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
      <div className={`newsletter-subscribe ${className}`}>
        <h5 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Newsletter</h5>
        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)', marginBottom: '0.75rem' }}>
          Stay updated with our latest insights
        </p>
        
        {isSuccess ? (
          <div style={{ 
            padding: '0.75rem', 
            backgroundColor: 'rgba(34, 197, 94, 0.2)', 
            borderRadius: '6px',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            fontSize: '0.85rem',
            color: '#86efac'
          }}>
            ✓ Successfully subscribed! Check your email to confirm.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
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
              style={{
                padding: '0.6rem 0.75rem',
                fontSize: '0.9rem',
                borderRadius: '6px',
                border: error ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.2)',
                backgroundColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                outline: 'none',
                transition: 'all 0.2s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.4)';
                e.target.style.backgroundColor = 'rgba(255,255,255,0.15)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(255,255,255,0.2)';
                e.target.style.backgroundColor = 'rgba(255,255,255,0.1)';
              }}
            />
            {error && (
              <div style={{ 
                fontSize: '0.8rem', 
                color: '#fca5a5',
                padding: '0.25rem 0'
              }}>
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-secondary"
              style={{ 
                fontSize: '0.9rem', 
                padding: '0.6rem 1rem',
                width: '100%',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1
              }}
            >
              {isSubmitting ? 'Subscribing...' : 'Subscribe'}
            </button>
          </form>
        )}
        
        <p style={{ 
          fontSize: '0.75rem', 
          color: 'rgba(255,255,255,0.6)', 
          marginTop: '0.5rem',
          lineHeight: '1.4'
        }}>
          1–2 emails/month. Unsubscribe anytime.
        </p>
      </div>
    );
  }

  // Inline variant (for use in other sections)
  return (
    <div className={`newsletter-subscribe-inline ${className}`}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
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
          style={{
            flex: 1,
            padding: '0.75rem',
            fontSize: '0.95rem',
            borderRadius: '6px',
            border: error ? '1px solid #ef4444' : '1px solid #e5e7eb',
            outline: 'none',
            transition: 'all 0.2s'
          }}
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
          style={{ 
            padding: '0.75rem 1.5rem',
            whiteSpace: 'nowrap',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            opacity: isSubmitting ? 0.7 : 1
          }}
        >
          {isSubmitting ? 'Subscribing...' : 'Subscribe'}
        </button>
      </form>
      {error && (
        <div style={{ 
          marginTop: '0.5rem',
          fontSize: '0.85rem', 
          color: '#ef4444'
        }}>
          {error}
        </div>
      )}
      {isSuccess && (
        <div style={{ 
          marginTop: '0.5rem',
          padding: '0.75rem', 
          backgroundColor: '#dcfce7', 
          borderRadius: '6px',
          border: '1px solid #86efac',
          fontSize: '0.85rem',
          color: '#166534'
        }}>
          ✓ Successfully subscribed! Check your email to confirm.
        </div>
      )}
    </div>
  );
}
