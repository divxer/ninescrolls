# Tender-Watch Monitoring (Phase A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build pipeline-run observability for tender-watch so silent failures of the daily Step Function trigger ops alerts within ≤24h and an admin UI surfaces "what happened in last night's run?" without CloudWatch spelunking.

**Architecture:** Three-tier Step Function catch writes pipeline-run rows to IntelligenceTable (new GSI5 partition `PIPELINE_RUNS`). A daily health-check Lambda queries the table and emails ops on rule violations. A new admin page renders the list and per-run funnel.

**Tech Stack:** AWS Amplify Gen2 backend (CDK), DynamoDB single-table design, AWS Step Functions, AWS EventBridge, AWS SES (existing `info@ninescrolls.com` SMTP identity), Lambda (Node.js 22), Vitest, React 19, AppSync (GraphQL).

**Spec:** [`docs/superpowers/specs/2026-05-27-tender-watch-monitoring-design.md`](../specs/2026-05-27-tender-watch-monitoring-design.md)

**Pre-commit invariants for every task:**
- Run the task's specific test command and confirm it passes (TDD red→green→commit).
- Tasks that touch `amplify/backend.ts` MUST also run `npx tsc --noEmit -p .` before commit — silent CDK type errors don't surface in the vitest suite.
- Frontend tasks should follow existing admin styling (`mp-card`, `mp-table` if available in `src/styles/admin*.css`) rather than introducing new inline-style blocks. The inline styles shown in Task 12 are scaffolding — port to existing classes during the task if patterns exist.

---

## File-touch map

| File | Action | Responsibility |
|---|---|---|
| `amplify/lib/tender-watch/pipeline-run-types.ts` | **create** | `PipelineRunSummary` + `PipelineRunSource` interfaces, reduction helpers |
| `amplify/lib/tender-watch/pipeline-run-types.test.ts` | **create** | Unit tests for `reduceNotificationStatus` + key builders |
| `amplify/backend.ts` | **modify** | Add GSI5; register `recordPipelineRun` + `notifyPipelineHealth`; wire three-tier SF catch; EventBridge 02:30 cron |
| `amplify/functions/normalize-dedupe/handler.ts` | **modify** | Emit `perSource: { [src]: { fetched, normalized, duplicates } }` in result |
| `amplify/functions/normalize-dedupe/handler.test.ts` | **modify** | Assert `perSource` counts |
| `amplify/functions/prefilter-by-keyword/handler.ts` | **modify** | Emit `perSource: { [src]: { candidates } }` |
| `amplify/functions/prefilter-by-keyword/handler.test.ts` | **modify** | Assert `perSource` counts |
| `amplify/functions/match-with-llm/handler.ts` | **modify** | Add `source`, `attempted`, `llmTimeout`, `llmError` fields to `MatchResult` |
| `amplify/functions/match-with-llm/handler.test.ts` | **modify** | Assert new fields populated |
| `amplify/functions/notify-high-priority/handler.ts` | **modify** | Return `{ status: 'sent'\|'skipped'\|'failed', count, error? }` |
| `amplify/functions/notify-daily-digest/handler.ts` | **modify** | Same return shape |
| `amplify/functions/record-pipeline-run/handler.ts` | **create** | Writes SUMMARY + SOURCE rows |
| `amplify/functions/record-pipeline-run/handler.test.ts` | **create** | COMPLETE / FAILED / PARTIAL / notification-failure cases |
| `amplify/functions/record-pipeline-run/resource.ts` | **create** | Lambda definition |
| `amplify/functions/record-pipeline-run/package.json` | **create** | Dependencies |
| `amplify/functions/notify-pipeline-health/handler.ts` | **create** | 7 enabled rules + 4 disabled Phase C comments |
| `amplify/functions/notify-pipeline-health/handler.test.ts` | **create** | 11+ rule-coverage tests |
| `amplify/functions/notify-pipeline-health/resource.ts` | **create** | Lambda definition |
| `amplify/functions/notify-pipeline-health/package.json` | **create** | Dependencies |
| `amplify/data/resource.ts` | **modify** | Add `listPipelineRuns` + `getPipelineRun` queries |
| `amplify/functions/tender-api/handler.ts` | **modify** | Dispatch new fieldNames |
| `amplify/functions/tender-api/handler.test.ts` | **modify** | Tests for new fields |
| `src/pages/admin/TenderPipelineRunsPage.tsx` | **create** | List page |
| `src/pages/admin/TenderPipelineRunDetailPage.tsx` | **create** | Detail page |
| `src/pages/admin/pipelineRunFunnel.test.ts` | **create** | Unit tests for funnel reduction helper |
| `src/routes.tsx` | **modify** | Add two new admin routes |
| `src/components/admin/AdminLayout.tsx` | **modify** | Sidebar entry "Pipeline Runs" |

---

## Task 1: Pipeline-run types + reduction helpers

**Files:**
- Create: `amplify/lib/tender-watch/pipeline-run-types.ts`
- Create: `amplify/lib/tender-watch/pipeline-run-types.test.ts`

- [ ] **Step 1: Write the failing test for the notification-status reduction**

`amplify/lib/tender-watch/pipeline-run-types.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    reduceNotificationStatus,
    pipelineRunSummaryKey,
    pipelineRunSourceKey,
    pipelineRunGsi5Sk,
} from './pipeline-run-types';

describe('reduceNotificationStatus', () => {
    it('returns SUCCESS when both sent', () => {
        expect(reduceNotificationStatus({ status: 'sent' }, { status: 'sent' })).toEqual({ status: 'SUCCESS', error: null });
    });
    it('returns SUCCESS when one sent + one skipped (either order)', () => {
        expect(reduceNotificationStatus({ status: 'sent' }, { status: 'skipped' })).toEqual({ status: 'SUCCESS', error: null });
        expect(reduceNotificationStatus({ status: 'skipped' }, { status: 'sent' })).toEqual({ status: 'SUCCESS', error: null });
    });
    it('returns SKIPPED when both skipped', () => {
        expect(reduceNotificationStatus({ status: 'skipped' }, { status: 'skipped' })).toEqual({ status: 'SKIPPED', error: null });
    });
    it('returns PARTIAL when exactly one failed', () => {
        const result = reduceNotificationStatus({ status: 'failed', error: 'SES quota' }, { status: 'sent' });
        expect(result).toEqual({ status: 'PARTIAL', error: 'SES quota' });
    });
    it('returns PARTIAL when failed + skipped', () => {
        const result = reduceNotificationStatus({ status: 'failed', error: 'SES quota' }, { status: 'skipped' });
        expect(result).toEqual({ status: 'PARTIAL', error: 'SES quota' });
    });
    it('returns FAILED when both failed and joins errors', () => {
        const result = reduceNotificationStatus(
            { status: 'failed', error: 'HP throw' },
            { status: 'failed', error: 'Digest throw' },
        );
        expect(result.status).toBe('FAILED');
        expect(result.error).toContain('HP throw');
        expect(result.error).toContain('Digest throw');
    });
});

describe('key builders', () => {
    it('builds summary key', () => {
        expect(pipelineRunSummaryKey('abc-123')).toEqual({ PK: 'RUN#abc-123', SK: 'SUMMARY' });
    });
    it('builds source key', () => {
        expect(pipelineRunSourceKey('abc-123', 'sam')).toEqual({ PK: 'RUN#abc-123', SK: 'SOURCE#sam' });
    });
    it('builds GSI5SK from startedAt and execId', () => {
        expect(pipelineRunGsi5Sk('2026-05-27T02:00:00.000Z', 'abc-123')).toBe('2026-05-27T02:00:00.000Z#abc-123');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run amplify/lib/tender-watch/pipeline-run-types.test.ts
```

Expected: FAIL with `Cannot find module './pipeline-run-types'`.

- [ ] **Step 3: Create the types + helpers module**

`amplify/lib/tender-watch/pipeline-run-types.ts`:

```typescript
/**
 * Shapes and key builders for pipeline_run rows in IntelligenceTable.
 * Spec: docs/superpowers/specs/2026-05-27-tender-watch-monitoring-design.md
 */

export type TenderSource = 'sam' | 'ted' | 'calusource';

export interface NotifyOutcome {
    status: 'sent' | 'skipped' | 'failed';
    count?: number;
    error?: string;
}

export interface PipelineRunSummary {
    PK: string;                          // "RUN#${execId}"
    SK: 'SUMMARY';
    GSI5PK: 'PIPELINE_RUNS';
    GSI5SK: string;                      // "${startedAt}#${execId}"
    entityType: 'PIPELINE_RUN_SUMMARY';
    executionId: string;
    stepFunctionExecutionArn: string;

    status: 'SUCCESS' | 'PARTIAL' | 'FAILED';
    notificationStatus: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL';
    notificationError: string | null;

    startedAt: string;
    endedAt: string;
    durationMs: number;

    sourcesAttempted: TenderSource[];
    sourcesSucceeded: TenderSource[];
    sourcesFailed: TenderSource[];

    totalFetched: number;
    totalDedupedCandidates: number;
    totalNewTenders: number;
    totalPrefilterCandidates: number;
    totalScored: number;
    totalHighPriority: number;
    totalNotified: number;

    lastError: string | null;
    createdAt: string;
}

export interface PipelineRunSource {
    PK: string;                          // "RUN#${execId}"
    SK: string;                          // "SOURCE#${source}"
    entityType: 'PIPELINE_RUN_SOURCE';
    executionId: string;
    source: TenderSource;

    status: 'SUCCESS' | 'FAILED';
    isPartial: boolean;
    completedStages: ('fetch' | 'normalize' | 'prefilter' | 'match' | 'classify' | 'notify')[];

    startedAt: string;
    endedAt: string;
    durationMs: number;

    fetched: number | null;
    normalized: number | null;
    prefilterCandidates: number | null;
    scored: number | null;
    highPriority: number | null;
    notified: number | null;

    prefilterPassRate: number | null;
    llmAttemptedCount: number | null;
    llmScoredCount: number | null;
    llmAvgScore: number | null;
    llmErrorCount: number | null;
    llmTimeoutCount: number | null;
    duplicateRate: number | null;

    stagedKey: string | null;
    errorName: string | null;
    errorCause: string | null;
    createdAt: string;
}

export function pipelineRunSummaryKey(executionId: string): { PK: string; SK: 'SUMMARY' } {
    return { PK: `RUN#${executionId}`, SK: 'SUMMARY' };
}

export function pipelineRunSourceKey(executionId: string, source: TenderSource): { PK: string; SK: string } {
    return { PK: `RUN#${executionId}`, SK: `SOURCE#${source}` };
}

export function pipelineRunGsi5Sk(startedAt: string, executionId: string): string {
    return `${startedAt}#${executionId}`;
}

/**
 * Map two NotifyOutcome objects (from notify-high-priority and notify-daily-digest)
 * into a single notificationStatus + joined error message.
 *
 * Semantics (per spec):
 *   both sent / sent+skipped / skipped+sent → SUCCESS
 *   both skipped                            → SKIPPED
 *   exactly one failed                      → PARTIAL
 *   both failed                             → FAILED
 */
