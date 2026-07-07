# Conversion Chain Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Contact, RFQ, Service Support, Cart, Checkout, Success, and Cancel conversion pages so they match the new NineScrolls product experience without changing attribution, cart, Stripe, or analytics contracts.

**Architecture:** First lock the conversion contracts and small shared utilities with tests. Then add a minimal conversion UI primitive layer. Finally redesign pages in batches, keeping business logic and submit contracts intact.

**Tech Stack:** React 18, TypeScript, React Router, react-helmet-async, Vitest, Testing Library, Tailwind utility classes, existing Cart/RFQ/Stripe services.

## Global Constraints

- Do not change RFQ URL parameter semantics for `?products=`, `?product=`, `?category=`, `?source=`, or `?via=`.
- Do not change RFQ form field names, submit payload shape, Turnstile behavior, honeypot, file limits, or attribution fields.
- Do not change Contact `?topic=` or `?email=` behavior.
- Do not change cart item shape, quantity/remove/update behavior, or Add-to-Cart landing on `/cart`.
- Do not change checkout form field names used for Stripe session creation.
- Do not change GA4 `begin_checkout` or `purchase` event semantics.
- Keep Stripe frontend success/cancel URLs exactly `/checkout/success?session_id={CHECKOUT_SESSION_ID}` and `/checkout/cancel`.
- Keep Lambda success/cancel fallbacks unchanged unless the frontend routes change; this plan does not change routes.
- Keep `/request-quote` as `index, follow`.
- Set `/cart` to `noindex, follow`.
- Set `/checkout`, `/checkout/success`, and `/checkout/cancel` to `noindex, nofollow`.
- State "2-year standard warranty" as a user-confirmed all-product-line policy.
- Remove unsupported competitor-comparison warranty claims such as "double the industry norm" and "Most major manufacturers only provide 1-year coverage".
- Do not keep or add unverified delivery-time claims such as "3-4 weeks" unless separately confirmed before implementation.
- Fix checkout image URL composition in both tax calculation and checkout session creation.
- Preserve default `SEO` output for pages that do not pass a robots override.
- Use TDD: contract tests first, implementation second, visual changes after contract locks.

---

## Files And Responsibilities

- `src/components/common/SEO.tsx`
  - Add typed optional `robots` prop, defaulting to existing `index, follow`.

- `src/components/common/SEO.test.tsx`
  - New tests proving default robots output is unchanged and override works.

- `src/components/conversion/ConversionLayout.tsx`
  - New minimal shared UI primitives: `ConversionHero`, `ConversionCard`, `TrustSignalList`, `FormSection`.

- `src/components/conversion/ConversionLayout.test.tsx`
  - New smoke tests for primitive semantics and accessible heading/label structure.

- `src/pages/checkoutImageUrl.ts`
  - New helper `toCheckoutImageUrl(image: string | undefined, origin: string): string | undefined`.

- `src/pages/checkoutImageUrl.test.ts`
  - New tests for relative, absolute HTTP(S), empty, and undefined image paths.

- `src/pages/RFQPage.test.tsx`
  - Expand from pure parser tests into render/contract tests for URL prefill, visible labels, accessible validation, and Turnstile container behavior.

- `src/pages/ContactPage.test.tsx`
  - Extend existing topic tests to verify selected topic state and `email=` prefill reaches the inline form mock.

- `src/pages/CartPage.test.tsx`
  - New tests for empty state, filled state, quantity/remove behavior, checkout CTA, and robots meta.

- `src/pages/CheckoutPage.test.tsx`
  - New tests for required-field validation, accessible error, image helper integration in both tax and checkout session paths, begin_checkout event, redirect URLs, and robots meta.

- `src/pages/CheckoutSuccessPage.test.tsx`
  - New tests for session id parsing, purchase tracking, cart clearing, noindex robots, and absence of unverified delivery-time text.

- `src/pages/CheckoutCancelPage.test.tsx`
  - New tests for recovery links and noindex robots.

- `src/pages/ServiceSupportPage.test.tsx`
  - New tests for 2-year warranty factual copy, absence of competitor claims, and support CTA structure.

- `src/pages/ContactPage.tsx`
  - Redesign markup while preserving existing topic logic and `ContactFormInline` contract.

- `src/pages/RFQPage.tsx`
  - Redesign markup around the existing state/submit logic; add accessible error semantics.

- `src/pages/ServiceSupportPage.tsx`
  - Redesign and remove unsupported competitor claims.

- `src/pages/CartPage.tsx`
  - Redesign empty and filled states; add robots override.

- `src/pages/CheckoutPage.tsx`
  - Redesign form/summary; integrate image URL helper; add robots override and accessible error.

- `src/pages/CheckoutSuccessPage.tsx`
  - Redesign confirmation page; remove/generalize unverified delivery time; add robots override.

- `src/pages/CheckoutCancelPage.tsx`
  - Redesign recovery page; add robots override.

---

## Task 1: Lock Conversion Contracts And Shared Utility Behavior

