# Design: RFQ Attribution Snapshot (visitorId already flows; add last-non-direct UTM/gclid)

**Date:** 2026-07-21
**Status:** Approved (brainstorm 2026-07-21, two owner refinements folded in)
**Branch:** `feature/rfq-attribution-snapshot`

## Problem & current state (verified 2026-07-20/21)

Google Ads is live (account 743-856-2590). Paid clicks arrive with gclid (48 distinct visitors 7/12–7/20) and — after the 2026-07-21 campaign-suffix fix — will carry full UTM. But RFQs cannot be tied back to the ad click that produced them, so UTM Phase 2 (Conversion Attribution) and the eventual Google Ads offline-conversion upload are blocked.

**What already works (do NOT rebuild):**
- The two payload-building RFQ entry points already send `visitorId: getVisitorId()`: `src/pages/RFQPage.tsx:585` and `src/components/common/QuoteModal.tsx:109`. `ProductQuoteModal.tsx` is a thin wrapper that delegates to `QuoteModal` (it builds no payload of its own), so it inherits the change automatically.
- The submit-rfq Lambda already stores `visitorId` on the RFQ META item (`amplify/functions/submit-rfq/handler.ts:805`), test-proven (`handler.test.ts:1011` "stores visitorId … when provided").
- `page_view` records already carry server-parsed UTM + click ids (`gclid/gbraid/wbraid/msclkid`), keyed by visitorId.

**The real gaps:**
1. **No attribution snapshot is captured for later RFQ submission.** Landing UTM is read once at page load in `PageTimeTracker.tsx:510-526` and fed to the analytics beacon only — never persisted client-side for a form submit that happens minutes/days later.
2. **The `RfqSubmission` GraphQL customType does not even declare `visitorId`** (block spans `resource.ts:554-586`, ending at `referrerSource`; the `visitorId` at line 612 belongs to `LeadSubmission`), AND neither `listRfqs` nor `getRfq` projects it (grep count 0). So even though the Lambda stores `visitorId` in DynamoDB, every read path strips it — this is why a 2026-07-20 audit via `getRfq`/`listRfqs` wrongly read all RFQs as `visitorId=null`. Attribution is invisible to admin and to any join.

## Architecture (owner decisions)

