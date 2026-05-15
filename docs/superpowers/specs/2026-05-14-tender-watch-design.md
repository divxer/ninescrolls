# Tender Watch — Design Spec

**Date:** 2026-05-14
**Status:** Approved (sandbox-validated)
**Owner:** harvey@ninescrolls.com

> **Verification:** This design was sandbox-deployed and end-to-end verified in PR [#139](https://github.com/divxer/ninescrolls/pull/139). The sandbox run pulled 129 live TED notices, deduped via GSI2, scored 2 ALD candidates through Bedrock Haiku, wrote 3 TENDER_MATCH items to the DynamoDB table, and triggered the daily-digest email (which surfaced the unrelated SES→SendGrid migration captured in commit `4e5f113`). All 12 corrections discovered during sandbox debugging are reflected in this revision.

## Summary

Tender Watch is a daily-run pipeline that monitors international public tender / procurement portals (SAM.gov, TED, UK Find a Tender, plus phased additions) for opportunities matching NineScrolls products (PECVD, ALD, RIE/ICP etchers, e-beam evaporator, sputter systems, AFM series, etc.). Matches are scored, deduped across sources, persisted to DynamoDB, surfaced in an admin UI, and pushed to admin email (high-priority real-time alerts + daily digest). China-domestic sources are explicitly excluded.

The system is delivered as three subsystems built together as one spec but with implementation phased:

1. **Data collection pipeline** — fetch → normalize → dedupe → keyword prefilter → LLM scoring → persist → notify
2. **Admin UI** — `/admin/tenders` list, detail page, keyword configuration page
3. **CRM hook** — "Convert to RFQ" button that prefills the existing RFQ creation page from a tender record

## Non-goals

- Slack / mobile push notifications (email only)
- Automated bid submission
- OCR parsing of attached tender PDFs (candidate for a later phase)
- Machine translation (multilingual content handled directly by the LLM)
- Sub-admin role management (reuses existing admin Cognito group)
- China-domestic tender sites

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Geographic scope | All non-China markets, phased: SAM.gov + TED first, UK in phase 3, others later |
| Delivery shape | Full CRM-style with all three subsystems designed together |
| Match strategy | Keyword prefilter + LLM (Bedrock Claude Haiku) relevance scoring |
| CRM integration | Tender is independent entity; manual conversion to RFQ via prefilled form |
| Keyword storage | DynamoDB table editable through admin UI (not hardcoded) |
| Cadence | Daily fetch + immediate email for high-score tenders, daily digest for the rest |
| Lifecycle | Auto-mark expired by deadline; admin default view filters out expired + `not_relevant` |
| Orchestration | AWS Step Functions Standard workflow (not per-source independent Lambdas) |
| Email threshold | `overallScore >= 80` (max across all product matches for a tender) |

## High-level architecture

```
EventBridge (cron: 02:00 UTC daily)
        ↓
[Step Functions State Machine: tender-watch-daily]
        ↓
   ┌────┴─────┬─────────┬──────────┐
   ↓          ↓         ↓          ↓
fetch-sam  fetch-ted  fetch-uk  fetch-others (Parallel; phased)
   ↓          ↓         ↓          ↓
   └────┬─────┴─────────┴──────────┘
        ↓
   normalize-and-dedupe  (cross-source dedupe, write TENDER items)
        ↓
   prefilter-by-keyword  (coarse string + NAICS/CPV filter)
        ↓
   match-with-llm        (Bedrock Haiku scoring, Map state with concurrency limit)
        ↓
   classify-and-store    (set overallScore, isHighPriority; write TenderProductMatch)
        ↓
   ┌────┴────────┐
   ↓             ↓
notify-high   notify-daily
-priority      -digest
   ↓             ↓
   └────┬────────┘
        ↓
   expire-old-tenders
        ↓
       [End]

Admin path: browser → AppSync (existing) → Lambda resolvers (Phase 2) → `intelligenceTable` single-table store
```

### Reused infrastructure

- Bedrock Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) — same model and region as `classify-org` Lambda; Anthropic API as fallback (same dual-provider pattern)
- SendGrid HTTP API (already used for RFQ/lead/question/Stripe notifications across the project) with the `SENDGRID_API_KEY` Amplify secret
- AppSync + Amplify Auth (admin already wired)
- Existing `/admin/*` navigation and layout
- **`intelligenceTable` (`NineScrollsIntelligence`)** — existing single-table store that already houses Order / RFQ / Lead / Feedback. Tender entities are added with new key prefixes; no new DynamoDB tables are created. This matches the established convention for workflow entities and keeps cross-entity timelines (GSI4 by email) coherent.