**Files:**
- Modify: `src/components/common/SEO.tsx`
- Create: `src/components/common/SEO.test.tsx`
- Create: `src/pages/checkoutImageUrl.ts`
- Create: `src/pages/checkoutImageUrl.test.ts`
- Modify: `src/pages/RFQPage.test.tsx`
- Modify: `src/pages/ContactPage.test.tsx`
- Create: `src/pages/CheckoutPage.test.tsx`
- Create: `src/pages/CheckoutSuccessPage.test.tsx`
- Create: `src/pages/CheckoutCancelPage.test.tsx`
- Create: `src/pages/CartPage.test.tsx`

**Interfaces:**
- Produces: `SEOProps.robots?: string`, default `'index, follow'`.
- Produces: `toCheckoutImageUrl(image: string | undefined, origin: string): string | undefined`.
- Consumes: existing `parseRfqUrlParams`, `ContactPage`, `RFQPage`, cart context, and Stripe service mocks.

- [ ] **Step 1: Write SEO robots failing tests**

Create `src/components/common/SEO.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { HelmetProvider } from 'react-helmet-async';
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
```

- [ ] **Step 2: Run SEO tests and verify they fail**

Run:

```bash
npm test -- src/components/common/SEO.test.tsx --run
```

Expected: failure because `SEO` does not accept or render a `robots` prop.

- [ ] **Step 3: Implement `robots` prop in `SEO`**

Modify `src/components/common/SEO.tsx`:

```tsx
interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  url?: string;
  type?: string;
  robots?: string;
}

export function SEO({
  title,
  description,
  keywords = 'semiconductor equipment, thin film deposition, etching system, coating system',
  image = cdnUrl('/assets/images/og-image.jpg'),
  imageWidth = 1200,
  imageHeight = 630,
  url = '/',
  type = 'website',
  robots = 'index, follow',
}: SEOProps) {
  // existing title/url/image logic unchanged
  return (
    <Helmet>
      {/* existing meta tags unchanged */}
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={fullUrl} />
    </Helmet>
  );
}
```

- [ ] **Step 4: Run SEO tests and verify they pass**

Run:

```bash
npm test -- src/components/common/SEO.test.tsx --run
```

Expected: 2 tests pass.

- [ ] **Step 5: Write checkout image URL helper tests**

Create `src/pages/checkoutImageUrl.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { toCheckoutImageUrl } from './checkoutImageUrl';

describe('toCheckoutImageUrl', () => {
  const origin = 'https://ninescrolls.com';

  it('returns undefined when no image is provided', () => {
    expect(toCheckoutImageUrl(undefined, origin)).toBeUndefined();
    expect(toCheckoutImageUrl('', origin)).toBeUndefined();
  });

  it('prefixes relative site paths with the current origin', () => {
    expect(toCheckoutImageUrl('/assets/images/redesign/products/hy-4l-standardized.webp', origin))
      .toBe('https://ninescrolls.com/assets/images/redesign/products/hy-4l-standardized.webp');
  });

  it('preserves absolute CDN URLs unchanged', () => {
    expect(toCheckoutImageUrl('https://cdn.ninescrolls.com/products/hy-4l/main.jpg', origin))
      .toBe('https://cdn.ninescrolls.com/products/hy-4l/main.jpg');
  });

  it('preserves protocol-relative URLs unchanged', () => {
    expect(toCheckoutImageUrl('//cdn.ninescrolls.com/products/hy-4l/main.jpg', origin))
      .toBe('//cdn.ninescrolls.com/products/hy-4l/main.jpg');
  });
});
```

- [ ] **Step 6: Run helper tests and verify they fail**

Run:

```bash
npm test -- src/pages/checkoutImageUrl.test.ts --run
```

Expected: failure because `checkoutImageUrl.ts` does not exist.

- [ ] **Step 7: Implement helper**

Create `src/pages/checkoutImageUrl.ts`:

```ts
export function toCheckoutImageUrl(image: string | undefined, origin: string): string | undefined {
  if (!image) return undefined;
  if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('//')) {
    return image;
  }
  return `${origin}${image.startsWith('/') ? image : `/${image}`}`;
}
```

- [ ] **Step 8: Run helper tests and verify they pass**

Run:

```bash
npm test -- src/pages/checkoutImageUrl.test.ts --run
```

Expected: 4 tests pass.

- [ ] **Step 9: Add RFQ render contract tests before visual edits**

Append to `src/pages/RFQPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { RFQPage } from './RFQPage';

function renderRfq(initialEntry: string) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <RFQPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('RFQPage URL attribution contract', () => {
  it('prefills product, category, source, via, and multi-product comments from URL params', () => {
    renderRfq('/request-quote?products=icp-etcher,rie-etcher&category=ICP&source=insights/test&via=ask-checkbox');

    expect(screen.getByLabelText(/Equipment Category/i)).toHaveValue('ICP');
    expect(screen.getByLabelText(/Preferred Model/i)).toHaveValue('icp-etcher');
    expect(screen.getByLabelText(/Special Requirements/i)).toHaveValue(expect.stringContaining('- icp-etcher'));
    expect(screen.getByLabelText(/Special Requirements/i)).toHaveValue(expect.stringContaining('- rie-etcher'));
  });

  it('keeps required labels associated with visible controls', () => {
    renderRfq('/request-quote?product=pecvd');

    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Institution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Application Description/i)).toBeInTheDocument();
  });
});
```

