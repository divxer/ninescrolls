# Product Detail Commerce + Gallery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `ProductDetailPage` so RFQ products stay unchanged while HY-4L can use real ecommerce variants, Add to Cart, AggregateOffer schema, and secondary product-view gallery.

**Architecture:** Add optional `commerce` and `gallery` config sections. Keep cart hooks isolated in a commerce-only child component so RFQ pages do not require `CartProvider`. Extract Stripe product catalog constants from Lambda handlers into importable modules, then add a frontend consistency test that compares commerce config prices with both Lambda catalogs.

**Tech Stack:** React, TypeScript, React Router, Vitest, Testing Library, react-helmet-async, existing `useProductPage`, existing `ProductDetailPage` config pattern.

## Global Constraints

- `commerce` and `gallery` are optional; omitted sections render no empty shells.
- RFQ-only pages keep existing primary/secondary CTA behavior and `price: "0"` Offer schema.
- Commerce variants are first-class data; if `defaultSku` is omitted, the first variant is selected.
- HY-4L variants are RF (`hy-4l-rf`, `$7,999`) and Mid-Frequency (`hy-4l-mf`, `$6,499`).
- Commerce prices render as USD with thousands separators, such as `$7,999`.
- Cart hooks must not run for RFQ-only pages.
- Add to Cart must preserve `useProductPage().addToCart`: cart item, GA4 `add_to_cart`, `analytics.trackAddToCart`, and navigation to `/cart`.
- Commerce schema uses real price data; HY-4L emits `AggregateOffer` with low price `6499`, high price `7999`, and offer count `2`.
- Commerce config prices must match both Stripe Lambda catalogs.
- Gallery is a simple responsive grid; no carousel, zoom viewer, or lightbox.
- Gallery copy must not use `supplier-provided`, `vendor-provided`, or similar source-chain language.
- Gallery images do not enter JSON-LD image, Open Graph image, or Twitter image.
- HY-4L must preserve `/products/hy-4l-rf`, `/products/hy-4l-mf`, and `/products/hy-4l?config=rf|mf` variant preselection.
- Do not migrate HY-20L, HY-20LRF, Pluto-F, Pluto-M, or Pluto-T in this first implementation.

---

### Task 1: Add Commerce and Gallery Types With RFQ Omission Tests

**Files:**
- Modify: `src/components/products/ProductDetailPage.types.ts`
- Modify: `src/components/products/ProductDetailPage.test.tsx`

**Interfaces:**
- Produces: `ProductDetailCommerceVariant`, `ProductDetailCommerce`, `ProductDetailGalleryImage`, `ProductDetailGallerySection`
- Produces: optional `commerce?: ProductDetailCommerce` and `gallery?: ProductDetailGallerySection` on `ProductDetailConfig`

- [ ] **Step 1: Write failing type and omission tests**

In `src/components/products/ProductDetailPage.test.tsx`, extend `allows product configs to omit research and resource sections` so it also proves commerce and gallery omissions:

```ts
expect(screen.queryByTestId('product-commerce-panel')).not.toBeInTheDocument();
expect(screen.queryByText('Product Views')).not.toBeInTheDocument();
```

Add a new test that builds a config with commerce and gallery and asserts those sections render. The test will fail before implementation because the types and DOM do not exist:

```ts
it('renders commerce controls and gallery only when configured', () => {
  const commerceConfig: ProductDetailConfig = {
    ...icpEtcherConfig,
    slug: 'commerce-prototype',
    commerce: {
      variants: [
        { sku: 'commerce-rf', label: 'RF (13.56 MHz)', price: 7999 },
        { sku: 'commerce-mf', label: 'Mid-Frequency (40 kHz)', price: 6499 },
      ],
      quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=commerce-prototype' },
    },
    gallery: {
      eyebrow: 'System Views',
      heading: 'Product Views',
      copy: 'Use these actual system photos to review the compact enclosure.',
      images: [
        {
          src: '/assets/images/products/ns-plasma-4r/main.jpg',
          alt: 'Commerce prototype front view',
          label: 'Front view',
          width: 800,
          height: 600,
        },
      ],
    },
  };

  render(
    <HelmetProvider>
      <MemoryRouter>
        <ProductDetailPage config={commerceConfig} />
      </MemoryRouter>
    </HelmetProvider>
  );

  expect(screen.getByTestId('product-commerce-panel')).toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 2, name: 'Product Views' })).toBeInTheDocument();
  expect(screen.getByAltText('Commerce prototype front view')).toHaveAttribute(
    'src',
    '/assets/images/products/ns-plasma-4r/main.jpg'
  );
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/components/products/ProductDetailPage.test.tsx
```

