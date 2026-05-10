# Insights → RFQ Conversion Spec

**Date:** 2026-05-09
**Status:** Approved for implementation planning
**Author:** harvey + Claude (brainstorming session)

## Background

The `/insights` section has 52 articles and growing organic search traffic. Recent work has been heavy on SEO (titles, meta, JSON-LD schema, internal linking, the RIE pillar). What is missing is a deliberate **conversion layer**: today, an article reader who wants to buy equipment has no clear path to request a quote. The article page has zero RFQ-oriented CTAs (`grep -nE "RFQ|CTA|Inquiry" src/pages/InsightsPostPage.tsx` returns nothing).

The site does have a "Talk to us" lead capture, via `ArticleQASection` (article footer) and `FloatingAskButton` (left-side scroll-triggered) — but both target the "I have a question" intent, not "I want to buy this." Mixing the two in a single channel obscures the commercial signal and effectively defaults all article-driven leads into a soft Q&A bucket.

This spec adds a deliberate RFQ conversion path tied to article context, while keeping the existing Q&A path intact.

## Goals

1. Give readers a low-friction way to request a quote for the equipment referenced in an article they just read.
2. Capture commercial intent that is currently leaking — readers who would happily fill an RFQ but only see an "Ask a question" entry today.
3. Attribute every RFQ submission back to its source article, so we can measure which content drives revenue (not just traffic).
4. Reduce duplication between the two existing Ask form surfaces (`ArticleQASection` and `FloatingAskButton`) while making the change.

## Non-Goals

- **No `/rfq` form UX rework** (progressive disclosure, hiding fields). That affects all RFQ traffic site-wide and deserves its own A/B-tested spec.
- **No new lead-magnet flow** (PDF gating, sample requests). Out of scope.
- **No exit-intent modal, scroll-depth pop-ups, or A/B framework.** Mismatched with academic/research customer profile and adds infrastructure debt.
- **No cross-session attribution** (localStorage). Skipped until data shows the gap matters.
- **No i18n.** [Target market](memory/project_target_market.md) is US/international; English copy only.
- **No conversion dashboard.** Existing GA4 + DDB queries are sufficient for v1.

## Architecture

### File map

**Frontend (`src/`)**

- `components/insights/RfqCtaCard.tsx` — **new** — article-footer card, adaptive on `relatedProducts.length`
- `components/insights/RfqCtaSidebar.tsx` — **new** — sticky sidebar card, desktop-only
- `hooks/useArticleQuestionForm.ts` — **new** — extracted shared form logic for Ask
- `components/insights/ArticleQASection.tsx` — **modify** — use new hook, add purchaseIntent checkbox + redirect
- `components/insights/FloatingAskButton.tsx` (lives in `ArticleQASection.tsx`) — **modify** — same as above
- `pages/InsightsPostPage.tsx` — **modify** — render `RfqCtaCard` after article body, render `RfqCtaSidebar` in `PostSidebar`
- `pages/RFQPage.tsx` — **modify** — accept `?products=a,b&source=insights/<slug>`, prefill, persist `referrerSource` to API payload
- `utils/rfqAttribution.ts` — **new** — pure helper to build `/rfq?...` URLs

**Backend (`amplify/`)**

- `data/resource.ts` — add `referrerSource: a.string()` to `RfqSubmission` customType; add `purchaseIntent: a.boolean()` to `ArticleQuestion` model
- `functions/submit-rfq/handler.ts` — accept and persist `referrerSource` (validate format `^(insights|news|products)/[a-z0-9-]+$`, max 200 chars)
- `functions/submit-question/handler.ts` — accept and persist `purchaseIntent: boolean`
- `data/resource.ts` `listRfqs`/`getRfq` resolvers — confirm `referrerSource` flows through (likely automatic if `**ALL**` projection)

**Admin**

- `pages/admin/RFQDetailPage.tsx` — show "Source" row when `referrerSource` is set, with link back to article
- `pages/admin/RFQListPage.tsx` — add Source column and `?source=` filter
- `pages/admin/AdminQuestionsPage.tsx` — show "$ Purchase Intent" badge when `purchaseIntent === true`

### Untouched

- `/rfq` form structure and field layout
- Q&A list rendering, approval workflow, `AdminQuestionsPage` core UX
- Insights article content, SEO Schema, internal links
- News articles (`isNews` branch) — no RFQ CTAs added; news is editorial, not technical guides

### Risks