If TypeScript reports duplicate imports, merge imports at the top instead of adding duplicates.

- [ ] **Step 10: Extend Contact tests for prefill and topic selection**

Modify the existing mock in `src/pages/ContactPage.test.tsx`:

```tsx
vi.mock('../components/common/ContactFormInline', () => ({
  ContactFormInline: ({ inquiryType, prefillEmail }: { inquiryType?: string; prefillEmail?: string }) => (
    <div data-testid="contact-form" data-inquiry-type={inquiryType || ''} data-prefill-email={prefillEmail || ''} />
  ),
}));
```

Add tests:

```tsx
it('selects engineer consultation for topic=expert', () => {
  renderAt('/contact?topic=expert');
  expect(screen.getByTestId('contact-form')).toHaveAttribute('data-inquiry-type', 'engineer');
});

it('selects feasibility for topic=application', () => {
  renderAt('/contact?topic=application');
  expect(screen.getByTestId('contact-form')).toHaveAttribute('data-inquiry-type', 'feasibility');
});

it('passes email query prefill to the inline form', () => {
  renderAt('/contact?topic=expert&email=buyer%40lab.edu');
  expect(screen.getByTestId('contact-form')).toHaveAttribute('data-prefill-email', 'buyer@lab.edu');
});
```

- [ ] **Step 11: Add non-visual page contract tests for Cart/Checkout/Success/Cancel**

Create focused tests that assert current behavior before visual edits. These tests must be makeable green in Task 1 without redesigning page layouts or rewriting page copy. Use existing testing patterns from product tests: `HelmetProvider`, `MemoryRouter`, and cart/Stripe mocks.

Minimum test names and assertions:

```tsx
// src/pages/CartPage.test.tsx
it('marks the cart page noindex without changing empty-cart behavior', async () => {
  // render with empty CartProvider state
  // assert the existing empty-cart heading remains visible and robots noindex,follow is rendered
});

it('renders filled cart line items, quantity controls, total, and checkout CTA', () => {
  // render with one mocked cart item
  // assert SKU/name/price/quantity, Increase quantity, Decrease quantity, Proceed to Checkout
});

// src/pages/CheckoutPage.test.tsx
it('blocks submit with an accessible required-field error', async () => {
  // render with one cart item, click Place Secure Order, expect role alert or aria-live error
});

it('sends unchanged success and cancel URLs to createCheckoutSession', async () => {
  // fill required fields, mock createCheckoutSession, assert successUrl/cancelUrl
});

it('uses absolute image URLs for both tax calculation and checkout session without double-prefixing CDN URLs', async () => {
  // item.image = 'https://cdn.ninescrolls.com/products/hy/main.jpg'
  // assert calculateTax and createCheckoutSession receive same absolute URL
});

// src/pages/CheckoutSuccessPage.test.tsx
it('tracks purchase and clears cart for a valid session id', () => {
  // render /checkout/success?session_id=test_session, assert gtag purchase and clearCart
});

it('uses noindex robots without changing success behavior', async () => {
  // assert robots noindex,nofollow and existing success/session behavior still renders
});

// src/pages/CheckoutCancelPage.test.tsx
it('shows recovery actions and noindex robots meta', async () => {
  // assert Return to Cart, Contact Sales/Request Quote, robots noindex,nofollow
});
```

Use test doubles for services rather than calling Stripe/tax APIs.
Do not add Service Support banned-copy tests or Checkout Success delivery-copy tests in Task 1. Those are copy acceptance tests and belong to Task 5, where they are written red and implemented before that task's commit.

- [ ] **Step 12: Run Task 1 contract tests**

Run:

```bash
npm test -- \
  src/components/common/SEO.test.tsx \
  src/pages/checkoutImageUrl.test.ts \
  src/pages/RFQPage.test.tsx \
  src/pages/ContactPage.test.tsx \
  src/pages/CartPage.test.tsx \
  src/pages/CheckoutPage.test.tsx \
  src/pages/CheckoutSuccessPage.test.tsx \
  src/pages/CheckoutCancelPage.test.tsx \
  --run
```

Expected at this stage: tests fail only for missing non-visual infrastructure (`SEO.robots`, `toCheckoutImageUrl`, checkout helper integration, and robots overrides). No failing assertion should require layout redesign, Service Support copy deletion, or Checkout Success delivery-copy changes.

- [ ] **Step 13: Implement non-visual infra needed for Task 1 tests**

Allowed implementation in this step:

- `SEO.robots` prop.
- `toCheckoutImageUrl` helper.
- Replace both `CheckoutPage` image URL constructions with `toCheckoutImageUrl(item.image, window.location.origin)`.
- Add robots overrides:
  - `CartPage`: `robots="noindex, follow"`
  - `CheckoutPage`: `robots="noindex, nofollow"`
  - `CheckoutSuccessPage`: `robots="noindex, nofollow"`
  - `CheckoutCancelPage`: `robots="noindex, nofollow"`