export function reduceNotificationStatus(
    hp: NotifyOutcome,
    digest: NotifyOutcome,
): { status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PARTIAL'; error: string | null } {
    const hpFailed = hp.status === 'failed';
    const digestFailed = digest.status === 'failed';

    if (hpFailed && digestFailed) {
        const err = [hp.error, digest.error].filter(Boolean).join(' | ');
        return { status: 'FAILED', error: err || 'both notifications failed' };
    }
    if (hpFailed || digestFailed) {
        const err = hp.error ?? digest.error ?? 'one notification failed';
        return { status: 'PARTIAL', error: err };
    }
    if (hp.status === 'skipped' && digest.status === 'skipped') {
        return { status: 'SKIPPED', error: null };
    }
    return { status: 'SUCCESS', error: null };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run amplify/lib/tender-watch/pipeline-run-types.test.ts
```

Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add amplify/lib/tender-watch/pipeline-run-types.ts amplify/lib/tender-watch/pipeline-run-types.test.ts
git commit -m "feat(tender-watch): add pipeline-run types + reduction helpers"
```

---

## Task 2: (deferred — folded into Task 8)

GSI5 creation is no longer a standalone task — it is added in the same backend.ts commit as the Step Function three-tier catch wiring (Task 8), because the index has no consumer until `notify-pipeline-health` (Task 9) and `tender-api` resolvers (Task 11) need it. Combining the two backend.ts touches reduces churn and avoids deploying a never-read GSI.

(The task numbers below preserve continuity with the original outline.)

---

## Task 3: normalize-dedupe emits perSource counts

**Files:**
- Modify: `amplify/functions/normalize-dedupe/handler.ts`
- Modify: `amplify/functions/normalize-dedupe/handler.test.ts`

- [ ] **Step 1: Write the failing test asserting `perSource` shape**

In `amplify/functions/normalize-dedupe/handler.test.ts`, add inside the existing `describe('normalize-dedupe handler', ...)` block:

```typescript
    it('emits perSource counts of fetched / normalized / duplicates', async () => {
        const samTender = makeTender({ source: 'sam', externalId: 'sam-1' });
        const tedTender = makeTender({ source: 'ted', externalId: 'ted-1' });
        const calTender = makeTender({ source: 'calusource', externalId: 'cal-1' });
        // Pre-seed an existing hash so ted-1 looks like a duplicate.
        const hash = hashFor(tedTender);
        ddbQueryMock.mockImplementation(async (cmd: any) => {
            if (cmd.input.ExpressionAttributeValues?.[':pk'] === `TENDER_HASH#${hash}`) {
                return { Items: [{ tenderId: 'ted-existing' }] };
            }
            return { Items: [] };
        });
        s3GetMock.mockImplementationOnce(async () => ({ Body: streamBody([samTender]) }))
                 .mockImplementationOnce(async () => ({ Body: streamBody([tedTender]) }))
                 .mockImplementationOnce(async () => ({ Body: streamBody([calTender]) }));

        const result = await handler({
            executionId: 'exec-ps-1',
            fetchOutputs: [
                { source: 'sam', stagedKey: 'k/sam', fetched: 1 },
                { source: 'ted', stagedKey: 'k/ted', fetched: 1 },
                { source: 'calusource', stagedKey: 'k/cal', fetched: 1 },
            ],
        });

        expect(result.perSource).toEqual({
            sam: { fetched: 1, normalized: 1, duplicates: 0 },
            ted: { fetched: 1, normalized: 0, duplicates: 1 },
            calusource: { fetched: 1, normalized: 1, duplicates: 0 },
        });
    });
```

Open the test file and locate the existing `makeTender` / `hashFor` / `streamBody` helpers — if they aren't there, copy them from a sibling test file (e.g., `fetch-sam/handler.test.ts`) or wire local minimal versions. If the existing test file lacks DDB query mocks, add them following the existing s3/ddb mock pattern at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run amplify/functions/normalize-dedupe/handler.test.ts
```

Expected: FAIL with `expected undefined to equal { sam: ... }` (perSource not yet emitted).

- [ ] **Step 3: Modify handler to track and emit perSource**

In `amplify/functions/normalize-dedupe/handler.ts`, change the `NormalizeDedupeResult` interface and the handler body:

```typescript
export interface NormalizeDedupePerSource {
    fetched: number;
    normalized: number;
    duplicates: number;
}

export interface NormalizeDedupeResult {
    newTenderIds: string[];
    skipped: number;
    perSource: Record<string, NormalizeDedupePerSource>;
}

export async function handler(event: NormalizeDedupeEvent): Promise<NormalizeDedupeResult> {
    const now = new Date().toISOString();
    const newTenderIds: string[] = [];
    let skipped = 0;
    const perSource: Record<string, NormalizeDedupePerSource> = {};

    for (const fo of event.fetchOutputs) {
        const src = fo.source;
        perSource[src] ??= { fetched: 0, normalized: 0, duplicates: 0 };
        perSource[src].fetched += fo.fetched;
        if (fo.fetched <= 0 || !fo.stagedKey) continue;

        const tenders = await loadStaged(fo.stagedKey);
        for (const t of tenders) {
            const hash = sourceTenderHash({ title: t.title, agency: t.agency, deadline: t.deadline });
            if (await hashExists(hash)) {
                skipped += 1;
                perSource[src].duplicates += 1;
                continue;
            }
            const item = buildItem(t, hash, now);
            try {
                await ddb.send(new PutCommand({
                    TableName: TABLE(),
                    Item: item,
                    ConditionExpression: 'attribute_not_exists(PK)',
                }));
                newTenderIds.push(item.tenderId);
                perSource[src].normalized += 1;
            } catch (err) {
                if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
                    skipped += 1;
                    perSource[src].duplicates += 1;
                } else {
                    throw err;
                }
            }
        }
    }

    console.log(JSON.stringify({ event: 'normalize-dedupe.done', newTenderIds: newTenderIds.length, skipped, perSource }));
    return { newTenderIds, skipped, perSource };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run amplify/functions/normalize-dedupe/handler.test.ts
```

Expected: PASS, all tests including the new `perSource` case.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/normalize-dedupe/handler.ts amplify/functions/normalize-dedupe/handler.test.ts
git commit -m "feat(normalize-dedupe): emit perSource fetched/normalized/duplicates"
```

---

## Task 4: prefilter-by-keyword emits perSource counts

**Files:**
- Modify: `amplify/functions/prefilter-by-keyword/handler.ts`
- Modify: `amplify/functions/prefilter-by-keyword/handler.test.ts`

- [ ] **Step 1: Write the failing test**

In `amplify/functions/prefilter-by-keyword/handler.test.ts`, add inside the existing describe block:

```typescript
    it('emits per-source candidate counts', async () => {
        // Two SAM tenders match a config; one TED tender matches; one calusource tender does not match.
        const tenderIds = ['sam-A', 'sam-B', 'ted-C', 'cal-D'];
        const tenders = [
            { tenderId: 'sam-A', source: 'sam',        title: 'ICP Etcher',           description: '', naicsCodes: ['333242'], cpvCodes: [] },
            { tenderId: 'sam-B', source: 'sam',        title: 'ALD System',            description: '', naicsCodes: ['334516'], cpvCodes: [] },
            { tenderId: 'ted-C', source: 'ted',        title: 'PVD Sputter',           description: '', naicsCodes: [],         cpvCodes: ['38540000'] },
            { tenderId: 'cal-D', source: 'calusource', title: 'Office Supplies',       description: '', naicsCodes: [],         cpvCodes: [] },
        ];
        // Stub the table BatchGet to return the 4 tenders, and the config loader to return one config.
        ddbBatchGetMock.mockResolvedValue({ Responses: { [TABLE]: tenders } });
        ddbQueryMock.mockResolvedValue({ Items: [makeConfig({
            productCategory: 'ALD',
            keywords: ['ald', 'icp', 'pvd'],
            naicsCodes: ['333242', '334516'],
            cpvCodes: ['38540000'],
        })] });

        const result = await handler({ newTenderIds: tenderIds });

        expect(result.candidates.length).toBe(3);
        expect(result.perSource).toEqual({
            sam: { candidates: 2 },
            ted: { candidates: 1 },
            calusource: { candidates: 0 },
        });
    });
```

If `ddbBatchGetMock` / `makeConfig` helpers don't exist, look at the existing `prefilter-by-keyword/handler.test.ts` for the mock pattern and either reuse or add minimal local versions.

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run amplify/functions/prefilter-by-keyword/handler.test.ts
```

Expected: FAIL — `perSource` undefined.

- [ ] **Step 3: Modify handler**

In `amplify/functions/prefilter-by-keyword/handler.ts`:

```typescript
export interface PrefilterPerSource {
    candidates: number;
}

export interface PrefilterResult {
    candidates: PrefilterCandidate[];
    candidatesCount: number;
    perSource: Record<string, PrefilterPerSource>;
}

export async function handler(event: PrefilterEvent): Promise<PrefilterResult> {
    const candidates: PrefilterCandidate[] = [];
    const perSource: Record<string, PrefilterPerSource> = {};
    if (event.newTenderIds.length === 0) {
        return { candidates: [], candidatesCount: 0, perSource };
    }
    const [tenders, configs] = await Promise.all([loadTenders(event.newTenderIds), loadActiveConfigs()]);
    for (const t of tenders) {
        const src = (t as any).source as string;
        perSource[src] ??= { candidates: 0 };
        const matchable: MatchableTender = {
            title: t.title,
            description: t.description ?? '',
            naicsCodes: t.naicsCodes ?? [],
            cpvCodes: t.cpvCodes ?? [],
        };
        const { matchedCategories, matchedKeywords } = matchesAnyConfig(matchable, configs);
        if (matchedCategories.length > 0) {
            candidates.push({
                tenderId: t.tenderId,
                matchedCategories,
                matchedKeywords,
            });
            perSource[src].candidates += 1;
        }
    }
    return { candidates, candidatesCount: candidates.length, perSource };
}
```

If `loadTenders` already exists and doesn't return a `source` field, expand its `ProjectionExpression` to include `source`.

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run amplify/functions/prefilter-by-keyword/handler.test.ts
```

Expected: PASS, all tests.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/prefilter-by-keyword/handler.ts amplify/functions/prefilter-by-keyword/handler.test.ts
git commit -m "feat(prefilter-by-keyword): emit perSource candidate counts"
```

---

## Task 5: match-with-llm carries source, attempted, llmTimeout, llmError

**Files:**
- Modify: `amplify/functions/match-with-llm/handler.ts`
- Modify: `amplify/functions/match-with-llm/handler.test.ts`

- [ ] **Step 1: Write the failing test**

In `amplify/functions/match-with-llm/handler.test.ts`, add:

```typescript
    it('returns source/attempted/llmTimeout/llmError fields on every call', async () => {
        ddbGetMock.mockResolvedValueOnce({ Item: {
            tenderId: 'sam-Z',
            source: 'sam',
            title: 'PECVD',
            description: '',
            naicsCodes: [],
            cpvCodes: [],
        }});
        ddbQueryMock.mockResolvedValueOnce({ Items: [makeConfig({ productCategory: 'PECVD' })] });
        bedrockInvokeMock.mockResolvedValueOnce({
            output: { message: { content: [{ text: '[{"category":"PECVD","score":92,"reasoning":"","matchedKeywords":[]}]' }] } },
        });

        const result = await handler({ tenderId: 'sam-Z' });
        expect(result.source).toBe('sam');
        expect(result.attempted).toBe(1);
        expect(result.llmTimeout).toBe(false);
        expect(result.llmError).toBe(false);
        expect(result.matches[0].score).toBe(92);
    });

    it('sets llmTimeout when Bedrock + Anthropic both AbortError', async () => {
        ddbGetMock.mockResolvedValueOnce({ Item: { tenderId: 'ted-Z', source: 'ted', title: 'X', description: '', naicsCodes: [], cpvCodes: [] }});
        ddbQueryMock.mockResolvedValueOnce({ Items: [] });
        bedrockInvokeMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        anthropicCreateMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));

        const result = await handler({ tenderId: 'ted-Z' });
        expect(result.llmTimeout).toBe(true);
        expect(result.llmError).toBe(false);
        expect(result.matches).toEqual([]);
    });

    it('sets llmError when Bedrock + Anthropic both fail with non-timeout error', async () => {
        ddbGetMock.mockResolvedValueOnce({ Item: { tenderId: 'cal-Z', source: 'calusource', title: 'X', description: '', naicsCodes: [], cpvCodes: [] }});
        ddbQueryMock.mockResolvedValueOnce({ Items: [] });
        bedrockInvokeMock.mockRejectedValueOnce(new Error('5xx'));
        anthropicCreateMock.mockRejectedValueOnce(new Error('5xx'));

        const result = await handler({ tenderId: 'cal-Z' });
        expect(result.llmError).toBe(true);
        expect(result.llmTimeout).toBe(false);
    });
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run amplify/functions/match-with-llm/handler.test.ts
```

Expected: FAIL — `result.source` and `result.attempted` undefined.

- [ ] **Step 3: Modify handler**

Update the `MatchResult` interface and handler in `amplify/functions/match-with-llm/handler.ts`:

```typescript
export interface MatchResult {
    tenderId: string;
    source: 'sam' | 'ted' | 'calusource' | string;       // copied from the tender record
    matches: { productSlug: string; productCategory: string; score: number }[];
    attempted: 0 | 1;                                     // always 1; 0 if tender not found
    llmTimeout: boolean;
    llmError: boolean;
    error?: string;
}

// ...

export async function handler(event: MatchEvent): Promise<MatchResult> {
    const tenderRes = await ddb.send(new GetCommand({ TableName: TABLE(), Key: tenderKey(event.tenderId) }));
    const tender = tenderRes.Item;
    if (!tender) {
        return { tenderId: event.tenderId, source: 'unknown', matches: [], attempted: 0, llmTimeout: false, llmError: false, error: 'tender not found' };
    }
    const source = (tender.source ?? 'unknown') as string;

    // ... existing config load + prompt build ...

    let bedrockErr: unknown = null;
    let anthropicErr: unknown = null;
    let llmOutput: LlmMatch[] = [];

    try {
        llmOutput = await callBedrock(prompt);
    } catch (err) {
        bedrockErr = err;
        try {
            llmOutput = await callAnthropic(prompt);
        } catch (err2) {
            anthropicErr = err2;
        }
    }

    const bothAborted = isAbort(bedrockErr) && isAbort(anthropicErr);
    const bothErrored = bedrockErr !== null && anthropicErr !== null;
    const llmTimeout = bothAborted;
    const llmError = bothErrored && !bothAborted;
    const matches: MatchResult['matches'] = [];

    if (!bothErrored) {
        // existing post-LLM logic that writes TENDER_MATCH rows and accumulates `matches`
        // (preserve all current behavior here)
    }

    return {
        tenderId: event.tenderId,
        source,
        matches,
        attempted: 1,
        llmTimeout,
        llmError,
        error: bothErrored ? String(anthropicErr ?? bedrockErr) : undefined,
    };
}

function isAbort(err: unknown): boolean {
    if (!err) return false;
    const name = (err as { name?: string }).name;
    const msg = (err as { message?: string }).message ?? '';
    return name === 'AbortError' || /abort|timeout/i.test(msg);
}
```