1. Schema additions require `npx ampx sandbox` to regenerate `amplify_outputs.json`; verify locally before deploying.
2. The hook extraction touches both Ask surfaces; mitigated by TDD — write hook tests against existing behavior first, then swap callers.
3. `ARTICLE_REDIRECTS` in `InsightsPostPage` — CTAs must use `post.slug` (resolved), not the URL slug, to avoid attributing to redirect entries.

## Data Flow

```
Reader on /insights/<slug>
  ├── Click RFQ CTA (footer or sidebar)
  │     → navigate('/rfq?products=a,b&source=insights/<slug>')
  │     → RFQPage parses URL, prefills form, holds referrerSource in state
  │     → User submits → POST /api/rfq with referrerSource in body
  │     → Lambda persists to DynamoDB
  │     → Admin RFQ detail shows article link
  │
  └── Click Ask → check "evaluating equipment for purchase" → submit
        → POST /api/questions with purchaseIntent: true
        → On success, react-router navigate to /rfq?products=...&source=insights/<slug>&via=ask-checkbox
        → (then continues on the RFQ flow above)
```

## URL Protocol

`/rfq` accepts:

| Param | Type | Meaning |
|---|---|---|
| `products` | CSV string | Product slugs, comma-separated, primary first |
| `source` | string | Source identifier with prefix, e.g. `insights/atomic-layer-etching-guide` |
| `via` | string (optional) | Sub-path identifier for analytics, e.g. `ask-checkbox` |
| `product` | string (legacy) | Single-product, kept for backward compatibility with product-page links |
| `category` | string (legacy) | Same |

If both `products` and `product` are present, `products` wins. `category` is still passed to `inferCategory()`.

### Prefill behavior

- `products.length === 0` → no field prefill
- `products.length === 1` → `specificModel` = first slug
- `products.length >= 2` → `specificModel` = first slug, **and** `additionalRequirements` is prefilled with:
  ```
  Products of interest:
  - <Product 1 Name>
  - <Product 2 Name>

  [Please describe your application requirements below]
  ```
  User can edit/remove freely.

- `products.length > 5` → truncate to first 5 (defensive guard; never expected to fire)

### Failure modes