- Minimal imports/mocks needed to make contract tests execute.

Not allowed in this step:

- Layout redesign.
- Contact/RFQ/Cart/Checkout visual copy rewrite.
- Service Support competitor-claim removal.
- Checkout Success delivery-copy rewrite.

- [ ] **Step 14: Run Task 1 tests and verify they pass**

Run:

```bash
npm test -- \
  src/components/common/SEO.test.tsx \
  src/pages/checkoutImageUrl.test.ts \
  src/pages/RFQPage.test.tsx \
  src/pages/ContactPage.test.tsx \
  src/pages/CartPage.test.tsx \
  src/pages/CheckoutPage.test.tsx \
  src/pages/CheckoutSuccessPage.test.tsx \
  src/pages/CheckoutCancelPage.test.tsx \
  --run
```

Expected: pass.

- [ ] **Step 15: Commit contract locks and utilities**

```bash
git add src/components/common/SEO.tsx src/components/common/SEO.test.tsx src/pages/checkoutImageUrl.ts src/pages/checkoutImageUrl.test.ts src/pages/RFQPage.test.tsx src/pages/ContactPage.test.tsx src/pages/CartPage.tsx src/pages/CartPage.test.tsx src/pages/CheckoutPage.tsx src/pages/CheckoutPage.test.tsx src/pages/CheckoutSuccessPage.tsx src/pages/CheckoutSuccessPage.test.tsx src/pages/CheckoutCancelPage.tsx src/pages/CheckoutCancelPage.test.tsx
git commit -m "test: lock conversion chain contracts"
```

---

## Task 2: Add Minimal Conversion UI Primitives

**Files:**
- Create: `src/components/conversion/ConversionLayout.tsx`
- Create: `src/components/conversion/ConversionLayout.test.tsx`
- Create: `src/components/conversion/index.ts`

**Interfaces:**
- Produces:
  - `ConversionHero(props: ConversionHeroProps): JSX.Element`
  - `ConversionCard(props: React.PropsWithChildren<ConversionCardProps>): JSX.Element`
  - `TrustSignalList({ items }: { items: Array<{ title: string; copy?: string }> }): JSX.Element`
  - `FormSection(props: React.PropsWithChildren<FormSectionProps>): JSX.Element`

- [ ] **Step 1: Write primitive tests**

Create `src/components/conversion/ConversionLayout.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConversionCard, ConversionHero, FormSection, TrustSignalList } from './ConversionLayout';

describe('conversion layout primitives', () => {
  it('renders a conversion hero with actions and trust signals', () => {
    render(
      <ConversionHero
        eyebrow="Engineering Support"
        title="Talk to a NineScrolls engineer"
        copy="Get help with process fit, configuration, and procurement."
        primaryAction={{ label: 'Request Quote', href: '/request-quote' }}
        secondaryAction={{ label: 'Contact Support', href: '/contact?topic=service' }}
        trustItems={['San Diego based', 'Engineering review', 'NDA available']}
      />
    );

    expect(screen.getByRole('heading', { name: 'Talk to a NineScrolls engineer' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request Quote' })).toHaveAttribute('href', '/request-quote');
    expect(screen.getByText('San Diego based')).toBeInTheDocument();
  });

  it('renders form sections with accessible headings', () => {
    render(
      <FormSection title="Contact information" description="Tell us who should receive the quote.">
        <label htmlFor="test-field">Email</label>
        <input id="test-field" />
      </FormSection>
    );

    expect(screen.getByRole('heading', { name: 'Contact information' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('renders trust signal lists and cards without requiring page-specific logic', () => {
    render(
      <ConversionCard>
        <TrustSignalList items={[{ title: 'Secure payment' }, { title: 'Formal invoice available', copy: 'For procurement workflows.' }]} />
      </ConversionCard>
    );

    expect(screen.getByText('Secure payment')).toBeInTheDocument();
    expect(screen.getByText('Formal invoice available')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run primitive tests and verify they fail**

Run:

```bash
npm test -- src/components/conversion/ConversionLayout.test.tsx --run
```

Expected: failure because the module does not exist.

- [ ] **Step 3: Implement primitives**

Create `src/components/conversion/ConversionLayout.tsx`:

```tsx
import type { PropsWithChildren } from 'react';
import { Link } from 'react-router-dom';

interface ActionLink {
  label: string;
  href: string;
}

export interface ConversionHeroProps {
  eyebrow: string;
  title: string;
  copy: string;
  primaryAction?: ActionLink;
  secondaryAction?: ActionLink;
  trustItems?: string[];
}