Expected: TypeScript/test failure because `commerce` and `gallery` do not exist on `ProductDetailConfig`, or DOM assertions fail because the sections are not rendered.

- [ ] **Step 3: Add minimal type definitions**

In `ProductDetailPage.types.ts`, add:

```ts
export interface ProductDetailCommerceVariant {
  sku: string;
  label: string;
  price: number;
}

export interface ProductDetailCommerce {
  variants: ProductDetailCommerceVariant[];
  defaultSku?: string;
  addToCartLabel?: string;
  quoteAction: ProductDetailAction;
}

export interface ProductDetailGalleryImage extends ProductDetailImage {
  label?: string;
}

export interface ProductDetailGallerySection {
  eyebrow?: string;
  heading: string;
  copy?: string;
  images: ProductDetailGalleryImage[];
}
```

Add to `ProductDetailConfig`:

```ts
commerce?: ProductDetailCommerce;
gallery?: ProductDetailGallerySection;
```

- [ ] **Step 4: Add minimal guarded gallery rendering**

In `ProductDetailPage.tsx`, add a gallery section after applications and before research:

```tsx
{config.gallery && (
  <section className="px-6 py-20 md:px-10 lg:px-16">
    <div className="mx-auto max-w-screen-2xl">
      <div className="max-w-3xl">
        {config.gallery.eyebrow && (
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">{config.gallery.eyebrow}</p>
        )}
        <h2 className="mt-4 font-headline text-4xl font-semibold tracking-normal text-slate-950">
          {config.gallery.heading}
        </h2>
        {config.gallery.copy && <p className="mt-5 text-base leading-8 text-slate-600">{config.gallery.copy}</p>}
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {config.gallery.images.map(image => (
          <figure key={`${image.src}-${image.alt}`} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <OptimizedImage
              src={image.src}
              alt={image.alt}
              className="h-full w-full object-cover"
              width={image.width}
              height={image.height}
            />
            {image.label && <figcaption className="px-5 py-4 text-sm font-semibold text-slate-700">{image.label}</figcaption>}
          </figure>
        ))}
      </div>
    </div>
  </section>
)}
```

Add a minimal empty commerce panel so the first guarded-render test can pass before behavior is added:

```tsx
{config.commerce && <div data-testid="product-commerce-panel" />}
```

- [ ] **Step 5: Run tests to verify GREEN**

Run:

```bash
npm test -- src/components/products/ProductDetailPage.test.tsx
```

Expected: all tests in the file pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/products/ProductDetailPage.types.ts src/components/products/ProductDetailPage.tsx src/components/products/ProductDetailPage.test.tsx
git commit -m "feat: add optional product detail gallery contract"
```

---

### Task 2: Implement Commerce Child Component and Preserve Cart Behavior

**Files:**
- Create: `src/components/products/ProductCommercePanel.tsx`
- Create: `src/components/products/ProductCommercePanel.test.tsx`
- Modify: `src/components/products/ProductDetailPage.tsx`
- Modify: `src/components/products/ProductDetailPage.test.tsx`

**Interfaces:**
- Consumes: `ProductDetailCommerce`, `ProductDetailImage`
- Produces: `<ProductCommercePanel commerce productName productImage />`

- [ ] **Step 1: Write failing behavior tests**

Create `src/components/products/ProductCommercePanel.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { ProductCommercePanel } from './ProductCommercePanel';

const addToCart = vi.fn();

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

const commerce = {
  variants: [
    { sku: 'hy-4l-rf', label: 'RF (13.56 MHz)', price: 7999 },
    { sku: 'hy-4l-mf', label: 'Mid-Frequency (40 kHz)', price: 6499 },
  ],
  quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-4l' },
};