### New infrastructure

- Amplify schema (`amplify/data/resource.ts`) gains 4 new `customType` definitions (Tender / TenderProductMatch / TenderKeywordConfig / TenderStatusLog) plus Lambda-resolver queries and mutations (Phase 2)
- Step Functions Standard state machine defined as a CDK construct inside `amplify/backend.ts`
- 10 Lambda functions under `amplify/functions/` (fetch-sam, fetch-ted, fetch-uk, normalize-dedupe, prefilter-by-keyword, match-with-llm, classify-and-store, notify-high-priority, notify-daily-digest, expire-old-tenders). Phase 1 ships all except `fetch-uk`, which is added in Phase 3.
- EventBridge rule (cron daily) → Step Functions
- S3 bucket `tender-watch-raw` for inter-state payload staging (raw fetch output is too large for Step Functions 256KB payload limit)

> **CDK note — `resourceGroupName`:** Every tender-watch Lambda's `defineFunction` call in `resource.ts` must include `resourceGroupName: 'tender-watch-stack'`. This assigns the Lambda to the same CloudFormation nested stack as the Step Functions state machine and S3 bucket. Without it, Lambdas land in Amplify's auto-managed `function` stack, which creates a circular dependency (`function` ↔ `tender-watch-stack`) because the Lambdas reference the S3 bucket and the state machine references the Lambdas.

## Data model

All Tender data lives in the existing `intelligenceTable` (DynamoDB single-table design matching the established convention for workflow entities). No new tables are created. Four logical entity types are layered on top via key prefixes.

### Key schema reference

Existing table keys:
- `PK` (HASH), `SK` (RANGE)
- `GSI1PK / GSI1SK` — Type/status queries
- `GSI2PK / GSI2SK` — Organization queries (reused below for cross-source dedupe hash)
- `GSI3PK / GSI3SK` — Order ↔ Feedback association (reused below for high-priority sort)
- `GSI4PK / GSI4SK` — Email-based timeline (not used by tender entities; tender does not have a primary email)
- `TTL` — optional expiry

### Entity 1: Tender (main record)

```
PK = TENDER#<tenderId>           // e.g. TENDER#sam-1234567890
SK = METADATA
GSI1PK = TENDER_STATUS#<status>  // for default admin list (active statuses)
GSI1SK = <100-overallScore (zero-padded 3)>#<postedDate>#<tenderId>
                                 // ↑ inverse score so lexicographic ASC = score DESC
GSI2PK = TENDER_HASH#<sourceTenderHash>  // dedupe lookup
GSI2SK = TENDER
GSI3PK = TENDER_HIGH_PRIORITY    // only set when overallScore >= 80, used for daily digest scan
GSI3SK = <postedDate>#<tenderId>
```