export function ConversionHero({ eyebrow, title, copy, primaryAction, secondaryAction, trustItems = [] }: ConversionHeroProps) {
  return (
    <section className="border-b border-slate-200 bg-[#FAFAFA]">
      <div className="mx-auto max-w-screen-2xl px-6 py-16 lg:px-10 lg:py-20">
        <span className="mb-5 block text-xs font-bold uppercase tracking-[0.28em] text-sky-600">{eyebrow}</span>
        <h1 className="max-w-4xl text-5xl font-headline font-bold leading-[0.98] tracking-tight text-slate-950 md:text-6xl">{title}</h1>
        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-600">{copy}</p>
        {(primaryAction || secondaryAction) && (
          <div className="mt-8 flex flex-wrap gap-3">
            {primaryAction && <Link to={primaryAction.href} className="inline-flex items-center justify-center rounded-md bg-sky-600 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-700">{primaryAction.label}</Link>}
            {secondaryAction && <Link to={secondaryAction.href} className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-bold text-slate-950 transition-colors hover:border-slate-400 hover:bg-slate-50">{secondaryAction.label}</Link>}
          </div>
        )}
        {trustItems.length > 0 && (
          <ul className="mt-8 flex flex-wrap gap-3 text-sm font-semibold text-slate-600">
            {trustItems.map((item) => <li key={item} className="rounded-full border border-slate-200 bg-white px-3 py-1">{item}</li>)}
          </ul>
        )}
      </div>
    </section>
  );
}

export interface ConversionCardProps {
  className?: string;
}

export function ConversionCard({ className = '', children }: PropsWithChildren<ConversionCardProps>) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`}>{children}</div>;
}

export function TrustSignalList({ items }: { items: Array<{ title: string; copy?: string }> }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => (
        <li key={item.title} className="flex gap-3">
          <span aria-hidden="true" className="mt-1 h-2 w-2 rounded-full bg-sky-600" />
          <div>
            <p className="font-bold text-slate-950">{item.title}</p>
            {item.copy && <p className="mt-1 text-sm leading-6 text-slate-600">{item.copy}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export interface FormSectionProps {
  title: string;
  description?: string;
  className?: string;
}

export function FormSection({ title, description, className = '', children }: PropsWithChildren<FormSectionProps>) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-6 ${className}`}>
      <h2 className="text-xl font-headline font-bold tracking-tight text-slate-950">{title}</h2>
      {description && <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
```

Create `src/components/conversion/index.ts`:

```ts
export * from './ConversionLayout';
```

- [ ] **Step 4: Run primitive tests and verify they pass**

Run:

```bash
npm test -- src/components/conversion/ConversionLayout.test.tsx --run
```

Expected: 3 tests pass.

- [ ] **Step 5: Run checkpoint test suite**

Run:

```bash
npm test -- \
  src/components/common/SEO.test.tsx \
  src/components/conversion/ConversionLayout.test.tsx \
  src/pages/checkoutImageUrl.test.ts \
  src/pages/RFQPage.test.tsx \
  src/pages/ContactPage.test.tsx \
  --run
```

Expected: pass.

- [ ] **Step 6: Commit conversion primitives**

```bash
git add src/components/conversion/ConversionLayout.tsx src/components/conversion/ConversionLayout.test.tsx src/components/conversion/index.ts
git commit -m "feat: add conversion page primitives"
```

**Checkpoint 1:** Stop after Task 2. Review should verify: contracts locked before visual edits, `SEO` default byte-equivalent for normal pages, helper behavior, and primitives are intentionally small.

---

## Task 3: Redesign Contact And RFQ Pages

**Files:**
- Modify: `src/pages/ContactPage.tsx`
- Modify: `src/pages/ContactPage.test.tsx`
- Modify: `src/pages/RFQPage.tsx`
- Modify: `src/pages/RFQPage.test.tsx`

**Interfaces:**
- Consumes: `ConversionHero`, `ConversionCard`, `FormSection`, `TrustSignalList`.
- Preserves: all Contact and RFQ contracts locked in Task 1.

- [ ] **Step 1: Write/adjust failing tests for new Contact visible content**

In `src/pages/ContactPage.test.tsx`, add:

```tsx
it('presents the redesigned engineering contact entry points without breaking the form contract', () => {
  renderAt('/contact?topic=expert&email=buyer%40lab.edu');

  expect(screen.getByRole('heading', { name: /Talk to a NineScrolls engineer/i })).toBeInTheDocument();
  expect(screen.getByText(/San Diego/i)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Request Quote/i })).toHaveAttribute('href', '/request-quote');
  expect(screen.getByTestId('contact-form')).toHaveAttribute('data-inquiry-type', 'engineer');
  expect(screen.getByTestId('contact-form')).toHaveAttribute('data-prefill-email', 'buyer@lab.edu');
});
```

Run:

```bash
npm test -- src/pages/ContactPage.test.tsx --run
```

Expected: fails until Contact markup is redesigned.

- [ ] **Step 2: Redesign Contact markup**

Modify `src/pages/ContactPage.tsx`:

- Import conversion primitives.
- Replace the current top-level `main className="py-24 px-8"` hero/contact-info shell with:
  - `ConversionHero`
  - a three-card contact method band
  - existing form section, still using `ContactFormInline`.
- Keep all hook logic and `Navigate` behavior unchanged.

Implementation pattern:

```tsx
import { ConversionCard, ConversionHero, TrustSignalList } from '../components/conversion';

