import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
import { describe, expect, it } from 'vitest';
import { SEO } from './SEO';

function renderSeo(ui: ReactNode) {
  return render(<HelmetProvider>{ui}</HelmetProvider>);
}

describe('SEO', () => {
  it('keeps index follow as the default robots output', async () => {
    renderSeo(<SEO title="Default Robots" description="Default description" url="/default-robots" />);

    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('index, follow');
      expect(document.querySelector('meta[name="googlebot"]')?.getAttribute('content')).toBe('index, follow');
    });
  });

  it('allows utility pages to override robots output', async () => {
    renderSeo(<SEO title="Checkout" description="Checkout page" url="/checkout" robots="noindex, nofollow" />);

    await waitFor(() => {
      expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
      expect(document.querySelector('meta[name="googlebot"]')?.getAttribute('content')).toBe('noindex, nofollow');
    });
  });
});