Attributes:
| Field | Type | Notes |
|---|---|---|
| `tenderId` | string | Format: `sam-<noticeId>`, `ted-<docId>`, etc. Deterministic. |
| `entityType` | string (const `TENDER`) | Discriminator for table scans |
| `source` | string | `sam` \| `ted` \| `uk` \| `canada` \| `australia` \| `singapore` \| `korea` \| ... |
| `sourceUrl` | string | Original public tender URL |
| `sourceTenderHash` | string | `sha256(title.lower().trim() + agency.lower() + (deadline || ''))` |
| `title` | string | |
| `agency` | string | Procuring agency name |
| `country` | string | ISO 3166-1 alpha-2 |
| `language` | string | ISO 639-1 |
| `description` | string | Original description |
| `estimatedValueUSD` | number? | Converted to USD via static rate table (refreshed quarterly) |
| `estimatedValueOriginal` | string? | e.g. `"EUR 250000"` |
| `postedDate` | string (ISO date) | |
| `deadline` | string (ISO date)? | |
| `naicsCodes` | string[] | |
| `cpvCodes` | string[] | |
| `rawPayload` | object | Stored as JSON, persisted for debugging |
| `overallScore` | number (0–100) | `max(matches.score)`; written by `classify-and-store` |
| `isHighPriority` | boolean | `overallScore >= 80` |
| `isExpired` | boolean | `deadline < today`; refreshed by `expire-old-tenders` |
| `status` | string | `new` \| `reviewing` \| `pursuing` \| `submitted` \| `won` \| `lost` \| `not_relevant` |
| `statusNote` | string? | |
| `assignedTo` | string? | Admin email |
| `lastStatusChangedAt` | string (ISO datetime)? | |
| `createdAt` | string (ISO datetime) | |
| `updatedAt` | string (ISO datetime) | |

Index usage:
- **Admin default list**: `Query GSI1 WHERE GSI1PK = TENDER_STATUS#<status> ORDER BY GSI1SK ASC` (which is score DESC then postedDate DESC). Iterate the non-`not_relevant` statuses (`new` / `reviewing` / `pursuing` / `submitted`) or use a small parallel fan-out client-side.
- **Dedupe**: `Query GSI2 WHERE GSI2PK = TENDER_HASH#<hash>` returns 0 or 1.
- **Daily digest scan**: `Query GSI3 WHERE GSI3PK = TENDER_HIGH_PRIORITY AND GSI3SK >= <today>`.

When `status` or `overallScore` changes, the writing Lambda must update GSI1SK and add/remove `GSI3PK`/`GSI3SK` accordingly (the existing helpers in `orderApi` Lambda follow the same pattern — same code style applies).

### Entity 2: TenderProductMatch (one tender ↔ many products)

```
PK = TENDER#<tenderId>
SK = MATCH#<productSlug>
```

Attributes:
| Field | Type | Notes |
|---|---|---|
| `tenderId` | string | |
| `productSlug` | string | References `Product.slug` |
| `entityType` | string (const `TENDER_MATCH`) | |
| `score` | number (0–100) | |
| `reasoning` | string | LLM-generated explanation |
| `matchedKeywords` | string[] | |
| `createdAt` | string (ISO datetime) | |

Listing all matches for a tender: `Query PK = TENDER#<id> AND begins_with(SK, "MATCH#")`.

### Entity 3: TenderStatusLog (status change audit)

```
PK = TENDER#<tenderId>
SK = LOG#<ISO datetime>#<ulid>
```

Attributes:
| Field | Type | Notes |
|---|---|---|
| `tenderId` | string | |
| `entityType` | string (const `TENDER_STATUS_LOG`) | |
| `fromStatus` | string? | Null on first status set |
| `toStatus` | string | |
| `changedBy` | string | Admin email |
| `changedAt` | string (ISO datetime) | |
| `note` | string? | |

Listing audit log for a tender: `Query PK = TENDER#<id> AND begins_with(SK, "LOG#")`.

### Entity 4: TenderKeywordConfig (per-category matching rules)

```
PK = TENDER_KEYWORD_CONFIG
SK = CATEGORY#<productCategory>     // e.g. CATEGORY#PECVD
GSI1PK = TENDER_KEYWORD_CONFIG_ACTIVE   // set only when isActive = true
GSI1SK = CATEGORY#<productCategory>
```

Attributes:
| Field | Type | Notes |
|---|---|---|
| `productCategory` | string | Logical grouping (`PECVD`, `ALD`, `RIE-ICP`, `AFM`, ...) |
| `entityType` | string (const `TENDER_KEYWORD_CONFIG`) | |
| `productSlugs` | string[] | |
| `keywords` | string[] | Primary keywords (OR-matched) |
| `synonyms` | string[] | |
| `blacklist` | string[] | Excluded terms |
| `naicsCodes` | string[] | |
| `cpvCodes` | string[] | |
| `isActive` | boolean | |
| `updatedBy` | string | Admin email |
| `updatedAt` | string (ISO datetime) | |