(The existing handler's "load tender from DDB" code is the entry; keep all existing match-writing logic inside the `if (!bothErrored)` block.)

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run amplify/functions/match-with-llm/handler.test.ts
```

Expected: PASS, all tests including the three new ones.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/match-with-llm/handler.ts amplify/functions/match-with-llm/handler.test.ts
git commit -m "feat(match-with-llm): carry source + attempted + llmTimeout + llmError"
```

---

## Task 6: notify-* Lambdas return the new outcome shape

**Files:**
- Modify: `amplify/functions/notify-high-priority/handler.ts`
- Modify: `amplify/functions/notify-daily-digest/handler.ts`
- Modify: `amplify/functions/notify-high-priority/handler.test.ts`
- Modify: `amplify/functions/notify-daily-digest/handler.test.ts`

- [ ] **Step 1: Write failing tests for notify-high-priority**

In `amplify/functions/notify-high-priority/handler.test.ts`, add:

```typescript
    it('returns {status:"skipped", count:0} when no HP tenders supplied', async () => {
        const result = await handler({ highPriorityTenderIds: [] });
        expect(result).toEqual({ status: 'skipped', count: 0 });
    });

    it('returns {status:"sent", count:N} on success', async () => {
        // ... existing setup that ends with a successful SES send for 2 tenders ...
        const result = await handler({ highPriorityTenderIds: ['t1', 't2'] });
        expect(result.status).toBe('sent');
        expect(result.count).toBe(2);
    });
```

Add similar tests in `amplify/functions/notify-daily-digest/handler.test.ts` for empty `digestTenderIds` → skipped, and non-empty → sent.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run amplify/functions/notify-high-priority/handler.test.ts amplify/functions/notify-daily-digest/handler.test.ts
```

Expected: FAIL — current return shape is `{ sent, failed }`.

- [ ] **Step 3: Modify both handlers**

In `amplify/functions/notify-high-priority/handler.ts`, replace `NotifyResult` and the handler return:

```typescript
export interface NotifyOutcome {
    status: 'sent' | 'skipped';
    count: number;     // tenders included in the email, NOT number of emails sent
}
export type NotifyResult = NotifyOutcome; // exported alias for backwards-compat with any importers

export async function handler(event: NotifyHighPriorityEvent): Promise<NotifyOutcome> {
    if (event.highPriorityTenderIds.length === 0) {
        return { status: 'skipped', count: 0 };
    }
    // The notify Lambdas each send ONE summary email containing all relevant tenders.
    // `count` reports how many tenders were included in that single email.
    // If the SES call throws, the SF catch (Task 8) sets notifyHp.status='failed' —
    // no partial-send accounting needed because there is only one SES call per Lambda.
    // ... existing logic that builds the summary email and calls SES once ...
    return { status: 'sent', count: event.highPriorityTenderIds.length };
}
```

In `amplify/functions/notify-daily-digest/handler.ts`, apply the analogous change with `digestTenderIds`.

For both Lambdas, if the single SES call throws, **let the throw propagate** — do not catch and swallow. The SF catch in Task 8 converts that into `status: 'failed'` via the Pass node. There is no partial-success state because the email is one atomic SES call containing the whole list.

**If the current Lambda implementation actually issues per-tender SES calls** (verify by reading the existing code first), refactor it to a single summary email before this change — otherwise the `count` semantics in the SUMMARY row become misleading and Phase B trend analysis breaks.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run amplify/functions/notify-high-priority/handler.test.ts amplify/functions/notify-daily-digest/handler.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add amplify/functions/notify-high-priority/ amplify/functions/notify-daily-digest/
git commit -m "feat(notify): return {status,count} outcome and throw on SES errors"
```

---

## Task 7: `record-pipeline-run` Lambda

**Files:**
- Create: `amplify/functions/record-pipeline-run/handler.ts`
- Create: `amplify/functions/record-pipeline-run/handler.test.ts`
- Create: `amplify/functions/record-pipeline-run/resource.ts`
- Create: `amplify/functions/record-pipeline-run/package.json`

- [ ] **Step 1: Write the failing test (COMPLETE path, SUCCESS)**

`amplify/functions/record-pipeline-run/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ddbPutMock = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: () => ({ send: (cmd: any) => ddbPutMock(cmd) }) },
    PutCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'Put', ...args })),
}));
vi.stubEnv('INTELLIGENCE_TABLE', 'IntelligenceTable-test');

beforeEach(() => { ddbPutMock.mockClear(); });

describe('record-pipeline-run', () => {
    it('writes SUMMARY + 3 SOURCE rows on COMPLETE happy path with both notifies sent', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-1',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:02:14.000Z',
            stepFunctionExecutionArn: 'arn:aws:states:us-east-2:1:execution:tw:exec-1',
            fetchResults: [
                { source: 'sam',        fetched: 11, stagedKey: 'k/sam' },
                { source: 'ted',        fetched: 124, stagedKey: 'k/ted' },
                { source: 'calusource', fetched: 12, stagedKey: 'k/cal' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {
                sam: { fetched: 11, normalized: 9, duplicates: 2 },
                ted: { fetched: 124, normalized: 100, duplicates: 24 },
                calusource: { fetched: 12, normalized: 12, duplicates: 0 },
            }},
            prefilter: { candidates: [], candidatesCount: 0, perSource: {
                sam: { candidates: 8 },
                ted: { candidates: 2 },
                calusource: { candidates: 2 },
            }},
            matches: [
                { tenderId: 't1', source: 'sam',        matches: [{ productSlug: 'rie-etcher', productCategory: 'RIE-ICP', score: 95 }], attempted: 1, llmTimeout: false, llmError: false },
                { tenderId: 't2', source: 'ted',        matches: [], attempted: 1, llmTimeout: false, llmError: false },
                { tenderId: 't3', source: 'calusource', matches: [], attempted: 1, llmTimeout: false, llmError: false },
            ],
            classified: { tendersUpdated: 1, highPriorityTenderIds: ['t1'], digestTenderIds: ['t1'] },
            notifyHp: { status: 'sent', count: 1 },
            notifyDigest: { status: 'sent', count: 1 },
        });

        // 1 SUMMARY + 3 SOURCE = 4 PutCommand calls
        expect(ddbPutMock).toHaveBeenCalledTimes(4);
        const items = ddbPutMock.mock.calls.map(c => c[0].Item);
        const summary = items.find(i => i.SK === 'SUMMARY');
        expect(summary.status).toBe('SUCCESS');
        expect(summary.notificationStatus).toBe('SUCCESS');
        expect(summary.GSI5PK).toBe('PIPELINE_RUNS');
        expect(summary.GSI5SK).toBe('2026-05-27T02:00:00.000Z#exec-1');
        expect(summary.totalFetched).toBe(147);
        expect(summary.totalHighPriority).toBe(1);

        const samRow = items.find(i => i.SK === 'SOURCE#sam');
        expect(samRow.fetched).toBe(11);
        expect(samRow.normalized).toBe(9);
        expect(samRow.prefilterCandidates).toBe(8);
        expect(samRow.llmAttemptedCount).toBe(1);
        expect(samRow.llmAvgScore).toBe(95);
        expect(samRow.completedStages).toEqual(['fetch','normalize','prefilter','match','classify','notify']);
        expect(samRow.notified).toBe(1);     // notify-hp.status=sent and sam has 1 HP
    });

    it('marks sources missing from fetchResults as failed (defensive)', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-miss',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            // Only 2 of 3 sources present — the third is implicitly failed.
            fetchResults: [
                { source: 'sam', fetched: 1, stagedKey: 'k' },
                { source: 'ted', fetched: 1, stagedKey: 'k' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });
        const summary = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SUMMARY');
        expect(summary.sourcesAttempted).toEqual(['sam', 'ted', 'calusource']);
        expect(summary.sourcesFailed).toContain('calusource');
        expect(summary.status).toBe('PARTIAL');
    });

    it('writes notified=null when fetch succeeded but notify failed', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-notify-failed',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 1, stagedKey: 'k' },
                { source: 'ted', fetched: 1, stagedKey: 'k' },
                { source: 'calusource', fetched: 1, stagedKey: 'k' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [
                { tenderId: 't1', source: 'sam', matches: [{ productSlug: 'x', productCategory: 'X', score: 90 }], attempted: 1, llmTimeout: false, llmError: false },
            ],
            classified: { tendersUpdated: 1, highPriorityTenderIds: ['t1'], digestTenderIds: ['t1'] },
            notifyHp: { status: 'failed', error: 'SES quota' },
            notifyDigest: { status: 'skipped' },
        });
        const samRow = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SOURCE#sam');
        expect(samRow.highPriority).toBe(1);
        expect(samRow.notified).toBeNull();
    });

    it('writes completedStages=[\"fetch\"] on a failed source', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-cs',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 0, stagedKey: null, errorName: 'Timeout', errorCause: 'after 30s' },
                { source: 'ted', fetched: 1, stagedKey: 'k' },
                { source: 'calusource', fetched: 1, stagedKey: 'k' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });
        const samRow = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SOURCE#sam');
        expect(samRow.completedStages).toEqual(['fetch']);
        expect(samRow.status).toBe('FAILED');
    });

    it('writes status=PARTIAL when one source failed', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-2',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [
                { source: 'sam', fetched: 11, stagedKey: 'k/sam' },
                { source: 'ted', fetched: 0, stagedKey: null, errorName: 'Timeout', errorCause: 'after 30s' },
                { source: 'calusource', fetched: 12, stagedKey: 'k/cal' },
            ],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });

        const summary = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SUMMARY');
        expect(summary.status).toBe('PARTIAL');
        expect(summary.sourcesFailed).toEqual(['ted']);
        expect(summary.sourcesSucceeded).toEqual(['sam', 'calusource']);
        expect(summary.notificationStatus).toBe('SKIPPED');
    });

    it('writes notificationStatus=PARTIAL when one notify failed and one sent', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-3',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [{ source: 'sam', fetched: 1, stagedKey: 'k' }],
            normalized: { newTenderIds: [], skipped: 0, perSource: {} },
            prefilter: { candidates: [], candidatesCount: 0, perSource: {} },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'failed', error: 'SES quota' },
            notifyDigest: { status: 'sent', count: 3 },
        });
        const summary = ddbPutMock.mock.calls.map(c => c[0].Item).find(i => i.SK === 'SUMMARY');
        expect(summary.notificationStatus).toBe('PARTIAL');
        expect(summary.notificationError).toContain('SES quota');
    });

    it('writes only SUMMARY (no SOURCE rows) on FAILED path', async () => {
        const { handler } = await import('./handler');
        await handler({
            kind: 'FAILED',
            executionId: 'exec-4',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:00:30.000Z',
            stepFunctionExecutionArn: 'arn:..',
            errorName: 'States.TaskFailed',
            errorCause: 'normalize-dedupe crashed',
        });
        expect(ddbPutMock).toHaveBeenCalledTimes(1);
        const summary = ddbPutMock.mock.calls[0][0].Item;
        expect(summary.SK).toBe('SUMMARY');
        expect(summary.status).toBe('FAILED');
        expect(summary.lastError).toContain('normalize-dedupe crashed');
        expect(summary.totalFetched).toBe(0);
    });

    it('still writes SUMMARY when SOURCE row writes all throw on COMPLETE', async () => {
        const { handler } = await import('./handler');
        // First call (SUMMARY) succeeds; subsequent (SOURCE) throw.
        ddbPutMock.mockResolvedValueOnce({}).mockRejectedValue(new Error('Throughput exceeded'));
        await handler({
            kind: 'COMPLETE',
            executionId: 'exec-5',
            startedAt: '2026-05-27T02:00:00.000Z',
            endedAt: '2026-05-27T02:01:00.000Z',
            stepFunctionExecutionArn: 'arn:..',
            fetchResults: [{ source: 'sam', fetched: 1, stagedKey: 'k' }],
            normalized: { newTenderIds: [], skipped: 0, perSource: { sam: { fetched: 1, normalized: 1, duplicates: 0 } } },
            prefilter: { candidates: [], candidatesCount: 0, perSource: { sam: { candidates: 0 } } },
            matches: [],
            classified: { tendersUpdated: 0, highPriorityTenderIds: [], digestTenderIds: [] },
            notifyHp: { status: 'skipped' },
            notifyDigest: { status: 'skipped' },
        });
        // SUMMARY (1 call succeeded) + 1 attempted SOURCE = 2 calls; lambda must not throw.
        expect(ddbPutMock).toHaveBeenCalled();
        const summary = ddbPutMock.mock.calls[0][0].Item;
        expect(summary.SK).toBe('SUMMARY');
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run amplify/functions/record-pipeline-run/handler.test.ts
```

Expected: FAIL with `Cannot find module './handler'`.

- [ ] **Step 3: Create the Lambda handler**

`amplify/functions/record-pipeline-run/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import {
    pipelineRunSummaryKey,
    pipelineRunSourceKey,
    pipelineRunGsi5Sk,
    reduceNotificationStatus,
    type PipelineRunSummary,
    type PipelineRunSource,
    type NotifyOutcome,
    type TenderSource,
} from '../../lib/tender-watch/pipeline-run-types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

type FetchOutputLike = {
    source: TenderSource;
    fetched: number;
    stagedKey: string | null;
    errorName?: string;
    errorCause?: string;
};

type MatchLike = {
    tenderId: string;
    source: string;
    matches: { productSlug: string; productCategory: string; score: number }[];
    attempted: 0 | 1;
    llmTimeout: boolean;
    llmError: boolean;
};

type NormalizePerSource = Record<string, { fetched: number; normalized: number; duplicates: number }>;
type PrefilterPerSource = Record<string, { candidates: number }>;

export interface RecordEvent {
    kind: 'COMPLETE' | 'FAILED';
    executionId: string;
    startedAt: string;
    endedAt: string;
    stepFunctionExecutionArn: string;
    fetchResults?: FetchOutputLike[];
    normalized?: { newTenderIds: string[]; skipped: number; perSource: NormalizePerSource };
    prefilter?: { candidates: unknown[]; candidatesCount: number; perSource: PrefilterPerSource };
    matches?: MatchLike[];
    classified?: { tendersUpdated: number; highPriorityTenderIds: string[]; digestTenderIds: string[] };
    notifyHp?: NotifyOutcome;
    notifyDigest?: NotifyOutcome;
    errorName?: string;
    errorCause?: string;
}

const ALL_SOURCES: TenderSource[] = ['sam', 'ted', 'calusource'];

function durationMs(startedAt: string, endedAt: string): number {
    return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

function avg(nums: number[]): number | null {
    if (nums.length === 0) return null;
    return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function safeDiv(num: number, den: number): number | null {
    if (den <= 0) return null;
    return num / den;
}

function buildFailedSummary(event: RecordEvent): PipelineRunSummary {
    const lastError = `${event.errorName ?? 'UnknownError'}: ${event.errorCause ?? ''}`.slice(0, 1024);
    return {
        ...pipelineRunSummaryKey(event.executionId),
        GSI5PK: 'PIPELINE_RUNS',
        GSI5SK: pipelineRunGsi5Sk(event.startedAt, event.executionId),
        entityType: 'PIPELINE_RUN_SUMMARY',
        executionId: event.executionId,
        stepFunctionExecutionArn: event.stepFunctionExecutionArn,
        status: 'FAILED',
        notificationStatus: 'SKIPPED',
        notificationError: null,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        durationMs: durationMs(event.startedAt, event.endedAt),
        sourcesAttempted: ALL_SOURCES,
        sourcesSucceeded: [],
        sourcesFailed: [],
        totalFetched: 0,
        totalDedupedCandidates: 0,
        totalNewTenders: 0,
        totalPrefilterCandidates: 0,
        totalScored: 0,
        totalHighPriority: 0,
        totalNotified: 0,
        lastError,
        createdAt: new Date().toISOString(),
    };
}

function buildCompleteSummary(event: RecordEvent): PipelineRunSummary {
    const fetchResults = event.fetchResults ?? [];
    // sourcesAttempted is a constant — the pipeline always tries all three sources
    // even if a fetch result is missing from the payload. Derived `sourcesFailed`
    // includes sources with explicit error AND sources absent from fetchResults.
    const sourcesAttempted = ALL_SOURCES;
    const reportedSources = new Set(fetchResults.map(r => r.source));
    const sourcesMissing = sourcesAttempted.filter(s => !reportedSources.has(s));
    const sourcesFailed = [
        ...fetchResults.filter(r => r.errorName || r.errorCause).map(r => r.source),
        ...sourcesMissing,
    ];
    const sourcesSucceeded = sourcesAttempted.filter(s => !sourcesFailed.includes(s));
    const status: 'SUCCESS' | 'PARTIAL' = sourcesFailed.length > 0 ? 'PARTIAL' : 'SUCCESS';

    const totalFetched = fetchResults.reduce((s, r) => s + (r.fetched ?? 0), 0);
    const totalDedupedCandidates = Object.values(event.normalized?.perSource ?? {})
        .reduce((s, r) => s + r.normalized + r.duplicates, 0);
    const totalNewTenders = event.normalized?.newTenderIds.length ?? 0;
    const totalPrefilterCandidates = event.prefilter?.candidatesCount ?? 0;
    const matches = event.matches ?? [];
    const totalScored = matches.filter(m => m.matches.length > 0).length;
    const totalHighPriority = event.classified?.highPriorityTenderIds.length ?? 0;
    const totalNotified = (event.notifyHp?.count ?? 0) + (event.notifyDigest?.count ?? 0);

    const notify = reduceNotificationStatus(
        event.notifyHp ?? { status: 'skipped' },
        event.notifyDigest ?? { status: 'skipped' },
    );

    return {
        ...pipelineRunSummaryKey(event.executionId),
        GSI5PK: 'PIPELINE_RUNS',
        GSI5SK: pipelineRunGsi5Sk(event.startedAt, event.executionId),
        entityType: 'PIPELINE_RUN_SUMMARY',
        executionId: event.executionId,
        stepFunctionExecutionArn: event.stepFunctionExecutionArn,
        status,
        notificationStatus: notify.status,
        notificationError: notify.error,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        durationMs: durationMs(event.startedAt, event.endedAt),
        sourcesAttempted,
        sourcesSucceeded,
        sourcesFailed,
        totalFetched,
        totalDedupedCandidates,
        totalNewTenders,
        totalPrefilterCandidates,
        totalScored,
        totalHighPriority,
        totalNotified,
        lastError: sourcesFailed.length > 0 ? fetchResults.find(r => r.errorCause)?.errorCause ?? null : null,
        createdAt: new Date().toISOString(),
    };
}

function buildSourceRow(event: RecordEvent, fr: FetchOutputLike, notifyHpSent: boolean): PipelineRunSource {
    const src = fr.source;
    const failed = !!(fr.errorName || fr.errorCause);
    const matchesForSrc = (event.matches ?? []).filter(m => m.source === src);
    const llmScores = matchesForSrc.flatMap(m => m.matches.map(x => x.score));
    const normalizedCounts = event.normalized?.perSource[src];
    const prefilterCounts = event.prefilter?.perSource[src];
    const scoredForSrc = matchesForSrc.filter(m => m.matches.length > 0).length;
    const hpForSrc = (event.classified?.highPriorityTenderIds ?? []).filter(id => {
        const m = matchesForSrc.find(x => x.tenderId === id);
        return m != null;
    }).length;

    // completedStages reflects what THIS source actually completed.
    //   failed fetch  → ['fetch']  (attempt was made; nothing downstream possible)
    //   success       → all six stages
    const completedStages: PipelineRunSource['completedStages'] =
        failed ? ['fetch'] : ['fetch', 'normalize', 'prefilter', 'match', 'classify', 'notify'];

    // notified is the count of THIS source's HP tenders that made it into the
    // notify-high-priority email. If notify failed or the source itself failed,
    // we cannot claim notification happened: null > 0 to keep Phase B charts honest.
    const notified: number | null = failed
        ? null
        : (notifyHpSent ? hpForSrc : null);

    return {
        ...pipelineRunSourceKey(event.executionId, src),
        entityType: 'PIPELINE_RUN_SOURCE',
        executionId: event.executionId,
        source: src,
        status: failed ? 'FAILED' : 'SUCCESS',
        isPartial: false,
        completedStages,
        startedAt: event.startedAt,
        endedAt: event.endedAt,
        durationMs: durationMs(event.startedAt, event.endedAt),
        fetched: fr.fetched ?? 0,
        normalized: normalizedCounts?.normalized ?? null,
        prefilterCandidates: prefilterCounts?.candidates ?? null,
        scored: failed ? null : scoredForSrc,
        highPriority: failed ? null : hpForSrc,
        notified,
        prefilterPassRate: safeDiv(prefilterCounts?.candidates ?? 0, normalizedCounts?.normalized ?? 0),
        llmAttemptedCount: matchesForSrc.length,
        llmScoredCount: scoredForSrc,
        llmAvgScore: avg(llmScores),
        llmErrorCount: matchesForSrc.filter(m => m.llmError).length,
        llmTimeoutCount: matchesForSrc.filter(m => m.llmTimeout).length,
        duplicateRate: safeDiv(normalizedCounts?.duplicates ?? 0, fr.fetched ?? 0),
        stagedKey: fr.stagedKey ?? null,
        errorName: fr.errorName ?? null,
        errorCause: fr.errorCause ?? null,
        createdAt: new Date().toISOString(),
    };
}

export async function handler(event: RecordEvent): Promise<{ ok: true }> {
    const summary = event.kind === 'FAILED' ? buildFailedSummary(event) : buildCompleteSummary(event);

    // Hard guarantee: SUMMARY first, errors propagate so SF marks the record task itself failed.
    await ddb.send(new PutCommand({ TableName: TABLE(), Item: summary }));

    if (event.kind === 'COMPLETE' && event.fetchResults) {
        const notifyHpSent = event.notifyHp?.status === 'sent';
        const writes = event.fetchResults.map(async (fr) => {
            try {
                await ddb.send(new PutCommand({
                    TableName: TABLE(),
                    Item: buildSourceRow(event, fr, notifyHpSent),
                }));
            } catch (err) {
                console.warn(JSON.stringify({
                    event: 'record-pipeline-run.source-row-failed',
                    source: fr.source,
                    error: err instanceof Error ? err.message : String(err),
                }));
            }
        });
        await Promise.allSettled(writes);
    }
    return { ok: true };
}
```

- [ ] **Step 4: Create the resource definition**

`amplify/functions/record-pipeline-run/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const recordPipelineRun = defineFunction({
    name: 'record-pipeline-run',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 60,
    memoryMB: 256,
});
```

- [ ] **Step 5: Create package.json**

`amplify/functions/record-pipeline-run/package.json`:

```json
{
    "name": "record-pipeline-run",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0"
    }
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
npx vitest run amplify/functions/record-pipeline-run/handler.test.ts
```

Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/record-pipeline-run/
git commit -m "feat(record-pipeline-run): Lambda writes SUMMARY + SOURCE rows"
```

---

## Task 8: Wire record-pipeline-run into backend.ts + three-tier Step Function catch

**Files:**
- Modify: `amplify/backend.ts`

- [ ] **Step 0: Add GSI5 to IntelligenceTable**

After the existing `GSI4` block (Phase 2 email-timeline index, around line 440), insert:

```typescript
// GSI5: Pipeline run history (operational logs, separate from domain data).
// SUMMARY rows populate GSI5PK/GSI5SK; SOURCE rows omit them so they never
// appear in the index. Used by notify-pipeline-health (Task 9) for the
// 24-48h health window and by tender-api (Task 11) for listPipelineRuns.
intelligenceTable.addGlobalSecondaryIndex({
    indexName: 'GSI5',
    partitionKey: { name: 'GSI5PK', type: AttributeType.STRING },
    sortKey: { name: 'GSI5SK', type: AttributeType.STRING },
    projectionType: ProjectionType.ALL,
});
```

- [ ] **Step 1: Import + register the new Lambda**

In `amplify/backend.ts`, near the other tender-watch imports (around line 26):

```typescript
import { recordPipelineRun } from './functions/record-pipeline-run/resource';
```

And add `recordPipelineRun` to the `defineBackend({...})` argument (the same block as `fetchSam`, `fetchTed`, etc.).

Also add `backend.recordPipelineRun` to the `tenderLambdas` array (so it gets the IntelligenceTable env + permissions).

- [ ] **Step 2: Add InjectExecutionId startedAt parameter**

Find the existing `passInjectExecutionId`:

```typescript
const passInjectExecutionId = new Pass(tenderWatchStack, 'InjectExecutionId', {
    parameters: { 'executionId.$': '$$.Execution.Name' },
    resultPath: '$.exec',
});
```

Add `startedAt`:

```typescript
const passInjectExecutionId = new Pass(tenderWatchStack, 'InjectExecutionId', {
    parameters: {
        'executionId.$': '$$.Execution.Name',
        'startedAt.$': '$$.Execution.StartTime',
    },
    resultPath: '$.exec',
});
```

- [ ] **Step 3: Add per-fetch internal catch Pass nodes**

After each `fetch*Task` declaration, add a failure Pass:

```typescript
const fetchSamFailedPass = new Pass(tenderWatchStack, 'FetchSamFailedPass', {
    parameters: {
        source: 'sam',
        fetched: 0,
        stagedKey: null,
        'errorName.$': '$.error.Error',
        'errorCause.$': '$.error.Cause',
    },
});
fetchSamTask.addCatch(fetchSamFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

const fetchTedFailedPass = new Pass(tenderWatchStack, 'FetchTedFailedPass', {
    parameters: {
        source: 'ted',
        fetched: 0,
        stagedKey: null,
        'errorName.$': '$.error.Error',
        'errorCause.$': '$.error.Cause',
    },
});
fetchTedTask.addCatch(fetchTedFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });

const fetchCalusourceFailedPass = new Pass(tenderWatchStack, 'FetchCalusourceFailedPass', {
    parameters: {
        source: 'calusource',
        fetched: 0,
        stagedKey: null,
        'errorName.$': '$.error.Error',
        'errorCause.$': '$.error.Cause',
    },
});
fetchCalusourceTask.addCatch(fetchCalusourceFailedPass, { errors: ['States.ALL'], resultPath: '$.error' });
```

- [ ] **Step 4: Add RecordRunComplete + RecordRunFailed tasks**

Below the existing `notifyDailyDigestTask` declaration:

```typescript
const recordRunCompleteTask = new LambdaInvoke(tenderWatchStack, 'RecordRunComplete', {
    lambdaFunction: backend.recordPipelineRun.resources.lambda,
    payload: TaskInput.fromObject({
        kind: 'COMPLETE',
        'executionId.$': '$.exec.executionId',
        'startedAt.$': '$.exec.startedAt',
        'endedAt.$': '$$.State.EnteredTime',
        'stepFunctionExecutionArn.$': '$$.Execution.Id',
        'fetchResults.$': '$.fetchResults',
        'normalized.$': '$.normalized',
        'prefilter.$': '$.prefilter',
        'matches.$': '$.matches',
        'classified.$': '$.classified',
        'notifyHp.$': '$.notifyHp',
        'notifyDigest.$': '$.notifyDigest',
    }),
    payloadResponseOnly: true,
});

const recordRunFailedTask = new LambdaInvoke(tenderWatchStack, 'RecordRunFailed', {
    lambdaFunction: backend.recordPipelineRun.resources.lambda,
    payload: TaskInput.fromObject({
        kind: 'FAILED',
        'executionId.$': '$.exec.executionId',
        'startedAt.$': '$.exec.startedAt',
        'endedAt.$': '$$.State.EnteredTime',
        'stepFunctionExecutionArn.$': '$$.Execution.Id',
        'errorName.$': '$.error.Error',
        'errorCause.$': '$.error.Cause',
    }),
    payloadResponseOnly: true,
});
```

- [ ] **Step 5: Configure per-task resultPath + tier-3 notify catches**

Find the existing `notifyHighPriorityTask` and `notifyDailyDigestTask` declarations and modify them to use `resultPath`:

```typescript
const notifyHighPriorityTask = new LambdaInvoke(tenderWatchStack, 'NotifyHighPriority', {
    lambdaFunction: backend.notifyHighPriority.resources.lambda,
    payload: TaskInput.fromObject({ 'highPriorityTenderIds.$': '$.classified.highPriorityTenderIds' }),
    payloadResponseOnly: true,
    resultPath: '$.notifyHp',
});

const notifyHpFailedPass = new Pass(tenderWatchStack, 'NotifyHpFailedPass', {
    parameters: {
        status: 'failed',
        'error.$': '$.notifyHpError.Cause',
    },
    resultPath: '$.notifyHp',
});
notifyHighPriorityTask.addCatch(notifyHpFailedPass, { errors: ['States.ALL'], resultPath: '$.notifyHpError' });

const notifyDailyDigestTask = new LambdaInvoke(tenderWatchStack, 'NotifyDailyDigest', {
    lambdaFunction: backend.notifyDailyDigest.resources.lambda,
    payload: TaskInput.fromObject({ 'digestTenderIds.$': '$.classified.digestTenderIds' }),
    payloadResponseOnly: true,
    resultPath: '$.notifyDigest',
});

const notifyDigestFailedPass = new Pass(tenderWatchStack, 'NotifyDigestFailedPass', {
    parameters: {
        status: 'failed',
        'error.$': '$.notifyDigestError.Cause',
    },
    resultPath: '$.notifyDigest',
});
notifyDailyDigestTask.addCatch(notifyDigestFailedPass, { errors: ['States.ALL'], resultPath: '$.notifyDigestError' });
```

- [ ] **Step 6: Wire tier-2 stage catches**

After the recordRunFailedTask is declared, attach catches to the data-pipeline stages:

```typescript
[normalizeTask, prefilterTask, matchMap, classifyTask].forEach((t) => {
    t.addCatch(recordRunFailedTask, { errors: ['States.ALL'], resultPath: '$.error' });
});
```

`matchMap` is the existing `Map` state for match-with-llm. Do NOT attach the catch to `fetchParallel` (tier-1 handles that) or to `notifyHighPriorityTask` / `notifyDailyDigestTask` (tier-3 handles those).

- [ ] **Step 7: Wire the success chain — and verify RecordRunFailed is terminal**

Find where the SF state machine's `.next(...)` chain currently ends (right after `notifyDailyDigestTask`). Append:

```typescript
notifyDailyDigestTask.next(recordRunCompleteTask);
notifyHpFailedPass.next(notifyDailyDigestTask);
notifyDigestFailedPass.next(recordRunCompleteTask);
// recordRunFailedTask is intentionally NOT chained — it is the terminal state on the
// FAILED path. Do not call .next() on it. CDK's chain-then-end semantics guarantee
// the state machine ends after a state with no transition. (Step Functions itself
// reaches a terminal state when no .next() is set.)
```

Sanity check the resulting ASL: after `cdk synth` or `amplify deploy`, the state machine should contain:

```
NotifyHighPriority (success) → NotifyDailyDigest
NotifyHighPriority (Catch[States.ALL]) → NotifyHpFailedPass
NotifyHpFailedPass → NotifyDailyDigest
NotifyDailyDigest (success) → RecordRunComplete
NotifyDailyDigest (Catch[States.ALL]) → NotifyDigestFailedPass
NotifyDigestFailedPass → RecordRunComplete
[NormalizeDedupe|Prefilter|MatchMap|ClassifyAndStore] (Catch[States.ALL]) → RecordRunFailed (End)
RecordRunComplete (End)
```

The Pass nodes' `resultPath: '$.notifyHp'` ensures both success and failure write to the same slot — `RecordRunComplete` Lambda then reads `$.notifyHp` uniformly without branching.

- [ ] **Step 8: Verify with tsc**

```bash
npx tsc --noEmit -p .
```

Expected: clean.

- [ ] **Step 9: Run amplify test suite**

```bash
npx vitest run amplify/
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add amplify/backend.ts
git commit -m "feat(tender-watch): three-tier catch + RecordRunComplete/Failed tasks"
```

---

## Task 9: `notify-pipeline-health` Lambda

**Files:**
- Create: `amplify/functions/notify-pipeline-health/handler.ts`
- Create: `amplify/functions/notify-pipeline-health/handler.test.ts`
- Create: `amplify/functions/notify-pipeline-health/resource.ts`
- Create: `amplify/functions/notify-pipeline-health/package.json`

- [ ] **Step 1: Write failing tests covering all rules**

`amplify/functions/notify-pipeline-health/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ddbQueryMock = vi.fn();
const ddbBatchGetMock = vi.fn();
const ddbPutMock = vi.fn().mockResolvedValue({});
const sesSendMock = vi.fn().mockResolvedValue({ MessageId: 'm1' });

vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: { from: () => ({
        send: (cmd: any) => {
            if (cmd.__cmd === 'Query') return ddbQueryMock(cmd);
            if (cmd.__cmd === 'BatchGet') return ddbBatchGetMock(cmd);
            if (cmd.__cmd === 'Put') return ddbPutMock(cmd);
            return Promise.resolve({});
        }
    }) },
    QueryCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'Query', input: args })),
    BatchGetCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'BatchGet', input: args })),
    PutCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'Put', ...args })),
}));
vi.mock('@aws-sdk/client-ses', () => ({
    SESClient: vi.fn().mockImplementation(() => ({ send: (cmd: any) => sesSendMock(cmd) })),
    SendEmailCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'SendEmail', ...args })),
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'IntelligenceTable-test');
vi.stubEnv('ALERT_EMAIL_TO', 'info@ninescrolls.com');
vi.stubEnv('ALERT_EMAIL_FROM', 'info@ninescrolls.com');
vi.stubEnv('ZERO_FETCH_ALERT_SOURCES', 'sam,ted,calusource');

