# UTM Traffic Summary — Design Spec

**Date:** 2026-06-27
**Status:** Approved (pending spec review)
**Area:** Admin analytics (`src/pages/admin/AdminAnalyticsPage.tsx`, `src/services/behaviorAnalytics.ts`)
**Depends on:** PR #199 (UTM persistence on `AnalyticsEvent`)

## Problem

After #199, the admin shows UTM attribution only as a per-event badge on an
individual visitor's timeline. There is no way to answer:

- "How much traffic came from **MRS** in total?"
- "Within MRS, which content performed better — `qr_video` vs `qr_brochure`?"
- "Who exactly came from a given source/campaign/content?" (drill-down)

The existing `channelFilter` only filters by broad traffic *channel*
(referral / organic_search / ai_referral / …), which lumps MRS together with
every other referral. There is no aggregation or filter by `utm_source` /
`utm_campaign` / `utm_content`.

## Goal (MVP)

A global **UTM Traffic Summary** card on the admin analytics page that
aggregates UTM-bearing traffic by a chosen dimension, supports search/sort, and
lets the user click a row to drill into the matching visitors. Pure traffic
metrics only.

Explicitly **out of scope** for this MVP (deferred to later versions):
- v2: Conversion attribution (RFQ / downloads / conversion rate) — a separate card.
- v3: ROI (won amount, opportunity value per channel).

These are separate concerns (require `visitorId ↔ lead/RFQ` joins and attribution
rules) and must not be mixed into this traffic table.

## Approach

**Group-by toggle table** (single dimension at a time) combined with a
filter-and-regroup interaction, instead of a flat cross-tab or a 3-level tree.

Default flow:
1. Group by **Source** → click `mrs` row → active filter becomes `source = mrs`.
2. Switch Group by **Content** → table now shows `qr_video` vs `qr_brochure`
   **within MRS only** (table respects the active filter).

This answers both core questions with minimal code and no row-count blow-up from
`source × campaign × content` combinations.

## Data source & computation

- **Client-side only**, via `useMemo`. No new backend query.
- Computed from the **page-level filtered event set** — the same array that
  already excludes bots / self-visits / private IPs
  (`AdminAnalyticsPage.tsx` ~line 3197), within the currently selected time window.
- **Only events with at least one UTM field** (`utmSource | utmCampaign |
  utmContent`) are included.
- ⚠️ Only post-#199-deploy traffic carries UTM, and history is not backfilled.
  The table is empty until tagged traffic arrives → show an empty state:
  "暂无 UTM 流量，部署后带 UTM 的新流量才会出现".

## State

Added to the analytics page component:

```ts
type UtmGroupBy = 'source' | 'campaign' | 'content';
// null value = explicit "(not set)" bucket (field missing on the event)
interface UtmFilter { source?: string | null; campaign?: string | null; content?: string | null; }

const [utmGroupBy, setUtmGroupBy] = useState<UtmGroupBy>('source');
const [utmFilter, setUtmFilter]   = useState<UtmFilter>({});
const [utmSearch, setUtmSearch]   = useState('');
const [utmSort, setUtmSort]       = useState<{ col: 'value'|'visits'|'visitors'|'orgs'; dir: 'asc'|'desc' }>({ col: 'visits', dir: 'desc' });
```

## Columns

| Value | Visits | Visitors | Known Organizations |
|---|---|---|---|

Metric definitions (computed over events matching the active `utmFilter`):

- **Value** — the grouped dimension value (trimmed), or `(not set)` when that
  dimension is missing/empty on the event. The `(not set)` bucket keeps totals
  reconciling.
- **Visits** — count of UTM-bearing **`page_view`** events in the group.
  The aggregation **hard-filters to `eventType === 'page_view'`** so clicks,
  downloads, and custom events are never counted as visits. (UTM lands only on
  the entry `page_view`; SPA navigation drops the params and `page_view` records
  carry no `sessionId`, so "Visits" — entry events — is the honest available
  metric, not "Sessions".)
- **Visitors** — distinct `visitorId` among those `page_view` events.
- **Known Organizations** — distinct `orgName` where the org is a *real*
  organization, **not** an ISP/telecom. Determination (matches existing admin
  logic, `AdminAnalyticsPage.tsx:714`): `orgName` is present AND
  `organizationType` is neither `'telecom_isp'` / `'isp'` nor `'unknown'`.
  ISP-only visitors (Comcast / Verizon / Cloudflare …) are excluded from this
  count to keep the business signal clean — but they still count toward Visits
  and Visitors, and remain visible in the visitor list.

## Pure helpers (in `behaviorAnalytics.ts`, unit-tested)

Keep the large page component thin and give regression coverage.