describe('ProductCommercePanel', () => {
  it('defaults to the first variant when defaultSku is omitted', () => {
    render(
      <MemoryRouter>
        <ProductCommercePanel
          commerce={commerce}
          productName="HY-4L Plasma Cleaner"
          productImage="/assets/images/products/ns-plasma-4r/main.jpg"
        />
      </MemoryRouter>
    );

    expect(screen.getByText('$7,999')).toBeInTheDocument();
  });

  it('switches variants and adds the selected SKU and price to cart', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ProductCommercePanel
          commerce={commerce}
          productName="HY-4L Plasma Cleaner"
          productImage="/assets/images/products/ns-plasma-4r/main.jpg"
        />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: /Mid-Frequency/i }));
    expect(screen.getByText('$6,499')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith({
      id: 'hy-4l-mf',
      sku: 'hy-4l-mf',
      name: 'HY-4L Plasma Cleaner - Mid-Frequency (40 kHz)',
      price: 6499,
      image: '/assets/images/products/ns-plasma-4r/main.jpg',
    });
  });

  it('keeps the budgetary quote action available', () => {
    render(
      <MemoryRouter>
        <ProductCommercePanel
          commerce={commerce}
          productName="HY-4L Plasma Cleaner"
          productImage="/assets/images/products/ns-plasma-4r/main.jpg"
        />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Request a Budgetary Quote' })).toHaveAttribute(
      'href',
      '/request-quote?products=hy-4l'
    );
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/components/products/ProductCommercePanel.test.tsx
```

Expected: FAIL because `ProductCommercePanel` does not exist.

- [ ] **Step 3: Implement the commerce child component**

Create `src/components/products/ProductCommercePanel.tsx`:

```tsx
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProductPage } from '../../hooks/useProductPage';
import type { ProductDetailCommerce } from './ProductDetailPage.types';

interface ProductCommercePanelProps {
  commerce: ProductDetailCommerce;
  productName: string;
  productImage: string;
}

const formatUsd = (price: number) => `$${price.toLocaleString('en-US')}`;

export function ProductCommercePanel({ commerce, productName, productImage }: ProductCommercePanelProps) {
  const defaultVariant = commerce.variants.find(variant => variant.sku === commerce.defaultSku) ?? commerce.variants[0];
  const [selectedSku, setSelectedSku] = useState(defaultVariant.sku);
  const { addToCart } = useProductPage();

  const selectedVariant = useMemo(
    () => commerce.variants.find(variant => variant.sku === selectedSku) ?? defaultVariant,
    [commerce.variants, defaultVariant, selectedSku]
  );

  const handleAddToCart = () => {
    addToCart({
      id: selectedVariant.sku,
      sku: selectedVariant.sku,
      name: `${productName} - ${selectedVariant.label}`,
      price: selectedVariant.price,
      image: productImage,
    });
  };

  return (
    <div data-testid="product-commerce-panel" className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">Configuration</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {commerce.variants.map(variant => (
          <button
            key={variant.sku}
            type="button"
            onClick={() => setSelectedSku(variant.sku)}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              selectedVariant.sku === variant.sku
                ? 'border-sky-300 bg-sky-400 text-slate-950'
                : 'border-white/20 bg-white/5 text-white hover:bg-white/10'
            }`}
          >
            {variant.label}
          </button>
        ))}
      </div>
      <p className="mt-5 font-mono text-3xl font-semibold tracking-normal text-white">{formatUsd(selectedVariant.price)}</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleAddToCart}
          className="inline-flex min-h-12 items-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-sky-400 motion-reduce:transform-none"
        >
          {commerce.addToCartLabel ?? 'Add to Cart'}
        </button>
        <Link
          to={commerce.quoteAction.href}
          className="inline-flex min-h-12 items-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/12 motion-reduce:transform-none"
        >
          {commerce.quoteAction.label}
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire panel into the hero**

In `ProductDetailPage.tsx`, import the panel:

```ts
import { ProductCommercePanel } from './ProductCommercePanel';
```

Replace the minimal empty commerce panel and branch the hero CTA area. Keep the existing RFQ link/button markup unchanged inside the non-commerce branch:

```tsx
{config.commerce ? (
  <ProductCommercePanel
    commerce={config.commerce}
    productName={config.schema.name}
    productImage={config.hero.image.src}
  />
) : (
  <div className="mt-8 flex flex-wrap gap-4">
    <Link
      to={config.hero.primaryAction.href}
      className="inline-flex min-h-12 items-center rounded-xl bg-sky-500 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-sky-400 motion-reduce:transform-none"
    >
      {config.hero.primaryAction.label}
    </Link>
    <Link
      to={config.hero.secondaryAction.href}
      className="inline-flex min-h-12 items-center rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/12 motion-reduce:transform-none"
    >
      {config.hero.secondaryAction.label}
    </Link>
  </div>
)}
```

Keep the datasheet button available in both branches by placing it below the branch:

```tsx
<button
  type="button"
  onClick={() => setGateOpen(true)}
  className="mt-4 inline-flex min-h-12 items-center rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/10 motion-reduce:transform-none"
>
  {config.datasheet.buttonLabel}
</button>
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/components/products/ProductCommercePanel.test.tsx src/components/products/ProductDetailPage.test.tsx src/hooks/useProductPage.test.ts
```

Expected: all tests pass; no `useCart must be used within a CartProvider` error in RFQ template tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/products/ProductCommercePanel.tsx src/components/products/ProductCommercePanel.test.tsx src/components/products/ProductDetailPage.tsx src/components/products/ProductDetailPage.test.tsx
git commit -m "feat: add product detail commerce controls"
```

---

### Task 3: Add Commerce-Aware Product Schema

**Files:**
- Modify: `src/components/products/ProductDetailPage.tsx`
- Modify: `src/components/products/ProductDetailPage.test.tsx`

**Interfaces:**
- Consumes: `config.commerce`
- Produces: single Offer for RFQ configs; AggregateOffer for multi-variant commerce configs

- [ ] **Step 1: Write failing schema tests**

In `ProductDetailPage.test.tsx`, add helper:

```ts
function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}
```

Add RFQ regression assertion to an existing test:

```ts
expect(getProductJsonLd().offers).toMatchObject({
  '@type': 'Offer',
  price: '0',
  priceCurrency: 'USD',
  url: 'https://ninescrolls.com/products/icp-etcher',
});
```

Add commerce schema test:

```ts
it('uses AggregateOffer for multi-variant commerce products', () => {
  const commerceConfig: ProductDetailConfig = {
    ...icpEtcherConfig,
    slug: 'hy-4l',
    schema: {
      ...icpEtcherConfig.schema,
      name: 'HY-4L Plasma Cleaner',
      sku: 'hy-4l',
    },
    commerce: {
      variants: [
        { sku: 'hy-4l-rf', label: 'RF (13.56 MHz)', price: 7999 },
        { sku: 'hy-4l-mf', label: 'Mid-Frequency (40 kHz)', price: 6499 },
      ],
      quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-4l' },
    },
  };

  render(
    <HelmetProvider>
      <MemoryRouter>
        <ProductDetailPage config={commerceConfig} />
      </MemoryRouter>
    </HelmetProvider>
  );

  expect(getProductJsonLd().offers).toMatchObject({
    '@type': 'AggregateOffer',
    lowPrice: '6499',
    highPrice: '7999',
    offerCount: 2,
    priceCurrency: 'USD',
    availability: 'https://schema.org/InStock',
    url: 'https://ninescrolls.com/products/hy-4l',
  });
  expect(getProductJsonLd().offers.priceValidUntil).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/components/products/ProductDetailPage.test.tsx
```

Expected: commerce schema assertion fails because ProductDetailPage still emits single `Offer`.

- [ ] **Step 3: Implement schema helper inline**

In `ProductDetailPage.tsx`, before `structuredData`, add:

```ts
const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
const offerData = config.commerce
  ? {
      '@type': 'AggregateOffer',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'USD',
      lowPrice: String(Math.min(...config.commerce.variants.map(variant => variant.price))),
      highPrice: String(Math.max(...config.commerce.variants.map(variant => variant.price))),
      offerCount: config.commerce.variants.length,
      priceValidUntil,
      url: productUrl,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'NineScrolls LLC', url: 'https://ninescrolls.com' },
    }
  : {
      '@type': 'Offer',
      availability: 'https://schema.org/InStock',
      priceCurrency: 'USD',
      price: '0',
      url: productUrl,
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'NineScrolls LLC', url: 'https://ninescrolls.com' },
    };
```

Then set:

```ts
offers: offerData,
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm test -- src/components/products/ProductDetailPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/ProductDetailPage.tsx src/components/products/ProductDetailPage.test.tsx
git commit -m "feat: emit commerce product offer schema"
```

---

### Task 4: Extract Stripe Product Catalogs and Add Price Consistency Test

**Files:**
- Create: `amplify/functions/create-checkout-session/productCatalog.ts`
- Create: `amplify/functions/calculate-tax/productCatalog.ts`
- Modify: `amplify/functions/create-checkout-session/handler.ts`
- Modify: `amplify/functions/calculate-tax/handler.ts`
- Create: `src/components/products/productDetailConfigs/commercePriceConsistency.test.ts`

**Interfaces:**
- Produces: `checkoutProductCatalog`
- Produces: `taxProductCatalog`
- Produces: a Vitest test that compares commerce config prices against both catalogs

- [ ] **Step 1: Write failing consistency test**

Create `src/components/products/productDetailConfigs/commercePriceConsistency.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { checkoutProductCatalog } from '../../../../amplify/functions/create-checkout-session/productCatalog';
import { taxProductCatalog } from '../../../../amplify/functions/calculate-tax/productCatalog';
import type { ProductDetailConfig } from '../ProductDetailPage.types';

const commerceConfigs: ProductDetailConfig[] = [];

describe('commerce product prices', () => {
  it('keeps product detail config prices aligned with Stripe checkout and tax catalogs', () => {
    for (const config of commerceConfigs) {
      for (const variant of config.commerce?.variants ?? []) {
        expect(checkoutProductCatalog[variant.sku]?.price).toBe(variant.price);
        expect(taxProductCatalog[variant.sku]?.price).toBe(variant.price);
      }
    }
  });
});
```

This compiles only after catalog modules exist. HY-4L will be added to `commerceConfigs` in Task 5.

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/components/products/productDetailConfigs/commercePriceConsistency.test.ts
```

Expected: FAIL because product catalog modules do not exist.

- [ ] **Step 3: Extract checkout catalog**

Create `amplify/functions/create-checkout-session/productCatalog.ts`:

```ts
export interface CheckoutProductCatalogItem {
  name: string;
  price: number;
  imagePath?: string;
  taxCode?: string;
  priceId?: string;
}

export const checkoutProductCatalog: Record<string, CheckoutProductCatalogItem> = {
  'hy-4l-rf': {
    name: 'HY-4L - RF (13.56 MHz) Plasma Cleaner',
    price: 7999,
    imagePath: '/assets/images/products/ns-plasma-4r/main.jpg',
    taxCode: 'txcd_99999999',
  },
  'hy-4l-mf': {
    name: 'HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner',
    price: 6499,
    imagePath: '/assets/images/products/ns-plasma-4r/main.jpg',
    taxCode: 'txcd_99999999',
  },
};
```

In `create-checkout-session/handler.ts`, import it:

```ts
import { checkoutProductCatalog } from './productCatalog';
```

Replace the inline `const productCatalog: Record<string, { name: string; price: number; imagePath?: string; taxCode?: string; priceId?: string }> = { ... }` with:

```ts
const productCatalog = checkoutProductCatalog;
```

- [ ] **Step 4: Extract tax catalog**

Create `amplify/functions/calculate-tax/productCatalog.ts`:

```ts
export interface TaxProductCatalogItem {
  name: string;
  price: number;
  taxCode?: string;
}

export const taxProductCatalog: Record<string, TaxProductCatalogItem> = {
  'hy-4l-rf': {
    name: 'HY-4L - RF (13.56 MHz) Plasma Cleaner',
    price: 7999,
    taxCode: 'txcd_99999999',
  },
  'hy-4l-mf': {
    name: 'HY-4L - Mid-Frequency (40 kHz) Plasma Cleaner',
    price: 6499,
    taxCode: 'txcd_99999999',
  },
};
```

In `calculate-tax/handler.ts`, import it:

```ts
import { taxProductCatalog } from './productCatalog';
```

Replace the inline `const productCatalog: Record<string, { name: string; price: number; taxCode?: string }> = { ... }` with:

```ts
const productCatalog = taxProductCatalog;
```

- [ ] **Step 5: Run tests and typecheck**

Run:

```bash
npm test -- src/components/products/productDetailConfigs/commercePriceConsistency.test.ts
npm run typecheck:amplify
```

Expected: price consistency test passes with no commerce configs listed yet; Amplify TypeScript passes.

- [ ] **Step 6: Commit**

```bash
git add amplify/functions/create-checkout-session/productCatalog.ts amplify/functions/calculate-tax/productCatalog.ts amplify/functions/create-checkout-session/handler.ts amplify/functions/calculate-tax/handler.ts src/components/products/productDetailConfigs/commercePriceConsistency.test.ts
git commit -m "refactor: share commerce product price catalogs"
```

---

### Task 5: Migrate HY-4L to the Commerce/Gallery Template

**Files:**
- Create: `src/components/products/productDetailConfigs/hy4lConfig.ts`
- Modify: `src/components/products/HY4L.tsx`
- Create: `src/components/products/HY4L.test.tsx`
- Modify: `src/components/products/productDetailConfigs/commercePriceConsistency.test.ts`

**Interfaces:**
- Consumes: `ProductDetailPage`, `ProductDetailConfig`, `commerce`, `gallery`
- Produces: `hy4lConfig`

- [ ] **Step 1: Write failing HY-4L tests**

Create `src/components/products/HY4L.test.tsx`:

```ts
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { HY4L } from './HY4L';

const addToCart = vi.fn();

vi.mock('../../hooks/useProductPage', () => ({
  useProductPage: () => ({ addToCart }),
}));

vi.mock('../common/DownloadGateModal', () => ({
  DownloadGateModal: () => null,
}));

function renderHy4l(initialEntry = '/products/hy-4l') {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[initialEntry]}>
        <HY4L />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function getProductJsonLd() {
  return Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map(script => JSON.parse(script.textContent ?? '{}'))
    .find(data => data['@type'] === 'Product');
}

describe('HY4L commerce product page', () => {
  it('defaults to RF and can switch to Mid-Frequency before adding to cart', async () => {
    const user = userEvent.setup();
    renderHy4l();

    expect(screen.getByText('$7,999')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Mid-Frequency/i }));
    expect(screen.getByText('$6,499')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add to Cart' }));
    expect(addToCart).toHaveBeenCalledWith(expect.objectContaining({
      id: 'hy-4l-mf',
      sku: 'hy-4l-mf',
      price: 6499,
    }));
  });

  it('preselects variants from dedicated routes and query params', () => {
    renderHy4l('/products/hy-4l-mf');
    expect(screen.getByText('$6,499')).toBeInTheDocument();
  });

  it('keeps budgetary quote and gallery available', () => {
    renderHy4l('/products/hy-4l?config=rf');
    expect(screen.getByRole('link', { name: 'Request a Budgetary Quote' })).toHaveAttribute(
      'href',
      '/request-quote?products=hy-4l'
    );
    expect(screen.getByRole('heading', { level: 2, name: 'System Views' })).toBeInTheDocument();
    expect(screen.queryByText(/supplier-provided/i)).not.toBeInTheDocument();
  });

  it('uses AggregateOffer schema for the two purchasable variants', () => {
    renderHy4l();
    expect(getProductJsonLd().offers).toMatchObject({
      '@type': 'AggregateOffer',
      lowPrice: '6499',
      highPrice: '7999',
      offerCount: 2,
      priceCurrency: 'USD',
    });
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm test -- src/components/products/HY4L.test.tsx
```

Expected: FAIL because legacy HY4L does not render the template commerce/gallery contract.

- [ ] **Step 3: Create HY-4L config**

Create `src/components/products/productDetailConfigs/hy4lConfig.ts` using the current legacy page's verified ecommerce data:

```ts
import type { ProductDetailConfig } from '../ProductDetailPage.types';

// Price edits must stay aligned with:
// - amplify/functions/create-checkout-session/productCatalog.ts
// - amplify/functions/calculate-tax/productCatalog.ts
export const hy4lConfig: ProductDetailConfig = {
  slug: 'hy-4l',
  seo: {
    title: 'HY-4L Plasma Cleaner',
    description: 'Compact 4L plasma cleaner with RF and mid-frequency configurations for research labs, teaching labs, and sample preparation.',
    keywords: 'HY-4L plasma cleaner, compact plasma cleaner, RF plasma cleaner, mid-frequency plasma cleaner',
  },
  schema: {
    name: 'HY-4L Plasma Cleaner',
    description: 'Compact 4L plasma cleaner with RF and mid-frequency configurations.',
    sku: 'hy-4l',
    category: 'Plasma Cleaning Equipment',
  },
  faq: [
    {
      question: 'Which HY-4L frequency should I choose?',
      answer: 'RF is the default for research plasma cleaning and surface activation. Mid-frequency is a lower-cost option for routine sample preparation.',
    },
  ],
  breadcrumb: {
    parentLabel: 'Products',
    parentHref: '/products',
    current: 'HY-4L',
  },
  hero: {
    eyebrow: 'Compact Plasma Cleaner',
    title: 'HY-4L Plasma Cleaner',
    description: 'A compact 4L plasma cleaner for research labs, teaching labs, and low-volume sample preparation.',
    image: {
      src: '/assets/images/products/ns-plasma-4r/main.jpg',
      alt: 'HY-4L compact plasma cleaner',
      width: 800,
      height: 600,
    },
    stats: [
      { label: 'Chamber', value: '4 L' },
      { label: 'RF Power', value: '150 W' },
      { label: 'Options', value: 'RF / MF' },
      { label: 'Lead Time', value: '3-4 weeks' },
    ],
    primaryAction: { label: 'Add to Cart', href: '/cart' },
    secondaryAction: { label: 'Request Quote', href: '/request-quote?products=hy-4l' },
  },
  commerce: {
    variants: [
      { sku: 'hy-4l-rf', label: 'RF (13.56 MHz)', price: 7999 },
      { sku: 'hy-4l-mf', label: 'Mid-Frequency (40 kHz)', price: 6499 },
    ],
    defaultSku: 'hy-4l-rf',
    quoteAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-4l' },
  },
  datasheet: {
    fileUrl: '/assets/pdfs/hy-4l-datasheet.pdf',
    fileName: 'hy-4l-datasheet.pdf',
    title: 'Download HY-4L Datasheet',
    buttonLabel: 'Download Datasheet',
  },
  processIntro: {
    eyebrow: 'Surface Preparation',
    title: 'Compact plasma treatment for small-lab workflows.',
    copy: 'HY-4L supports cleaning, activation, and sample preparation without the footprint of a full-size plasma system.',
    windows: [
      { title: 'Cleaning', copy: 'Remove organic residue before bonding, coating, or analysis.', details: ['Oxygen plasma', 'Low-volume samples'] },
      { title: 'Activation', copy: 'Improve surface energy for adhesion and wetting.', details: ['Polymers', 'Glass', 'Metals'] },
      { title: 'Education', copy: 'A compact platform for teaching and prototyping labs.', details: ['4L chamber', 'Bench format'] },
    ],
  },
  coreWindows: {
    eyebrow: 'Use Cases',
    title: 'Built for compact lab plasma workflows.',
    compareAction: { label: 'Compare plasma cleaners', href: '/products/plasma-cleaner' },
    cards: [
      { title: 'Sample Cleaning', copy: 'Prepare small substrates and samples before downstream processing.' },
      { title: 'Surface Activation', copy: 'Increase surface energy before bonding, coating, or printing.' },
      { title: 'Teaching Labs', copy: 'Support hands-on plasma processing education with a compact system.' },
    ],
  },
  specifications: {
    eyebrow: 'Specifications',
    title: 'HY-4L configuration window',
    copy: 'Representative HY-4L options. Confirm process-specific configuration during quote review.',
    testId: 'hy-4l-specifications',
    items: [
      { label: 'Chamber Volume', value: '4 L' },
      { label: 'RF Frequency', value: '13.56 MHz' },
      { label: 'MF Frequency', value: '40 kHz' },
      { label: 'RF Power', value: '150 W' },
    ],
  },
  applications: {
    eyebrow: 'Applications',
    title: 'Where HY-4L fits',
    items: ['Surface cleaning', 'Surface activation', 'Bonding preparation', 'Teaching labs', 'Small sample preparation', 'Research prototyping'],
  },
  gallery: {
    eyebrow: 'System Views',
    heading: 'System Views',
    copy: 'Use these actual system photos to review the compact enclosure, service-side access, chamber placement, and bench integration before configuration review.',
    images: [
      {
        src: '/assets/images/products/ns-plasma-4r/main.jpg',
        alt: 'HY-4L plasma cleaner front view',
        label: 'Front view',
        width: 800,
        height: 600,
      },
    ],
  },
  resources: {
    eyebrow: 'Resources',
    title: 'Related Resources',
    items: [
      { title: 'Plasma Cleaning Basics', href: '/insights/plasma-cleaning-basics', meta: 'Surface preparation guide' },
    ],
  },
  finalCta: {
    eyebrow: 'Ready to Configure',
    title: 'Choose the HY-4L configuration for your lab.',
    copy: 'Order directly or request a budgetary quote for institutional purchasing.',
    primaryAction: { label: 'Add to Cart', href: '/cart' },
    secondaryAction: { label: 'Request a Budgetary Quote', href: '/request-quote?products=hy-4l' },
    backgroundImage: '/assets/images/products/ns-plasma-4r/main.jpg',
  },
};
```

Before keeping the `resources` section, verify each resource slug against the live sitemap or DynamoDB-backed catalog. If `plasma-cleaning-basics` is not verified, omit `resources` from HY-4L in this first migration.

- [ ] **Step 4: Replace HY4L wrapper**

Replace `src/components/products/HY4L.tsx` with:

```tsx
import { useLocation } from 'react-router-dom';
import { ProductDetailPage } from './ProductDetailPage';
import { hy4lConfig } from './productDetailConfigs/hy4lConfig';

export function HY4L() {
  const location = useLocation();
  const selectedSku = location.pathname.includes('-mf') || new URLSearchParams(location.search).get('config') === 'mf'
    ? 'hy-4l-mf'
    : 'hy-4l-rf';

  return (
    <ProductDetailPage
      config={{
        ...hy4lConfig,
        commerce: hy4lConfig.commerce ? { ...hy4lConfig.commerce, defaultSku: selectedSku } : undefined,
      }}
    />
  );
}
```

- [ ] **Step 5: Add HY-4L to price consistency test**

In `commercePriceConsistency.test.ts`, import the config:

```ts
import { hy4lConfig } from './hy4lConfig';
```

Set:

```ts
const commerceConfigs: ProductDetailConfig[] = [hy4lConfig];
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/components/products/HY4L.test.tsx src/components/products/ProductCommercePanel.test.tsx src/components/products/ProductDetailPage.test.tsx src/components/products/productDetailConfigs/commercePriceConsistency.test.ts src/hooks/useProductPage.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/components/products/HY4L.tsx src/components/products/HY4L.test.tsx src/components/products/productDetailConfigs/hy4lConfig.ts src/components/products/productDetailConfigs/commercePriceConsistency.test.ts
git commit -m "feat: migrate HY-4L with commerce and gallery"
```

---

### Task 6: Browser QA, Full Verification, and Cleanup

**Files:**
- Modify only if verification finds issues.

**Interfaces:**
- Consumes: full feature from Tasks 1-5.
- Produces: verified branch ready for review.

- [ ] **Step 1: Run full targeted product tests**

Run:

```bash
npm test -- src/components/products src/hooks/useProductPage.test.ts
```

Expected: all product and product-hook tests pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build exits 0. Existing lint warnings and chunk-size warnings may remain; no new errors.

- [ ] **Step 3: Inspect HY-4L in browser**

Open:

```text
http://127.0.0.1:5173/products/hy-4l
http://127.0.0.1:5173/products/hy-4l-mf
http://127.0.0.1:5173/products/hy-4l?config=mf
```

Check:

- Default HY-4L shows RF price `$7,999`.
- MF route/query shows `$6,499`.
- Variant selector changes price.
- Add to Cart button is visually primary.
- Request a Budgetary Quote remains visible.
- Gallery renders system views and does not mention supplier source.
- RFQ-only product page such as `/products/icp-etcher` still shows Request Quote first and no commerce panel.

- [ ] **Step 4: Run source scans**

Run:

```bash
rg -n 'supplier-provided|vendor-provided|manufacturer-provided' src/components/products
rg -n 'price: "0"|price: \\'0\\'' src/components/products/productDetailConfigs src/components/products/ProductDetailPage.tsx
```

Expected: first command has no customer-facing hits. Second command shows only RFQ schema path, not HY-4L commerce config.

- [ ] **Step 5: Fix verification issues in the owning task**

If verification finds an issue, return to the task that owns the affected behavior, add or update the focused test there, make the minimal fix, rerun that task's focused command, then rerun this Task 6 verification. Do not create an empty commit when verification requires no edits.

- [ ] **Step 6: Prepare review summary**

Include:

- RFQ zero-regression evidence.
- HY-4L commerce behavior evidence.
- Price catalog consistency evidence.
- Browser QA notes.
- Any known non-blocking follow-ups for remaining cleaner family pages.