`prefilter-by-keyword` Lambda loads all active configs with: `Query GSI1 WHERE GSI1PK = TENDER_KEYWORD_CONFIG_ACTIVE`.

### Amplify schema additions

Following the existing customType + Lambda-resolver convention (matches RFQ/Order pattern), 4 customType definitions are added to `amplify/data/resource.ts`: `Tender`, `TenderProductMatch`, `TenderStatusLog`, `TenderKeywordConfig`, plus `TenderConnection` / `TenderMatchConnection` / `TenderKeywordConfigConnection` for paginated list returns. Queries (`listTenders`, `getTender`, `listTenderKeywordConfigs`, etc.) and mutations (`updateTenderStatus`, `upsertTenderKeywordConfig`, `markTenderNotRelevant`, `runPrefilterPreview`) are added in **Phase 2** as part of the admin UI work; Phase 1 does not need any AppSync wiring because the pipeline writes directly via the DynamoDB SDK.

### Existing `Product` table

Not modified. Linkage to tenders is via `TenderKeywordConfig.productSlugs`.

## Step Functions workflow

State machine name: `tender-watch-daily`.
Trigger: EventBridge cron `0 2 * * ? *` (02:00 UTC daily).

### State sequence

1. **Parallel: FetchAllSources** — one branch per source. Each branch has Retry (3× exponential backoff) and Catch that converts failure into `{ source, error, fetched: 0 }`. State succeeds even when individual sources fail.
2. **Map: NormalizeAndDedupe** — MaxConcurrency 5. Each item processes a batch of 50 raw tenders: compute `sourceTenderHash`, Query `GSI2` with `GSI2PK = TENDER_HASH#<hash>`; if a record already exists, skip; else PutItem with `attribute_not_exists(PK)` condition (defensive against concurrent batches).
3. **Task: PrefilterByKeyword** — load all active `TenderKeywordConfig` into memory once; for each new tender, check NAICS/CPV whitelist OR keyword match (less blacklist). Output `{ candidates: [tenderId, ...] }`.
4. **Choice: HasCandidates?** — empty → Pass + End. Non-empty → continue.
5. **Map: LLMScoring** — MaxConcurrency 10. Each candidate calls `match-with-llm`. Retry on `BedrockThrottlingException` (3× backoff). On exhausted retry, Catch logs the failure to CloudWatch and leaves the tender scoreless; the next day's run will retry if the tender is still pre-deadline.
6. **Task: ClassifyAndStore** — compute `overallScore` per tender, update `isHighPriority`.
7. **Parallel: Notifications**
   - `notify-high-priority` — one email per high-priority tender (sequential; uses SendGrid HTTP API, `POST https://api.sendgrid.com/v3/mail/send`, from `noreply@ninescrolls.com` to `info@ninescrolls.com`)
   - `notify-daily-digest` — single HTML email of all new tenders today via SendGrid; not sent if empty
8. **Task: ExpireOldTenders** — scan `isExpired = false AND deadline < today`, batch update to true.

> **CDK note — `payloadResponseOnly` on `LambdaInvoke`:** Every `LambdaInvoke` task in the state machine uses `payloadResponseOnly: true`. The naive alternative — `outputPath: '$.Payload'` — fails when the task also sets `resultPath`: the `resultPath` nests the full wrapped Lambda invoke response (`{ ExecutedVersion, Payload, StatusCode, ... }`) under the result key, and `outputPath: '$.Payload'` then tries to find `Payload` at the root and finds nothing. `payloadResponseOnly: true` unwraps the Lambda's return value directly as the task output, which works correctly in all cases.

### Concurrency and rate limits

- Map state for normalize: MaxConcurrency 5 to avoid DDB write throttling on `intelligenceTable` (PAY_PER_REQUEST adapts quickly, but a soft cap also reduces SDK-level retry storms)
- Map state for LLM scoring: MaxConcurrency 10 to stay well under Bedrock per-account TPS
- All Lambdas use AWS SDK v3 client reuse (module-scope) for warm-start performance