// inside return, after Helmet
<main className="bg-[#FAFAFA]">
  <ConversionHero
    eyebrow="Engineering Contact"
    title="Talk to a NineScrolls engineer"
    copy="Get help with process fit, equipment configuration, service support, or procurement next steps."
    primaryAction={{ label: 'Request Quote', href: '/request-quote' }}
    secondaryAction={{ label: 'Service Support', href: '/service-support' }}
    trustItems={['San Diego based', '1-2 business day response', 'NDA available upon request']}
  />
  {/* contact cards + existing form logic */}
</main>
```

Do not alter `topicToInquiryType`, `KNOWN_TOPICS`, `Navigate`, or `ContactFormInline` props.

- [ ] **Step 3: Run Contact tests**

Run:

```bash
npm test -- src/pages/ContactPage.test.tsx --run
```

Expected: pass.

- [ ] **Step 4: Write/adjust RFQ visual/a11y tests**

In `src/pages/RFQPage.test.tsx`, add:

```tsx
it('renders the redesigned RFQ header while preserving URL prefill', () => {
  renderRfq('/request-quote?products=icp-etcher,rie-etcher&source=insights/test&via=ask-checkbox');

  expect(screen.getByRole('heading', { name: /Request a process equipment quote/i })).toBeInTheDocument();
  expect(screen.getByText(/engineering review/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Preferred Model/i)).toHaveValue('icp-etcher');
});