```ts
interface UtmEvent {
  eventType?: string | null;
  visitorId?: string | null;
  orgName?: string | null;
  organizationType?: string | null;   // used to exclude ISP/telecom from "Known Organizations"
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
}

interface UtmSummaryRow { value: string; isNotSet: boolean; visits: number; visitors: number; knownOrganizations: number; }

// Normalize a UTM value for comparison/grouping: trim; treat null/undefined/''/
// whitespace-only as "absent" (returns undefined). Shared by predicate + grouping.
function normalizeUtmValue(v: string | null | undefined): string | undefined;

// Pure predicate. A filter entry of `null` matches events where that field is
// absent (null/undefined/empty/whitespace, via normalizeUtmValue). A string
// filter entry matches the normalized field value. Omitted filter keys are
// ignored. Multiple keys AND together.
function matchesUtmFilter(e: UtmEvent, filter: UtmFilter): boolean;

// Pure aggregation. (1) hard-filters to eventType === 'page_view'; (2) applies
// `filter` (so "click mrs then regroup by content" is covered HERE, not by
// component glue); (3) groups remaining events by the normalized `groupBy`
// value; (4) computes distinct visitorId and distinct known-org counts.
// Events whose group dimension is absent fall into one row with
// value="(not set)", isNotSet=true. Returns rows sorted by visits desc.
function summarizeUtmTraffic(events: UtmEvent[], groupBy: UtmGroupBy, filter: UtmFilter): UtmSummaryRow[];
```

Notes:
- **Visits hard-filter**: `summarizeUtmTraffic` counts only `eventType === 'page_view'`.
- **Normalization**: grouping and matching both go through `normalizeUtmValue`, so
  `"mrs"` and `" mrs "` collapse to one row, and `null`/`''`/whitespace all map to
  `(not set)`.
- `summarizeUtmTraffic` takes `filter` as a parameter (per review) so the core
  "filter + regroup" logic lives in the tested pure function, not in the component.
- `(not set)` is represented internally as `null` in `UtmFilter`, never the literal
  string `"(not set)"`, so it can never collide with a real campaign/content value.
  The UI renders the label `(not set)`; the predicate tests field-absent.
- **Known org**: a small `isKnownOrganization(e)` helper (or inline check) returns
  true when `orgName` is present and `organizationType ∉ {'telecom_isp','isp','unknown'}`.

## Drill-down / filter integration

- Clicking a row sets `utmFilter[utmGroupBy] = row.isNotSet ? null : row.value`.
- Active filter shown as removable chips (`source = mrs ✕`, `content = (not set) ✕`).
- `utmFilter` (via `matchesUtmFilter`) filters **both**:
  1. The summary table itself (so regrouping shows within-filter breakdown).
  2. The existing global organizations / visitor list — reusing the same
     `o.events.some(e => matchesUtmFilter(e, utmFilter))` pattern as `channelFilter`
     (`AdminAnalyticsPage.tsx` ~lines 3346 / 3374 / 3512).
- **Clear** button resets `utmFilter` to `{}`.

### Filter composition with existing filters

`utmFilter` is **AND-combined** with the existing filters, never replacing them:

```
time window  AND  channelFilter  AND  searchFilter  AND  utmFilter
```

So selecting `source = mrs` further narrows whatever list is already showing
(e.g. an active channel/region filter stays applied). The summary table and the
org/visitor list both honor the same composed predicate set.

## Search & sort

- **Search** — case-insensitive substring match on the row `value`; filters
  displayed rows only.
- **Sort** — click column header to sort by value / visits / visitors / known
  organizations; default `visits desc`.

## UI placement

A new card titled **"UTM Traffic Summary"** at the global level on
`AdminAnalyticsPage`, near the existing traffic/keyword sections. Contains:
group-by segmented control, search box, active-filter chips + Clear, and the
sortable table. Badge styling consistent with existing admin components
(material-symbols, existing color tokens).

## Testing

vitest unit tests in `src/services/behaviorAnalytics.test.ts`:

- `normalizeUtmValue`: trims; `null`/`undefined`/`''`/`'   '` → `undefined`; `' mrs '` → `'mrs'`.
- `matchesUtmFilter`:
  - matches when normalized field equals filter value (incl. whitespace variants: `' mrs '` matches `source='mrs'`)
  - `null` filter matches absent field (null/undefined/empty/whitespace); does NOT match a present value
  - omitted keys ignored; multiple keys AND together
- `summarizeUtmTraffic`:
  - **counts only `eventType === 'page_view'`** — a `pdf_download`/`click` event with UTM is excluded from Visits
  - groups by source / campaign / content; `' mrs '` and `'mrs'` collapse into one row
  - distinct visitor count; **Known Organizations** counts distinct `orgName` only when `organizationType ∉ {telecom_isp, isp, unknown}` (ISP-only event excluded from org count but still in visits/visitors)
  - `(not set)` bucket for missing dimension (value `(not set)`, `isNotSet: true`)
  - applies `filter` before grouping (e.g. filter `source=mrs`, group by content → only MRS content rows)
  - empty input → `[]`
  - sort order by visits desc

## Files touched

- `src/services/behaviorAnalytics.ts` — add `normalizeUtmValue`, `isKnownOrganization`, `matchesUtmFilter`, `summarizeUtmTraffic`, and `UtmGroupBy` / `UtmFilter` / `UtmSummaryRow` / `UtmEvent` types.
- `src/services/behaviorAnalytics.test.ts` — unit tests above.
- `src/pages/admin/AdminAnalyticsPage.tsx` — state, the new card UI, and wiring `utmFilter` into the existing org/visitor list filter.
- `docs/UTM-Naming-Convention.md` — update the "报表去哪看" row to note the admin now has an aggregate UTM summary + drill-down (not just per-event badges).

## Out of scope (restated)

No backend/schema changes. No conversion/RFQ/download metrics. No ROI. No new
DynamoDB queries or indexes — purely a client-side view over already-loaded events.