### Inter-state payload handling

Fetch output is potentially large (5,000+ tenders × ~10KB each = 50MB) — far above the Step Functions 256KB inline payload limit. Resolution:

- Each `fetch-*` Lambda writes its normalized output to S3: `s3://tender-watch-raw/<execution-id>/<source>.json`
- Lambda return value is the S3 key reference
- Downstream Lambdas read from S3
- Lifecycle policy on bucket: delete objects older than 7 days

### Idempotency

All Lambdas must be idempotent:
- `fetch-*` writes use deterministic ids (`sam-<noticeId>`, etc.)
- `normalize-dedupe` uses conditional PutItem
- `match-with-llm` writes TenderProductMatch items (`PK = TENDER#<id>, SK = MATCH#<productSlug>`); repeat executions overwrite, not append
- `classify-and-store` is a pure update over existing records

## Lambda functions

| Lambda | Trigger | Primary deps | IAM (beyond defaults) |
|---|---|---|---|
| `fetch-sam` | Step Functions | axios | S3 PutObject on raw bucket |
| `fetch-ted` | Step Functions | axios | S3 PutObject on raw bucket |
| `fetch-uk` | Step Functions | axios | S3 PutObject on raw bucket |
| `normalize-dedupe` | Step Functions | SDK DynamoDB | DDB read/write on `intelligenceTable`; S3 GetObject |
| `prefilter-by-keyword` | Step Functions | SDK DynamoDB | DDB read on `intelligenceTable` |
| `match-with-llm` | Step Functions Map | Bedrock Runtime, Anthropic SDK | bedrock:InvokeModel, DDB read/write on `intelligenceTable` |
| `classify-and-store` | Step Functions | SDK DynamoDB | DDB read/write on `intelligenceTable` |
| `notify-high-priority` | Step Functions | fetch (built-in) | none (HTTPS only — SendGrid via `api.sendgrid.com`) |
| `notify-daily-digest` | Step Functions | fetch (built-in) | none (HTTPS only — SendGrid via `api.sendgrid.com`); DDB read on `intelligenceTable` |
| `expire-old-tenders` | Step Functions | SDK DynamoDB | DDB read/write on `intelligenceTable` |

### Source-specific details

**fetch-sam**
- Endpoint: `https://api.sam.gov/opportunities/v2/search` (no `/prod` segment)
- Params:
  - `api_key=<SAM_API_KEY>` — API key passed as query param (value injected as the `SAM_API_KEY` env var from an Amplify secret, set via `npx ampx sandbox secret set SAM_API_KEY` for sandbox and via Amplify Console for prod)
  - `postedFrom=<MM/dd/yyyy>` / `postedTo=<MM/dd/yyyy>` — date range with 2-day overlap window; format is `MM/dd/yyyy` URL-encoded (e.g. `04%2F10%2F2026`)
  - `active=true`
  - `ncode=334516,334519,333242,541380`
- Notice-type filtering: done client-side after fetch — keep records where `op.type === 'Solicitation'` or `op.type === 'Combined Synopsis/Solicitation'`; drop `Justification`, `Sources Sought`, etc.
- Pagination: loop until `totalRecords` exhausted (page size 1000 max)
- Response shape: `{ totalRecords, limit, offset, opportunitiesData: [...] }` — iterate `opportunitiesData`

**fetch-ted**
- Endpoint: `https://api.ted.europa.eu/v3/notices/search` (new host; note no `.0` minor version suffix)
- Method: POST with JSON body
- Body shape:
  ```json
  {
    "query": "(classification-cpv=\"38000000\" OR classification-cpv=\"38500000\" OR classification-cpv=\"38540000\" OR classification-cpv=\"31700000\") AND publication-date>=YYYYMMDD",
    "fields": ["publication-number", "notice-title", "publication-date", "classification-cpv", "buyer-name", "buyer-country", "description-proc", "deadline-receipt-tender-date-lot", "estimated-value-proc", "notice-type", "links"],
    "page": 1,
    "limit": 100
  }
  ```
  - Date in query is compact `YYYYMMDD` (no dashes)
  - The `fields` array must be non-empty; omitting it returns only minimal data
