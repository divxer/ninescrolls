# Product Detail Commerce + Gallery Extension — Design

**Date:** 2026-07-05
**Status:** Draft for review

## Problem

`ProductDetailPage` now works well for RFQ-led equipment pages, but HY/Pluto
plasma cleaner pages are direct-purchase products. HY-4L has real ecommerce
behavior today: RF and MF variants, public prices, Add to Cart, analytics
tracking, Stripe checkout, and tax calculation. Moving HY-4L into the current
RFQ-only template removed that purchase path and emitted `price: 0` product
schema, which is a functional and SEO regression.

The cleaner family also has useful multi-view product photography on the legacy
pages. Front, rear, chamber, pump, and bench-integration views are valuable to
lab buyers, but they should be represented as product/system views without
exposing upstream supplier or OEM relationships.

## Decision

Extend `ProductDetailPage` with two optional capabilities:

- `commerce` for products that can be purchased directly.
- `gallery` for secondary product/system views.

RFQ-only products must render byte-for-byte equivalent schema and behavior when
these fields are omitted. HY-4L is the first implementation target and proof
case. HY-20L, HY-20LRF, Pluto-F, Pluto-M, and Pluto-T remain follow-up migrations
after the contract is proven.

## Commerce Contract

Commerce treats variants as first-class data, not decoration:

```ts
interface ProductDetailCommerceVariant {
  sku: string;
  label: string;
  price: number;
  image?: ProductDetailImage;
}

interface ProductDetailCommerce {
  variants: ProductDetailCommerceVariant[];
  defaultSku?: string;
  addToCartLabel?: string;
  quoteAction: ProductDetailAction;
}

interface ProductDetailConfig {
  commerce?: ProductDetailCommerce;
}
```

HY-4L will use:

- RF (13.56 MHz), `hy-4l-rf`, `$7,999`
- Mid-Frequency (40 kHz), `hy-4l-mf`, `$6,499`

When `commerce` exists, the hero CTA area becomes purchase-first:

- Variant selector
- Current price
- Primary Add to Cart button
- Secondary budgetary quote/RFQ link
- Datasheet button remains available

When `commerce` is absent, the existing primary/secondary RFQ actions remain
unchanged.

## Cart and Analytics

The template must not call cart hooks for RFQ-only pages. Directly calling a cart
hook inside `ProductDetailPage` would force every RFQ test and page render to be
inside `CartProvider`, recreating the known `useCart must be used within a
CartProvider` failure.

The commerce implementation should reuse the existing `useProductPage().addToCart`
path only from a commerce-only child component. That keeps hooks unconditional
inside the child while ensuring the child is rendered only when `commerce` is
present. The existing add-to-cart behavior must be preserved:

- Add the selected variant to cart with `id`, `sku`, `name`, `price`, `image`,
  and quantity `1`.
- Fire GA4 `add_to_cart`.
- Fire `analytics.trackAddToCart(sku, name, price)`.
- Navigate to `/cart`.

## Offer Schema

RFQ-only products keep the existing single Offer shape with `price: "0"` so the
existing migrated pages do not change.

Commerce products use real price data:

- One variant can emit `Offer`.
- Multiple variants emit `AggregateOffer` with `lowPrice`, `highPrice`,
  `offerCount`, `priceCurrency: "USD"`, `availability`, and `url`.
- Add `priceValidUntil` for real-priced commerce offers.

HY-4L should produce an AggregateOffer with low price `6499`, high price `7999`,
and offer count `2`.

## Price Source Consistency

Commerce config prices duplicate values that are also whitelisted in the Stripe
tax and checkout Lambda product catalogs. That duplication is acceptable for
this template extension only if guarded.

Implementation must add a verification check that compares commerce config
variant prices against:

- `amplify/functions/create-checkout-session/handler.ts`
- `amplify/functions/calculate-tax/handler.ts`

The check should fail when a commerce config SKU is missing from either Lambda
catalog or when prices differ. The commerce config should also include a short
comment pointing maintainers to those Lambda catalogs when editing prices.

## Gallery Contract

Gallery is optional and guarded like `research` and `resources`:

```ts
interface ProductDetailGalleryImage extends ProductDetailImage {
  label?: string;
}

interface ProductDetailGallerySection {
  eyebrow?: string;
  heading: string;
  copy?: string;
  images: ProductDetailGalleryImage[];
}

interface ProductDetailConfig {
  gallery?: ProductDetailGallerySection;
}
```

Rendering stays simple:

- Responsive grid, no carousel, no lightbox.
- Each image has meaningful alt text.
- Image `width` and `height` come from verified real dimensions.
- CDN absolute URLs and local paths are both valid.
- Gallery images do not enter JSON-LD `image`, Open Graph image, or Twitter
  image; the hero product image remains the canonical image.

Customer-facing copy must not use `supplier-provided`, `vendor-provided`, or
similar source-chain language. Use phrasing such as "actual system photos" or
"system views".

## HY-4L Pilot Scope

The HY-4L migration will happen only after the template extension is tested.
The page should keep direct-purchase behavior and institutional RFQ behavior:

- Variant selector changes the displayed price.
- Add to Cart uses the selected SKU and price.
- Secondary RFQ route remains visible.
- AggregateOffer schema reflects both variants.
- Gallery renders the real system views.
- Existing ecommerce route compatibility for `/products/hy-4l?config=rf` and
  `/products/hy-4l-rf` should be preserved if the route layer still supports it.

## Non-Goals

- Migrating HY-20L, HY-20LRF, Pluto-F, Pluto-M, or Pluto-T in the same first
  implementation.
- Rebuilding checkout, cart, tax calculation, or Stripe webhooks.
- Adding a carousel, zoom viewer, or lightbox.
- Exposing OEM, supplier, or upstream manufacturer relationships in page copy.
- Changing RFQ-only product page schema or CTA behavior.

## Testing

Use TDD for the implementation.

Regression tests for existing RFQ pages:

- `ProductDetailPage` renders with no `commerce` and no `gallery`.
- No empty commerce or gallery section appears.
- At least one existing RFQ page keeps the same rendered canonical, Product
  JSON-LD URL, and Offer schema.
- Existing per-product tests continue to pass across all migrated RFQ configs.

Commerce tests for HY-4L:

- Default variant renders the correct price.
- Switching variants updates the displayed price.
- Add to Cart sends the selected SKU and price through the existing
  `useProductPage().addToCart` behavior.
- Secondary RFQ action remains present.
- Product JSON-LD uses AggregateOffer with `lowPrice`, `highPrice`,
  `offerCount`, `availability`, and `priceValidUntil`.

Gallery tests:

- Gallery renders when `config.gallery` exists.
- Gallery does not render when omitted.
- The copy avoids `supplier-provided` and similar source-chain language.

Price consistency tests:

- Every commerce SKU in product detail configs exists in both Stripe Lambda
  catalogs.
- Config price, checkout catalog price, and tax catalog price match.

Final verification:

- Relevant focused tests for `ProductDetailPage`, HY-4L, cart hook behavior, and
  price consistency.
- Full product test suite.
- Production build.

## Rollout

1. Add commerce and gallery contracts with failing tests.
2. Implement guarded rendering and schema changes while proving RFQ pages are
   unchanged.
3. Add the price consistency check.
4. Migrate HY-4L as the first commerce/gallery page.
5. Review HY-4L in browser for desktop and mobile.
6. After HY-4L passes review, migrate the remaining cleaner family pages in
   separate commits or PRs.
