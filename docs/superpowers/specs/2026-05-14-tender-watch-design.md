# Tender Watch — Design Spec

**Date:** 2026-05-14
**Status:** Approved (pending implementation)
**Owner:** harvey@ninescrolls.com

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
   normalize-and-dedupe  (cross-source dedupe, write to Tender table)
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

Admin path: browser → AppSync (existing) → DynamoDB (Tender, TenderProductMatch, TenderKeywordConfig, TenderStatusLog)
```

### Reused infrastructure

- Bedrock Claude Haiku 4.5 (`us.anthropic.claude-haiku-4-5-20251001-v1:0`) — same model and region as `classify-org` Lambda; Anthropic API as fallback (same dual-provider pattern)
- SES (already used for RFQ notifications)
- AppSync + Amplify Auth (admin already wired)
- Existing `/admin/*` navigation and layout

### New infrastructure

- 4 DynamoDB tables (Tender, TenderProductMatch, TenderKeywordConfig, TenderStatusLog) defined in `amplify/data/resource.ts`
- Step Functions Standard state machine defined as a CDK construct inside `amplify/backend.ts`
- 10 Lambda functions under `amplify/functions/` (fetch-sam, fetch-ted, fetch-uk, normalize-dedupe, prefilter-by-keyword, match-with-llm, classify-and-store, notify-high-priority, notify-daily-digest, expire-old-tenders). Phase 1 ships all except `fetch-uk`, which is added in Phase 3.
- EventBridge rule (cron daily) → Step Functions
- S3 bucket `tender-watch-raw` for inter-state payload staging (raw fetch output is too large for Step Functions 256KB payload limit)

## Data model

All models added to `amplify/data/resource.ts` with `allow.authenticated()` for admin auth (matches existing admin model patterns).

### `Tender`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | Format: `sam-<noticeId>`, `ted-<docId>`, etc. Deterministic, idempotent across reruns. |
| `source` | enum | `sam` \| `ted` \| `uk` \| `canada` \| `australia` \| `singapore` \| `korea` \| ... |
| `sourceUrl` | string | Original public tender URL |
| `sourceTenderHash` | string | `sha256(title.lower().trim() + agency.lower() + (deadline || ''))` — cross-source dedupe key |
| `title` | string | |
| `agency` | string | Procuring agency name |
| `country` | string | ISO 3166-1 alpha-2 |
| `language` | string | ISO 639-1 (`en`, `de`, `fr`, ...) |
| `description` | string | Original description (may be long) |
| `estimatedValueUSD` | number? | Converted to USD via static rate table (refreshed quarterly); null if not provided by source |
| `estimatedValueOriginal` | string? | e.g. `"EUR 250000"` for reference |
| `postedDate` | AWSDate | When tender was published |
| `deadline` | AWSDate? | Bid submission deadline; null when source omits |
| `naicsCodes` | string[] | NAICS codes from source (US tenders) |
| `cpvCodes` | string[] | CPV codes from source (EU tenders) |
| `rawPayload` | AWSJSON | Original API response for debugging |
| `overallScore` | integer | 0–100, `max(matches.score)`. Maintained by `classify-and-store`. |
| `isHighPriority` | boolean | `overallScore >= 80` |
| `isExpired` | boolean | `deadline < today`; refreshed by `expire-old-tenders` |
| `status` | enum | `new` \| `reviewing` \| `pursuing` \| `submitted` \| `won` \| `lost` \| `not_relevant` |
| `statusNote` | string? | Free-text note set at last status change |
| `assignedTo` | string? | Admin email |
| `lastStatusChangedAt` | AWSDateTime? | |

Indexes:
- `byStatus + lastStatusChangedAt` (admin list default sort)
- `bySource + postedDate`
- `byScore + postedDate` (high-priority queries)
- `bySourceTenderHash` (dedupe lookup)

### `TenderProductMatch` (M:N association)

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | Deterministic: `${tenderId}-${productSlug}` for idempotency |
| `tenderId` | string (FK) | |
| `productSlug` | string | References `Product.slug` |
| `score` | integer | 0–100 for this single product match |
| `reasoning` | string | LLM explanation, shown in admin detail page |
| `matchedKeywords` | string[] | Keywords that triggered prefilter |

Indexes: `byTenderId`, `byProductSlug`

### `TenderKeywordConfig`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `productCategory` | string | Logical grouping: `PECVD`, `ALD`, `RIE-ICP`, `AFM`, `sputter`, `e-beam`, ... |
| `productSlugs` | string[] | Product slugs in this category |
| `keywords` | string[] | Primary keywords (OR-matched) |
| `synonyms` | string[] | Additional matchable terms |
| `blacklist` | string[] | Terms that exclude a candidate (handles ambiguity, e.g. `AFM = automated facial recognition`) |
| `naicsCodes` | string[] | NAICS whitelist for US sources |
| `cpvCodes` | string[] | CPV whitelist for EU sources |
| `isActive` | boolean | |
| `updatedBy` | string | Admin email |
| `updatedAt` | AWSDateTime | |

### `TenderStatusLog`

| Field | Type | Notes |
|---|---|---|
| `id` | string (PK) | |
| `tenderId` | string (FK) | |
| `fromStatus` | enum? | Null on first status set |
| `toStatus` | enum | |
| `changedBy` | string | Admin email |
| `changedAt` | AWSDateTime | |
| `note` | string? | |

Index: `byTenderId + changedAt`

### Existing `Product` table

Not modified. Linkage to tenders is via `TenderKeywordConfig.productSlugs`.

## Step Functions workflow

State machine name: `tender-watch-daily`.
Trigger: EventBridge cron `0 2 * * ? *` (02:00 UTC daily).

### State sequence

1. **Parallel: FetchAllSources** — one branch per source. Each branch has Retry (3× exponential backoff) and Catch that converts failure into `{ source, error, fetched: 0 }`. State succeeds even when individual sources fail.
2. **Map: NormalizeAndDedupe** — MaxConcurrency 5. Each item processes a batch of 50 raw tenders: compute `sourceTenderHash`, Query the `bySourceTenderHash` GSI; if a record already exists, skip; else PutItem with `attribute_not_exists(id)` condition (defensive against concurrent batches).
3. **Task: PrefilterByKeyword** — load all active `TenderKeywordConfig` into memory once; for each new tender, check NAICS/CPV whitelist OR keyword match (less blacklist). Output `{ candidates: [tenderId, ...] }`.
4. **Choice: HasCandidates?** — empty → Pass + End. Non-empty → continue.
5. **Map: LLMScoring** — MaxConcurrency 10. Each candidate calls `match-with-llm`. Retry on `BedrockThrottlingException` (3× backoff). On exhausted retry, Catch logs the failure to CloudWatch and leaves the tender scoreless; the next day's run will retry if the tender is still pre-deadline.
6. **Task: ClassifyAndStore** — compute `overallScore` per tender, update `isHighPriority`.
7. **Parallel: Notifications**
   - `notify-high-priority` — one email per high-priority tender (sequential, throttled to 5/s for SES)
   - `notify-daily-digest` — single HTML email of all new tenders today; not sent if empty
8. **Task: ExpireOldTenders** — scan `isExpired = false AND deadline < today`, batch update to true.

### Concurrency and rate limits

- Map state for normalize: MaxConcurrency 5 to avoid DDB write throttling on the Tender table
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
- `match-with-llm` writes `TenderProductMatch` with `${tenderId}-${productSlug}` id (overwrite, not append)
- `classify-and-store` is a pure update over existing records

## Lambda functions

| Lambda | Trigger | Primary deps | IAM (beyond defaults) |
|---|---|---|---|
| `fetch-sam` | Step Functions | axios, SDK SSM | SSM Parameter Store read (`/tender-watch/sam/api-key`), S3 PutObject on raw bucket |
| `fetch-ted` | Step Functions | axios | S3 PutObject on raw bucket |
| `fetch-uk` | Step Functions | axios | S3 PutObject on raw bucket |
| `normalize-dedupe` | Step Functions | SDK DynamoDB | DDB read/write on Tender table; S3 GetObject |
| `prefilter-by-keyword` | Step Functions | SDK DynamoDB | DDB read on TenderKeywordConfig and Tender |
| `match-with-llm` | Step Functions Map | Bedrock Runtime, Anthropic SDK | bedrock:InvokeModel, DDB read/write on Tender + TenderProductMatch, SSM read (`/tender-watch/anthropic/api-key`) |
| `classify-and-store` | Step Functions | SDK DynamoDB | DDB read/write on Tender + TenderProductMatch |
| `notify-high-priority` | Step Functions | SDK SES | ses:SendEmail |
| `notify-daily-digest` | Step Functions | SDK SES | ses:SendEmail; DDB read on Tender |
| `expire-old-tenders` | Step Functions | SDK DynamoDB | DDB read/write on Tender |

### Source-specific details

**fetch-sam**
- Endpoint: `https://api.sam.gov/prod/opportunities/v2/search`
- Params: `postedFrom=today-2 (with overlap window)`, `noticeType=Solicitation,Combined Synopsis/Solicitation`, `active=true`, `ncode=334516,334519,333242,541380`
- Pagination: loop until `totalRecords` exhausted (page size 1000 max)
- Auth: API key in header (stored in SSM)

**fetch-ted**
- Endpoint: `https://ted.europa.eu/api/v3.0/notices/search`
- Filter: `CPV~'38000000|38500000|38540000|31700000'`
- Multilingual: prefer English version when source provides multiple; otherwise keep original and tag `language`

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

Matches with `score < 30` are dropped (not written to `TenderProductMatch`).

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
  - `notify-*`: mock SES; assert subject and body templates; assert no-send on empty input
- **Integration tests**: not in scope for MVP. Manual Step Functions trigger + CloudWatch verification used during phase 1 rollout.
- **Fixture data**: 5–10 real SAM.gov and TED responses stored under `amplify/functions/fetch-sam/fixtures/` and `amplify/functions/fetch-ted/fixtures/`.

## Observability and alerting

- Step Functions execution failure → EventBridge → SNS → SES email to `info@ninescrolls.com`
- CloudWatch alarms:
  - Any Lambda 5xx > 1/day
  - `BedrockThrottlingException` > 5/day
  - Zero new tenders ingested for 7 consecutive days (data source schema change indicator)
- Debug capture: when `match-with-llm` fails JSON parse, raw output is written to `s3://tender-watch-debug/<execution-id>/<tenderId>.txt`
- CloudWatch metrics (phase 4 dashboard): `fetched_per_source`, `prefilter_pass_rate`, `llm_match_score_distribution`, `high_priority_count`, `notifications_sent`

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
| SES | <100 emails/month | $0 |
| S3 | ~500 MB raw payload staging (7-day lifecycle) | <$1 |
| CloudWatch | logs + a few alarms | <$2 |
| **Total** | | **~$10/month** |

Phase 3+ scales linearly with LLM calls; still under $30/month at 3× volume.

## Implementation phases

Detailed task breakdown to be produced by the implementation-plan skill. High-level phases:

1. **Phase 1 — Data pipeline + email (2–3 days)** — schema, Step Functions, 9 Lambdas, EventBridge cron, seed `TenderKeywordConfig` script, manual verification of email output. No UI.
2. **Phase 2 — Admin UI (2–3 days)** — list page, detail page, keyword configuration page, status log table, nav integration.
3. **Phase 3 — CRM hook + UK + additional sources (1–2 days)** — `Convert to RFQ` flow, `fetch-uk`, optional Canada/Australia/Singapore/Korea sources.
4. **Phase 4 — Tuning (ongoing)** — adjust keyword configs, refine LLM prompt, CloudWatch dashboard, optional debug-output cache.

## Out of scope (explicitly excluded)

- Slack / Teams / mobile push notifications
- Automated bid submission
- OCR / PDF attachment parsing
- Machine translation pipeline
- Sub-admin role splitting (read-only vs editor)
- China-domestic procurement portals
- "Test match" preview button in keyword config page (deferred to phase 4 if needed)