- Notice-type filtering: keep records where `notice-type` starts with `cn-` (open tender calls, e.g. `cn-standard`); drop `can-standard` (contract award notices) and other types
- Response field mapping to normalized schema:
  | TED field | Notes |
  |---|---|
  | `publication-number` | → `externalId` |
  | `notice-title` | multilingual map `{ eng: [strings], ... }` — prefer `eng[0]`, fall back to first available language |
  | `publication-date` | → `postedDate` |
  | `classification-cpv` | → `cpvCodes` |
  | `buyer-name` | multilingual map — prefer `eng[0]` |
  | `buyer-country` | 3-letter ISO array (e.g. `["DEU"]`) — convert to 2-letter for `country` |
  | `description-proc` | multilingual map — prefer `eng[0]` |
  | `deadline-receipt-tender-date-lot` | array — take first element → `deadline` |
  | `estimated-value-proc` | number → `estimatedValue.amount` (currency EUR assumed) |
  | `links` | multilingual map of URLs → `url` (prefer `eng`) |
- Multilingual: prefer English fields (`eng`) when available; otherwise keep original and tag `language`

**fetch-uk**
- Endpoint: `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages`
- Filter: `updatedFrom=today-2`, OCDS classification scheme = CPV (whitelisted as above)

**fetch-others** (Phase 3+)
- Placeholders. New sources are added as new Lambdas following the same output schema; Step Functions Parallel state gets a new branch.

### Normalized tender output schema

All `fetch-*` Lambdas emit this schema (validated by zod before S3 write):

```ts
{
  source: 'sam' | 'ted' | 'uk' | ...,
  externalId: string,
  url: string,
  title: string,
  agency: string,
  country: string,        // ISO 2-letter
  language: string,       // ISO 639-1
  description: string,
  estimatedValue?: { amount: number, currency: string },
  postedDate: string,     // ISO date
  deadline?: string,      // ISO date
  naicsCodes: string[],
  cpvCodes: string[],
  rawPayload: unknown,
}
```

### LLM prompt structure (match-with-llm)

System prompt:
> You are scoring how relevant a public procurement tender is to NineScrolls' product catalog. NineScrolls sells semiconductor and MEMS fabrication equipment. Score on a 0–100 scale where 0 means clearly unrelated and 100 means the tender is unambiguously asking for one of these exact products. Output JSON only.

User prompt:
- Tender title, agency, country
- Tender description (truncated to 4000 characters)
- A JSON list of active product categories with their slugs

Expected output:
```json
[
  { "category": "PECVD", "score": 87, "reasoning": "...", "matchedKeywords": ["plasma-enhanced", "thin film"] },
  { "category": "RIE-ICP", "score": 12, "reasoning": "...", "matchedKeywords": [] }
]
```

Matches with `score < 30` are dropped (no `MATCH#<slug>` item is written for them).

> **LLM output parsing note:** Bedrock Claude Haiku frequently wraps its JSON output in ` ```json … ``` ` code fences despite the "Output JSON only" instruction. The `match-with-llm` Lambda's parser strips an optional fence before calling `JSON.parse`, using the regex `/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i`. The Anthropic API fallback path uses the same parser.

## Admin UI

All pages live under `/admin/*`, reusing existing layout, navigation, and Amplify Auth.

### `/admin/tenders` — list page

- Default filters: `status NOT IN (not_relevant)` AND `isExpired = false`
- Default sort: `overallScore DESC, postedDate DESC`
- KPI cards: today's new / this week's new / unhandled high-priority / closing within 7 days
- Filters: status (multi), country (multi from distinct values), product category (multi), score slider, date range, `Include expired` toggle, `Include not_relevant` toggle, full-text search on title + agency
- Table columns: score (color-coded), title (truncated, hover full), agency, country (flag + code), deadline (days remaining + date), status (inline pill switcher), matched products (chips with `+N` overflow), actions
- Pagination 25/page (configurable), column sorting, bulk action (multi-select → batch status change or batch `not_relevant`), CSV export of current filter

