import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from '../components/layout/Layout';
import { CartProvider } from '../contexts/CartContext';
import { CartPage } from './CartPage';
import { CheckoutCancelPage } from './CheckoutCancelPage';
import { NotFoundPage } from './NotFoundPage';
import { AboutPage } from './AboutPage';
import { StartupPackagePage } from './StartupPackagePage';
import { CareersPage } from './CareersPage';
import { PrivacyPage } from './PrivacyPage';
import { ReturnPolicyPage } from './ReturnPolicyPage';

// Landmark-navigation regression guard: Layout owns the single <main>. Page
// components must NOT render their own <main> (they use <div>/fragments), so a
// routed page wrapped in Layout must expose exactly one <main> landmark.
// A second <main> is invalid HTML and creates ambiguous main content for
// screen readers (WCAG 1.3.1 / landmark navigation).
function renderInLayout(page: React.ReactNode, initialEntry: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <CartProvider>
          <Layout>{page}</Layout>
        </CartProvider>
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('single <main> landmark', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('renders exactly one <main> for CartPage (empty) inside Layout', () => {
    renderInLayout(<CartPage />, '/cart');
    const mains = document.body.querySelectorAll('main');
    expect(mains.length).toBe(1);
    expect(mains[0]).toHaveClass('flex-grow');
  });

  it('renders exactly one <main> for CartPage (populated) inside Layout', () => {
    // CartProvider seeds items from localStorage on mount, so a seeded cart
    // exercises CartPage's populated branch — a second, independently-edited
    // wrapper that must also be a <div>, not a <main>.
    localStorage.setItem(
      'cart',
      JSON.stringify([{ id: 'pluto-t', name: 'PLUTO-T', price: 1000, quantity: 1, sku: 'pluto-t' }])
    );
    renderInLayout(<CartPage />, '/cart');
    // Guard against silently testing the empty branch: confirm the seeded
    // item actually rendered (populated branch), then assert the landmark.
    expect(document.body.textContent).toContain('PLUTO-T');
    expect(document.body.querySelectorAll('main').length).toBe(1);
  });

  it('renders exactly one <main> for CheckoutCancelPage inside Layout', () => {
    renderInLayout(<CheckoutCancelPage />, '/checkout/cancel');
    const mains = document.body.querySelectorAll('main');
    expect(mains.length).toBe(1);
    // The one main is Layout's, not a page-level main.
    expect(mains[0]).toHaveClass('flex-grow');
  });

  it('renders exactly one <main> for NotFoundPage inside Layout', () => {
    renderInLayout(<NotFoundPage />, '/does-not-exist');
    expect(document.body.querySelectorAll('main').length).toBe(1);
  });

  // Company/support/policy pages (Phase 3) must also defer the <main> to Layout.
  it.each([
    ['AboutPage', <AboutPage />, '/about'],
    ['StartupPackagePage', <StartupPackagePage />, '/startup-package'],
    ['CareersPage', <CareersPage />, '/careers'],
    ['PrivacyPage', <PrivacyPage />, '/privacy'],
    ['ReturnPolicyPage', <ReturnPolicyPage />, '/return-policy'],
  ])('renders exactly one <main> for %s inside Layout', (_name, page, path) => {
    renderInLayout(page, path);
    const mains = document.body.querySelectorAll('main');
    expect(mains.length).toBe(1);
    expect(mains[0]).toHaveClass('flex-grow');
  });
});
