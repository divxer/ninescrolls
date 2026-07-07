# Conversion Chain Redesign Design

Date: 2026-07-07
Status: Draft for review

## Goal

Bring the highest-value post-product-click pages into the new NineScrolls redesign language without changing the conversion contracts they carry.

This phase covers the pages where users land after choosing to buy, request pricing, or talk to NineScrolls:

- `/contact`
- `/request-quote`
- `/service-support`
- `/cart`
- `/checkout`
- `/checkout/success`
- `/checkout/cancel`

The goal is not to add new funnel mechanics. It is to remove the visual discontinuity between the redesigned product system and the still-legacy conversion pages while preserving attribution, checkout, analytics, and form behavior.

## Non-Goals

- Do not redesign About, Insights, News, legal, or admin pages in this phase.
- Do not change product page CTAs or product detail configs.
- Do not rename routes.
- Do not change RFQ form field names, checkout payloads, Stripe Lambda contracts, UTM collection, GA4 event names, or Segment/behavior analytics event semantics.
- Do not introduce new warranty-duration claims unless the user confirms the policy source.
- Do not build a full design system sprint. Extract only the small primitives needed to keep these pages consistent.

## Page Roles

### Contact

Role: general technical contact and consultative entry point.

Design direction:

- Replace the legacy generic contact layout with a conversion-focused engineering contact page.
- Keep `?topic=` behavior intact:
  - `topic=quote` redirects to `/request-quote`.
  - `topic=expert` selects engineer consultation.
  - `topic=application` selects feasibility.
  - Other known topics scroll to the form and show context.
- Keep `?email=` prefill behavior intact.
- Keep `ContactFormInline` behavior and submit contract intact unless a test explicitly proves equivalence.

Visual content:

- Hero: "Talk to a NineScrolls engineer" / "Technical support and application consultation".
- Trust band: San Diego, engineering support, response window, NDA available.
- Side panel: direct email/phone/support hours.
- Inline path to `/request-quote` for budgetary quotes.

### Request Quote

Role: structured RFQ intake for product, process, and procurement context.

Contract constraints:

- Preserve `parseRfqUrlParams` behavior for:
  - `?products=`
  - legacy `?product=`
  - `?category=`
  - `?source=`
  - `?via=`
- Preserve the product-list prefill block in `additionalComments`.
- Preserve equipment category inference.
- Preserve current form field names and API payload shape.
- Preserve Turnstile rendering, token handling, honeypot, file-upload limits, and form-abandonment tracking.
- Preserve analytics calls and attribution fields.

Design direction:

- Keep the multi-step structure.
- Make the header and step layout match the product-page visual system: white background, slate borders, restrained blue accent, compact engineering copy.
- Put the "what happens next" trust information near the form, not as marketing filler.
- Improve visible error states and required-field affordances without changing validation semantics.

### Service Support

Role: trust page for warranty, support, maintenance, and post-sale confidence.

Open policy input:

- The current page contains multiple "2-year standard warranty" statements. This redesign must not amplify or create new year-specific warranty claims until the user confirms the exact warranty policy and whether it applies across all product lines.
- If not confirmed before implementation, replace year-specific marketing phrasing with "standard warranty terms", "warranty coverage", or "confirmed during quote/order review", while preserving any backend/service data contracts.

Design direction:

- Replace the heavy legacy hero with the same calm B2B tone as product pages.
- Focus on:
  - configuration review
  - documentation
  - installation/startup guidance
  - service coordination
  - preventive maintenance
  - annual maintenance contracts where verified
- Avoid unsupported competitive claims such as "double the industry norm" unless separately sourced and approved.

### Cart

Role: order review and low-friction path to checkout.

Contract constraints:

- Preserve `useCart` item shape and quantity/remove/update behavior.
- Preserve `navigate('/checkout')`.
- Preserve image rendering for cart items.

Design direction:

- Bring the cart into the new product-family style.
- Empty state should feel like a useful procurement detour, not a blank utility page:
  - Continue Shopping
  - Request Quote
  - Compare Plasma Cleaners
- Filled state should use a clear two-column review layout:
  - line items
  - order summary
  - trust notes: secure payment, formal invoice option, support path

SEO/robots:

- Cart should be `noindex, follow`. This is a utility state page and should not compete in search.

### Checkout

Role: collect checkout contact/shipping details, calculate tax, and redirect to Stripe.

Contract constraints:

- Preserve form field names used for Stripe session creation.
- Preserve validation minimums:
  - first name
  - last name
  - email
  - phone
- Preserve `calculateTax` trigger behavior and input shape.
- Preserve GA4 `begin_checkout` payload.
- Preserve `createCheckoutSession` payload.
- Preserve `/checkout/success?session_id={CHECKOUT_SESSION_ID}` and `/checkout/cancel`.
- Do not change Lambda success/cancel URLs unless the Lambda is changed in the same task and covered by consistency tests.

Required technical cleanup:

- Fix the existing image URL composition bug:
  - Current code sends `image: item.image ? `${window.location.origin}${item.image}` : undefined`.
  - This is wrong for absolute CDN URLs.
  - Implement a helper that returns absolute URLs unchanged and prefixes only relative URLs.
  - Cover this helper with tests.

Design direction:

- Keep checkout task-focused.
- Use a calm, dense, professional layout:
  - shipping/contact form
  - sticky order manifest
  - secure payment note
  - support/contact fallback
- Error messages must be announced accessibly and associated with the form context.

SEO/robots:

- Checkout should be `noindex, nofollow` or `noindex, follow`. Choose deliberately in the implementation plan; default recommendation is `noindex, nofollow` because this page is not useful as a search landing page.

### Checkout Success

Role: post-payment confirmation.

Contract constraints:

- Preserve `session_id` parsing:
  - `session_id`
  - `sessionId`
  - `session id`
- Preserve `purchase` tracking.
- Preserve cart clearing only after a valid session id.
- Preserve route `/checkout/success`.

Design direction:

- Replace "Transmission Received" with straightforward order-confirmation language unless the user requests otherwise.
- Show next steps:
  - email confirmation
  - order review
  - support contact
  - formal invoice availability
- Do not invent delivery times unless verified. Current page says "3-4 weeks"; implementation must verify this against product/order policy or remove it.

SEO/robots:

- `noindex, nofollow`.

### Checkout Cancel

Role: recover a cancelled checkout.

Contract constraints:

- Preserve route `/checkout/cancel`.
- Preserve "Return to Cart" path.

Design direction:

- Present as a recovery page:
  - no charges made
  - return to cart
  - request quote / talk to sales if procurement requires PO

SEO/robots:

- `noindex, nofollow`.

## Shared Visual System

Use a minimal set of shared primitives, preferably under a conversion-specific module such as `src/components/conversion/` or a small local component file if the implementation stays narrow.

Primitives:

- `ConversionHero`
  - eyebrow
  - title
  - copy
  - primary/secondary actions
  - optional trust bullets
- `ConversionCard`
  - white background
  - `border border-slate-200`
  - rounded 12px or project-equivalent
  - low/no shadow
- `TrustSignalList`
  - check/icon + concise phrase
- `FormSection`
  - heading
  - optional description
  - stable label/input spacing
- `OrderSummaryCard`
  - reusable across cart/checkout where practical

Do not extract button primitives unless the page edits show real duplication. The goal is consistency, not a broad component migration.

## Form Accessibility Requirements

This phase treats form accessibility as a primary requirement.

Requirements:

- Every input/select/textarea keeps a stable `id` + `htmlFor` label.
- Required fields use both visual indication and HTML `required` where applicable.
- Error summaries use `role="alert"` or `aria-live="polite"` and receive focus or are reachable after failed submit.
- Field-level errors should use `aria-invalid` and `aria-describedby` where field-specific messages exist.
- Turnstile remains placed near submit and has surrounding explanatory text.
- Keyboard flow must follow visual order.
- Buttons have explicit text labels; icon-only actions require `aria-label`.
- Quantity controls in cart preserve accessible labels.
- No form section may rely on color alone to communicate state.

## Attribution And Analytics Contract

These behaviors must be test-locked before or during visual changes:

- RFQ URL parsing:
  - `?products=a,b`
  - `?product=a`
  - `?category=`
  - `?source=`
  - `?via=`
- RFQ prefilled `specificModel`, `equipmentCategory`, and product-list `additionalComments`.
- RFQ submit payload keeps attribution fields.
- Contact topic behavior remains intact.
- Cart Add-to-Cart landing remains `/cart`.
- Checkout GA4 `begin_checkout` remains intact.
- Checkout Success GA4 `purchase` remains intact.
- UTM collection pipeline remains untouched.

## Stripe Contract

The Stripe Lambda currently pins:

- `success_url`: `${APP_URL}/checkout/success?session_id={CHECKOUT_SESSION_ID}`
- `cancel_url`: `${APP_URL}/checkout/cancel`

The frontend routes must remain:

- `/checkout/success`
- `/checkout/cancel`

If implementation changes these routes, it must update `amplify/functions/create-checkout-session/handler.ts` in the same task and add a frontend/backend consistency assertion. The preferred design is to keep routes unchanged.

## Robots / Indexing Decision

Current `SEO` defaults all pages to `index, follow`, except special cases such as admin and 404. This phase should add or otherwise support route-specific robots behavior.

Recommended:

- `/contact`: `index, follow`
- `/request-quote`: `index, follow` unless marketing decides it should be hidden from organic search
- `/service-support`: `index, follow`
- `/cart`: `noindex, follow`
- `/checkout`: `noindex, nofollow`
- `/checkout/success`: `noindex, nofollow`
- `/checkout/cancel`: `noindex, nofollow`

Implementation plan must decide whether to extend the `SEO` component with a `robots` prop or apply per-page Helmet overrides. Preferred: extend `SEO` with a typed optional `robots` prop and default to existing `index, follow`.

## Testing Strategy

Use TDD. Do not visually refactor first and backfill tests later.

Required tests:

### RFQ

- Existing `parseRfqUrlParams` behavior remains green.
- Render with `?product=` and `?products=` confirms fields are prefilled.
- Required labels remain associated.
- Submit validation error is announced accessibly.
- Turnstile placeholder/render container remains present when site key exists.

### Contact

- `topic=quote` still redirects to `/request-quote`.
- `topic=expert` selects engineer consultation.
- `topic=application` selects feasibility.
- `email=` prefill still reaches inline form.

### Cart

- Empty cart shows redesigned empty state and links to Products / Request Quote or quote path.
- Filled cart shows line items, quantity controls, subtotal/total, and checkout CTA.
- Remove/update behavior remains intact.
- Robots meta is `noindex`.

### Checkout

- Required-field validation still blocks submit.
- Error message is accessible.
- Relative item image becomes absolute with `window.location.origin`.
- Absolute CDN item image remains unchanged.
- `createCheckoutSession` receives unchanged route URLs.
- GA4 `begin_checkout` still fires.
- Robots meta is noindex.

### Checkout Success

- Session id parsing is unchanged.
- Purchase tracking fires when session id exists.
- Cart clearing behavior unchanged.
- Robots meta is noindex.

### Checkout Cancel

- Return-to-cart link remains.
- Robots meta is noindex.

### Service Support

- No unsupported warranty-duration claim is added.
- If warranty duration remains visible, test name/documentation must point to the user-confirmed policy source.

## Verification

Before review:

- Run targeted tests for conversion pages.
- Run relevant product commerce tests to ensure the Add to Cart → Cart path did not regress.
- Run `npx tsc --noEmit --pretty false`.
- Run `npm run build`.
- Browser smoke on local:
  - `/contact?topic=expert`
  - `/contact?topic=quote`
  - `/request-quote?products=icp-etcher,rie-etcher&source=insights/test&via=ask-checkbox`
  - `/cart`
  - `/checkout`
  - `/checkout/success?session_id=test_session`
  - `/checkout/cancel`

Post-deploy smoke:

- Same browser smoke on production.
- Confirm no broken images.
- Confirm checkout/cart pages have the intended robots meta.
- Confirm Stripe redirect URLs remain unchanged.

## Risks

- Attribution regression is the highest risk. Keep contracts test-locked before visual changes.
- Stripe redirect route drift would break paid checkout. Keep routes unchanged.
- Service/warranty copy may currently contain unsupported numeric claims. Treat those as policy inputs, not design copy.
- Adding noindex support to `SEO` changes a shared component. Keep the default output byte-equivalent for pages that do not pass `robots`.
- This phase overlaps with live conversion infrastructure; avoid broad rewrites of form state and submit logic.

## Open Inputs For User

1. Confirm warranty policy:
   - Is "2-year standard warranty" true for all product lines?
   - Does it apply to plasma cleaners as well as large semiconductor equipment?
   - Should the site state a fixed year count, or only "standard warranty terms"?
2. Confirm indexing preference for `/request-quote`:
   - Keep indexed as a commercial conversion page?
   - Or mark noindex because it is a form utility page?

If these are not answered before implementation, default to conservative copy:

- Use "standard warranty terms" rather than a year count.
- Keep `/request-quote` indexed unless explicitly told otherwise.