### `/admin/tenders/:id` — detail page

- Header: title, agency, country, deadline countdown
- Status dropdown (`new → reviewing → pursuing → submitted → won|lost`) + status note textarea; status change writes a `TenderStatusLog` entry
- Separate `Mark not relevant` button (terminal state, requires confirmation)
- `Convert to RFQ` button — navigates to `/admin/rfq/new?fromTender=<id>`; RFQ create page reads tenderId and prefills agency name, country, product slugs (from matched products), estimated value
- Body: source URL (external link + copy), original description (long; collapsed by default), NAICS/CPV chips, posted/deadline/ingestion dates
- Match results: one card per `TenderProductMatch`, sorted by score DESC; each shows product link, score bar, matched keywords (chips), LLM reasoning (quote-styled)
- Audit log section: list of `TenderStatusLog` entries (who/when/from→to/note)

### `/admin/tenders/keywords` — configuration page

- Left: list of product categories from `TenderKeywordConfig`
- Right: detail panel for selected category — productCategory (immutable PK), linked product slugs (multiselect from Product table), keywords (tag input), synonyms, blacklist (with helper text on disambiguation), NAICS codes, CPV codes, `isActive` toggle
- Save action writes DDB + records `updatedBy` / `updatedAt` + shows "takes effect on next daily run" hint
- **Test match preview**: a textarea for pasting sample tender title + description, plus optional NAICS/CPV inputs. A `Test match` button invokes the `prefilter-by-keyword` Lambda directly (synchronously, via AppSync custom mutation) using the *current unsaved* form values, and shows whether the candidate would pass prefilter and which keywords/codes triggered. No LLM call (would be slow and would cost tokens during config iteration); LLM behavior is observed in production runs.

### Navigation integration

Existing admin nav (Analytics, Articles, New Article, Orders, RFQs) gets a new `Tenders` entry after RFQs. Final order by usage frequency: Analytics → RFQs → Tenders → Orders → Articles → New Article.

### Permissions

Reuses existing admin Cognito group. No sub-roles. Sub-admin role splitting is a later concern if salespeople need read-only access without keyword-config edit rights.

## Testing strategy

- **Unit tests** (vitest, matching existing `submit-rfq` handler test patterns):
  - `fetch-*`: mock axios; assert normalized output schema; load fixture API responses from `amplify/functions/fetch-*/fixtures/*.json`
  - `normalize-dedupe`: mock DDB; test hash algorithm + conditional PutItem behavior
  - `prefilter-by-keyword`: pure function over keyword config + tender; cover keyword match, synonym match, blacklist, NAICS whitelist, CPV whitelist
  - `match-with-llm`: mock Bedrock; verify JSON parsing of expected and malformed LLM output; verify fallback to Anthropic API on Bedrock failure
  - `notify-*`: mock `fetch` (global) for the SendGrid API call; assert request body subject and HTML template; assert no-send on empty input
- **Integration tests**: not in scope for MVP. Manual Step Functions trigger + CloudWatch verification used during phase 1 rollout.
- **Fixture data**: 5–10 real SAM.gov and TED responses stored under `amplify/functions/fetch-sam/fixtures/` and `amplify/functions/fetch-ted/fixtures/`.

## Observability and alerting