it('announces validation errors accessibly', async () => {
  renderRfq('/request-quote');
  // click through or submit in the current page flow according to existing button text
  // expect validation summary to have role="alert" or aria-live="polite"
});
```

When writing the second test, use the actual visible button names from the current page snapshot. Do not guess labels.

- [ ] **Step 5: Redesign RFQ markup without changing logic**

Modify `src/pages/RFQPage.tsx`:

- Keep state, effects, handlers, Turnstile, validation, submit payloads, and analytics unchanged.
- Wrap page in the new conversion visual language.
- Replace generic top hero with a compact `ConversionHero`.
- Use `FormSection` for each existing step section where practical.
- Add an error summary with `role="alert"` when `submitError` or validation summary is shown.
- Preserve all `id`, `name`, `htmlFor`, and `required` attributes.

- [ ] **Step 6: Run RFQ tests**

Run:

```bash
npm test -- src/pages/RFQPage.test.tsx --run
```

Expected: pass.

- [ ] **Step 7: Commit Contact/RFQ redesign**

```bash
git add src/pages/ContactPage.tsx src/pages/ContactPage.test.tsx src/pages/RFQPage.tsx src/pages/RFQPage.test.tsx
git commit -m "feat: redesign contact and quote pages"
```

---

## Task 4: Redesign Cart And Checkout Pages

**Files:**
- Modify: `src/pages/CartPage.tsx`
- Modify: `src/pages/CartPage.test.tsx`
- Modify: `src/pages/CheckoutPage.tsx`
- Modify: `src/pages/CheckoutPage.test.tsx`

**Interfaces:**
- Consumes: `ConversionCard`, `FormSection`, `TrustSignalList`, `toCheckoutImageUrl`.
- Preserves: cart context behavior, Stripe service payload shape, GA4 begin_checkout.

- [ ] **Step 1: Make Cart tests fail for redesigned recovery/actions**

In `src/pages/CartPage.test.tsx`, ensure tests assert:

```tsx
expect(screen.getByRole('heading', { name: /Review your equipment order/i })).toBeInTheDocument();
expect(screen.getByRole('link', { name: /Request Quote/i })).toHaveAttribute('href', '/request-quote');
expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow');
```

Run:

```bash
npm test -- src/pages/CartPage.test.tsx --run
```

Expected: fail until Cart is redesigned and robots override is applied.

- [ ] **Step 2: Redesign Cart**

Modify `src/pages/CartPage.tsx`:

- Use `SEO robots="noindex, follow"`.
- Empty state:
  - heading: "Review your equipment order"
  - copy explaining no items are in cart
  - links to `/products`, `/request-quote`, `/products/plasma-cleaner/compare`
- Filled state:
  - two-column layout matching product pages
  - line item cards
  - order summary card
  - trust notes
- Preserve quantity/remove/update logic and `handleCheckout`.

- [ ] **Step 3: Run Cart tests**

Run:

```bash
npm test -- src/pages/CartPage.test.tsx --run
```

Expected: pass.

- [ ] **Step 4: Make Checkout tests fail for helper integration and noindex**

In `src/pages/CheckoutPage.test.tsx`, assert:

```tsx
expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
expect(createCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
  successUrl: expect.stringContaining('/checkout/success?session_id={CHECKOUT_SESSION_ID}'),
  cancelUrl: expect.stringContaining('/checkout/cancel'),
}));
expect(calculateTax).toHaveBeenCalledWith(
  expect.arrayContaining([expect.objectContaining({ image: 'https://cdn.ninescrolls.com/products/hy/main.jpg' })]),
  expect.any(Object)
);
```

Run:

```bash
npm test -- src/pages/CheckoutPage.test.tsx --run
```

Expected: fail until Checkout uses the helper in both places and robots override is applied.

- [ ] **Step 5: Redesign Checkout and integrate helper**

Modify `src/pages/CheckoutPage.tsx`:

- Import `toCheckoutImageUrl`.
- Replace both image URL lines:

```ts
image: toCheckoutImageUrl(item.image, window.location.origin),
```

- Use `SEO robots="noindex, nofollow"`.
- Add `role="alert"` to the error container.
- Use `FormSection` for contact/shipping/notes.
- Keep form field `name` attributes unchanged.
- Keep `successUrl` and `cancelUrl` exact.
- Keep GA4 `begin_checkout` payload unchanged.

- [ ] **Step 6: Run Checkout tests**

Run:

```bash
npm test -- src/pages/CheckoutPage.test.tsx --run
```

Expected: pass.

- [ ] **Step 7: Run commerce path tests**

Run:

```bash
npm test -- src/pages/CartPage.test.tsx src/pages/CheckoutPage.test.tsx src/components/products/HY4L.test.tsx src/components/products/HY20L.test.tsx src/components/products/PlutoT.test.tsx --run
```

Expected: pass.

- [ ] **Step 8: Commit Cart/Checkout redesign**

```bash
git add src/pages/CartPage.tsx src/pages/CartPage.test.tsx src/pages/CheckoutPage.tsx src/pages/CheckoutPage.test.tsx
git commit -m "feat: redesign cart and checkout"
```

---

## Task 5: Redesign Service Support And Checkout Result Pages

**Files:**
- Modify: `src/pages/ServiceSupportPage.tsx`
- Modify: `src/pages/ServiceSupportPage.test.tsx`
- Modify: `src/pages/CheckoutSuccessPage.tsx`
- Modify: `src/pages/CheckoutSuccessPage.test.tsx`
- Modify: `src/pages/CheckoutCancelPage.tsx`
- Modify: `src/pages/CheckoutCancelPage.test.tsx`

**Interfaces:**
- Consumes: conversion primitives and `SEO.robots`.
- Preserves: checkout success session parsing, purchase tracking, cart clear, cancel recovery route.

- [ ] **Step 1: Make Service Support tests fail for banned copy and new layout**

In `src/pages/ServiceSupportPage.test.tsx`, assert:

```tsx
expect(screen.getByText(/2-year standard warranty/i)).toBeInTheDocument();
expect(screen.queryByText(/double the industry norm/i)).not.toBeInTheDocument();
expect(screen.queryByText(/Most major manufacturers/i)).not.toBeInTheDocument();
expect(screen.getByRole('link', { name: /Request service support/i })).toHaveAttribute('href', '/contact?topic=service');
```

Run:

```bash
npm test -- src/pages/ServiceSupportPage.test.tsx --run
```

Expected: fail until banned competitor copy is removed and redesigned CTA exists.

- [ ] **Step 2: Redesign Service Support**

Modify `src/pages/ServiceSupportPage.tsx`:

- Keep Service schema, but update schema descriptions to remove competitor comparisons.
- Keep factual 2-year warranty copy.
- Remove:
  - "double the industry norm"
  - "Most major manufacturers only provide 1-year coverage"
  - any equivalent unnamed competitor claims.
- Redesign with:
  - `ConversionHero`
  - support coverage cards
  - service workflow
  - AMC overview where pricing is already present and intended
  - CTA to `/contact?topic=service`

- [ ] **Step 3: Run Service Support tests**

Run:

```bash
npm test -- src/pages/ServiceSupportPage.test.tsx --run
```

Expected: pass.

- [ ] **Step 4: Make Checkout Success tests fail for new copy and robots**

In `src/pages/CheckoutSuccessPage.test.tsx`, assert:

```tsx
expect(screen.getByRole('heading', { name: /Order confirmed/i })).toBeInTheDocument();
expect(screen.queryByText(/Transmission Received/i)).not.toBeInTheDocument();
expect(screen.queryByText(/3-4 weeks/i)).not.toBeInTheDocument();
expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
```

Run:

```bash
npm test -- src/pages/CheckoutSuccessPage.test.tsx --run
```

Expected: fail until copy and robots are updated.

- [ ] **Step 5: Redesign Checkout Success**

Modify `src/pages/CheckoutSuccessPage.tsx`:

- Use `SEO robots="noindex, nofollow"`.
- Replace heading with "Order confirmed".
- Keep session id display.
- Keep purchase tracking and clear-cart effect unchanged.
- Replace "3-4 weeks" with non-specific next-step copy:

```tsx
Our team will review your order details and follow up with confirmation, documentation, and shipping coordination.
```

- [ ] **Step 6: Run Checkout Success tests**

Run:

```bash
npm test -- src/pages/CheckoutSuccessPage.test.tsx --run
```

Expected: pass.

- [ ] **Step 7: Make Checkout Cancel tests fail for redesigned recovery and robots**

In `src/pages/CheckoutCancelPage.test.tsx`, assert:

```tsx
expect(screen.getByRole('heading', { name: /Checkout cancelled/i })).toBeInTheDocument();
expect(screen.getByRole('link', { name: /Return to Cart/i })).toHaveAttribute('href', '/cart');
expect(screen.getByRole('link', { name: /Request Quote/i })).toHaveAttribute('href', '/request-quote');
expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
```

Run:

```bash
npm test -- src/pages/CheckoutCancelPage.test.tsx --run
```

Expected: fail until redesigned.

- [ ] **Step 8: Redesign Checkout Cancel**

Modify `src/pages/CheckoutCancelPage.tsx`:

- Use `SEO robots="noindex, nofollow"`.
- Heading: "Checkout cancelled".
- Keep "Return to Cart".
- Add "Request Quote" path for procurement recovery.
- Keep no-charge reassurance.

- [ ] **Step 9: Run Task 5 tests**

Run:

```bash
npm test -- src/pages/ServiceSupportPage.test.tsx src/pages/CheckoutSuccessPage.test.tsx src/pages/CheckoutCancelPage.test.tsx --run
```

Expected: pass.

- [ ] **Step 10: Commit support/result page redesign**

```bash
git add src/pages/ServiceSupportPage.tsx src/pages/ServiceSupportPage.test.tsx src/pages/CheckoutSuccessPage.tsx src/pages/CheckoutSuccessPage.test.tsx src/pages/CheckoutCancelPage.tsx src/pages/CheckoutCancelPage.test.tsx
git commit -m "feat: redesign support and checkout result pages"
```

---

## Task 6: Final Verification And Browser Smoke

**Files:**
- No production file edits expected.
- May update plan notes only if verification uncovers a documented non-code issue.

- [ ] **Step 1: Run full conversion-page test suite**

Run:

```bash
npm test -- \
  src/components/common/SEO.test.tsx \
  src/components/conversion/ConversionLayout.test.tsx \
  src/pages/checkoutImageUrl.test.ts \
  src/pages/RFQPage.test.tsx \
  src/pages/ContactPage.test.tsx \
  src/pages/ServiceSupportPage.test.tsx \
  src/pages/CartPage.test.tsx \
  src/pages/CheckoutPage.test.tsx \
  src/pages/CheckoutSuccessPage.test.tsx \
  src/pages/CheckoutCancelPage.test.tsx \
  src/components/products/HY4L.test.tsx \
  src/components/products/HY20L.test.tsx \
  src/components/products/HY20LRF.test.tsx \
  src/components/products/PlutoT.test.tsx \
  src/components/products/PlutoM.test.tsx \
  src/components/products/PlutoF.test.tsx \
  --run