- Missing/invalid `source` → silently ignored, RFQ submits normally
- Misspelled product slug → text fills the field anyway, user sees and corrects
- Q&A submit fails after checkbox checked → no redirect, error displayed inline (do not lose the user's question)
- Q&A submit succeeds + checkbox checked → use react-router `navigate()`, not `window.location` (preserves SPA session)

## Components

### `RfqCtaCard` (article footer)

Position: between article HTML body and `ArticleQASection`.

Props:
```ts
interface RfqCtaCardProps {
  post: InsightsPost;
  ctaPosition: 'article-footer';
}
```

Three variants by `relatedProducts.length`:

| Products | Title | Subcopy | Button | Visual |
|---|---|---|---|---|
| 0 | "Need help with this process?" | "Talk to our application engineers about equipment options for your project." | "Get a quote" | Plain card, no thumbnail |
| 1 | "Looking to deploy {Product Name}?" | "Get pricing and lead time for {product}, customized to your application." | "Request a quote" | Card + 1 product thumbnail |
| ≥2 | "Compare and request quotes" | "Get pricing for the systems referenced in this article." | "Get quotes for these systems" | Card + horizontal product thumbnail strip |

Click → `navigate(buildRfqUrl({ products, sourceSlug: post.slug, sourceArea: 'insights' }))` + emit `insights_cta_click`.

Visual: matches `RelatedProductsSidebar` rounded/shadow style. Primary button (`bg-primary text-on-primary`). **Visually distinct shape from the floating Ask button** — Ask is a left-edge pill, RFQ CTA is an inline rectangular card.

### `RfqCtaSidebar` (sticky sidebar)

Position: in `PostSidebar`, between `RelatedProductsSidebar` and `RelatedArticlesSidebar`. `position: sticky; top: 80px;` on desktop.

Props:
```ts
interface RfqCtaSidebarProps {
  post: InsightsPost;
  ctaPosition: 'sidebar';
}
```

Single layout, not three variants (sidebar is small):
- Title: "Get a quote"
- Subcopy adapts mildly to product count ("for these systems" / "for {product}" / omitted)
- One primary button "Request a quote →"

Mobile: **not rendered** (footer card serves mobile readers; avoids stacking duplicate CTAs).

### `useArticleQuestionForm` (extracted hook)

Replaces ~100 lines of duplicated form logic in `FloatingAskButton` and `ArticleQASection`. Pure refactor — zero behavior change for the existing pieces, plus the new `purchaseIntent` field.

```ts
interface UseArticleQuestionFormOpts {
  slug: string;
  onSuccessRedirect?: (form: { purchaseIntent: boolean }) => void;
}

interface UseArticleQuestionFormReturn {
  form: { name: string; email: string; question: string; purchaseIntent: boolean };
  update: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  setPurchaseIntent: (v: boolean) => void;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  isSubmitting: boolean;
  isSuccess: boolean;
  error: string | null;
  reset: () => void;
  turnstileSiteKey: string | undefined;
  widgetRef: React.RefObject<HTMLDivElement | null>;
  token: string;
  resetToken: () => void;
}
```

Hook responsibilities:
- form state + validation (existing rules: name ≥ 2, valid email, question ≥ 10 chars, Turnstile token if site key present)
- Turnstile script load + widget render + token management
- `submitQuestion` call with `purchaseIntent` in payload
- On success: if `purchaseIntent === true && onSuccessRedirect`, call the callback so the consumer can decide how to redirect (`navigate('/rfq?...&via=ask-checkbox')`)

### `ArticleQASection` and `FloatingAskButton` modifications

Same edit applied to both forms — add a checkbox above the submit button:

```tsx
<label className="flex items-start gap-2 cursor-pointer text-sm text-on-surface-variant">
  <input
    type="checkbox"
    checked={form.purchaseIntent}
    onChange={e => setPurchaseIntent(e.target.checked)}
    className="mt-0.5"
  />
  <span>
    I'm also evaluating equipment for purchase
    <span className="block text-xs text-on-surface-variant/70 mt-0.5">
      Optional — if checked, we'll redirect you to our quote form after submitting your question.
    </span>
  </span>
</label>
```

Default unchecked. Plain language so the user knows what happens on submit.

### `InsightsPostPage` integration

```tsx
// Article body
<div dangerouslySetInnerHTML={...} />
<RfqCtaCard post={post} ctaPosition="article-footer" />  {/* NEW */}
<ArticleQASection slug={post.slug} />

// PostSidebar
<RelatedProductsSidebar products={post.relatedProducts} />
<RfqCtaSidebar post={post} ctaPosition="sidebar" />  {/* NEW (desktop only) */}
{allPosts && <RelatedArticlesSidebar post={post} allPosts={allPosts} />}
```

News articles (`isNews` branch) get **no** RFQ CTAs.

## Backend Changes

### Schema

```ts
// amplify/data/resource.ts

RfqSubmission: a.customType({
  // ...existing fields...
  attachmentKeys: a.json(),
  referrerSource: a.string(),  // NEW: "insights/<slug>" | "news/<slug>" | empty
}),

ArticleQuestion: a
  .model({
    // ...existing fields...
    answeredBy: a.string(),
    purchaseIntent: a.boolean(),  // NEW
  })
  .authorization(/* unchanged */)
  .secondaryIndexes(/* unchanged */),
```

### Lambda — `submit-rfq/handler.ts`

- Read `body.referrerSource`
- Validate: must match `/^(insights|news|products)\/[a-z0-9-]+$/` and be ≤ 200 chars
- If invalid: log a CloudWatch warning, do **not** persist the field, do **not** fail the RFQ
- If valid: include in DDB `PutItem.Item.referrerSource` as `{ S: ... }`

### Lambda — `submit-question/handler.ts`

- Read `body.purchaseIntent`
- Coerce: must be exact `boolean true`; anything else → `false`
- Always persist (default `false`)

### Admin UI

- `RFQDetailPage`: render Source row when `referrerSource` is set; link to `/<referrerSource>` and a friendly "Article: {Title}" label (slug → title via existing insights data)
- `RFQListPage`: new optional column "Source"; URL filter `?source=insights/<slug>`
- `AdminQuestionsPage`: "$ Purchase Intent" chip on rows where `purchaseIntent === true`

### Deployment order

1. Schema + Lambdas + admin UI (backward-compatible: old frontend ignores new fields)
2. Frontend (CTA cards, prefill, Ask checkbox)

## Tracking

Three new events via `useCombinedAnalytics()` (existing infrastructure, GA4 + Segment).

### Event A — `insights_cta_click`

Fired by `RfqCtaCard`, `RfqCtaSidebar`, and the Ask-checkbox redirect path.

```ts
analytics.trackCustomEvent('insights_cta_click', {
  ctaPosition: 'article-footer' | 'sidebar' | 'ask-checkbox-redirect',
  articleSlug: post.slug,
  articleTitle: post.title,
  productCount: post.relatedProducts?.length ?? 0,
  productSlugs: post.relatedProducts?.map(p => p.slug).join(',') ?? '',  // CSV
});
```

### Event B — `insights_question_with_purchase_intent`

Fired by `useArticleQuestionForm` on successful submit when `purchaseIntent === true`.

```ts
analytics.trackCustomEvent('insights_question_with_purchase_intent', {
  articleSlug: slug,
  questionLength: form.question.length,  // length only, never the text (PII)
});
```

### Event C — `rfq_submit_attribution`

Fired by `RFQPage` after successful submit, in addition to existing `trackRFQSubmission`, when `referrerSource` is present.

```ts
analytics.trackCustomEvent('rfq_submit_attribution', {
  referrerSource,
  productCount: products.length,
  viaAskCheckbox: params.get('via') === 'ask-checkbox',
});
```

### Measurement targets

| Question | Data source |
|---|---|
| Top RFQ-driving articles | DDB `RfqSubmission.referrerSource` aggregated |
| Footer card vs sidebar — which converts? | `insights_cta_click.ctaPosition` × `rfq_submit_attribution` |
| Does the Ask checkbox work? | `insights_question_with_purchase_intent` count, then `rfq_submit_attribution` where `viaAskCheckbox=true` |
| Multi-product articles harder to convert? | `insights_cta_click.productCount` correlated with submits |
| Articles with high CTA clicks but low submits | Indicates copy/context friction; manual review candidates |

### Privacy

- Never log user-input text (question body, RFQ form fields) to events. Only metadata (length, IDs).
- `referrerSource` is article slug, not PII.

## Testing

### Unit tests

- **`utils/rfqAttribution.test.ts`** — pure function, all branches: 0/1/N products, default `sourceArea`, special-char encoding, >5 product truncation
- **`hooks/useArticleQuestionForm.test.ts`** — ~8-10 cases:
  - validation: name<2 / invalid email / question<10 / missing Turnstile token
  - happy path: success → reset state, reset token
  - failure path: API failure → error set, no `onSuccessRedirect` call
  - network failure path: generic error message
  - `purchaseIntent: true` + success + `onSuccessRedirect` provided → callback fires with correct args
  - `purchaseIntent: false` + success → callback **not** fired
  - submit failure (any reason) + `purchaseIntent: true` → callback **not** fired

### Component tests

- **`RfqCtaCard.test.tsx`** — 0/1/N rendering, click → navigate URL correctness, click → analytics call args
- **`RfqCtaSidebar.test.tsx`** — desktop render, mobile not rendered (mock `matchMedia`), click behavior
- **`ArticleQASection.test.tsx`** — basic submit unchanged, checkbox submit success → navigates with correct URL, checkbox + submit failure → no navigate

### Integration

- **`pages/RFQPage.test.tsx`** — first tests for this page:
  - `?products=a,b&source=insights/x` → form prefills correctly, payload contains `referrerSource`
  - legacy `?product=a` still works
  - no source → payload omits `referrerSource`

### Lambda

- **`submit-rfq/handler.test.ts`** — add cases for valid/invalid/missing/oversized `referrerSource`
- **`submit-question/handler.test.ts`** — only if file exists; add cases for `purchaseIntent` true/undefined/non-boolean. If file does not exist, do not create it for this spec.

### Manual smoke (post-deploy)

- Multi-product article → click footer card → `/rfq` URL correct, prefill correct
- Single-product article → sidebar card sticky on desktop
- Ask form + checkbox → submit → redirected to `/rfq` prefilled
- Submit RFQ → admin shows referrerSource link back to article
- Mobile viewport: no sidebar card

### Out of scope

- No GA4/Segment end-to-end verification (trust existing pipeline)
- No LocalStack DDB integration tests (mock-based, matches current pattern)
- No visual regression tooling
- Pre-existing 6 `submit-rfq` test failures remain unfixed; new cases must pass independently

### Acceptance criteria

- [ ] All new tests pass
- [ ] After hook extraction, `FloatingAskButton` and `ArticleQASection` behave identically to before in manual testing
- [ ] Manual smoke list passes
- [ ] `npm run typecheck` clean
- [ ] Sandbox deploy: admin shows `referrerSource` and `purchaseIntent` correctly

## Open Questions

None — all clarifying decisions resolved during brainstorming. Implementation can proceed.

## Related Work

- [Order quote expiration spec](2026-05-09-order-quote-expiration-design.md) — established the RTL test infrastructure used here
- Existing Q&A system: `src/components/insights/ArticleQASection.tsx`, `src/services/articleQuestionsService.ts`, `amplify/functions/submit-question/`
- Existing RFQ system: `src/pages/RFQPage.tsx`, `amplify/functions/submit-rfq/`