beforeEach(() => {
    ddbQueryMock.mockReset();
    ddbBatchGetMock.mockReset();
    ddbPutMock.mockClear();
    sesSendMock.mockClear();
});

function summary(overrides: Partial<any> = {}): any {
    return {
        PK: 'RUN#' + (overrides.executionId ?? 'e'),
        SK: 'SUMMARY',
        executionId: overrides.executionId ?? 'e',
        startedAt: '2026-05-27T02:00:00.000Z',
        endedAt: '2026-05-27T02:02:00.000Z',
        durationMs: 120000,
        status: 'SUCCESS',
        notificationStatus: 'SUCCESS',
        notificationError: null,
        sourcesAttempted: ['sam', 'ted', 'calusource'],
        sourcesSucceeded: ['sam', 'ted', 'calusource'],
        sourcesFailed: [],
        totalFetched: 147,
        totalHighPriority: 0,
        ...overrides,
    };
}
function sourceRow(src: string, overrides: Partial<any> = {}): any {
    return {
        PK: 'RUN#e',
        SK: 'SOURCE#' + src,
        source: src,
        status: 'SUCCESS',
        fetched: 10,
        normalized: 10,
        prefilterCandidates: 0,
        scored: 0,
        highPriority: 0,
        llmAttemptedCount: 0,
        llmTimeoutCount: 0,
        llmErrorCount: 0,
        ...overrides,
    };
}

