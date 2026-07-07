# Product Detail Visible FAQ Design

## Summary

Product detail pages currently emit `FAQPage` JSON-LD from `config.faq`, but the same FAQ content is not visible on the rendered page. This creates a schema-only FAQ mismatch. Fix the template by rendering a visible FAQ section from the same `config.faq` array and keeping the JSON-LD derived from that array.

This is post-freeze template change #3. It must be incremental, guarded, and regression-tested across the product-detail fleet.

## Goals

1. Make product-detail FAQ content visible to users.
2. Keep visible FAQ content and `FAQPage` JSON-LD structurally tied to the same source array.
3. Preserve the SEO value of product FAQs while eliminating schema-only content.
4. Upgrade existing FAQ copy from hidden schema text into customer-facing conversion copy.
5. Avoid introducing another per-page switch or manual consistency rule.

## Non-Goals

- Do not add a `faqVisible`, `showFaq`, or similar per-page display flag.
- Do not change `Product/Offer` schema, pricing schema, product specs, commerce behavior, quote flow, images, or CTAs.
- Do not add accordion, carousel, tabs, or lightbox interactions.
- Do not change `PlasmaCleanerOverviewPage`; it already renders visible FAQ content and matching FAQ schema.
- Do not add the ICP-RIE "system vs technology guide" FAQ in this task. That becomes a follow-up config-only micro change after this template debt is resolved.

## Current State

- `ProductDetailPage.tsx` builds `faqData` from `config.faq`.
- `ProductDetailPage.tsx` injects the `FAQPage` JSON-LD into `<Helmet>`.
- `ProductDetailPage.tsx` does not render any visible FAQ section.
- `ProductDetailPage.types.ts` requires `faq` on every `ProductDetailConfig`.
- All 17 migrated product configs currently define `faq`.
- `PlasmaCleanerOverviewPage` already follows the preferred pattern: the visible FAQ cards and `FAQPage` JSON-LD map from the same array.

## Proposed Design

### Template Behavior

Add a visible FAQ section to `ProductDetailPage`.

Placement:

- Render the FAQ section immediately before `finalCta`.
- Do not anchor placement relative to `resources`, because `resources` is optional.

Guard:

- Render the FAQ section only when `config.faq.length > 0`.
- Emit `FAQPage` JSON-LD only when `config.faq.length > 0`.
- This prevents an empty FAQ shell if a future config intentionally supplies an empty array.

Content source:

- Visible FAQ cards and JSON-LD must both map from `config.faq`.
- No duplicate local FAQ arrays.
- No separate schema-only transform that can drift from visible text.

Section copy:

- Eyebrow: `FAQ`
- Heading: `Frequently Asked Questions`

Semantics:

- Use a `<section>` with an `h2` heading.
- Use one static article/card per FAQ item.
- Use an `h3` for each question.
- Render the answer as visible paragraph text.
- Do not use accordion disclosure controls. Static rendering is the strongest compliance guarantee and avoids unnecessary keyboard/focus complexity.

Layout:

- Desktop: two-column FAQ card grid.
- Mobile: single-column stack.
- Use the existing product-detail visual language: restrained cards, 2xl radius, thin slate border, white or near-white background, readable line length.
- Keep it below-fold and conversion-supporting; the section should not compete with hero, specs, commerce, or CTA.

### FAQ Copy Review

Existing `config.faq` answers were originally treated as structured-data copy, not visible UI copy. Before shipping the visible section, review all 17 product configs.

For every FAQ item:

- Keep the answer customer-facing, direct, and useful for selection or purchase.
- Remove schema-like phrasing, filler, or claims that read like hidden SEO text.
- Preserve verified specs and pricing only when already supported by the relevant product migration work.
- Avoid OEM/supplier-disclosure phrasing on customer-facing pages.
- Prefer concise answers: usually 1-3 sentences.
- Keep terms aligned with each page's intent boundary. For example, plasma cleaner pages should not drift into photoresist stripping/ashing intent, and ICP-RIE product FAQs should not take over the technology article's Learn intent.

This copy review is part of the implementation, not an optional polish pass.

## Testing Requirements

### Template-Level Tests

Add tests in `ProductDetailPage.test.tsx` that verify:

1. A product config with FAQs renders a visible `Frequently Asked Questions` section.
2. The visible FAQ question count equals the `FAQPage.mainEntity` count.
3. Every FAQ schema question text appears as visible page text.
4. The visible answers match the same source text used by the schema.
5. A config with `faq: []` renders no FAQ section and emits no `FAQPage` JSON-LD.
6. Existing `Product` JSON-LD remains present and unchanged for RFQ pages.

These assertions should be template-level, not duplicated for all 17 pages. The shared template is responsible for source-of-truth consistency.

### Page Smoke Tests

Add or update one narrow smoke assertion for each migrated product page:

- Render the page.
- Assert that the first FAQ question for that product is visible.

Do not duplicate the full schema-count comparison in every product test.

### Regression Tests

Run:

```bash
npm test -- src/components/products src/pages/HomePage.test.tsx src/pages/PlasmaCleanerOverviewPage.test.tsx --run
npx tsc --noEmit --pretty false
npm run build
```

Expected:

- Product-detail tests pass.
- `PlasmaCleanerOverviewPage` remains unchanged and still has visible FAQ/schema parity.
- TypeScript exits 0.
- Production build exits 0. Existing lint warnings and chunk-size warnings are acceptable if there are no new errors.

## Risks

- This adds below-fold visible content to all 17 product pages while Plasma Cleaner CTR and ICP-RIE boundary observation windows are still open. Accept this consciously. The change is uniform across product detail pages, below-fold, and primarily fixes schema/content compliance; record the deployment date as a background event for the next GSC review.
- FAQ copy may expose weak or overly terse answers that were acceptable only as hidden schema text. The required copy review mitigates this.
- The section could make already-long product pages feel heavier. Static two-column cards before final CTA keep the section scannable and conversion-supporting.

## Follow-Ups

1. After this lands, add the deferred ICP-RIE FAQ that routes users between the product page and the ICP-RIE technology guide.
2. During the late-July GSC review, note the deployment date of visible product FAQs when interpreting Plasma Cleaner CTR and ICP-RIE boundary results.
3. Consider a future FAQ copy-quality benchmark across product families if GSC begins surfacing FAQ-related long-tail queries.

## Review Checklist

- No per-page FAQ visibility switch.
- FAQ section renders before final CTA.
- Empty FAQ arrays produce no visible section and no FAQPage JSON-LD.
- Visible FAQ and schema map from the same source.
- All 17 product configs receive customer-facing copy review.
- Product/Offer schema remains unchanged.
- `PlasmaCleanerOverviewPage` remains unchanged.
