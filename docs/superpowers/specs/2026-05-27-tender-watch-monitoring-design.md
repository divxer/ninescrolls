# Tender-Watch Monitoring (Phase A) — Design Spec

> **Status**: design — not yet implemented
> **Author**: brainstormed 2026-05-27 (Harvey + Claude)
> **Implements**: Approach A+ from the 2026-05-27 brainstorming session
> **Related specs**: [Phase 1 (tender-watch core)](./2026-05-14-tender-watch-design.md), [Phase 2 (admin UI)](./2026-05-15-tender-watch-phase-2-design.md)

## Goal

Give NineScrolls operations the minimum viable observability they need to (1) be alerted to silent failures of the daily tender-watch pipeline within ≤24h, and (2) answer "what happened in last night's run?" without digging through CloudWatch.

## Why now

Recent incidents motivated this work:

1. **fetch-sam silently returned `count=0` for 5 days** (May 2026, fixed in PR #154). No alerting layer existed; user discovered by manually checking the admin tender list and noticing the absence of new SAM RFPs.
2. **fetch-ted has the same structural risk** (PR #156 hardened the retry path but no monitoring).
3. **Three sources now exist** (sam/ted/calusource as of PR #157). Operational complexity is rising.

CloudWatch alone is insufficient because it only reports *infrastructure* failures (Lambda errors). It cannot detect *business-layer* degradations: zero records when the API succeeded, LLM quality drift, prefilter over-aggressive, etc.

## Scope: Phase A only

This spec defines **Phase A** only. Phase B (cross-run trend dashboards, anomaly detection on business metrics) and Phase C (per-source SLAs, LLM cost dashboards, auto-remediation) are explicitly **out of scope** but their data plumbing is pre-wired so Phase B alarms can be added in pure-Lambda-config changes, no schema or UI rework.

## Architecture overview

```
                             tender-watch-daily State Machine
                  ┌──────────────────────────────────────────────────────┐
                  │                                                      │
                  │  InjectExecutionId  (adds $.exec.executionId,        │
                  │       │              $.exec.startedAt)               │
                  │       ↓                                              │
                  │  Parallel: FetchAllSources                           │
                  │     ┌─ FetchSam ──── internal catch ─→ Pass {sam}    │
                  │     ├─ FetchTed ──── internal catch ─→ Pass {ted}    │
                  │     └─ FetchCalusource ─ internal catch ─→ Pass {cal}│
                  │       ↓ $.fetchResults always exists                 │
                  │  NormalizeDedupe ────────catch─→ RecordRunFailed     │
                  │       ↓                                              │
                  │  Prefilter ──────────────catch─→ RecordRunFailed     │
                  │       ↓                                              │
                  │  MatchMap ───────────────catch─→ RecordRunFailed     │
                  │       ↓                                              │
                  │  ClassifyAndStore ───────catch─→ RecordRunFailed     │
                  │       ↓                                              │
                  │  NotifyHighPriority ─────catch─→ NotifySawError      │
                  │       ↓                          │ (set              │
                  │  NotifyDailyDigest ──────catch─→ │  notificationStatus)
                  │       ↓                          ↓                   │
                  │  RecordRunComplete ←─────────────┘                   │
                  │  (status: SUCCESS | PARTIAL)                         │
                  └──────────────────────────────────────────────────────┘
                                            │
                                            ▼
                  ┌────────────────────────────────────────────────────┐
                  │     pipeline_run rows in IntelligenceTable          │
                  │  PK=RUN#<execId>  SK=SUMMARY                       │
                  │  PK=RUN#<execId>  SK=SOURCE#sam|ted|calusource     │
                  │  GSI4PK=PIPELINE_RUNS  GSI4SK=<startedAt>#<execId> │
                  │  (GSI4 only projects SUMMARY rows)                 │
                  └────────────────────────┬───────────────────────────┘
                                           │
       ┌───────────────────────────────────┼───────────────────────────┐
       │                                   │                           │
┌──────▼───────────┐  ┌────────────────────▼──────────┐  ┌─────────────▼─────────┐
│ tender-api       │  │ notify-pipeline-health Lambda │  │ Future business-layer │
│ +listPipelineRuns│  │ EventBridge daily 02:30 UTC   │  │ alarms (Phase B)      │
│ +getPipelineRun  │  │ 6 rules enabled (Phase A)     │  │ — code prewired, off  │
└──────┬───────────┘  │ 4 rules pre-wired, disabled   │  └───────────────────────┘
       │              │ → SES email on alerts          │
       │              └────────────────────────────────┘
       ▼ AppSync
┌────────────────────────────────────┐
│ /admin/tenders/runs        (list)  │
│ /admin/tenders/runs/:execId(detail)│
└────────────────────────────────────┘
```

### Five key architectural decisions

1. **Reuse IntelligenceTable single-table design.** No new DDB table. `pipeline_run` rows use `PK=RUN#<execId>` namespace. New GSI4 (partition `PIPELINE_RUNS`, sort `<startedAt>#<execId>`) for time-ordered list queries.
2. **Final-task pattern, not per-stage writes.** A single `RecordRunComplete` Lambda invocation at the end of the SF state machine reads all stage ResultPaths and writes all rows in one shot. Cheaper, atomic, and avoids partial state from per-stage writes failing.
3. **Two-tier catch.** Fetch-task failures are handled inside each fetch branch (returning `{source, fetched: 0, stagedKey: null, errorName, errorCause}`), allowing the pipeline to continue with `PARTIAL` status. Stage failures (Normalize/Prefilter/Match/Classify) route to `RecordRunFailed`, producing a `FAILED` status. Notification failures are a third tier — they record a `notificationStatus=FAILED` flag on the SUMMARY but the run itself is still `PARTIAL`/`SUCCESS`.
4. **Separate `notify-pipeline-health` Lambda.** Does not merge into the existing `notify-daily-digest` Lambda. Audience differs (sales reads digest; ops reads health), trigger conditions differ, and the email format differs.
5. **Phase C data pre-wired, alerts off.** SOURCE rows carry `prefilterPassRate`, `llmAvgScore`, `llmErrorCount`, `llmTimeoutCount`, `llmAttemptedCount`, `duplicateRate`, but the corresponding alarms are commented-out in `notify-pipeline-health/handler.ts`. Activating them is a 1-line uncomment plus an optional threshold env var, no schema change.

## Data model

### `PipelineRunSummary` row

```typescript
// PK = RUN#<execId>  SK = SUMMARY
interface PipelineRunSummary {
    PK: string;                          // "RUN#${execId}"
    SK: 'SUMMARY';
    GSI4PK: 'PIPELINE_RUNS';
    GSI4SK: string;                      // "${startedAt}#${execId}" — disambiguates concurrent starts
    entityType: 'PIPELINE_RUN_SUMMARY';
    executionId: string;
    stepFunctionExecutionArn: string;

    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    notificationStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL';
    notificationError: string | null;

    startedAt: string;                   // ISO8601
    endedAt: string;
    durationMs: number;

    sourcesAttempted: string[];          // ['sam', 'ted', 'calusource']
    sourcesSucceeded: string[];
    sourcesFailed: string[];             // sources with errorName/errorCause set

    // Funnel totals across all sources
    totalFetched: number;
    totalDedupedCandidates: number;      // tenders after dedupe (existed-or-new)
    totalNewTenders: number;             // tenders newly persisted this run
    totalPrefilterCandidates: number;
    totalScored: number;                 // tenders with ≥1 LLM match ≥ MIN_SCORE
    totalHighPriority: number;
    totalNotified: number;

    lastError: string | null;            // populated on FAILED; truncated to 1024 chars
    createdAt: string;
}
```

`status` semantics:
- `SUCCESS` — all sources fetched (even if 0 records) AND every downstream stage completed.
- `PARTIAL` — at least one source failed but the data pipeline ran to completion.
- `FAILED` — top-level catch fired (Normalize / Prefilter / Match / Classify exception).

`notificationStatus` semantics:
- `SUCCESS` — both notify-high-priority and notify-daily-digest ran without error.
- `FAILED` — one or both threw.
- `SKIPPED` — no HP tenders and no digest content (legitimate).
- `PARTIAL` — one succeeded, the other failed or skipped.

### `PipelineRunSource` row

```typescript
// PK = RUN#<execId>  SK = SOURCE#<sam|ted|calusource>
interface PipelineRunSource {
    PK: string;                          // "RUN#${execId}"
    SK: string;                          // "SOURCE#${source}"
    entityType: 'PIPELINE_RUN_SOURCE';
    executionId: string;
    source: 'sam' | 'ted' | 'calusource';

    status: 'SUCCESS' | 'FAILED';
    isPartial: boolean;                  // true if upstream pipeline failed mid-flight
    completedStages: string[];           // ['fetch'] | ['fetch','normalize'] | ... up to ['fetch','normalize','prefilter','match','classify','notify']

    startedAt: string;
    endedAt: string;
    durationMs: number;

    // Funnel counts — null (not 0) for stages that never ran on this run.
    fetched: number | null;
    normalized: number | null;
    prefilterCandidates: number | null;
    scored: number | null;
    highPriority: number | null;
    notified: number | null;

    // Phase C metrics — pre-wired, alerts disabled in Phase A
    prefilterPassRate: number | null;    // prefilterCandidates / normalized
    llmAttemptedCount: number | null;
    llmScoredCount: number | null;
    llmAvgScore: number | null;
    llmErrorCount: number | null;
    llmTimeoutCount: number | null;
    duplicateRate: number | null;        // (fetched - normalized) / fetched

    stagedKey: string | null;            // S3 key of raw fetch output (for replay/debug)
    errorName: string | null;
    errorCause: string | null;
    createdAt: string;
}
```

**Rule**: for any stage that never executed (because the pipeline failed before reaching it), the corresponding funnel field is `null`, not `0`. Consumers (UI, health alerts) display `—` for `null` to avoid the false impression that the stage processed zero records.

### GSI4

| GSI4PK | GSI4SK | Projects |
|---|---|---|
| `PIPELINE_RUNS` | `<startedAt>#<execId>` | SUMMARY rows only |

SOURCE rows are intentionally NOT projected to GSI4 — fetched only via base-table `Query` on `PK=RUN#<execId>` when needed.

### Query patterns

| Query | Implementation |
|---|---|
| List recent N runs | GSI4 query, `ScanIndexForward=false`, `Limit=N`, `KeyConditionExpression='GSI4PK = :pk'`. |
| Health check window (last 48h) | GSI4 query with `KeyConditionExpression='GSI4PK = :pk AND GSI4SK BETWEEN :lo AND :hi'`, `ScanIndexForward=false`, `Limit=10`. |
| Get one run with all sources | Base-table `Query` on `PK=RUN#<execId>`, returns SUMMARY + 3 SOURCE rows in one round-trip. |

## Step Function changes

### Inject startedAt

```typescript
const passInjectExecutionId = new Pass(stack, 'InjectExecutionId', {
    parameters: {
        'executionId.$': '$$.Execution.Name',
        'startedAt.$': '$$.Execution.StartTime',     // new — needed by RecordRun on failure paths
    },
    resultPath: '$.exec',
});
```

### Tier 1: per-fetch internal catch

Each fetch task gets a `Pass` node as its catch target. The Pass emits a structured object so downstream `RecordRunComplete` can identify which source failed without parsing strings:

```typescript
const fetchSamFailedPass = new Pass(stack, 'FetchSamFailedPass', {
    parameters: {
        source: 'sam',
        fetched: 0,
        stagedKey: null,
        errorName: JsonPath.stringAt('$.error.Error'),
        errorCause: JsonPath.stringAt('$.error.Cause'),
    },
});
fetchSamTask.addCatch(fetchSamFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

// Identical pattern for fetchTedTask + fetchCalusourceTask.
```

The result is that `$.fetchResults` always contains a 3-element array, even on partial failure. Downstream `sourcesFailed` is computed by `fetchResults.filter(r => r.errorName || r.errorCause).map(r => r.source)`.

### Tier 2: stage-level top catch → RecordRunFailed

```typescript
const recordRunFailedTask = new LambdaInvoke(stack, 'RecordRunFailed', {
    lambdaFunction: backend.recordPipelineRun.resources.lambda,
    payload: TaskInput.fromObject({
        kind: 'FAILED',
        executionId: JsonPath.stringAt('$.exec.executionId'),
        startedAt: JsonPath.stringAt('$.exec.startedAt'),
        endedAt: JsonPath.stringAt('$$.State.EnteredTime'),
        stepFunctionExecutionArn: JsonPath.stringAt('$$.Execution.Id'),
        errorName: JsonPath.stringAt('$.error.Error'),
        errorCause: JsonPath.stringAt('$.error.Cause'),
        // Best-effort: may be missing on early failures.
        partialFetchResults: JsonPath.objectAt('$.fetchResults'),
        partialNormalized: JsonPath.objectAt('$.normalized'),
        partialPrefilter: JsonPath.objectAt('$.prefilter'),
    }),
});

// Apply to data-pipeline stages only — NOT to fetchParallel (handled by tier 1)
// and NOT to notifyHpTask / notifyDigestTask (handled by tier 3).
[normalizeTask, prefilterTask, matchMap, classifyTask].forEach((t) => {
    t.addCatch(recordRunFailedTask, { errors: ['States.ALL'], resultPath: '$.error' });
});
```

The `record-pipeline-run` Lambda for the FAILED path is required to write the SUMMARY row even when every `partial*` field is missing — that's the hard guarantee. Only the SUMMARY row is guaranteed; SOURCE rows on the FAILED path are best-effort.

### Tier 3: notify catch (separate path, run still continues)

To allow the four-state `notificationStatus` (SUCCESS/FAILED/SKIPPED/PARTIAL) to be computed, the two notify Lambdas must each report their own outcome rather than throwing on "no content". Update their return signatures:

```typescript
// notify-high-priority/handler.ts and notify-daily-digest/handler.ts
interface NotifyResult {
    status: 'sent' | 'skipped';       // 'sent' when an email went out, 'skipped' when no content
    count: number;                     // 0 for 'skipped'
}
```

Each notify task is then independently catchable:

```typescript
const notifyHpFailedPass = new Pass(stack, 'NotifyHpFailedPass', {
    parameters: { status: 'failed', error: JsonPath.stringAt('$.error.Cause') },
});
const notifyDigestFailedPass = new Pass(stack, 'NotifyDigestFailedPass', {
    parameters: { status: 'failed', error: JsonPath.stringAt('$.error.Cause') },
});
notifyHpTask.addCatch(notifyHpFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });
notifyDigestTask.addCatch(notifyDigestFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

// Both branches converge at RecordRunComplete, carrying $.notifyHp and $.notifyDigest results.
```

`RecordRunComplete` reduces the two `NotifyResult` objects into `notificationStatus`:

| notifyHp.status | notifyDigest.status | → notificationStatus |
|---|---|---|
| sent | sent | SUCCESS |
| skipped | skipped | SKIPPED |
| sent | skipped (or vice versa) | SUCCESS (at least one email left the system; the other was a legitimate no-op) |
| failed | failed | FAILED |
| failed | sent / skipped (or vice versa) | PARTIAL |

`notificationError` carries the failure cause from whichever side failed (joined if both).

This means: data pipeline `SUCCESS` + notify `FAILED` still produces a SUMMARY with `status=SUCCESS, notificationStatus=FAILED`. Phase A health alert Rule 3 fires a WARNING for this case but does not classify the run as broken.

### Normal completion

```typescript
const recordRunCompleteTask = new LambdaInvoke(stack, 'RecordRunComplete', {
    lambdaFunction: backend.recordPipelineRun.resources.lambda,
    payload: TaskInput.fromObject({
        kind: 'COMPLETE',
        executionId: JsonPath.stringAt('$.exec.executionId'),
        startedAt: JsonPath.stringAt('$.exec.startedAt'),
        endedAt: JsonPath.stringAt('$$.State.EnteredTime'),
        stepFunctionExecutionArn: JsonPath.stringAt('$$.Execution.Id'),
        fetchResults: JsonPath.objectAt('$.fetchResults'),
        normalized: JsonPath.objectAt('$.normalized'),
        prefilter: JsonPath.objectAt('$.prefilter'),
        matches: JsonPath.objectAt('$.matches'),         // raw Map output; Lambda reduces internally
        classified: JsonPath.objectAt('$.classified'),
        notifyHp: JsonPath.objectAt('$.notifyHp'),               // {status, count} or {status:'failed', error}
        notifyDigest: JsonPath.objectAt('$.notifyDigest'),       // same shape
    }),
});
```

### Upstream Lambda output schema changes

| Lambda | Current output | Added |
|---|---|---|
| `normalize-dedupe` | `{ newTenderIds: string[] }` | `+ perSource: { [source]: { fetched, normalized, duplicates } }` |
| `prefilter-by-keyword` | `{ candidates, candidatesCount }` | `+ perSource: { [source]: { candidates } }` |
| `match-with-llm` (Map iterator) | `{ tenderId, matches: [...] }` | `+ source: string`, `+ attempted: 1`, `+ llmTimeout: boolean`, `+ llmError: boolean` |
| `classify-and-store` | `{ tendersUpdated, highPriorityTenderIds, digestTenderIds }` | unchanged |

The `record-pipeline-run` Lambda reduces `$.matches` itself (`groupBy(matches, 'source')`, compute `llmAttemptedCount`, `llmScoredCount`, `llmAvgScore`, `llmErrorCount`, `llmTimeoutCount` per source). Doing this in the Lambda rather than in Step Functions intrinsics keeps the SF state machine simpler.

## `record-pipeline-run` Lambda

```
amplify/functions/record-pipeline-run/
  handler.ts
  resource.ts
  package.json
  handler.test.ts
```

```typescript
export interface RecordEvent {
    kind: 'COMPLETE' | 'FAILED';
    executionId: string;
    startedAt: string;
    endedAt: string;
    stepFunctionExecutionArn: string;
    // COMPLETE
    fetchResults?: FetchOutput[];
    normalized?: { newTenderIds: string[]; perSource: PerSourceCounts };
    prefilter?: { candidates: PrefilterCandidate[]; perSource: PerSourceCounts };
    matches?: MatchResultExt[];          // pre-reduce
    classified?: { tendersUpdated: number; highPriorityTenderIds: string[]; digestTenderIds: string[] };
    notifyHp?: { status: 'sent' | 'skipped' | 'failed'; count?: number; error?: string };
    notifyDigest?: { status: 'sent' | 'skipped' | 'failed'; count?: number; error?: string };
    // FAILED
    errorName?: string;
    errorCause?: string;
    partialFetchResults?: unknown;
    partialNormalized?: unknown;
    partialPrefilter?: unknown;
}

export async function handler(event: RecordEvent): Promise<{ ok: true }> {
    // 1. Compute SUMMARY fields.
    // 2. Write SUMMARY row — this is the hard guarantee, runs first.
    // 3. Best-effort: write SOURCE rows. Wrapped in Promise.allSettled —
    //    a failure here must not propagate.
}
```

**Permissions**: `dynamodb:PutItem` on IntelligenceTable.
**Memory**: 256MB. **Timeout**: 60s.

## Admin UI

### Routes

```typescript
// src/routes.tsx
<Route path="/admin/tenders/runs" element={<TenderPipelineRunsPage />} />
<Route path="/admin/tenders/runs/:executionId" element={<TenderPipelineRunDetailPage />} />
```

`AdminLayout` sidebar adds a "Pipeline Runs" entry under the existing "Tender Watch" section.

### List page (`/admin/tenders/runs`)

Columns: Started (Pacific time) · Duration · Overall (SUCCESS/PARTIAL/FAILED + icon) · Sources (3 colored dots) · Fetched · HP · Notify (SUCCESS/FAILED/SKIPPED/PARTIAL).

Filters (client-side): status dropdown, last-N-days. Clicking a row navigates to detail.

Data loading: single `listPipelineRuns(limit: 100)` call on mount. Manual refresh button. No auto-refresh (runs are daily).

### Detail page (`/admin/tenders/runs/:executionId`)

Top: two summary cards — left lists overall + funnel totals, right lists notification status + failed sources + last error.

Middle: overall funnel rendered as a horizontal CSS bar chart. Stages: `fetched → deduped → newTenders → prefilterCandidates → scored → highPriority → notified`. Bar widths are `count / max * 100%`. No charting library introduced.

Below the overall funnel: three source cards (sam/ted/calusource) each showing:
- status pill + duration
- per-stage funnel counts (with `—` for null / unexecuted stages)
- LLM technical metrics: `attempted / scored / avgScore / errors / timeouts`
- `Completed stages: fetch → normalize → prefilter` line per-card (source-level partial state, per the explicit feedback in Section 4)
- error message if `status=FAILED`

Bottom: staged S3 keys (with copy-to-clipboard) and top-right link to AWS Step Functions console (`encodeURIComponent` the ARN to avoid `:` corruption in the deep link).

### AppSync API additions

```typescript
listPipelineRuns: a.query()
    .arguments({ limit: a.integer() })
    .returns(a.json())
    .authorization(allow => [allow.groups(['admin'])])
    .handler(a.handler.function(tenderApi)),

getPipelineRun: a.query()
    .arguments({ executionId: a.string().required() })
    .returns(a.json())
    .authorization(allow => [allow.groups(['admin'])])
    .handler(a.handler.function(tenderApi)),
```

In `tender-api/handler.ts`:
- `listPipelineRuns(limit)`: GSI4 query `ScanIndexForward=false, Limit=limit ?? 100`. Returns the raw SUMMARY rows array.
- `getPipelineRun(executionId)`: base-table `Query` on `PK=RUN#<execId>`. Returns `{ summary, sources }`.

The `status` filter parameter is intentionally deferred — clients filter client-side until volume warrants server-side.

## `notify-pipeline-health` Lambda

```
amplify/functions/notify-pipeline-health/
  handler.ts
  resource.ts
  package.json
  handler.test.ts
  fixtures/healthy-run.json
  fixtures/failed-run.json
  fixtures/silent-source-run.json
```

**Schedule**: EventBridge cron `cron(30 2 * * ? *)` — daily 02:30 UTC, 30 minutes after the pipeline cron.

**Permissions**:
- `dynamodb:Query` on IntelligenceTable + GSI4
- `dynamodb:BatchGetItem` for SOURCE rows
- `dynamodb:PutItem` / `dynamodb:GetItem` for idempotency markers
- `ses:SendEmail`

**Env**:
- `INTELLIGENCE_TABLE` (auto-injected)
- `ALERT_EMAIL_TO` default `info@ninescrolls.com`
- `ALERT_EMAIL_FROM` default `info@ninescrolls.com`
- `ZERO_FETCH_ALERT_SOURCES` default `sam,ted,calusource` — comma-separated allowlist for Rule 5

### Phase A: 6 enabled rules

| # | Level | Condition | Motivation |
|---|---|---|---|
| 1 | CRITICAL | No SUMMARY row in last 48h | Cron not firing / SF launch failure |
| 2 | CRITICAL | latest.status === 'FAILED' | Data pipeline broken |
| 3 | WARNING | latest.notificationStatus === 'FAILED' | Delivery layer broken, data already in DDB |
| 4 | CRITICAL | Same source in `sourcesFailed` of last 2 consecutive runs | Source API persistent regression |
| 5 | CRITICAL | source.status === 'SUCCESS' AND source.fetched === 0 AND source in `ZERO_FETCH_ALERT_SOURCES` | The fetch-sam regression class — silent zero |
| 6 | WARNING | sum(llmTimeoutCount across sources) > 0 | Bedrock throttling signal |

### Phase A: 4 pre-wired (commented-out) rules

```typescript
// PHASE C — DO NOT ENABLE until baseline is established (≥2 weeks of data)
//
// if (sourceRow.prefilterPassRate !== null && sourceRow.prefilterPassRate < 0.05)
//     → "Source X: prefilter pass rate <5% (keyword config likely too narrow)"
//
// if (sourceRow.llmAvgScore !== null && sourceRow.llmAvgScore < 20)
//     → "Source X: LLM avg score <20 (model drift or catalog mismatch)"
//
// if (sourceRow.duplicateRate !== null && sourceRow.duplicateRate > 0.5)
//     → "Source X: duplicate rate >50% (dedupe regression)"
//
// if (last7Runs.every(r => r.totalHighPriority === 0))
//     → "No high-priority tenders in 7 consecutive runs"
```

### Idempotency

Per-alert dedup so identical findings don't spam ops day after day. Key shape:

```
ALERT_SENT#<YYYY-MM-DD>#<ruleId>#<scope>
```

`scope` examples:
- Rule 1: `cron`
- Rule 2: `<executionId>`
- Rule 3: `<executionId>`
- Rule 4: `<source>` (so sam-2-day-fail and ted-2-day-fail are independent)
- Rule 5: `<source>` (so simultaneous sam=0 and ted=0 both alert)
- Rule 6: `bedrock`

DDB write with `ConditionExpression='attribute_not_exists(PK)'`. TTL 48h. If condition fails, the alert is suppressed for that day.

The combined-scope key prevents the failure mode where one source legitimately failing eats the alert slot for a different source failing on the same day.

### Email format

Plain text. Subject takes the most severe alert's level prefix:

- One+ CRITICAL → `[CRITICAL] tender-watch: <top message>`
- Only WARNING → `[WARNING] tender-watch: <top message>`
- No alerts → no email sent

Body includes:
- Header timestamp
- Latest run one-line summary with per-source counts
- All alerts as a bulleted list
- Last 5 runs as a compact table (latest first)
- Deep links: admin UI detail page + AWS SF console (with `encodeURIComponent` on the ARN)

Sample body:

```
Tender-watch health check — 2026-05-27 02:30 UTC

Latest run: a1b2c3d4-... (2026-05-27 02:00:14 UTC, status=PARTIAL, 2m 14s)
  sam:         ✅ fetched=11   normalized=9   prefilter=8  HP=2
  ted:         ❌ FAILED (timeout)
  calusource:  ✅ fetched=12   normalized=12  prefilter=2  HP=0

Alerts:
  🚨 CRITICAL — Source "ted" failed in 2 consecutive runs

Last 5 runs (latest first):
  2026-05-27 02:00  PARTIAL  fetched=23  HP=2  notify=OK
  2026-05-26 02:00  PARTIAL  fetched=24  HP=1  notify=OK
  2026-05-25 02:00  SUCCESS  fetched=147 HP=3  notify=OK
  2026-05-24 02:00  SUCCESS  fetched=158 HP=1  notify=OK
  2026-05-23 02:00  SUCCESS  fetched=135 HP=2  notify=OK

Details:
  Admin UI:   https://ninescrolls.com/admin/tenders/runs/a1b2c3d4-...
  SF Console: https://us-east-2.console.aws.amazon.com/states/...
```

## Testing strategy

### `record-pipeline-run` Lambda

- COMPLETE path: full happy-day fixture → SUMMARY + 3 SOURCE rows written, all fields correct
- COMPLETE path with `notifyHp.status='failed'` and `notifyDigest.status='sent'` → SUMMARY.notificationStatus=PARTIAL
- COMPLETE path with both notify statuses `'failed'` → SUMMARY.notificationStatus=FAILED
- COMPLETE path with both notify statuses `'skipped'` → SUMMARY.notificationStatus=SKIPPED
- COMPLETE path with one source failed → SUMMARY.status=PARTIAL, sourcesFailed=[that source]
- FAILED path with no partial data → SUMMARY only, status=FAILED, all funnel fields 0
- FAILED path with partialFetchResults present → SUMMARY + best-effort SOURCE rows with isPartial=true and null funnel fields beyond fetch
- FAILED path where SOURCE row write throws → SUMMARY still written, lambda returns ok

### `notify-pipeline-health` Lambda

- Empty `runs` query → CRITICAL Rule 1
- Healthy latest run, all sources fetched>0 → no alerts → no email
- Latest FAILED → CRITICAL Rule 2
- Latest SUCCESS, ted SOURCE row with status=SUCCESS and fetched=0 → CRITICAL Rule 5
- Two consecutive runs with sam in sourcesFailed → CRITICAL Rule 4
- Single run with sam failed → Rule 4 does NOT fire
- notificationStatus=FAILED → WARNING Rule 3
- llmTimeoutCount=5 → WARNING Rule 6
- Multiple alerts: email contains all, subject takes most severe
- Idempotency: second invocation same day with same alert set + same scope → no email sent
- Idempotency: simultaneous sam=0 + ted=0 → both alerts fire (different scopes)
- `ZERO_FETCH_ALERT_SOURCES` excludes a source → no Rule 5 alert for that source

### Step Function integration

- Manual trigger via `aws stepfunctions start-execution` after deploy
- Verify SUMMARY row appears in DDB with status=SUCCESS
- Verify 3 SOURCE rows appear
- Inject a forced fetch-ted failure (temporary env override) → verify status=PARTIAL, sourcesFailed=[ted]
- Inject a forced normalize-dedupe error → verify status=FAILED, lastError populated

## Implementation phasing (estimated 5 days)

| Phase | Deliverables | Days |
|---|---|---|
| 1 | New types + GSI4 schema in `amplify/data/resource.ts`, `pipeline-run-types.ts` | 0.5 |
| 2 | `record-pipeline-run` Lambda + unit tests | 1.0 |
| 3 | Three upstream Lambdas: add `perSource` to `normalize-dedupe` / `prefilter-by-keyword`; add `source/attempted/timeout` to `match-with-llm` output | 0.5 |
| 4 | Step Function changes in `backend.ts`: inject startedAt, three-tier catch, RecordRunComplete/Failed tasks | 1.0 |
| 5 | `notify-pipeline-health` Lambda + 10+ unit tests + EventBridge cron | 0.5 |
| 6 | AppSync API: `listPipelineRuns` + `getPipelineRun` in `data/resource.ts` and `tender-api/handler.ts` | 0.5 |
| 7 | React pages `TenderPipelineRunsPage` + `TenderPipelineRunDetailPage`, AdminLayout entry, CSS funnel | 1.5 |
| 8 | End-to-end deploy + manual SF trigger validation | 0.5 |

## Out of scope

- Phase B: cross-run trend charts, source-level pause/resume, anomaly detection on business metrics, threshold tuning UI.
- Phase C: per-source SLAs, LLM cost dashboards, auto-remediation, replay-from-S3 admin actions.
- Slack/Discord/webhook delivery (email only in Phase A).
- HTML email format (plain text only).
- Mobile-friendly UI (admin uses desktop).
- Multi-tenant isolation (single-tenant system).

## Open follow-ups (not blocking)

- After 2 weeks of baseline data, revisit the 4 commented Phase C rules and pick thresholds.
- If alert email volume becomes uncomfortable, add per-rule `mute` flags or a snooze UI.
- Consider mirroring critical metrics (total HP per day, source fetched counts) to CloudWatch Custom Metrics if a third-party Datadog/Grafana integration becomes useful for the broader team.
- Task #20 (CloudWatch alarm on count=0) is superseded by this design — close after Phase A ships.