describe('notify-pipeline-health', () => {
    it('Rule 1: no run in 48h → CRITICAL email', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [] });
        const { handler } = await import('./handler');
        await handler({});
        expect(sesSendMock).toHaveBeenCalledTimes(1);
        const body = sesSendMock.mock.calls[0][0].Message.Body.Text.Data;
        expect(body).toMatch(/no pipeline run/i);
        const subject = sesSendMock.mock.calls[0][0].Message.Subject.Data;
        expect(subject).toMatch(/CRITICAL/);
    });

    it('Rule 2: latest FAILED → CRITICAL email', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary({ status: 'FAILED', lastError: 'normalize crash' })] });
        const { handler } = await import('./handler');
        await handler({});
        const body = sesSendMock.mock.calls[0][0].Message.Body.Text.Data;
        expect(body).toMatch(/FAILED/);
        expect(body).toMatch(/normalize crash/);
    });

    it('Rule 3: notificationStatus FAILED → WARNING email', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary({ notificationStatus: 'FAILED', notificationError: 'SES quota' })] });
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam', { fetched: 10 }),
            sourceRow('ted', { fetched: 10 }),
            sourceRow('calusource', { fetched: 10 }),
        ]}});
        const { handler } = await import('./handler');
        await handler({});
        const subject = sesSendMock.mock.calls[0][0].Message.Subject.Data;
        expect(subject).toMatch(/WARNING/);
        const body = sesSendMock.mock.calls[0][0].Message.Body.Text.Data;
        expect(body).toMatch(/Notification.*FAILED/i);
    });

    it('Rule 4: source failed in 2 consecutive runs → CRITICAL', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [
            summary({ executionId: 'e2', sourcesFailed: ['ted'] }),
            summary({ executionId: 'e1', sourcesFailed: ['ted'] }),
        ]});
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam'), sourceRow('ted', { status: 'FAILED', fetched: 0 }), sourceRow('calusource'),
        ]}});
        const { handler } = await import('./handler');
        await handler({});
        const body = sesSendMock.mock.calls[0][0].Message.Body.Text.Data;
        expect(body).toMatch(/ted.*2 consecutive/i);
    });

    it('Rule 5: source SUCCESS but fetched=0 → CRITICAL', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary()] });
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam'),
            sourceRow('ted', { fetched: 0 }),
            sourceRow('calusource'),
        ]}});
        const { handler } = await import('./handler');
        await handler({});
        const body = sesSendMock.mock.calls[0][0].Message.Body.Text.Data;
        expect(body).toMatch(/ted.*0 records/i);
    });

    it('Rule 5: source excluded via ZERO_FETCH_ALERT_SOURCES → no alert', async () => {
        vi.stubEnv('ZERO_FETCH_ALERT_SOURCES', 'sam,calusource'); // ted excluded
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary()] });
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam'), sourceRow('ted', { fetched: 0 }), sourceRow('calusource'),
        ]}});
        const { handler } = await import('./handler');
        await handler({});
        expect(sesSendMock).not.toHaveBeenCalled();
        vi.stubEnv('ZERO_FETCH_ALERT_SOURCES', 'sam,ted,calusource');
    });

    it('Rule 6: llmTimeoutCount > 0 → WARNING', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary()] });
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam', { llmTimeoutCount: 3 }), sourceRow('ted'), sourceRow('calusource'),
        ]}});
        const { handler } = await import('./handler');
        await handler({});
        const body = sesSendMock.mock.calls[0][0].Message.Body.Text.Data;
        expect(body).toMatch(/LLM timeouts/i);
    });

    it('Rule 7: SUMMARY present but source rows missing → WARNING', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary()] });
        // Only sam returned, ted+cal missing.
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam'),
        ]}});
        const { handler } = await import('./handler');
        await handler({});
        const body = sesSendMock.mock.calls[0][0].Message.Body.Text.Data;
        expect(body).toMatch(/missing SOURCE rows/i);
    });

    it('Healthy run → no email', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary()] });
        ddbBatchGetMock.mockResolvedValueOnce({ Responses: { 'IntelligenceTable-test': [
            sourceRow('sam'), sourceRow('ted'), sourceRow('calusource'),
        ]}});
        const { handler } = await import('./handler');
        await handler({});
        expect(sesSendMock).not.toHaveBeenCalled();
    });

    it('Idempotency: second invocation same day same scope → no email', async () => {
        ddbQueryMock.mockResolvedValue({ Items: [summary({ status: 'FAILED', lastError: 'crash' })] });
        // First PUT for idempotency succeeds; second throws ConditionalCheckFailed.
        ddbPutMock.mockResolvedValueOnce({}).mockRejectedValueOnce(Object.assign(new Error('cond'), { name: 'ConditionalCheckFailedException' }));
        const { handler } = await import('./handler');
        await handler({});
        await handler({});
        expect(sesSendMock).toHaveBeenCalledTimes(1);
    });

    it('Multiple alerts with mixed levels → subject takes most severe', async () => {
        ddbQueryMock.mockResolvedValueOnce({ Items: [summary({ status: 'FAILED', lastError: 'x', notificationStatus: 'FAILED' })] });
        // No BatchGet needed since latest is FAILED, but rule 3 still fires.
        const { handler } = await import('./handler');
        await handler({});
        const subject = sesSendMock.mock.calls[0][0].Message.Subject.Data;
        expect(subject).toMatch(/CRITICAL/);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run amplify/functions/notify-pipeline-health/handler.test.ts
```

Expected: FAIL with `Cannot find module './handler'`.

- [ ] **Step 3: Create the Lambda handler**

`amplify/functions/notify-pipeline-health/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import type { PipelineRunSummary, PipelineRunSource, TenderSource } from '../../lib/tender-watch/pipeline-run-types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESClient({});

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const ALERT_EMAIL_TO = () => process.env.ALERT_EMAIL_TO ?? 'info@ninescrolls.com';
const ALERT_EMAIL_FROM = () => process.env.ALERT_EMAIL_FROM ?? 'info@ninescrolls.com';
const ZERO_FETCH_ALERT_SOURCES = () =>
    (process.env.ZERO_FETCH_ALERT_SOURCES ?? 'sam,ted,calusource').split(',').map(s => s.trim()).filter(Boolean);

const ADMIN_BASE_URL = 'https://ninescrolls.com/admin/tenders/runs';
const SF_CONSOLE_BASE = 'https://us-east-2.console.aws.amazon.com/states/home?region=us-east-2#/v2/executions/details/';

interface Alert {
    level: 'CRITICAL' | 'WARNING';
    ruleId: string;
    scope: string;
    message: string;
}

export interface HealthEvent { /* EventBridge invocation — no payload needed */ }

async function fetchRecentSummaries(): Promise<PipelineRunSummary[]> {
    const now = new Date();
    const window48h = new Date(now.getTime() - 48 * 3600 * 1000);
    const res = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI5',
        KeyConditionExpression: 'GSI5PK = :pk AND GSI5SK BETWEEN :lo AND :hi',
        ExpressionAttributeValues: {
            ':pk': 'PIPELINE_RUNS',
            ':lo': `${window48h.toISOString()}#`,
            ':hi': `${now.toISOString()}#~`,
        },
        ScanIndexForward: false,
        Limit: 10,
    }));
    return (res.Items ?? []) as PipelineRunSummary[];
}