- **Write-time snapshot** (not read-time join): the client persists a first-party attribution snapshot and sends it on the RFQ payload; the Lambda stores it directly on the RFQ. Self-contained, robust to page_view TTL/gaps, and the pattern Google's own offline-conversion guidance recommends.
- **Last-non-direct semantics:** a landing that carries any UTM/click id **always overwrites** the stored snapshot (recency wins, regardless of the old snapshot's age). A parameter-less landing never overwrites; it only triggers an age check that clears a snapshot older than 90 days (reverting that visitor to Direct).
- **Nested object storage:** `Item.attribution = { source, medium, … }` — 1:1 with the client TS type, cleanest AppSync/GraphQL mapping, no `attr_`-prefix flattening.

## §1 Client attribution capture — `src/services/attributionSnapshot.ts` (new)

Single responsibility, dependency-free, localStorage only (no network), fully unit-testable via injected search string + clock.

```ts
export interface AttributionSnapshot {
  source?: string; medium?: string; campaign?: string; term?: string; content?: string;
  gclid?: string; gbraid?: string; wbraid?: string; msclkid?: string;
  capturedAt: string;   // ISO
  landingPath: string;  // window.location.pathname at capture
}
```

- `captureLandingAttribution(search = window.location.search, now = new Date())`: parse `utm_source/medium/campaign/term/content` + `gclid/gbraid/wbraid/msclkid`. **If any of those params is present** → write `ns_attribution` to localStorage (overwrite unconditionally — recency wins). **If none present** → read existing snapshot; if `capturedAt` is older than 90 days, remove it; otherwise leave untouched. localStorage failures are swallowed (try/catch), matching `analyticsStorageService` style.
- `getAttributionSnapshot(): AttributionSnapshot | undefined`: return the parsed snapshot if present and well-formed, else undefined.
- Values are individually length-capped on read to the limits in §3 (defensive; a hostile URL can't bloat the payload).

Wired by calling `captureLandingAttribution()` once from the existing page-load path in `PageTimeTracker.tsx` (alongside the current `classifyTrafficChannel` block, same guard site), so capture happens on the very first pageview of every session.

## §2 Payload extension — the two payload-building entry points

RFQPage and QuoteModal each build a payload with `visitorId: getVisitorId()`. Add, at the same site, a conditional `attribution` field: `const attr = getAttributionSnapshot(); if (attr) payload.attribution = attr;` (mirroring the existing optional-field pattern in RFQPage `if (…) payload.x = …`; never send `attribution: undefined`). ProductQuoteModal needs no change — it delegates to QuoteModal. Both payload builders must be updated — a missed one is an attribution blind spot. A component test for each asserts the payload carries `attribution` when a snapshot exists (and the ProductQuoteModal→QuoteModal path is covered transitively).

## §3 Field limits + Lambda storage

**Shared limits** — extend `amplify/lib/rfq/limits.ts` (the import-free SSoT consumed by both Lambda Zod and client) with an `attribution` sub-shape, e.g.:

```ts
attribution: {
  source: { max: 128 }, medium: { max: 64 }, campaign: { max: 256 },
  term: { max: 256 }, content: { max: 256 },
  gclid: { max: 512 }, gbraid: { max: 512 }, wbraid: { max: 512 }, msclkid: { max: 512 },
  landingPath: { max: 512 },
}
```

**Lambda schema** (`submit-rfq/handler.ts`): add an optional `attribution` object to the RFQ Zod schema, every sub-field `.max(L.attribution.<f>.max).optional()`, `capturedAt` an ISO-datetime string (bounded). Unknown/missing `attribution` accepted exactly like a missing `visitorId` (old clients keep working) — add an explicit "accepts a missing attribution" test mirroring `handler.test.ts:1022`.

**Storage**: set `item.attribution = data.attribution` on the RFQ META item next to `visitorId` (line ~805), only when present. Add a "stores attribution when provided" test mirroring the visitorId case.

## §4 Resolver + type projection (also fixes the visitorId blind spot)

- `RfqSubmission` customType (`amplify/data/resource.ts:554-586`): **add `visitorId: a.string()`** (currently absent — it was never declared here, only on `LeadSubmission`) **and** a nested `attribution` field. For the nested shape use `a.customType({...})` for `RfqAttribution` (source/medium/campaign/term/content/gclid/gbraid/wbraid/msclkid/capturedAt/landingPath, all `a.string()`) referenced as `attribution: a.ref('RfqAttribution')`, or an inline nested customType — pick whichever the existing file already uses for nested objects; keep it consistent with sibling types.
- `listRfqs` (`amplify/functions/order-api/resolvers/listRfqs.ts`) and `getRfq` resolvers: add `visitorId: item.visitorId || null` and `attribution: item.attribution || null` to the returned projection. This closes the pre-existing gap where stored `visitorId` was never surfaced — verify end-to-end by re-querying a recent real RFQ (2026-07-13…-20) after deploy and confirming a non-null visitorId comes back.

## §5 Admin UI — RFQ detail "Traffic Source" subcard

In the existing RFQ detail page (read-only, list page untouched): a small "Traffic Source" section rendering `source / medium / campaign / term`, a Paid badge when `gclid` (or medium `cpc/ppc`) is present, `landingPath`, and captured time. When `attribution` is null → "Direct / not captured". Reuse existing admin card styling; no new global components.

## §6 Testing

- `attributionSnapshot.test.ts`: param capture writes; no-param leaves an in-window snapshot untouched; no-param clears a >90-day snapshot; a new param landing overwrites an unexpired snapshot (recency); all four click ids + five utm fields parsed; length caps enforced; localStorage-throwing is swallowed.
- `handler.test.ts`: "stores attribution when provided", "accepts a missing attribution".
- Component tests: RFQPage and QuoteModal each include `attribution` in the submit payload when a snapshot exists; ProductQuoteModal covered transitively through QuoteModal.
- Resolver mapping assertions: `listRfqs`/`getRfq` return `visitorId` + `attribution`.
- Admin: RFQ detail renders the subcard for a snapshot and the "Direct / not captured" fallback.

## §7 Out of scope (YAGNI)

- Google Ads **offline-conversion upload** (the gclid → conversion-value → API push). This spec is the enabling foundation; the upload waits for the first ad-attributed RFQ→order per the standing decision.
- First-touch snapshot (only last-non-direct is stored).
- UTM Traffic Summary card aggregation of RFQs.
- Cross-device stitching.

## Constraints inherited

- Client and server limits derive ONLY from `amplify/lib/rfq/limits.ts` — never hardcode a cap on one side (the drift that caused the Probe-Station outage). The new `attribution` limits live there too.
- Form Lambda error contract unchanged (`{success,error,details}`, never `message`).
- No PII in the snapshot beyond what the ad platforms already set; gclid/UTM are marketing identifiers, not personal data — but they still ride the existing authenticated resolver path, never a public read.
