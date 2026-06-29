# Product Page Deduplication — Design

**Date:** 2026-06-29
**Status:** Approved (Approach B, two steps)

## Problem

17 product detail components under `src/components/products/` (~10.7k lines,
450–887 each), each a `/products/*` route lazy-loaded via the `components/products`
barrel. They share a large amount of **scaffolding** while their bodies are
genuinely bespoke.

Measured duplication:
- **17/17 identical:** `isModalOpen`/`isQuoteIntent` state, `openContactForm`/
  `closeContactForm`, `<QuoteModal isOpen defaultIsQuote onClose>`, `<SEO>`,
  `<Breadcrumbs>`, `useScrollToTop()`.
- **6/17 identical-structure:** `handleAddToCart` (addItem → GA4 `add_to_cart`
  → `analytics.trackAddToCart` → `navigate('/cart')`); only product data differs
  (and `id === sku` everywhere).
- **2/17 identical-structure:** `handleDownloadBrochure` (anchor download; only
  href/filename differ).
- **Bespoke per product:** hero, section set/order, specs, copy, image galleries.
  (PlutoF vs PlutoM differ on 618/874 lines.)

## Decision

The duplication is in the **scaffolding**, not the content. A full data-driven
single `ProductPage` (Approach A) was rejected: bodies are too bespoke, the
rewrite would be large/risky and could flatten product nuance. Product
components also have **no tests**, so we favor low-risk, behavior-preserving
moves.

**Approach B, in two steps:**

### Step 1 — `useProductPage()` hook (this PR)
`src/hooks/useProductPage.ts` centralizes the modal/quote state + handlers and
the add-to-cart / datasheet-download logic:

```ts
useProductPage(): {
  isModalOpen, isQuoteIntent,
  openContactForm(quote?), closeContactForm(),
  addToCart({ id, name, price, image, sku }),   // addItem + GA4 + analytics + navigate('/cart')
  downloadBrochure(href, filename),
}
```

Each component destructures what it needs. Cart components keep their
`handleAddToCart` name (JSX unchanged) but delegate to `addToCart`; the two
brochure components delegate to `downloadBrochure`. `useScrollToTop()` stays in
each component (separate concern). No product copy/specs/layout/data changes.

### Step 2 — 1–2 low-coupling shell components (follow-up PR)
Extract the repeated chrome (e.g. the `QuoteModal` + `SEO` + `Breadcrumbs`
wiring, or a shared CTA band) into shell component(s). Still no full
data-driven rewrite; product bodies untouched.

## Non-goals
- Approach A (full data-driven ProductPage).
- Any change to product copy, specs, layout, images, or pricing.

## Verification (each step)
`npx tsc --noEmit` clean · `npm run lint` 0 errors · `npm test` all pass · each
step its own commit.