async function fetchSourceRows(executionId: string): Promise<PipelineRunSource[]> {
    const keys: TenderSource[] = ['sam', 'ted', 'calusource'];
    const res = await ddb.send(new BatchGetCommand({
        RequestItems: {
            [TABLE()]: {
                Keys: keys.map(s => ({ PK: `RUN#${executionId}`, SK: `SOURCE#${s}` })),
            },
        },
    }));
    return (res.Responses?.[TABLE()] ?? []) as PipelineRunSource[];
}

async function alreadySent(date: string, ruleId: string, scope: string): Promise<boolean> {
    try {
        await ddb.send(new PutCommand({
            TableName: TABLE(),
            Item: {
                PK: `ALERT_SENT#${date}`,
                SK: `${ruleId}#${scope}`,
                entityType: 'ALERT_SENT_MARKER',
                date,
                ruleId,
                scope,
                createdAt: new Date().toISOString(),
                TTL: Math.floor(Date.now() / 1000) + 48 * 3600,
            },
            ConditionExpression: 'attribute_not_exists(PK)',
        }));
        return false;
    } catch (err) {
        if ((err as { name?: string }).name === 'ConditionalCheckFailedException') return true;
        throw err;
    }
}

function evaluateRules(runs: PipelineRunSummary[], latestSources: PipelineRunSource[]): Alert[] {
    const alerts: Alert[] = [];
    if (runs.length === 0) {
        alerts.push({ level: 'CRITICAL', ruleId: 'rule-1', scope: 'cron', message: 'No pipeline run in last 48h — cron may not be firing' });
        return alerts;
    }
    const latest = runs[0];

    if (latest.status === 'FAILED') {
        alerts.push({
            level: 'CRITICAL',
            ruleId: 'rule-2',
            scope: latest.executionId,
            message: `Latest run ${latest.executionId} FAILED: ${latest.lastError ?? 'unknown'}`,
        });
    }
    if (latest.notificationStatus === 'FAILED' || latest.notificationStatus === 'PARTIAL') {
        alerts.push({
            level: 'WARNING',
            ruleId: 'rule-3',
            scope: latest.executionId,
            message: `Notification layer ${latest.notificationStatus} for run ${latest.executionId}: ${latest.notificationError ?? 'unknown'} (data already in DDB)`,
        });
    }
    // Rule 4: same source in sourcesFailed of last 2 runs
    if (runs.length >= 2) {
        for (const src of ['sam', 'ted', 'calusource'] as TenderSource[]) {
            const last2 = runs.slice(0, 2);
            if (last2.every(r => (r.sourcesFailed ?? []).includes(src))) {
                alerts.push({
                    level: 'CRITICAL',
                    ruleId: 'rule-4',
                    scope: src,
                    message: `Source "${src}" failed in 2 consecutive runs`,
                });
            }
        }
    }

    if (latest.status !== 'FAILED') {
        // Rule 7: SUMMARY present but some SOURCE rows missing
        const expectedSources = latest.sourcesAttempted ?? ['sam', 'ted', 'calusource'];
        if (latestSources.length < expectedSources.length) {
            alerts.push({
                level: 'WARNING',
                ruleId: 'rule-7',
                scope: latest.executionId,
                message: `Run ${latest.executionId} has SUMMARY but ${expectedSources.length - latestSources.length} SOURCE rows are missing — Rules 5/6 not fully evaluable`,
            });
        }
        const zeroAllowlist = ZERO_FETCH_ALERT_SOURCES();
        for (const sr of latestSources) {
            // Rule 5: zero-fetch silent regression
            if (sr.status === 'SUCCESS' && sr.fetched === 0 && zeroAllowlist.includes(sr.source)) {
                alerts.push({
                    level: 'CRITICAL',
                    ruleId: 'rule-5',
                    scope: sr.source,
                    message: `Source "${sr.source}" returned 0 records in latest run (likely upstream API regression)`,
                });
            }
        }
        // Rule 6: LLM timeouts
        const totalTimeouts = latestSources.reduce((s, sr) => s + (sr.llmTimeoutCount ?? 0), 0);
        if (totalTimeouts > 0) {
            alerts.push({
                level: 'WARNING',
                ruleId: 'rule-6',
                scope: 'bedrock',
                message: `${totalTimeouts} LLM timeouts in latest run — Bedrock may be throttled`,
            });
        }
    }

    // Phase C placeholders — DO NOT ENABLE until baseline established (≥2 weeks)
    //
    // for (const sr of latestSources) {
    //   if (sr.prefilterPassRate !== null && sr.prefilterPassRate < 0.05)
    //     alerts.push({ level:'WARNING', ruleId:'rule-c1', scope: sr.source,
    //                   message: `Source "${sr.source}" prefilter pass rate <5% (keyword config likely too narrow)` });
    //   if (sr.llmAvgScore !== null && sr.llmAvgScore < 20)
    //     alerts.push({ level:'WARNING', ruleId:'rule-c2', scope: sr.source,
    //                   message: `Source "${sr.source}" LLM avg score <20 (model drift or catalog mismatch)` });
    //   if (sr.duplicateRate !== null && sr.duplicateRate > 0.5)
    //     alerts.push({ level:'WARNING', ruleId:'rule-c3', scope: sr.source,
    //                   message: `Source "${sr.source}" duplicate rate >50% (dedupe regression)` });
    // }
    // const last7 = runs.slice(0, 7);
    // if (last7.length === 7 && last7.every(r => r.totalHighPriority === 0))
    //   alerts.push({ level:'WARNING', ruleId:'rule-c4', scope: 'hp-trend',
    //                 message: 'No high-priority tenders in 7 consecutive runs' });

    return alerts;
}

function topAlert(alerts: Alert[]): Alert {
    return alerts.find(a => a.level === 'CRITICAL') ?? alerts[0];
}

function buildEmail(runs: PipelineRunSummary[], latestSources: PipelineRunSource[], alerts: Alert[]): { subject: string; body: string } {
    const top = topAlert(alerts);
    const subject = `[${top.level}] tender-watch: ${top.message.slice(0, 90)}`;
    const latest = runs[0];
    const sourceLines = latestSources.map(sr =>
        `  ${sr.source.padEnd(12)} ${sr.status === 'SUCCESS' ? '✅' : '❌'} fetched=${sr.fetched ?? '—'}   normalized=${sr.normalized ?? '—'}   prefilter=${sr.prefilterCandidates ?? '—'}  HP=${sr.highPriority ?? '—'}`,
    ).join('\n');
    const alertLines = alerts.map(a => `  ${a.level === 'CRITICAL' ? '🚨 CRITICAL' : '⚠️  WARNING'} — ${a.message}`).join('\n');
    const last5Lines = runs.slice(0, 5).map(r =>
        `  ${r.startedAt}  ${r.status.padEnd(8)}  fetched=${r.totalFetched}  HP=${r.totalHighPriority}  notify=${r.notificationStatus}`,
    ).join('\n');
    const body = [
        `Tender-watch health check — ${new Date().toISOString()}`,
        '',
        latest ? `Latest run: ${latest.executionId} (${latest.startedAt}, status=${latest.status}, ${Math.round(latest.durationMs / 1000)}s)` : 'No recent runs.',
        sourceLines,
        '',
        'Alerts:',
        alertLines,
        '',
        'Last 5 runs (latest first):',
        last5Lines,
        '',
        'Details:',
        latest ? `  Admin UI:   ${ADMIN_BASE_URL}/${latest.executionId}` : '',
        latest ? `  SF Console: ${SF_CONSOLE_BASE}${encodeURIComponent(latest.stepFunctionExecutionArn)}` : '',
    ].filter(Boolean).join('\n');
    return { subject, body };
}

