# Tender Watch — Phase 2 Admin UI Design Spec

**Date:** 2026-05-15
**Status:** Approved (pending implementation)
**Owner:** harvey@ninescrolls.com
**Depends on:** [Phase 1 design](2026-05-14-tender-watch-design.md) (merged in [PR #139](https://github.com/divxer/ninescrolls/pull/139))

## Summary

Phase 2 delivers the admin-facing UI for Tender Watch — three pages under `/admin/tenders` that turn the daily-cron pipeline's DynamoDB data into a working triage and configuration tool. The pipeline (Phase 1) already writes TENDER / TENDER_MATCH / TENDER_STATUS_LOG / TENDER_KEYWORD_CONFIG entities into `intelligenceTable`. Phase 2 reads them, lets the admin change tender status, manage assignments, and edit the keyword configurations that drive prefilter matching.

Three pages, one Lambda, one new toast notification system.

## Non-goals

- Realtime updates (WebSocket / DynamoDB Streams / AppSync subscriptions) — daily cadence means manual refresh is fine
- Mobile responsive design — admin tooling, desktop-only
- Multi-tier admin permissions — all members of the `admin` Cognito group get full access
- Tender comments / discussion threads
- "Convert to RFQ" wiring — deferred to Phase 3 (CRM hook)
- Slack / Teams integration
- PDF download / OCR of attached tender documents

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| List page main view | Table (sortable, filterable, paginated, multi-select for bulk actions). Kanban deferred to a possible future toggle. |
| Status edit affordance | Inline dropdown in the table's Status column. Status changes that need a note (`not_relevant`, `lost`) open a small dialog. |
| Detail page layout | Two-column. Left 240px sticky panel = title, country, score, deadline, status dropdown, assignment, quick actions. Right scrolling content = description, matches, audit log. |
| Keyword config page | Master-detail. Left sidebar lists 10 categories; right pane is the editor with embedded Test match preview. |
| Lambda architecture | New `tender-api` Lambda dedicated to tender resolvers. Does not extend the existing `orderApi` (which handles RFQ/Order/Lead/Feedback). |
| Convert to RFQ button | Hidden in Phase 2 — picked up in Phase 3 when the CRM hook and prefill logic land together. |
| Toast library | Introduce `react-hot-toast` (~2KB gzipped, headless, matches existing styling needs). |
| Real-time data | Not required. Pull on mount + manual refresh + URL-driven filter state. |

## High-level architecture

```
┌────────────────────────────────────────────────────────────────────┐
│ Browser (admin)                                                    │
│                                                                    │
│  /admin/tenders          ─┐                                        │
│  /admin/tenders/:id       │  React pages (vite)                    │
│  /admin/tenders/keywords ─┘                                        │
│            │                                                       │
│            │   useTenders / useTender / useKeywordConfigs hooks    │
│            │                                                       │
│            ▼                                                       │
│   tenderAdminService.ts → generateClient<Schema>()                 │
└──────────────────────────┬─────────────────────────────────────────┘
                           │ GraphQL over HTTPS
                           ▼
┌────────────────────────────────────────────────────────────────────┐
│  AppSync (existing)                                                │
│  Schema: 4 customTypes + 3 connections + 3 queries + 4 mutations   │
│                       │                                            │
│                       ▼                                            │
│  tender-api Lambda resolver                                        │
│    handler.ts: switch (fieldName) { ... }                          │
│    Reuses matchesAnyConfig from lib/tender-watch/prefilter.ts      │
│    Reuses keys.ts builders + TENDER_STATUSES enum                  │
│                       │                                            │
│                       ▼                                            │
│            intelligenceTable (existing, Phase 1 entities already)  │
└────────────────────────────────────────────────────────────────────┘
```

## Schema additions

Added to `amplify/data/resource.ts`. Follows the existing customType + Lambda-resolver pattern (matches RFQ/Order/Lead).

### Custom types

```typescript
Tender: a.customType({
    tenderId: a.id().required(),
    source: a.string().required(),
    sourceUrl: a.string().required(),
    title: a.string().required(),
    agency: a.string().required(),
    country: a.string(),
    language: a.string(),
    description: a.string(),
    descriptionEn: a.string(),               // populated lazily by translateTenderDescription
    estimatedValueUSD: a.integer(),
    estimatedValueOriginal: a.string(),
    postedDate: a.string(),
    deadline: a.string(),
    naicsCodes: a.string().array(),
    cpvCodes: a.string().array(),
    overallScore: a.integer(),
    isHighPriority: a.boolean(),
    isExpired: a.boolean(),
    status: a.string(),
    statusNote: a.string(),
    assignedTo: a.string(),
    lastStatusChangedAt: a.datetime(),
    createdAt: a.datetime(),
    updatedAt: a.datetime(),
}),

TenderMatch: a.customType({
    tenderId: a.id().required(),
    productSlug: a.string().required(),
    score: a.integer().required(),
    reasoning: a.string(),
    matchedKeywords: a.string().array(),
    createdAt: a.datetime(),
}),

TenderStatusLog: a.customType({
    tenderId: a.id().required(),
    fromStatus: a.string(),
    toStatus: a.string().required(),
    changedBy: a.string().required(),
    changedAt: a.datetime().required(),
    note: a.string(),
}),

TenderKeywordConfig: a.customType({
    productCategory: a.string().required(),
    productSlugs: a.string().array().required(),
    keywords: a.string().array().required(),
    synonyms: a.string().array().required(),
    blacklist: a.string().array().required(),
    naicsCodes: a.string().array().required(),
    cpvCodes: a.string().array().required(),
    isActive: a.boolean().required(),
    updatedBy: a.string(),
    updatedAt: a.datetime(),
}),

TenderConnection: a.customType({
    items: a.ref('Tender').array().required(),
    nextToken: a.string(),
    totalActiveUnfiltered: a.integer(),  // count of all active tenders, unaffected by filters
}),

TenderDetailBundle: a.customType({
    tender: a.ref('Tender').required(),
    matches: a.ref('TenderMatch').array().required(),
    log: a.ref('TenderStatusLog').array().required(),
}),

PrefilterPreviewResult: a.customType({
    matchedCategories: a.string().array().required(),
    matchedKeywords: a.string().array().required(),
    passed: a.boolean().required(),
}),
```

### Queries

```typescript
listTenders: a.query()
    .arguments({
        statuses: a.string().array(),
        includeExpired: a.boolean(),
        countries: a.string().array(),
        categories: a.string().array(),
        minScore: a.integer(),
        postedDateFrom: a.string(),       // YYYY-MM-DD
        postedDateTo: a.string(),
        search: a.string(),
        sortBy: a.string(),     // 'score' (default) | 'postedDate' | 'deadline'
        sortDir: a.string(),    // 'desc' (default) | 'asc'
        limit: a.integer(),
        nextToken: a.string(),
    })
    .returns(a.ref('TenderConnection').required())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

getTender: a.query()
    .arguments({ tenderId: a.id().required() })
    .returns(a.ref('TenderDetailBundle'))
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

listTenderKeywordConfigs: a.query()
    .arguments({ includeInactive: a.boolean() })
    .returns(a.ref('TenderKeywordConfig').array().required())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),
```

### Mutations

```typescript
updateTenderStatus: a.mutation()
    .arguments({
        tenderId: a.id().required(),
        toStatus: a.string().required(),
        note: a.string(),
        assignedTo: a.string(),   // optional — pass Cognito username to update assignment alongside status
    })
    .returns(a.ref('Tender').required())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

bulkUpdateTenderStatus: a.mutation()
    .arguments({
        tenderIds: a.id().array().required(),
        toStatus: a.string().required(),
    })
    .returns(a.integer().required())  // count updated
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

upsertTenderKeywordConfig: a.mutation()
    .arguments({
        productCategory: a.string().required(),
        productSlugs: a.string().array().required(),
        keywords: a.string().array().required(),
        synonyms: a.string().array().required(),
        blacklist: a.string().array().required(),
        naicsCodes: a.string().array().required(),
        cpvCodes: a.string().array().required(),
        isActive: a.boolean().required(),
    })
    .returns(a.ref('TenderKeywordConfig').required())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

runPrefilterPreview: a.mutation()
    .arguments({
        title: a.string().required(),
        description: a.string().required(),
        naicsCodes: a.string().array(),
        cpvCodes: a.string().array(),
        configOverride: a.json(),  // optional — current unsaved config form state
    })
    .returns(a.ref('PrefilterPreviewResult').required())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

translateTenderDescription: a.mutation()
    .arguments({ tenderId: a.id().required(), force: a.boolean() })
    .returns(a.string().required())  // returns descriptionEn
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),
```

`runPrefilterPreview` is intentionally a **mutation, not a query**. Same string inputs in different unsaved-config contexts must always re-evaluate; query-level caching would silently return stale results.

`translateTenderDescription` is also a mutation rather than a query for the same reason: the cached `descriptionEn` string would otherwise be hit by AppSync query-level cache, and re-translation requests via `force: true` would still return stale cached results.

## `tender-api` Lambda

New Lambda under `amplify/functions/tender-api/`. Standard project conventions (matches `submit-rfq`, `order-api`).

### Phase 1 reuse

**Library reorg:** During Phase 2 setup, move `matchesAnyConfig` and its `MatchableTender` interface from `amplify/functions/prefilter-by-keyword/handler.ts` into a new file `amplify/lib/tender-watch/prefilter.ts`. Update `prefilter-by-keyword/handler.ts` to import from the lib. This eliminates the cross-Lambda source-level dependency that would otherwise couple `tender-api` to `prefilter-by-keyword`'s file layout. All existing tests for the pure function continue to pass since the move is mechanical.

```
amplify/functions/tender-api/
  handler.ts
  handler.test.ts
  resource.ts
  package.json
```

### `handler.ts` structure

```typescript
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
    DynamoDBDocumentClient,
    QueryCommand, GetCommand, PutCommand, UpdateCommand, BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import {
    tenderItemKey, tenderMatchItemKey, tenderStatusLogItemKey,
    tenderKeywordConfigItemKey, tenderStatusGsiKey, tenderHighPriorityGsiKey,
    tenderKeywordConfigActiveGsiKey, scoreSortToken,
    TENDER_STATUSES, ACTIVE_TENDER_STATUSES, type TenderStatus,
} from '../../lib/tender-watch/keys';
import { matchesAnyConfig } from '../../lib/tender-watch/prefilter';
import type { TenderKeywordConfigItem } from '../../lib/tender-watch/types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const ADMIN_GROUP = 'admin';

export async function handler(event: AppSyncResolverEvent<any> & { fieldName?: string }) {
    requireAdmin(event);
    const identity = (event.identity as any)?.username ?? 'unknown';
    // Amplify Gen 2's a.handler.function() path sends fieldName at the event root;
    // standard AppSync wraps it under event.info. Support both.
    const fieldName = (event.info as any)?.fieldName ?? (event as any).fieldName;
    switch (fieldName) {
        case 'listTenders':              return listTenders(event.arguments);
        case 'getTender':                return getTender(event.arguments);
        case 'listTenderKeywordConfigs': return listKeywordConfigs(event.arguments);
        case 'updateTenderStatus':       return updateStatus(event.arguments, identity);
        case 'bulkUpdateTenderStatus':   return bulkUpdateStatus(event.arguments, identity);
        case 'upsertTenderKeywordConfig':return upsertKeywordConfig(event.arguments, identity);
        case 'runPrefilterPreview':      return runPrefilterPreview(event.arguments);
        case 'translateTenderDescription': return translateDescription(event.arguments);
        default: throw new Error(`Unknown fieldName: ${fieldName}`);
    }
}

function requireAdmin(event: AppSyncResolverEvent<any>) {
    const groups = (event.identity as any)?.groups ?? [];
    if (!groups.includes(ADMIN_GROUP)) {
        throw new Error('Unauthorized: admin group required');
    }
}
```

### Operation summaries

**listTenders**
- For each requested status (default `ACTIVE_TENDER_STATUSES`), run `Query GSI1` with `GSI1PK = TENDER_STATUS#<status>`.
- Apply server-side filters: country, category overlap, minScore, search (case-insensitive substring on title + agency).
- Merge results, sort by requested sortBy/sortDir (default GSI1SK natural order = score DESC).
- Paginate by cursor — `nextToken` is base64-encoded `LastEvaluatedKey`.
- Return `totalActiveUnfiltered` (one extra Query with `Select: 'COUNT'` for active statuses, unaffected by filters, cached per Lambda invocation).

**getTender**
- 3 parallel queries on `PK = TENDER#<id>`:
  - GetItem for `SK = METADATA`
  - Query for `begins_with(SK, 'MATCH#')`
  - Query for `begins_with(SK, 'LOG#')` (newest first, limit 100)
- Returns 404 if METADATA absent.

**listTenderKeywordConfigs**
- `includeInactive=false` (default): Query GSI1 `GSI1PK = TENDER_KEYWORD_CONFIG_ACTIVE`.
- `includeInactive=true`: Query base table `PK = TENDER_KEYWORD_CONFIG`.

**updateTenderStatus**
- GetItem current TENDER METADATA.
- Update with new `status`, refreshed `GSI1SK` (via `scoreSortToken`), set/clear `GSI3PK`/`GSI3SK` based on isHighPriority (unchanged here; score-based, not status-based — leave alone). If `assignedTo` provided, update `assignedTo` field on the TENDER item in the same UpdateItem call.
- Use optimistic ConditionExpression: `updatedAt = :prevUpdatedAt` to detect concurrent writes; on `ConditionalCheckFailedException` throw `Conflict: tender modified by another user`.
- PutItem TenderStatusLog entry: `SK = LOG#<ISO datetime>#<ulid>`, fields = fromStatus, toStatus, changedBy, changedAt, note.
- Return updated Tender.

**bulkUpdateTenderStatus**
- Validate `tenderIds.length <= 50` (server cap, throws `400: bulk update limit exceeded`).
- `Promise.all` with concurrency limit 10 (Sufficient for batch sizes up to ~25; admin won't bulk more than that at once via UI).
- Each tender goes through the same path as `updateTenderStatus`.
- Tally success count, return it. Per-tender failures logged but not rolled back.

**upsertTenderKeywordConfig**
- Build item with the existing key builders, set GSI1 active key only when `isActive`.
- PutItem (no condition — upsert semantics).
- Set `updatedBy = identity, updatedAt = now`.

**runPrefilterPreview**
- If `configOverride` provided: parse with the same Zod-compatible shape used for `TenderKeywordConfigItem` (required string arrays for `keywords`, `productSlugs`, etc.; boolean `isActive`). On parse failure, throw `400: invalid configOverride payload`. On success, call `matchesAnyConfig(tender, [parsedConfig])`.
- Otherwise: load all active configs, call `matchesAnyConfig(tender, configs)`.
- Return `{matchedCategories, matchedKeywords, passed: matchedCategories.length > 0}`.

**translateTenderDescription**
- GetItem tender by `tenderId`. If `descriptionEn` already populated and `force !== true`, return cached value (zero Bedrock call).
- Otherwise: invoke Bedrock Claude Haiku (same model + region as `match-with-llm`, `BEDROCK_MODEL_ID` env) with prompt:
  - Timeout: `BEDROCK_TIMEOUT_MS = 8000`, Anthropic fallback `ANTHROPIC_TIMEOUT_MS = 20000` (matches `match-with-llm` constants).
  > Translate this procurement tender description to English. Preserve technical terminology (CPV codes, model numbers, scientific units) verbatim. Output translation only, no commentary.
  > 
  > Original (language: <code>):
  > <description, truncated to 4000 chars>
- Parse response, strip markdown fences (reuse Phase 1's `parseLlmJson` pattern — actually this is plain text not JSON, so just trim).
- UpdateItem to set `descriptionEn` + `descriptionEnAt = now()`.
  - **Do not update `updatedAt`** — translation is a derived/cached attribute, not a user-initiated mutation. Touching `updatedAt` would invalidate the optimistic-locking token used by `updateTenderStatus` and cause spurious Conflict errors if a translation lands between a tender load and a status save.
- Return translated text.
- On Bedrock failure: try Anthropic API fallback (mirror `match-with-llm` dual-provider pattern). On both fail, return `Error: translation unavailable` and don't cache.

### IAM and environment

- DDB read/write on `intelligenceTable`
- `INTELLIGENCE_TABLE`, `BEDROCK_MODEL_ID`, `CLAUDE_MODEL` env injected by `backend.ts`
- `ANTHROPIC_API_KEY` Amplify secret (fallback)
- `bedrock:InvokeModel` IAM grant (same model ARN patterns as `match-with-llm`)
- No SES, no S3

### Tests

`handler.test.ts` covers each fieldName case with vitest:
- `listTenders` — multi-status query + sort + filter
- `getTender` — happy path + 404
- `updateTenderStatus` — success + ConditionalCheckFailed → Conflict
- `bulkUpdateTenderStatus` — partial failure path (some succeed, some fail)
- `upsertTenderKeywordConfig` — active/inactive GSI1 key handling
- `runPrefilterPreview` — with/without configOverride
- `translateTenderDescription` — cached path + Bedrock-fallback-to-Anthropic + both-fail path
- `requireAdmin` — rejects non-admin group

## `/admin/tenders` — List page

### Layout

Standard `AdminLayout` shell. Main area:

1. **KPI cards** (top, 4-column grid):
   - Today new (`statuses=['new'] AND postedDateFrom=today AND postedDateTo=today`)
   - Week new (`statuses=['new'] AND postedDateFrom=today-7 AND postedDateTo=today`)
   - High priority (`minScore=80`, all active statuses)
   - Closing <7d (client-side filter on `daysUntil(deadline) <= 7`)

   Each card is clickable and acts as a quick filter pre-set.

2. **Filter bar**:
   - Search box (debounced 300ms; matches title + agency server-side)
   - Status multi-select (default: `new`, `reviewing`, `pursuing`, `submitted`)
   - Country multi-select (options pulled from distinct values in current dataset)
   - Category multi-select (options from `TenderKeywordConfig.productCategory`)
   - Min score slider (0–100, step 10)
   - Date range picker (postedDate)
   - "Include expired" toggle
   - "Include not_relevant" toggle
   - Refresh button
   - All filter state synced to URL query params for share/restore

3. **Table**:
   - Columns: checkbox, score, title (truncate 80ch, hover full), agency (truncate 40ch), country (flag emoji + ISO code), deadline (`YYYY-MM-DD (Nd)`, red if <7d), status (inline dropdown), matched products (chips, +N overflow), actions
   - Default sort: score DESC, postedDate DESC (handled server-side via GSI1SK natural order)
   - Sort by column header click — score / postedDate / deadline supported
   - Color-coded score pills: ≥80 red, 60-79 orange, 30-59 yellow, <30 grey

4. **Inline status dropdown**:
   - Click status chip → menu opens (7 options from `TENDER_STATUSES`)
   - For `not_relevant` and `lost`: open a dialog with **required note** textarea (label `Reason *` with red asterisk; Confirm button disabled until note has ≥3 chars)
   - For other transitions: immediate optimistic update, server call, rollback + error toast on failure

5. **Bulk action bar** (sticky at bottom when ≥1 selected):
   - `[N selected]` count
   - Action menu: `Mark as not_relevant`, `Move to reviewing`, `Move to pursuing`
   - Bulk excludes `won`/`lost`/`submitted` (these require per-tender notes / are too consequential for batch)

6. **Pagination**:
   - 25/page default, server cursor-based via `nextToken`
   - Page numbers UI but with internal cursor tracking
   - Display: `Showing 1-25 (filtered) · ~120 total active` — the "total active" figure comes from `totalActiveUnfiltered` and is unaffected by the current filter selections

7. **CSV export**:
   - `Export current filter as CSV` button
   - Client-side loops `nextToken` to fetch all pages (cap at 500 rows; show warning if more)
   - Columns: tenderId, source, title, agency, country, postedDate, deadline, overallScore, status, sourceUrl, matchedProductSlugs (semicolon-joined)
   - Blob download via `URL.createObjectURL`

8. **Empty states**:
   - No tenders at all: `No tenders yet — the daily cron runs at 02:00 UTC. Check back tomorrow.`
   - Filtered to zero: `No tenders match these filters. Try removing some?`

### Files

```
src/pages/admin/TenderListPage.tsx
src/components/admin/
  TenderTable.tsx
  TenderStatusDropdown.tsx
  TenderFilterBar.tsx
  TenderKpiCards.tsx
  TenderBulkActionBar.tsx
src/hooks/useTenders.ts
```

## `/admin/tenders/:tenderId` — Detail page

### Layout

Two-column grid. Back link at top.

**Left sticky 240px panel** (always visible while right side scrolls):

- Title (full, wraps)
- Agency + country flag emoji
- Score (large number, color-coded; fire emoji if high priority)
- Deadline countdown (`2026-06-12 (29 days)`, red if <7d, "no deadline" if null)
- Status dropdown (with note textarea below; mandatory note for `not_relevant` / `lost`)
- "Assigned to" dropdown (Phase 2: current user / unassigned only; Phase 3+ multi-user)
  - The current user identity is resolved client-side via `import { getCurrentUser } from 'aws-amplify/auth'` (matches existing admin pattern). The Lambda mutation accepts `assignedTo: a.string()` — frontend passes the resolved Cognito username, Lambda stores verbatim. Assignment changes go through `updateTenderStatus` with the optional `assignedTo` field (no dedicated `updateTenderAssignment` mutation in Phase 2; status and assignment can be updated independently in separate calls if needed).
- Quick actions:
  - `View on <source>` (external link, new tab)
  - `Mark not relevant` (one-click → opens note dialog)
- Metadata block: postedDate, source name, estimatedValueUSD formatted as `~$120,000`, NAICS/CPV code chips, language
- `Convert to RFQ` button slot — **omitted from rendered output in Phase 2**, present as a TODO comment for Phase 3

**Right scrolling content**:

1. **Description section**
   - If ≤500 chars: render in full
   - If >500 chars: collapsed showing first 200 chars + "Show more"
   - Header notes original language if non-English: `Description (original: et)`
   - **Translate button** (only shown when `language !== 'en'`): one-click `Translate to English` invokes a new `translateTenderDescription` mutation on `tender-api` (Bedrock Claude Haiku, same model as `match-with-llm`). Translated text rendered in-place below the original with `Translation (machine, may contain errors)` header. Per-tender cache: result stored on the TENDER item as `descriptionEn` so re-opening the page doesn't re-call Bedrock. Phase 2 stores translation on first click; admin can request retranslation if it looks off.

2. **Product matches** (sorted by score DESC, one card per match):
   - Product slug (link to `/products/<slug>` in new tab)
   - Score progress bar + numeric
   - LLM `reasoning` text (quote-styled, italic)
   - Matched keywords chip list

3. **Audit log** (newest first, first 5 visible, "Show all (N)" expands):
   - `<changedAt> · <changedBy> · status: <fromStatus> → <toStatus> [· "<note>"]`
   - Server query: `Query PK = TENDER#<id> AND begins_with(SK, 'LOG#') ScanIndexForward=false Limit=100`. Since SK is `LOG#<ISO datetime>#<ulid>`, `ScanIndexForward=false` gives newest-first natural order. 100-row cap is a hard ceiling for Phase 2 — exceeding it triggers no pagination UI. If admin demand surfaces for older history, a Phase 4 enhancement could add a separate `listTenderStatusLog` query with cursor pagination.

### Data fetching

Single `getTender(tenderId)` call → `TenderDetailBundle`. Lambda fans out 3 parallel DDB ops internally.

Hook: `useTender(tenderId)` with stale-while-revalidate. After successful `updateTenderStatus`, refresh the bundle.

### Mark-not-relevant flow

1. Click button → modal opens with `Mark this tender as not relevant?` + required note textarea + Cancel/Confirm
2. Confirm → call `updateTenderStatus({tenderId, toStatus: 'not_relevant', note})`
3. On success: toast `Marked as not relevant` + navigate back to list page (with `?highlightId=<tenderId>` so list briefly highlights the row that was just removed from default view)

### Empty / error states

- Tender not found: `This tender no longer exists.` + back-to-list link
- No matches recorded: `No product matches recorded.` (rare — only possible if Lambda failed mid-pipeline)

### Files

```
src/pages/admin/TenderDetailPage.tsx
src/components/admin/
  TenderHeaderPanel.tsx
  TenderMatchCard.tsx
  TenderAuditLog.tsx
  TenderStatusChangeDialog.tsx
src/hooks/useTender.ts
```

## `/admin/tenders/keywords` — Keyword config page

### Layout

Master-detail. Settings access via gear icon in TenderListPage header (not a top-level nav item).

**Master sidebar (180px)**:

- 10 categories, each row: `<category> (<linkedSlugsCount>)`
- Active selection highlighted
- Inactive configs grey/italic
- Bottom: `+ New category` button → modal asks for new `productCategory` name (PK, immutable) → creates empty config and selects it

**Editor pane (right)**:

Form fields:
- `isActive` checkbox (top-right of editor)
- **Linked product slugs** — tag input, type-ahead candidates from `Product` table (existing `a.model('Product')`)
- **Keywords** (OR-match) — tag input, free text
- **Synonyms** — tag input
- **Blacklist** — tag input with helper text on disambiguation
- **NAICS codes** — tag input, 6-digit validation
- **CPV codes** — tag input, 8-digit validation

**Test match panel** (green border, embedded at bottom of editor):
- Title input
- Description textarea (4 rows)
- Optional NAICS / CPV inputs
- `Run test` button → calls `runPrefilterPreview` passing the form's current (unsaved) state as `configOverride`
- Result display: PASS or FAIL with matched categories + keywords

**Save**:
- `Save changes` button bottom-right
- Calls `upsertTenderKeywordConfig`
- Client-side validation: ≥1 keyword OR synonym, ≥1 linked productSlug
- Success → toast `Saved — takes effect on next daily run at 02:00 UTC`
- Failure → toast + form preserved

**Dirty state**:
- Banner `Unsaved changes` appears top of editor when form differs from server state
- Switching categories with unsaved changes prompts `Discard unsaved changes?` confirm

**No delete**:
- Categories with `TenderProductMatch` history shouldn't be deleted (creates dangling references)
- Mark `isActive: false` instead — config preserved, just stops matching on next runs

### Files

```
src/pages/admin/TenderKeywordConfigPage.tsx
src/components/admin/
  KeywordConfigSidebar.tsx
  KeywordConfigEditor.tsx
  KeywordConfigTestPanel.tsx
  TagInput.tsx
src/hooks/useKeywordConfigs.ts
```

`TagInput.tsx` is a small new component (chips + free-text input + Enter to commit, basic type-ahead). Used in 6+ fields across the config page.

**Important: preserve special characters.** Semiconductor terminology frequently includes `/`, `-`, `+`, and `.` (e.g. `RIE/ICP`, `E-Beam`, `PECVD+ALD`, `HDP-CVD`, `38.2.1`). The TagInput **only commits on Enter or comma + space** — it does not auto-split on any other character. Backspace on empty input removes the last chip. Pasted text is committed as a single tag unless it contains explicit `\n` or `, ` separators.

## Frontend service layer

Centralized in `src/services/tenderAdminService.ts`. Matches `orderAdminService.ts` pattern: thin wrappers around `client.queries.*` / `client.mutations.*` with consistent error handling.

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const AUTH = { authMode: 'userPool' as const };

export async function listTenders(args: ListTendersArgs) { /* ... */ }
export async function getTender(tenderId: string) { /* ... */ }
export async function listKeywordConfigs(includeInactive?: boolean) { /* ... */ }
export async function updateStatus(args: UpdateStatusArgs) { /* ... */ }
export async function bulkUpdateStatus(args: BulkUpdateArgs) { /* ... */ }
export async function upsertKeywordConfig(args: UpsertConfigArgs) { /* ... */ }
export async function runPrefilterPreview(args: PreviewArgs) { /* ... */ }
export async function translateTenderDescription(tenderId: string, force?: boolean): Promise<string> { /* ... */ }
export async function exportTendersAsCsv(filters: ListTendersArgs): Promise<Blob> { /* loops nextToken */ }
```

Each wrapper throws on `errors.length > 0` with concatenated messages.

## Navigation integration

`src/components/admin/AdminLayout.tsx` `NAV_ITEMS` array:

```typescript
const NAV_ITEMS = [
    { path: '/admin/dashboard', label: 'Dashboard',  icon: 'dashboard' },
    { path: '/admin/orders',    label: 'Orders',     icon: 'shopping_cart' },
    { path: '/admin/rfqs',      label: 'RFQs',       icon: 'request_quote' },
    { path: '/admin/tenders',   label: 'Tenders',    icon: 'gavel' },        // NEW
    { path: '/admin/leads',     label: 'Leads',      icon: 'contact_mail' },
    { path: '/admin/insights',  label: 'Insights',   icon: 'insights' },
    { path: '/admin/questions', label: 'Q&A',        icon: 'forum' },
    { path: '/admin/analytics', label: 'Analytics',  icon: 'analytics' },
];
```

Position between RFQs and Leads — workflow ordering (RFQ = current sales, Tenders = potential new opportunities, Leads = early funnel).

`src/App.tsx` routes (order matters — `/keywords` before `/:tenderId`):

```typescript
<Route path="/admin/tenders" element={<TenderListPage />} />
<Route path="/admin/tenders/keywords" element={<TenderKeywordConfigPage />} />
<Route path="/admin/tenders/:tenderId" element={<TenderDetailPage />} />
```

## Toast system

New dependency: `react-hot-toast` (~2KB gzipped, headless API). One `<Toaster />` mounted in `AdminLayout.tsx` (admin-only since tenders is admin-only; if Phase 3 surfaces toasts on public pages, move to `App.tsx`).

Usage pattern:

```typescript
import toast from 'react-hot-toast';
toast.success('Status updated');
toast.error('Failed to update status');
toast.loading('Saving...', { id: 'save' });   // updateable
```

**Mount point**: in `src/components/admin/AdminLayout.tsx`, import `import { Toaster } from 'react-hot-toast'` at the top, then render `<Toaster position="top-right" toastOptions={{ duration: 4000 }} />` immediately before the closing `</div>` of the layout's root container (after the `<Outlet />`). Confines toast surface to admin pages.

## Authorization

- All AppSync operations use `authorization((allow) => [allow.authenticated()])`
- `tender-api` Lambda also explicitly checks `event.identity.groups.includes('admin')` — defense in depth
- AdminRoute component (existing) blocks non-admin users at the route level

## Optimistic updates and concurrency

- Status dropdown changes use optimistic UI: update local state immediately, send mutation in background
- On failure: rollback + error toast
- Server uses `UpdateItem` with `ConditionExpression: 'updatedAt = :prev'` — concurrent edits trigger `ConditionalCheckFailedException` which the Lambda translates to a friendly `Conflict: tender was modified by another user` error
- Front-end handles Conflict by refreshing the tender record + toast `Tender was modified — your change was discarded, refreshing.`

## URL state

List page filters are synced to `useSearchParams`:
- Status pills: `?statuses=new,reviewing`
- Country: `?countries=US,DE`
- Etc.

Empty / default values are omitted from the URL. Restoring from URL on mount runs immediately.

## Error handling

- All hooks return `{data, loading, error, refresh}` shape (matches existing `useRfqs` etc.)
- Errors render as toast + retry button in-page
- Network errors distinguished from validation errors (HTTP status / error code inspection)

## Testing

### Lambda tests

`amplify/functions/tender-api/handler.test.ts`. One test group per fieldName:

- `listTenders` — multi-status query, filter applied, sort default & override
- `getTender` — bundle assembly, 404 path
- `listTenderKeywordConfigs` — active vs all
- `updateTenderStatus` — success + log written, ConditionalCheckFailed → Conflict
- `bulkUpdateTenderStatus` — partial failure tally
- `upsertTenderKeywordConfig` — active→inactive removes GSI1 key
- `runPrefilterPreview` — with/without configOverride
- `requireAdmin` — rejects non-admin

Reuses `matchesAnyConfig` test coverage from Phase 1 — does not re-test the pure function.

### Frontend tests

vitest + @testing-library/react. Per-component:

- `TenderTable` — column rendering, sort indicators, multi-select toggling, empty state
- `TenderStatusDropdown` — optimistic update, rollback on error, note-required dialog for `not_relevant` / `lost`
- `TenderFilterBar` — URL sync (writes + restores)
- `KeywordConfigEditor` — dirty state, save validation, tag input add/remove
- `KeywordConfigTestPanel` — pass/fail UI states
- `TagInput` — Enter to commit, duplicate prevention, paste-split

Page-level integration tests with MSW mocking `tenderAdminService` functions:
- TenderListPage filter → URL sync
- TenderDetailPage status change full flow
- TenderKeywordConfigPage save + test preview flow

### Manual QA

A checklist (added to PR description) covering:
- Inline status edit
- Bulk action with 5+ tenders
- CSV export with both small and capped (>500) result sets
- Test match preview with both saved config and unsaved edits
- New category creation
- Conflict handling (open same tender in two tabs, change status from both)

E2E (Playwright/Cypress) — out of scope. Project doesn't have an E2E framework yet; introducing one is its own initiative.

## Implementation phases

| Sub-task | Estimated | Depends on |
|---|---|---|
| 1. Schema additions + `tender-api` Lambda scaffold | 0.5d | — |
| 2. `tender-api` Lambda handlers + tests | 1.5d | 1 |
| 3. Frontend service layer + hooks | 0.5d | 1 |
| 4. Toast setup + admin nav integration + routing | 0.3d | 3 |
| 5. List page (KPI, filter bar, table, bulk, CSV) | 1.5d | 3, 4 |
| 6. Detail page + status change dialog + translate button | 1.2d | 3, 4 |
| 7. Keyword config page + test panel + TagInput | 1.0d | 3, 4 |
| 8. Manual QA + adjustments | 0.5d | all |
| **Total** | **~6.2 days** | |

## Risks

1. **Schema type drift** — Amplify Gen 2's generated `Schema` type occasionally lags behind `resource.ts` changes. Mitigation: PR pipeline runs `npx ampx generate graphql-client-code` and commits the result; rerun on local before frontend work.

2. **Optimistic update race** — Two admins editing the same tender simultaneously. Mitigation: ConditionalCheckFailedException + Conflict error + UI refresh + clear toast message.

3. **TagInput scope creep** — Building a polished tag input (type-ahead, paste-split, drag-reorder) is a project on its own. Mitigation: start with minimum viable (chip + input + Enter to commit + click-X to remove + no type-ahead for Phase 2). Type-ahead added later only if admin feedback demands it.

4. **CSV export memory** — Looping `nextToken` to fetch 1000+ tenders client-side could hang the browser. Mitigation: cap at 500 rows, banner warning, suggest filtering further.

5. **`listTenders` query fan-out worst case** — Default active 4 statuses + 2 toggles (include expired / include `not_relevant`) + `won`/`lost` filter can issue up to 7 parallel `Query GSI1` calls per list page, plus up to 4 additional `Select: 'COUNT'` queries for `totalActiveUnfiltered`. Worst-case: ~11 DDB requests per page load at low volume (≤100 ms latency each, parallel). At 10k+ active tenders the merge + sort cost grows. Mitigation: monitor Lambda duration metric; if it exceeds 1s consistently, add a cross-status GSI keyed by `score`, or paginate per-status with a merge token.

6. **Toast library lock-in** — Once we ship `react-hot-toast`, replacing it later means rewriting every `toast.*` call. Mitigation: wrap calls in a thin `src/lib/notify.ts` module so the library swap is a one-file change.

7. **Score sort key staleness** — When a tender's `overallScore` changes (e.g. Phase 4 re-scoring), GSI1SK must be rewritten. Phase 1's `classify-and-store` already handles this. Phase 2's `updateTenderStatus` does NOT change score, so it doesn't need to rewrite GSI1SK — but if any future operation changes score, that path must update GSI1SK.

## Cost estimate (monthly, expected admin usage)

| Item | Usage | Cost |
|---|---|---|
| `tender-api` Lambda invocations | ~100 ops/day × 30 = 3,000/month | $0 (free tier) |
| AppSync requests | Same | $0 (free tier) |
| Additional DDB read/write | A few thousand ops/month | <$0.50 |
| Bedrock Haiku translation | ~5 click/day × 30 = 150 calls × ~1500 tokens × $0.002 | ~$0.50 |
| Bundle size impact (react-hot-toast) | +2 KB gzipped | Negligible |
| **Phase 2 added cost** | | **~$1/month** |

## Implementation notes

- **`TenderMatch` vs `TenderProductMatch` naming**: the GraphQL customType is named `TenderMatch` for brevity. The underlying DDB entity remains `TENDER_MATCH` (entityType discriminator) and the TypeScript interface in `types.ts` remains `TenderMatchItem`. No rename is needed in Phase 1 code.

- **Optimistic update row transition**: when an inline status change moves a tender out of the current filtered view (e.g. admin marks a `new` tender as `reviewing` while viewing `new`-only filter), the row stays in place during the optimistic pending state (fade to 50% opacity), then animates out (slide-up + fade) after server confirms within 300ms. On error, the row restores to full opacity and shows the error toast.

- **Keyword config edit audit**: Phase 2 does not introduce a `TENDER_KEYWORD_CONFIG_LOG` entity. The only audit trail is `updatedBy`/`updatedAt` on each config item — if an admin overwrites a keyword list, prior values are lost. A future Phase 4+ enhancement could add full-history logs. This is an explicit tradeoff to keep Phase 2 lean.

- **Nav position conflict with Phase 1 spec**: Phase 1's spec mentioned positioning Tenders after RFQs in usage-frequency order (Analytics → RFQs → Tenders → ...). Phase 2 supersedes that: position is between RFQs and Leads in workflow order (RFQ = current sales, Tenders = potential new opportunities, Leads = early funnel). The Phase 1 spec's nav guidance was speculative; this is the binding decision.

## Out of scope (explicitly excluded)

- Realtime updates / DynamoDB Streams / AppSync subscriptions
- Mobile responsive layouts
- Multi-tier admin role splitting (read-only viewer, editor, etc.)
- Tender comments, mentions, @-replies
- "Convert to RFQ" UI (Phase 3)
- Auto-assignment rules
- Slack / Teams / Discord integrations
- Tender PDF download / OCR
- Bulk actions for `won` / `lost` / `submitted` (require per-tender notes)
- Delete category operation in keyword config page
- Multi-user assignment list beyond current logged-in user (Phase 3+)
- "Test match" against historical tenders (only freeform input in Phase 2)
- E2E testing framework introduction
- Cross-status unified GSI (added only if `listTenders` Lambda duration exceeds 1s consistently — see Risk #5)
- Background CSV export job via SQS + email link (current 500-row cap is sufficient until admin reports it isn't)
- NAICS/CPV "common code" quick-pick dropdown (admins configure categories rarely; type-ahead is enough)
- Tag-input type-ahead for keyword/synonym fields (only the linked-products field has type-ahead in Phase 2)