- Step Functions execution failure → EventBridge → SNS → email to `info@ninescrolls.com` (SNS subscription; note: pipeline notification emails use SendGrid, but SNS-triggered alarm emails go through SNS's own email transport)
- CloudWatch alarms:
  - Any Lambda 5xx > 1/day
  - `BedrockThrottlingException` > 5/day
  - Zero new tenders ingested for 7 consecutive days (data source schema change indicator)
- Debug capture: when `match-with-llm` fails JSON parse, raw output is written to `s3://tender-watch-debug/<execution-id>/<tenderId>.txt`
- CloudWatch metrics (phase 4 dashboard): `fetched_per_source`, `prefilter_pass_rate`, `llm_match_score_distribution`, `high_priority_count`, `notifications_sent`, `s3_staging_latency_ms` (time from `fetch-*` S3 write to next state's S3 read; surfaces when raw payloads grow large enough to slow the pipeline)

## Local-sandbox considerations

- **CloudFront alias conflict:** `cdn.ninescrolls.com` is a globally-unique CloudFront alias owned by the prod distribution. When running `npx ampx sandbox`, the sandbox's `insightsAssetsCdn` distribution must drop the `domainNames` + `certificate` props — otherwise the sandbox deploy fails because the alias is already in use. Detection: check `backend.stack.stackName.includes('-sandbox-')` in `amplify/backend.ts` and conditionally omit those props. In sandbox mode the distribution uses its default `*.cloudfront.net` URL; prod uses the custom domain. This pattern should be followed for any future CloudFront distributions that reference `cdn.ninescrolls.com`.

## Risks

1. **Keyword noise** — Acronym ambiguity (AFM = automated facial recognition; SEM = search engine marketing). Mitigation: blacklist + NAICS/CPV whitelists + LLM second-pass. Expect 1–2 weeks of tuning before signal:noise is stable.
2. **Data source schema drift** — Government APIs occasionally change shape. Mitigation: each fetch Lambda emits the same normalized schema, so a source change is contained.
3. **Bedrock throttling** — Default us-east-2 Haiku TPS limit is adequate but tight at peak. Mitigation: Map state MaxConcurrency caps; quota uplift available on request.
4. **Multilingual reasoning consistency** — TED tenders are often German/French/Italian/Spanish. Haiku handles multilingual input but score consistency may vary. Mitigation: prompt requires English reasoning output; `matchedKeywords` preserves original language.
5. **Amplify Gen 2 + Step Functions** — Not a heavily exercised pattern. Mitigation: validate state machine deployment in an isolated branch before merging to main.
6. **Legal / ToS** — All Phase 1–3 sources (SAM.gov, TED, Find a Tender) are public government APIs with ToS allowing programmatic access. Phase 4 additions must each be vetted before integration.

## Cost estimate (monthly, phase 1+2 at expected load)

| Item | Usage | Cost |
|---|---|---|
| Bedrock Haiku | ~100 LLM calls/day × 30 = 3,000/month × $0.002 | ~$6 |
| Lambda invocations | A few thousand/month, within free tier | $0 |
| DynamoDB | A few thousand items, on-demand | <$1 |
| Step Functions Standard | ~50 transitions/day × 30 = 1,500/month (free tier 4,000) | $0 |
| EventBridge | 1 rule | $0 |
| SendGrid | <100 emails/month (free tier) | $0 |
| S3 | ~500 MB raw payload staging (7-day lifecycle) | <$1 |
| CloudWatch | logs + a few alarms | <$2 |
| **Total** | | **~$10/month** |

Phase 3+ scales linearly with LLM calls; still under $30/month at 3× volume.

## Implementation phases

Detailed task breakdown to be produced by the implementation-plan skill. High-level phases:

1. **Phase 1 — Data pipeline + email (2–3 days)** — shared library code (key builders, hash, S3 staging, normalized tender schema), Step Functions state machine + IAM, 9 Lambdas, EventBridge cron, seed script for initial `TenderKeywordConfig` items into `intelligenceTable`, manual verification of email output. No UI, no AppSync changes.
2. **Phase 2 — Admin UI (2–3 days)** — list page, detail page, keyword configuration page (including the synchronous `Test match` preview backed by an AppSync custom mutation around `prefilter-by-keyword`), status log table, nav integration.
3. **Phase 3 — CRM hook + UK + additional sources (1–2 days)** — `Convert to RFQ` flow, `fetch-uk`, optional Canada/Australia/Singapore/Korea sources.
4. **Phase 4 — Tuning (ongoing)** — adjust keyword configs, refine LLM prompt, CloudWatch dashboard, optional debug-output cache.

## Out of scope (explicitly excluded)

- Slack / Teams / mobile push notifications
- Automated bid submission
- OCR / PDF attachment parsing
- Machine translation pipeline
- Sub-admin role splitting (read-only vs editor)
- China-domestic procurement portals