export async function handler(_event: HealthEvent): Promise<{ ok: true; alertsSent: number }> {
    const runs = await fetchRecentSummaries();
    const latestSources = runs[0] ? await fetchSourceRows(runs[0].executionId) : [];
    const alerts = evaluateRules(runs, latestSources);
    if (alerts.length === 0) return { ok: true, alertsSent: 0 };

    // De-duplicate: drop any alert already sent today (by ruleId#scope).
    const today = new Date().toISOString().slice(0, 10);
    const fresh: Alert[] = [];
    for (const a of alerts) {
        // eslint-disable-next-line no-await-in-loop
        const seen = await alreadySent(today, a.ruleId, a.scope);
        if (!seen) fresh.push(a);
    }
    if (fresh.length === 0) return { ok: true, alertsSent: 0 };

    const email = buildEmail(runs, latestSources, fresh);
    await ses.send(new SendEmailCommand({
        Source: ALERT_EMAIL_FROM(),
        Destination: { ToAddresses: [ALERT_EMAIL_TO()] },
        Message: {
            Subject: { Data: email.subject, Charset: 'UTF-8' },
            Body: { Text: { Data: email.body, Charset: 'UTF-8' } },
        },
    }));
    return { ok: true, alertsSent: fresh.length };
}
```

- [ ] **Step 4: Create the resource definition**

`amplify/functions/notify-pipeline-health/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const notifyPipelineHealth = defineFunction({
    name: 'notify-pipeline-health',
    entry: './handler.ts',
    runtime: 22,
    resourceGroupName: 'tender-watch-stack',
    timeoutSeconds: 60,
    memoryMB: 256,
});
```

- [ ] **Step 5: Create package.json**

`amplify/functions/notify-pipeline-health/package.json`:

```json
{
    "name": "notify-pipeline-health",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0",
        "@aws-sdk/client-ses": "^3.758.0"
    }
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run amplify/functions/notify-pipeline-health/handler.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/notify-pipeline-health/
git commit -m "feat(notify-pipeline-health): 7 enabled rules + Phase C placeholders + dedup"
```

---

## Task 10: Wire notify-pipeline-health into backend.ts + EventBridge cron

**Files:**
- Modify: `amplify/backend.ts`

- [ ] **Step 1: Import + register**

In `amplify/backend.ts`, near other tender-watch imports:

```typescript
import { notifyPipelineHealth } from './functions/notify-pipeline-health/resource';
```

Add `notifyPipelineHealth` to `defineBackend({...})` and to the `tenderLambdas` array.

- [ ] **Step 2: Grant SES SendEmail permission**

After the existing `match-with-llm` SES permission grant (or alongside it), add:

```typescript
backend.notifyPipelineHealth.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['ses:SendEmail', 'ses:SendRawEmail'],
    resources: ['*'],
}));
```

- [ ] **Step 3: Configure env vars**

```typescript
backend.notifyPipelineHealth.addEnvironment('ALERT_EMAIL_TO', 'info@ninescrolls.com');
backend.notifyPipelineHealth.addEnvironment('ALERT_EMAIL_FROM', 'info@ninescrolls.com');
backend.notifyPipelineHealth.addEnvironment('ZERO_FETCH_ALERT_SOURCES', 'sam,ted,calusource');
```

- [ ] **Step 4: EventBridge daily 02:30 UTC rule**

Below the existing `tender-watch-daily` schedule rule:

```typescript
new Rule(tenderWatchStack, 'PipelineHealthCheckRule', {
    schedule: Schedule.cron({ minute: '30', hour: '2', day: '*', month: '*', year: '*' }),
    targets: [new LambdaFunctionTarget(backend.notifyPipelineHealth.resources.lambda)],
});
```

If `LambdaFunctionTarget` isn't already imported, add `import { LambdaFunction as LambdaFunctionTarget } from 'aws-cdk-lib/aws-events-targets';` (or use whatever import the existing daily rule uses).

- [ ] **Step 5: tsc + tests**

```bash
npx tsc --noEmit -p . && npx vitest run amplify/
```

Expected: clean + green.

- [ ] **Step 6: Commit**

```bash
git add amplify/backend.ts
git commit -m "feat(tender-watch): wire notify-pipeline-health + 02:30 UTC EventBridge cron"
```

---

## Task 11: AppSync API: listPipelineRuns + getPipelineRun

**Files:**
- Modify: `amplify/data/resource.ts`
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

- [ ] **Step 1: Write the failing test in tender-api**

In `amplify/functions/tender-api/handler.test.ts`, add:

```typescript
    describe('listPipelineRuns', () => {
        it('queries GSI5 with PIPELINE_RUNS partition, latest-first, default limit 100', async () => {
            ddbQueryMock.mockResolvedValueOnce({ Items: [{ executionId: 'e1' }, { executionId: 'e2' }] });
            const result = await dispatchFieldName('listPipelineRuns', { arguments: {} } as any, ADMIN_IDENTITY);
            expect(ddbQueryMock).toHaveBeenCalledWith(expect.objectContaining({
                input: expect.objectContaining({
                    IndexName: 'GSI5',
                    KeyConditionExpression: 'GSI5PK = :pk',
                    ScanIndexForward: false,
                    Limit: 100,
                }),
            }));
            expect(result).toEqual([{ executionId: 'e1' }, { executionId: 'e2' }]);
        });

        it('respects custom limit', async () => {
            ddbQueryMock.mockResolvedValueOnce({ Items: [] });
            await dispatchFieldName('listPipelineRuns', { arguments: { limit: 20 } } as any, ADMIN_IDENTITY);
            expect(ddbQueryMock).toHaveBeenCalledWith(expect.objectContaining({
                input: expect.objectContaining({ Limit: 20 }),
            }));
        });
    });

    describe('getPipelineRun', () => {
        it('queries base table by PK=RUN#<execId>, returns summary + sources', async () => {
            ddbQueryMock.mockResolvedValueOnce({ Items: [
                { SK: 'SUMMARY', executionId: 'e1', status: 'SUCCESS' },
                { SK: 'SOURCE#sam', source: 'sam', fetched: 10 },
                { SK: 'SOURCE#ted', source: 'ted', fetched: 20 },
                { SK: 'SOURCE#calusource', source: 'calusource', fetched: 30 },
            ]});
            const result = await dispatchFieldName('getPipelineRun', { arguments: { executionId: 'e1' } } as any, ADMIN_IDENTITY);
            expect(result.summary.executionId).toBe('e1');
            expect(result.sources).toHaveLength(3);
        });

        it('returns null summary when run not found', async () => {
            ddbQueryMock.mockResolvedValueOnce({ Items: [] });
            const result = await dispatchFieldName('getPipelineRun', { arguments: { executionId: 'no-such' } } as any, ADMIN_IDENTITY);
            expect(result.summary).toBeNull();
            expect(result.sources).toEqual([]);
        });
    });
```

(Use whatever `ADMIN_IDENTITY` constant the existing tests use to indicate an admin caller. If not present, write a minimal stub.)

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run amplify/functions/tender-api/handler.test.ts
```

Expected: FAIL with `Unknown fieldName: listPipelineRuns`.

- [ ] **Step 3: Add resolver branches in tender-api**

In `amplify/functions/tender-api/handler.ts`, add to the `switch (fieldName)` dispatch:

```typescript
        case 'listPipelineRuns':
            requireAdmin(identity);
            return listPipelineRuns(event.arguments);
        case 'getPipelineRun':
            requireAdmin(identity);
            return getPipelineRun(event.arguments);
```

And the helper functions (near the bottom of the file before `export { ... }`):

```typescript
export interface ListPipelineRunsArgs { limit?: number; }
export async function listPipelineRuns(args: ListPipelineRunsArgs) {
    const res = await ddb.send(new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI5',
        KeyConditionExpression: 'GSI5PK = :pk',
        ExpressionAttributeValues: { ':pk': 'PIPELINE_RUNS' },
        ScanIndexForward: false,
        Limit: args.limit ?? 100,
    }));
    return res.Items ?? [];
}

export interface GetPipelineRunArgs { executionId: string; }
export async function getPipelineRun(args: GetPipelineRunArgs) {
    const res = await ddb.send(new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk',
        ExpressionAttributeValues: { ':pk': `RUN#${args.executionId}` },
    }));
    const items = res.Items ?? [];
    const summary = items.find((i: any) => i.SK === 'SUMMARY') ?? null;
    const sources = items.filter((i: any) => typeof i.SK === 'string' && i.SK.startsWith('SOURCE#'));
    return { summary, sources };
}
```

Also add both helpers to the file's `export { ... }` block at the bottom.

- [ ] **Step 4: Add GraphQL schema entries**

In `amplify/data/resource.ts`, near the existing `listTenderKeywordConfigs` declaration:

```typescript
  listPipelineRuns: a
    .query()
    .arguments({ limit: a.integer() })
    .returns(a.json().array())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

  getPipelineRun: a
    .query()
    .arguments({ executionId: a.string().required() })
    .returns(a.json())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),
```

(The `requireAdmin(identity)` inside the resolver provides the admin-only gate, mirroring the existing tender admin queries.)

- [ ] **Step 5: Run tests**

```bash
npx vitest run amplify/functions/tender-api/handler.test.ts
```

Expected: PASS, including the new tests.

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit -p .
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add amplify/data/resource.ts amplify/functions/tender-api/
git commit -m "feat(tender-api): listPipelineRuns + getPipelineRun resolvers"
```

---

## Task 12: Admin UI — list page, detail page, route, sidebar entry

**Files:**
- Create: `src/pages/admin/TenderPipelineRunsPage.tsx`
- Create: `src/pages/admin/TenderPipelineRunDetailPage.tsx`
- Create: `src/pages/admin/pipelineRunFunnel.test.ts`
- Create: `src/pages/admin/pipelineRunFunnel.ts`
- Modify: `src/routes.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: Write the failing test for the funnel-row builder**

`src/pages/admin/pipelineRunFunnel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildFunnelRows } from './pipelineRunFunnel';