```

Expected: all tests pass.

- [ ] **Step 2: Run TypeScript**

Run:

```bash
npx tsc --noEmit --pretty false
```

Expected: exit 0.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: exit 0. Existing npm audit or chunk-size warnings may remain; do not treat warnings as success/failure changes unless new errors appear.

- [ ] **Step 4: Browser smoke locally**

With the dev server running, visit:

- `/contact?topic=expert`
- `/contact?topic=quote`
- `/request-quote?products=icp-etcher,rie-etcher&source=insights/test&via=ask-checkbox`
- `/cart`
- `/checkout`
- `/checkout/success?session_id=test_session`
- `/checkout/cancel`
- `/service-support`

Verify:

- No 404 state.
- No broken images.
- Robots meta matches the spec.
- RFQ prefill is visible.
- Contact quote topic redirects.
- Cart and checkout preserve commerce flow.
- Service Support contains 2-year warranty and no competitor warranty claims.

- [ ] **Step 5: Static scans**

Run:

```bash
rg -n "double the industry norm|Most major manufacturers|industry norm|3-4 weeks|window.location.origin\\}\\$\\{item.image|Distributor:|authorized US distributor|Shenzhen Huiyi" src/pages src/components || true
```

Expected: no customer-facing hits. Test files may contain negative assertions only.

- [ ] **Step 6: Commit verification cleanup only if needed**

If verification required small fixes:

```bash
git add <changed-files>
git commit -m "fix: polish conversion chain redesign"
```

If no fixes were needed, do not create an empty commit.

- [ ] **Step 7: Push branch**

Run:

```bash
git status --short
git push
```

Expected: branch pushed, no unintended files staged. `tmp/` artifacts remain untracked if present.

---

## Self-Review Checklist

- Spec coverage:
  - Contract locks: Task 1.
  - SEO robots: Task 1 and page tasks.
  - Checkout image helper: Task 1 and Task 4.
  - Shared primitives: Task 2.
  - Contact/RFQ: Task 3.
  - Cart/Checkout: Task 4.
  - Service/Success/Cancel: Task 5.
  - Verification: Task 6.
- No route rename is planned.
- No Stripe Lambda edit is planned.
- Warranty year count follows user-confirmed policy.
- Competitor warranty claims are explicitly removed.
- `/request-quote` remains indexed.
- Checkout utility pages become noindex.