describe('buildFunnelRows', () => {
    it('returns 7 rows in canonical order with widths normalized to the max value', () => {
        const summary = {
            totalFetched: 147,
            totalDedupedCandidates: 142,
            totalNewTenders: 89,
            totalPrefilterCandidates: 12,
            totalScored: 5,
            totalHighPriority: 2,
            totalNotified: 2,
        };
        const rows = buildFunnelRows(summary as any);
        expect(rows.map(r => r.label)).toEqual([
            'fetched', 'deduped', 'newTenders', 'prefilterCandidates', 'scored', 'highPriority', 'notified',
        ]);
        expect(rows[0].count).toBe(147);
        expect(rows[0].widthPct).toBe(100);
        // 2 / 147 ≈ 1.36 → at least 1, at most 5 (we floor to integer for rendering stability)
        const notifiedRow = rows.find(r => r.label === 'notified')!;
        expect(notifiedRow.widthPct).toBeGreaterThan(0);
        expect(notifiedRow.widthPct).toBeLessThan(5);
    });

    it('renders 0 as 0% width', () => {
        const summary = {
            totalFetched: 0, totalDedupedCandidates: 0, totalNewTenders: 0,
            totalPrefilterCandidates: 0, totalScored: 0, totalHighPriority: 0, totalNotified: 0,
        };
        const rows = buildFunnelRows(summary as any);
        rows.forEach(r => expect(r.widthPct).toBe(0));
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run src/pages/admin/pipelineRunFunnel.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the funnel helper**

`src/pages/admin/pipelineRunFunnel.ts`:

```typescript
import type { PipelineRunSummary } from '../../../amplify/lib/tender-watch/pipeline-run-types';

export interface FunnelRow {
    label: string;
    count: number;
    widthPct: number;
}

const STAGES: { label: string; key: keyof PipelineRunSummary }[] = [
    { label: 'fetched',             key: 'totalFetched' },
    { label: 'deduped',             key: 'totalDedupedCandidates' },
    { label: 'newTenders',          key: 'totalNewTenders' },
    { label: 'prefilterCandidates', key: 'totalPrefilterCandidates' },
    { label: 'scored',              key: 'totalScored' },
    { label: 'highPriority',        key: 'totalHighPriority' },
    { label: 'notified',            key: 'totalNotified' },
];

export function buildFunnelRows(summary: PipelineRunSummary): FunnelRow[] {
    const max = Math.max(...STAGES.map(s => Number(summary[s.key] ?? 0)));
    return STAGES.map(s => {
        const count = Number(summary[s.key] ?? 0);
        const widthPct = max === 0 ? 0 : Math.round((count / max) * 100);
        return { label: s.label, count, widthPct };
    });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/pages/admin/pipelineRunFunnel.test.ts
```

Expected: PASS.

- [ ] **Step 5: Create the list page**

`src/pages/admin/TenderPipelineRunsPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { PipelineRunSummary } from '../../../amplify/lib/tender-watch/pipeline-run-types';
import { AdminLayout } from '../../components/admin/AdminLayout';

const client = generateClient();

const STATUS_ICON: Record<string, string> = {
    SUCCESS: '✅',
    PARTIAL: '⚠️',
    FAILED: '❌',
    SKIPPED: '—',
};

function sourceDot(s: PipelineRunSummary, src: 'sam' | 'ted' | 'calusource'): string {
    if (!s.sourcesAttempted?.includes(src)) return '○';
    return s.sourcesFailed?.includes(src) ? '🔴' : '🟢';
}

function formatPacific(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: false });
}

function formatDuration(ms: number): string {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function TenderPipelineRunsPage() {
    const [rows, setRows] = useState<PipelineRunSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setError(null);
        try {
            const res = await client.graphql({
                query: /* GraphQL */ `query ListPipelineRuns($limit: Int) { listPipelineRuns(limit: $limit) }`,
                variables: { limit: 100 },
            });
            setRows((res as any).data.listPipelineRuns as PipelineRunSummary[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }
    useEffect(() => { load(); }, []);

    return (
        <AdminLayout>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h1>Pipeline Runs</h1>
                <button onClick={load}>↻ Refresh</button>
            </header>
            {error && <p style={{ color: 'crimson' }}>Failed to load: {error}</p>}
            {!rows ? <p>Loading…</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr>
                            <th>Started (PT)</th>
                            <th>Duration</th>
                            <th>Overall</th>
                            <th>Sources</th>
                            <th>Fetched</th>
                            <th>HP</th>
                            <th>Notify</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(r => (
                            <tr key={r.executionId}>
                                <td>
                                    <Link to={`/admin/tenders/runs/${encodeURIComponent(r.executionId)}`}>
                                        {formatPacific(r.startedAt)}
                                    </Link>
                                </td>
                                <td>{formatDuration(r.durationMs)}</td>
                                <td>{STATUS_ICON[r.status]} {r.status}</td>
                                <td>{sourceDot(r, 'sam')}{sourceDot(r, 'ted')}{sourceDot(r, 'calusource')}</td>
                                <td>{r.totalFetched}</td>
                                <td>{r.totalHighPriority}</td>
                                <td>{r.notificationStatus}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </AdminLayout>
    );
}
```

- [ ] **Step 6: Create the detail page**

`src/pages/admin/TenderPipelineRunDetailPage.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { generateClient } from 'aws-amplify/api';
import type { PipelineRunSummary, PipelineRunSource } from '../../../amplify/lib/tender-watch/pipeline-run-types';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { buildFunnelRows } from './pipelineRunFunnel';

const client = generateClient();

interface RunDetail { summary: PipelineRunSummary | null; sources: PipelineRunSource[]; }

function formatPacific(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: false });
}

function sfConsoleUrl(arn: string): string {
    return `https://us-east-2.console.aws.amazon.com/states/home?region=us-east-2#/v2/executions/details/${encodeURIComponent(arn)}`;
}

export function TenderPipelineRunDetailPage() {
    const { executionId = '' } = useParams();
    const [detail, setDetail] = useState<RunDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setError(null);
        try {
            const res = await client.graphql({
                query: /* GraphQL */ `query GetPipelineRun($executionId: String!) { getPipelineRun(executionId: $executionId) }`,
                variables: { executionId },
            });
            setDetail((res as any).data.getPipelineRun as RunDetail);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }
    useEffect(() => { load(); }, [executionId]);

    if (error) return <AdminLayout><p style={{ color: 'crimson' }}>Failed to load: {error}</p></AdminLayout>;
    if (!detail) return <AdminLayout><p>Loading…</p></AdminLayout>;
    const { summary, sources } = detail;
    if (!summary) return <AdminLayout><p>Run not found. <Link to="/admin/tenders/runs">Back to list</Link></p></AdminLayout>;
    const funnel = buildFunnelRows(summary);

    return (
        <AdminLayout>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>Run {summary.executionId}</h1>
                <a href={sfConsoleUrl(summary.stepFunctionExecutionArn)} target="_blank" rel="noreferrer">SF Console ↗</a>
            </header>

            <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div>
                    <h3>Overall: {summary.status}</h3>
                    <p>Started: {formatPacific(summary.startedAt)}</p>
                    <p>Duration: {Math.round(summary.durationMs / 1000)}s</p>
                    <p>Total Fetched: {summary.totalFetched}</p>
                    <p>→ HP: {summary.totalHighPriority}</p>
                </div>
                <div>
                    <h3>Notification: {summary.notificationStatus}</h3>
                    <p>Sources OK: {summary.sourcesSucceeded.join(', ') || 'none'}</p>
                    <p>Sources Failed: {summary.sourcesFailed.join(', ') || 'none'}</p>
                    {summary.lastError && <p style={{ color: 'crimson' }}>Last Error: {summary.lastError}</p>}
                </div>
            </section>

            <section style={{ marginTop: '2rem' }}>
                <h3>Overall Funnel</h3>
                {funnel.map(row => (
                    <div key={row.label} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ width: 180 }}>{row.label}</span>
                        <div style={{ flex: 1, background: '#eee', height: 18, position: 'relative' }}>
                            <div style={{ width: `${row.widthPct}%`, background: '#3b82f6', height: '100%' }} />
                        </div>
                        <span style={{ width: 80, textAlign: 'right' }}>{row.count}</span>
                    </div>
                ))}
            </section>

            <section style={{ marginTop: '2rem' }}>
                <h3>Per-Source</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                    {sources.map(sr => (
                        <div key={sr.source} style={{ border: '1px solid #ccc', padding: '1rem' }}>
                            <h4>{sr.source} — {sr.status === 'SUCCESS' ? '✅' : '❌'} {Math.round(sr.durationMs / 1000)}s</h4>
                            <p>fetched: {sr.fetched ?? '—'}</p>
                            <p>normalized: {sr.normalized ?? '—'}</p>
                            <p>prefilter: {sr.prefilterCandidates ?? '—'}</p>
                            <p>scored: {sr.scored ?? '—'}</p>
                            <p>HP: {sr.highPriority ?? '—'}</p>
                            <hr />
                            <p>LLM attempted: {sr.llmAttemptedCount ?? '—'}</p>
                            <p>LLM scored: {sr.llmScoredCount ?? '—'}</p>
                            <p>LLM avg: {sr.llmAvgScore?.toFixed(1) ?? '—'}</p>
                            <p>LLM errors: {sr.llmErrorCount ?? '—'}</p>
                            <p>LLM timeouts: {sr.llmTimeoutCount ?? '—'}</p>
                            <p style={{ marginTop: '0.5rem', fontSize: '0.85em', color: '#666' }}>
                                Completed: {sr.completedStages.join(' → ') || 'none'}
                            </p>
                            {sr.errorCause && <p style={{ color: 'crimson', fontSize: '0.85em' }}>{sr.errorCause}</p>}
                            {sr.stagedKey && <p style={{ fontSize: '0.8em', color: '#888' }}>{sr.stagedKey}</p>}
                        </div>
                    ))}
                </div>
            </section>
        </AdminLayout>
    );
}
```

- [ ] **Step 7: Wire routes**

In `src/routes.tsx`, add inside the admin routes block:

```tsx
import { TenderPipelineRunsPage } from './pages/admin/TenderPipelineRunsPage';
import { TenderPipelineRunDetailPage } from './pages/admin/TenderPipelineRunDetailPage';

// ...
<Route path="/admin/tenders/runs" element={<AdminRoute><TenderPipelineRunsPage /></AdminRoute>} />
<Route path="/admin/tenders/runs/:executionId" element={<AdminRoute><TenderPipelineRunDetailPage /></AdminRoute>} />
```

(`AdminRoute` is the existing wrapper used for `/admin/tenders` etc.)

- [ ] **Step 8: Add the sidebar entry**

In `src/components/admin/AdminLayout.tsx`, in the existing "Tender Watch" sidebar section, add a new link below the "Tenders" link:

```tsx
<Link to="/admin/tenders/runs">Pipeline Runs</Link>
```

- [ ] **Step 9: Run the full frontend test suite + tsc**

```bash
npx vitest run src/ && npx tsc --noEmit -p .
```

Expected: clean + green.

- [ ] **Step 10: Commit**

```bash
git add src/pages/admin/TenderPipelineRunsPage.tsx src/pages/admin/TenderPipelineRunDetailPage.tsx src/pages/admin/pipelineRunFunnel.ts src/pages/admin/pipelineRunFunnel.test.ts src/routes.tsx src/components/admin/AdminLayout.tsx
git commit -m "feat(admin): pipeline runs list + detail pages with funnel viz"
```

---

## Task 13: Deploy + manual SF trigger validation

**Files:** none

- [ ] **Step 1: Push the branch and open PR**

```bash
git push -u origin feat/tender-watch-monitoring
gh pr create --title "feat(tender-watch): Phase A monitoring (runs UI + health alerts)" --body "Implements docs/superpowers/specs/2026-05-27-tender-watch-monitoring-design.md"
```

- [ ] **Step 2: Merge the PR**

```bash
gh pr merge --squash --delete-branch
```

(Amplify auto-deploy will pick up the merge.)

- [ ] **Step 3: Wait for Amplify to redeploy the relevant Lambdas**

Poll the LastModified time on the `recordPipelineRun` Lambda:

```bash
aws lambda list-functions --query 'Functions[?contains(FunctionName, `recordpipelinerun`)].{name:FunctionName,modified:LastModified}' --output table
```

Expected: timestamp is after the merge commit.

- [ ] **Step 4: Manually start a Step Function execution**

```bash
SM_ARN=$(aws stepfunctions list-state-machines --query 'stateMachines[?contains(name, `tender-watch-daily`)].stateMachineArn | [0]' --output text)
EXEC_NAME=verify-$(date +%s)
aws stepfunctions start-execution --state-machine-arn "$SM_ARN" --name "$EXEC_NAME"
```

- [ ] **Step 5: Wait until the execution completes (≤5 min normally)**

```bash
EXEC_ARN=$(aws stepfunctions list-executions --state-machine-arn "$SM_ARN" --max-items 1 --query 'executions[0].executionArn' --output text)
until [ "$(aws stepfunctions describe-execution --execution-arn "$EXEC_ARN" --query status --output text)" != "RUNNING" ]; do
  echo "still running..."
  sleep 30
done
aws stepfunctions describe-execution --execution-arn "$EXEC_ARN" --query '{status:status, startDate:startDate, stopDate:stopDate}'
```

Expected: `status` is `SUCCEEDED`.

- [ ] **Step 6: Confirm SUMMARY + 3 SOURCE rows in DDB**

```bash
TABLE=$(aws dynamodb list-tables --query 'TableNames[?contains(@, `Intelligence`)] | [0]' --output text)
aws dynamodb query --table-name "$TABLE" \
    --key-condition-expression "PK = :pk" \
    --expression-attribute-values "{\":pk\":{\"S\":\"RUN#$EXEC_NAME\"}}" \
    --query 'Items[*].{SK:SK.S,status:status.S,fetched:fetched.N,source:source.S}' --output table
```

Expected: 4 rows — one `SUMMARY` and three `SOURCE#sam/ted/calusource`.

- [ ] **Step 7: Manually invoke notify-pipeline-health and verify it sends no email on a healthy run**

```bash
aws lambda invoke --function-name "$(aws lambda list-functions --query 'Functions[?contains(FunctionName, `notifypipelinehealth`)].FunctionName | [0]' --output text)" \
    /tmp/health-out.json && cat /tmp/health-out.json
```

Expected: `{"ok":true,"alertsSent":0}` (healthy run, no alerts).

- [ ] **Step 8: Manually visit the admin UI**

Open `https://ninescrolls.com/admin/tenders/runs` and verify the new run appears with status SUCCESS, three green source dots, and clicking it opens the detail page with funnel + per-source cards.

- [ ] **Step 9: Capture proof + close out the task**

Take a screenshot of the detail page and attach it to a "Validation: tender-watch-monitoring Phase A" Linear/Notion task. Mark Task #20 (CloudWatch alarm) as superseded by this deploy.

---

## Out-of-band follow-ups (after merge, not blocking Phase A)

- Schedule a calendar reminder for 2026-06-10 (≈2 weeks after merge) to revisit the 4 commented Phase C rules in `notify-pipeline-health/handler.ts` and pick thresholds based on the accumulated baseline data.
- Close Task #20 ("CloudWatch alarm on fetch-sam/fetch-ted count=0") — superseded by Rule 5 in `notify-pipeline-health`.
- Decide whether the `feat/fetch-calusource` worktree's monitoring branch should be rebased onto a fresh branch off `main` to keep history clean before opening the PR.
