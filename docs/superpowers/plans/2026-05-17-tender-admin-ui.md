# Tender Admin UI — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the admin-facing UI for Tender Watch — three pages under `/admin/tenders` (list, detail, keyword config) backed by a new `tender-api` Lambda that reads/writes the Phase 1 TENDER entities on `intelligenceTable`.

**Architecture:** New `tender-api` Lambda exposes 8 fieldNames via AppSync (3 queries + 5 mutations). All ops admin-only via `requireAdmin`. Frontend service + 3 hooks + 3 pages + ~13 React components, styled with Tailwind + MD3 tokens matching existing admin pages (RFQListPage / OrganizationListPage). New `react-hot-toast` dependency for notifications.

**Tech Stack:** TypeScript, Node 22, AWS Amplify Gen 2, AWS CDK v2, AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-bedrock-runtime`), `@anthropic-ai/sdk`, `ulid`, vitest. React 19 + Vite + react-hot-toast for admin UI.

**Reference:** [docs/superpowers/specs/2026-05-15-tender-watch-phase-2-design.md](../specs/2026-05-15-tender-watch-phase-2-design.md)

---

## File structure

**Library reorg (Task 1):**

```
amplify/lib/tender-watch/
├── prefilter.ts             # NEW: matchesAnyConfig + MatchableTender (moved from prefilter-by-keyword)
├── prefilter.test.ts        # NEW: tests for the pure function
├── keys.ts                  # EXISTING (Phase 1)
├── types.ts                 # EXISTING (Phase 1)
└── ...

amplify/functions/prefilter-by-keyword/handler.ts  # MODIFIED: import matchesAnyConfig from lib
```

**tender-api Lambda (Tasks 2–13):**

```
amplify/functions/tender-api/
├── handler.ts
├── handler.test.ts
├── resource.ts
└── package.json
```

**Schema additions (Tasks 3–5):**

```
amplify/data/resource.ts     # MODIFIED: add Tender customTypes + queries + mutations
```

**Backend wiring (Task 14):**

```
amplify/backend.ts           # MODIFIED: register tenderApi + IAM + env + Bedrock policy
```

**Frontend foundation (Tasks 15–18):**

```
src/lib/notify.ts                                   # NEW: react-hot-toast wrapper
src/services/tenderAdminService.ts                  # NEW
src/hooks/useTenders.ts                             # NEW
src/hooks/useTender.ts                              # NEW
src/hooks/useKeywordConfigs.ts                      # NEW
src/components/admin/AdminLayout.tsx                # MODIFIED: NAV_ITEMS + Toaster mount
src/routes/index.tsx                                # MODIFIED: 3 new routes
```

**Shared components (Task 19):**

```
src/components/admin/TagInput.tsx                   # NEW: chip + free-text input
```

**List page (Tasks 20–21):**

```
src/pages/admin/TenderListPage.tsx                  # NEW
src/components/admin/TenderKpiCards.tsx             # NEW
src/components/admin/TenderFilterBar.tsx            # NEW
src/components/admin/TenderTable.tsx                # NEW
src/components/admin/TenderStatusDropdown.tsx       # NEW
src/components/admin/TenderStatusChangeDialog.tsx   # NEW
src/components/admin/TenderBulkActionBar.tsx        # NEW
```

**Detail page (Task 22):**

```
src/pages/admin/TenderDetailPage.tsx                # NEW
src/components/admin/TenderHeaderPanel.tsx          # NEW
src/components/admin/TenderMatchCard.tsx            # NEW
src/components/admin/TenderAuditLog.tsx             # NEW
```

**Keyword config page (Task 23):**

```
src/pages/admin/TenderKeywordConfigPage.tsx         # NEW
src/components/admin/KeywordConfigSidebar.tsx       # NEW
src/components/admin/KeywordConfigEditor.tsx        # NEW
src/components/admin/KeywordConfigTestPanel.tsx     # NEW
```

**Manual verification (Task 24).**

---

## Conventions

- TypeScript strict mode (existing project setting)
- Per-Lambda `package.json` with explicit SDK deps (matches `submit-rfq` / `organization-api`)
- Lambda env access pattern: `const TABLE = () => process.env.INTELLIGENCE_TABLE!` so tests can `vi.stubEnv()` before importing
- Tests via vitest 3.2.4, `npm test -- <path>`
- Structured JSON log lines: `console.log(JSON.stringify({event, ...}))`
- Lambda handler.ts uses 4-space indent; `amplify/data/resource.ts` uses 2-space (matches existing file convention)
- React components use 2-space indent + Tailwind utility classes + MD3 tokens (`text-on-surface`, `bg-surface-container-lowest`, `border-outline-variant`, `font-headline`, `font-body`)
- Branch: `feat/tender-admin-ui` (already checked out, contains spec commit `ab81888`)
- Commit messages: `feat(tender)`, `fix(tender)`, `chore(tender)`, `refactor(tender)`; standard project Co-Authored-By trailer

**Phase 1 reused artifacts** (do NOT re-implement):

- `amplify/lib/tender-watch/keys.ts` — `tenderItemKey`, `tenderMatchItemKey`, `tenderStatusLogItemKey`, `tenderKeywordConfigItemKey`, `tenderStatusGsiKey`, `tenderHighPriorityGsiKey`, `tenderKeywordConfigActiveGsiKey`, `scoreSortToken`, `TENDER_STATUSES`, `ACTIVE_TENDER_STATUSES`, `TenderStatus` type
- `amplify/lib/tender-watch/types.ts` — `TenderItem`, `TenderMatchItem`, `TenderKeywordConfigItem`
- `amplify/functions/prefilter-by-keyword/handler.ts` — currently exports `matchesAnyConfig` + has private `MatchableTender` interface (Task 1 extracts to lib)

---

## Task 1: Library reorg — extract `matchesAnyConfig` to `lib/tender-watch/prefilter.ts`

**Files:**
- Create: `amplify/lib/tender-watch/prefilter.ts`
- Create: `amplify/lib/tender-watch/prefilter.test.ts`
- Modify: `amplify/functions/prefilter-by-keyword/handler.ts`

Move the pure-function matcher out of the Lambda so `tender-api` can import it without depending on `prefilter-by-keyword`'s file layout.

- [ ] **Step 1.1: Write failing test for `prefilter.ts`**

Create `amplify/lib/tender-watch/prefilter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { matchesAnyConfig } from './prefilter';
import type { TenderKeywordConfigItem } from './types';

const baseConfig = (overrides: Partial<TenderKeywordConfigItem> = {}): TenderKeywordConfigItem => ({
    PK: 'TENDER_KEYWORD_CONFIG',
    SK: 'CATEGORY#ALD',
    GSI1PK: 'TENDER_KEYWORD_CONFIG_ACTIVE',
    GSI1SK: 'ALD',
    entityType: 'TENDER_KEYWORD_CONFIG',
    productCategory: 'ALD',
    productSlugs: ['ald-system'],
    keywords: ['atomic layer deposition'],
    synonyms: [],
    blacklist: [],
    naicsCodes: [],
    cpvCodes: [],
    isActive: true,
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
});

describe('matchesAnyConfig', () => {
    it('matches a tender title containing a keyword', () => {
        const r = matchesAnyConfig(
            { title: 'Atomic layer deposition system for university lab', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig()],
        );
        expect(r.matchedCategories).toEqual(['ALD']);
        expect(r.matchedKeywords).toContain('atomic layer deposition');
    });

    it('matches a keyword case-insensitively', () => {
        const r = matchesAnyConfig(
            { title: 'ATOMIC LAYER DEPOSITION installation', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig()],
        );
        expect(r.matchedCategories).toEqual(['ALD']);
    });

    it('skips inactive configs', () => {
        const r = matchesAnyConfig(
            { title: 'atomic layer deposition', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig({ isActive: false })],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('rejects when blacklist term is present', () => {
        const r = matchesAnyConfig(
            { title: 'atomic layer deposition advertisement', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig({ blacklist: ['advertisement'] })],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('applies code whitelist when both NAICS and CPV are set on config', () => {
        const cfg = baseConfig({ naicsCodes: ['334516'], cpvCodes: ['38540000'] });
        const matchingNaics = matchesAnyConfig(
            { title: 'atomic layer deposition', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [cfg],
        );
        const noCodeOverlap = matchesAnyConfig(
            { title: 'atomic layer deposition', description: '', naicsCodes: ['999999'], cpvCodes: ['99999999'] },
            [cfg],
        );
        expect(matchingNaics.matchedCategories).toEqual(['ALD']);
        expect(noCodeOverlap.matchedCategories).toEqual([]);
    });

    it('returns matched keywords from synonyms too', () => {
        const r = matchesAnyConfig(
            { title: 'ALD process for thin films', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig({ keywords: ['atomic layer deposition'], synonyms: ['ALD'] })],
        );
        expect(r.matchedKeywords).toContain('ALD');
    });

    it('matches across multiple configs and returns all hit categories', () => {
        const r = matchesAnyConfig(
            { title: 'PECVD and ALD combined deposition', description: '', naicsCodes: [], cpvCodes: [] },
            [
                baseConfig({ productCategory: 'ALD', keywords: ['ALD'] }),
                baseConfig({ productCategory: 'PECVD', SK: 'CATEGORY#PECVD', GSI1SK: 'PECVD', keywords: ['PECVD'] }),
            ],
        );
        expect(r.matchedCategories.sort()).toEqual(['ALD', 'PECVD']);
    });

    it('returns empty matchedKeywords when no config matches', () => {
        const r = matchesAnyConfig(
            { title: 'orange juice procurement', description: '', naicsCodes: [], cpvCodes: [] },
            [baseConfig()],
        );
        expect(r.matchedCategories).toEqual([]);
        expect(r.matchedKeywords).toEqual([]);
    });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
npm test -- amplify/lib/tender-watch/prefilter.test.ts
```
Expected: FAIL with "Cannot find module './prefilter'".

- [ ] **Step 1.3: Create `prefilter.ts`**

Create `amplify/lib/tender-watch/prefilter.ts`:

```typescript
import type { TenderKeywordConfigItem } from './types';

/**
 * Shape the matcher needs from a tender. Kept minimal so callers can pass
 * either a stored DDB item or a synthetic preview payload.
 */
export interface MatchableTender {
    title: string;
    description: string;
    naicsCodes: string[];
    cpvCodes: string[];
}

/**
 * Coarse string + code filter — first pass before LLM scoring.
 *
 * Logic:
 * 1. Skip inactive configs.
 * 2. Reject category if any blacklist term appears in title+description.
 * 3. Match category if any keyword OR synonym is a case-insensitive substring.
 * 4. If config has either NAICS or CPV restrictions, require the tender to
 *    overlap at least one. Empty code arrays on the config = no restriction.
 *
 * Used by both Phase 1's prefilter-by-keyword Lambda (during the daily pipeline)
 * and Phase 2's tender-api `runPrefilterPreview` mutation (admin "Test match").
 */
export function matchesAnyConfig(
    t: MatchableTender,
    configs: TenderKeywordConfigItem[],
): { matchedCategories: string[]; matchedKeywords: string[] } {
    const haystack = `${t.title}\n${t.description}`.toLowerCase();
    const matchedCategories: string[] = [];
    const matchedKeywords = new Set<string>();

    for (const c of configs) {
        if (!c.isActive) continue;
        if (c.blacklist.some((b) => haystack.includes(b.toLowerCase()))) continue;
        const terms = [...c.keywords, ...c.synonyms];
        const hits = terms.filter((term) => haystack.includes(term.toLowerCase()));
        if (hits.length === 0) continue;
        const hasNaics = c.naicsCodes.length > 0;
        const hasCpv = c.cpvCodes.length > 0;
        if (hasNaics || hasCpv) {
            const naicsHit = t.naicsCodes.some((n) => c.naicsCodes.includes(n));
            const cpvHit = t.cpvCodes.some((c2) => c.cpvCodes.includes(c2));
            if (!naicsHit && !cpvHit) continue;
        }
        matchedCategories.push(c.productCategory);
        hits.forEach((h) => matchedKeywords.add(h));
    }
    return { matchedCategories, matchedKeywords: [...matchedKeywords] };
}
```

- [ ] **Step 1.4: Run test to verify it passes**

```bash
npm test -- amplify/lib/tender-watch/prefilter.test.ts
```
Expected: PASS (8 tests).

- [ ] **Step 1.5: Update `prefilter-by-keyword/handler.ts` to import from lib**

Find the top of `amplify/functions/prefilter-by-keyword/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';
import type { TenderKeywordConfigItem } from '../../lib/tender-watch/types';
```

Add the import:

```typescript
import { matchesAnyConfig, type MatchableTender } from '../../lib/tender-watch/prefilter';
```

Then delete the local `matchesAnyConfig` function (lines ~26–58 in the original file) AND the local `MatchableTender` interface (lines ~20–24). Keep everything else (`PrefilterEvent`, `PrefilterCandidate`, `PrefilterResult`, `LoadedTender`, `loadActiveConfigs`, `loadTenders`, `handler`).

Update the `LoadedTender` interface declaration from:
```typescript
interface LoadedTender extends MatchableTender { tenderId: string; }
```
to (same code — `MatchableTender` is now imported):
```typescript
interface LoadedTender extends MatchableTender { tenderId: string; }
```

(Yes, identical — but the imported reference now resolves via the new `prefilter.ts` re-export.)

- [ ] **Step 1.6: Verify existing prefilter-by-keyword tests still pass**

```bash
npm test -- amplify/functions/prefilter-by-keyword/
```
Expected: all existing tests PASS.

- [ ] **Step 1.7: Commit**

```bash
git add amplify/lib/tender-watch/prefilter.ts amplify/lib/tender-watch/prefilter.test.ts amplify/functions/prefilter-by-keyword/handler.ts
git commit -m "$(cat <<'EOF'
refactor(tender): extract matchesAnyConfig to lib/tender-watch/prefilter

Moves the pure-function matcher (matchesAnyConfig + MatchableTender) out
of prefilter-by-keyword/handler.ts into a new shared lib so Phase 2's
tender-api can import it without a cross-Lambda file dependency.

prefilter-by-keyword now imports from the lib; behavior unchanged.

8 new unit tests cover the matcher independently.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `tender-api` Lambda scaffold

**Files:**
- Create: `amplify/functions/tender-api/package.json`
- Create: `amplify/functions/tender-api/resource.ts`
- Create: `amplify/functions/tender-api/handler.ts`
- Create: `amplify/functions/tender-api/handler.test.ts`

Standard Lambda scaffold with `requireAdmin` + fieldName dispatcher; all dispatch cases throw "Unknown fieldName" — operations land in Tasks 6–13. Sets up the shape needed by the schema additions in Tasks 3–5 (so the import `from '../functions/tender-api/resource'` resolves).

- [ ] **Step 2.1: Create `package.json`**

Create `amplify/functions/tender-api/package.json`:

```json
{
    "name": "tender-api",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@anthropic-ai/sdk": "^0.32.1",
        "@aws-sdk/client-bedrock-runtime": "^3.758.0",
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0",
        "ulid": "^2.3.0"
    }
}
```

- [ ] **Step 2.2: Create `resource.ts`**

Create `amplify/functions/tender-api/resource.ts`:

```typescript
import { defineFunction, secret } from '@aws-amplify/backend';

export const tenderApi = defineFunction({
    name: 'tender-api',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 30,
    memoryMB: 512,
    // Pin to its own nested stack so backend.ts can attach IAM grants without
    // creating circular deps with Phase 1's tender-watch-stack.
    resourceGroupName: 'tender-api-stack',
    environment: {
        ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
        BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
    },
});
```

- [ ] **Step 2.3: Write failing dispatcher tests**

Create `amplify/functions/tender-api/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({ send: vi.fn().mockResolvedValue({}) }),
    },
    GetCommand: class { input: any; constructor(i: any) { this.input = i; } },
    PutCommand: class { input: any; constructor(i: any) { this.input = i; } },
    UpdateCommand: class { input: any; constructor(i: any) { this.input = i; } },
    QueryCommand: class { input: any; constructor(i: any) { this.input = i; } },
    BatchGetCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: vi.fn() })),
    InvokeModelCommand: class { input: any; constructor(i: any) { this.input = i; } },
}));
vi.mock('@anthropic-ai/sdk', () => ({
    default: class { messages = { create: vi.fn() }; },
    Anthropic: class { messages = { create: vi.fn() }; },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence-test');

beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
});

describe('tender-api dispatcher', () => {
    it('throws when AppSync identity is missing admin group', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'listTenders' },
            arguments: {},
            identity: { username: 'user1', groups: ['user'] },
        } as any)).rejects.toThrow(/admin group required/);
    });

    it('throws on unknown fieldName when admin', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'bogusOp' },
            arguments: {},
            identity: { username: 'admin1', groups: ['admin'] },
        } as any)).rejects.toThrow(/Unknown fieldName/);
    });

    it('reads fieldName from event root when info is absent (Amplify Gen 2 shape)', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            fieldName: 'bogusOp',
            arguments: {},
            identity: { username: 'admin1', groups: ['admin'] },
        } as any)).rejects.toThrow(/Unknown fieldName/);
    });
});
```

- [ ] **Step 2.4: Verify failing**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```
Expected: FAIL with "Cannot find module './handler'".

- [ ] **Step 2.5: Implement `handler.ts` scaffold**

Create `amplify/functions/tender-api/handler.ts`:

```typescript
import type { AppSyncResolverEvent } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

const ADMIN_GROUP = 'admin';

export async function handler(event: AppSyncResolverEvent<any> & { fieldName?: string }): Promise<unknown> {
    requireAdmin(event);
    const identity = (event.identity as any)?.username ?? 'unknown';
    // Amplify Gen 2's `a.handler.function()` path sends fieldName at the event root.
    // Standard AppSync wraps it under event.info. Support both.
    const fieldName = ((event.info as any)?.fieldName) ?? (event as any).fieldName;
    return dispatchFieldName(fieldName, event, identity);
}

/**
 * AppSync admin gate. Expects Cognito-authenticated callers with a `groups` claim
 * containing 'admin'. Other auth modes (IAM, API key) leave `event.identity.groups`
 * undefined and are rejected here.
 */
function requireAdmin(event: AppSyncResolverEvent<any>): void {
    const groups = (event.identity as any)?.groups ?? [];
    if (!groups.includes(ADMIN_GROUP)) {
        throw new Error('Unauthorized: admin group required');
    }
}

async function dispatchFieldName(
    fieldName: string,
    _event: AppSyncResolverEvent<any>,
    _identity: string,
): Promise<unknown> {
    // Operations land in Tasks 6–13.
    throw new Error(`Unknown fieldName: ${fieldName}`);
}

// Export internals for unit tests
export { dispatchFieldName, requireAdmin, ddb, TABLE };
```

- [ ] **Step 2.6: Run test to verify passing**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 2.7: Commit**

```bash
git add amplify/functions/tender-api/
git commit -m "$(cat <<'EOF'
feat(tender): scaffold tender-api Lambda with requireAdmin + dispatcher

Stubs the tender-api Lambda — handler, resource.ts, package.json. The
fieldName dispatcher throws 'Unknown fieldName' for now; Tasks 6–13 fill
in listTenders, getTender, listTenderKeywordConfigs, updateTenderStatus,
bulkUpdateTenderStatus, upsertTenderKeywordConfig, runPrefilterPreview,
translateTenderDescription.

Resource group 'tender-api-stack' keeps the Lambda in its own nested
CloudFormation stack (same pattern as organization-api-stack in Phase
C — avoids circular deps between the Lambda IAM policy and Bedrock.

requireAdmin checks event.identity.groups for 'admin' (matches order-api
+ organization-api). Supports both event.info.fieldName and root
fieldName shapes (Amplify Gen 2 quirk).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Amplify schema — Tender customTypes

**Files:**
- Modify: `amplify/data/resource.ts`

Add 7 customTypes: `Tender`, `TenderMatch`, `TenderStatusLog`, `TenderKeywordConfig`, `TenderConnection`, `TenderDetailBundle`, `PrefilterPreviewResult`.

- [ ] **Step 3.1: Add `tenderApi` import**

At the top of `amplify/data/resource.ts`, add the import after the existing `optimizeInsightsImage` import:

```typescript
import { tenderApi } from '../functions/tender-api/resource';
```

- [ ] **Step 3.2: Add 7 customTypes**

Find the existing customTypes section in the schema (e.g., near `RfqSubmission`, `Order` definitions). Add these BEFORE the queries section (look for `// Queries — §12.4` or similar marker; in the existing file there's a comment near line 416):

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
    descriptionEn: a.string(),
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
    totalActiveUnfiltered: a.integer(),
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

**Indentation:** existing `resource.ts` uses 2-space indent; outer key `Tender:` lives at column 2, nested fields at column 4.

- [ ] **Step 3.3: Commit (will not type-check until Task 4 adds the query handler references)**

The customTypes alone are valid TypeScript; only the `a.ref('Tender')` references resolve. Type-check should pass at this step:

```bash
npx tsc --noEmit -p amplify 2>&1 | head -5
```
Expected: clean (no new errors).

```bash
git add amplify/data/resource.ts
git commit -m "$(cat <<'EOF'
feat(tender): add Tender schema customTypes (Tender, Match, Log, Config, bundles)

Adds 7 customTypes to amplify/data/resource.ts:
- Tender: main record (24 fields including descriptionEn for translation)
- TenderMatch: per-product LLM match (score + reasoning)
- TenderStatusLog: audit trail of status changes
- TenderKeywordConfig: editable prefilter config per category
- TenderConnection: list response with cursor + totalActiveUnfiltered count
- TenderDetailBundle: getTender response (Tender + matches[] + log[])
- PrefilterPreviewResult: runPrefilterPreview return shape

Also imports tenderApi resource at the top (Lambda scaffold from Task 2).
Queries and mutations land in Tasks 4–5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Amplify schema — Tender queries

**Files:**
- Modify: `amplify/data/resource.ts`

Add 3 queries: `listTenders`, `getTender`, `listTenderKeywordConfigs`. All wired to the `tenderApi` Lambda resolver, `allow.authenticated()`.

- [ ] **Step 4.1: Add 3 queries**

In the Queries section of `amplify/data/resource.ts` (after the existing admin queries near `getCustomerTimeline` / `listOrders` etc., before the `// Insights Image Upload` block):

```typescript
  listTenders: a.query()
    .arguments({
      statuses: a.string().array(),
      includeExpired: a.boolean(),
      countries: a.string().array(),
      categories: a.string().array(),
      minScore: a.integer(),
      postedDateFrom: a.string(),
      postedDateTo: a.string(),
      search: a.string(),
      sortBy: a.string(),
      sortDir: a.string(),
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

- [ ] **Step 4.2: Type-check**

```bash
npx tsc --noEmit -p amplify 2>&1 | head -5
```
Expected: clean.

- [ ] **Step 4.3: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "$(cat <<'EOF'
feat(tender): add 3 tender admin queries (listTenders, getTender, listConfigs)

- listTenders: 12 filter args (status, country, category, score, date range,
  search, sort) with cursor pagination → TenderConnection
- getTender: orgId → TenderDetailBundle (Tender + matches + log)
- listTenderKeywordConfigs: optional includeInactive flag → TenderKeywordConfig[]

All wired to tenderApi Lambda with allow.authenticated() at the schema
layer; runtime requireAdmin check inside the Lambda.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Amplify schema — Tender mutations

**Files:**
- Modify: `amplify/data/resource.ts`

Add 5 mutations: `updateTenderStatus`, `bulkUpdateTenderStatus`, `upsertTenderKeywordConfig`, `runPrefilterPreview`, `translateTenderDescription`.

- [ ] **Step 5.1: Add 5 mutations**

In the Mutations section of `amplify/data/resource.ts` (after the existing admin mutations like `updateOrder` / `convertRfqToOrder`, before the Subscriptions / AnalyticsEventNotification block):

```typescript
  updateTenderStatus: a.mutation()
    .arguments({
      tenderId: a.id().required(),
      toStatus: a.string().required(),
      note: a.string(),
      assignedTo: a.string(),
    })
    .returns(a.ref('Tender').required())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

  bulkUpdateTenderStatus: a.mutation()
    .arguments({
      tenderIds: a.id().array().required(),
      toStatus: a.string().required(),
    })
    .returns(a.integer().required())
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
      configOverride: a.json(),
    })
    .returns(a.ref('PrefilterPreviewResult').required())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),

  translateTenderDescription: a.mutation()
    .arguments({ tenderId: a.id().required(), force: a.boolean() })
    .returns(a.string().required())
    .handler(a.handler.function(tenderApi))
    .authorization((allow) => [allow.authenticated()]),
```

- [ ] **Step 5.2: Type-check**

```bash
npx tsc --noEmit -p amplify 2>&1 | head -5
```
Expected: clean.

- [ ] **Step 5.3: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "$(cat <<'EOF'
feat(tender): add 5 tender admin mutations

- updateTenderStatus: status change with optional note + assignedTo; returns
  updated Tender. Lambda uses optimistic locking via ConditionExpression.
- bulkUpdateTenderStatus: batch status update (cap 50 ids) → count updated.
- upsertTenderKeywordConfig: full config write with all 7 fields.
- runPrefilterPreview: mutation (not query) to defeat AppSync caching when
  testing different unsaved configOverrides against the same inputs.
- translateTenderDescription: also a mutation to allow force=true to bypass
  AppSync query cache.

All admin-only via allow.authenticated() + Lambda-side requireAdmin.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Lambda `listTenders` — multi-status fanout + filter + sort

**Files:**
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

Multi-status GSI1 fanout, merge + filter + sort + cursor pagination + totalActiveUnfiltered count.

- [ ] **Step 6.1: Append tests**

Append to `handler.test.ts` (after the existing `describe('tender-api dispatcher', …)` block):

```typescript
describe('listTenders', () => {
    it('queries GSI1 per requested status and merges results', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // Two parallel Queries (one per status)
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', status: 'new', overallScore: 85, postedDate: '2026-05-10', country: 'US', title: 'A', agency: 'A' },
        ] });
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't2', status: 'reviewing', overallScore: 70, postedDate: '2026-05-09', country: 'DE', title: 'B', agency: 'B' },
        ] });
        // totalActiveUnfiltered COUNT queries (4 active statuses × 1 each)
        sendMock.mockResolvedValue({ Count: 0 });

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'listTenders' },
            arguments: { statuses: ['new', 'reviewing'], limit: 25 },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect((result as any).items.length).toBe(2);
        // Default sort: score DESC
        expect((result as any).items[0].tenderId).toBe('t1');
    });

    it('filters by country in-memory', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', status: 'new', overallScore: 85, country: 'US', title: 'A', agency: 'A' },
            { tenderId: 't2', status: 'new', overallScore: 80, country: 'DE', title: 'B', agency: 'B' },
        ] });
        sendMock.mockResolvedValue({ Count: 0 });

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'listTenders' },
            arguments: { statuses: ['new'], countries: ['US'] },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect((result as any).items.map((i: any) => i.tenderId)).toEqual(['t1']);
    });
});
```

- [ ] **Step 6.2: Verify failing**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```
Expected: new tests fail with "Unknown fieldName: listTenders".

- [ ] **Step 6.3: Implement `listTenders` in handler.ts**

Update `handler.ts` imports to include `QueryCommand` and the Phase 1 reused items:

```typescript
import {
    DynamoDBDocumentClient,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import {
    TENDER_STATUSES, ACTIVE_TENDER_STATUSES, type TenderStatus,
} from '../../lib/tender-watch/keys';
```

Replace `dispatchFieldName` stub with a real switch + add the `listTenders` function:

```typescript
async function dispatchFieldName(
    fieldName: string,
    event: AppSyncResolverEvent<any>,
    identity: string,
): Promise<unknown> {
    switch (fieldName) {
        case 'listTenders':
            return listTenders(event.arguments);
        default:
            throw new Error(`Unknown fieldName: ${fieldName}`);
    }
}

interface ListTendersArgs {
    statuses?: string[];
    includeExpired?: boolean;
    countries?: string[];
    categories?: string[];
    minScore?: number;
    postedDateFrom?: string;
    postedDateTo?: string;
    search?: string;
    sortBy?: 'score' | 'postedDate' | 'deadline';
    sortDir?: 'asc' | 'desc';
    limit?: number;
    nextToken?: string;
}

async function listTenders(args: ListTendersArgs) {
    const statuses = (args.statuses?.length ? args.statuses : [...ACTIVE_TENDER_STATUSES]) as TenderStatus[];
    const limit = args.limit ?? 25;
    const sortBy = args.sortBy ?? 'score';
    const sortDir = args.sortDir ?? 'desc';

    // Fan-out one Query per requested status on GSI1
    const queries = await Promise.all(
        statuses.map((status) =>
            ddb.send(new QueryCommand({
                TableName: TABLE(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `TENDER_STATUS#${status}` },
                Limit: limit * 2,
            })),
        ),
    );
    let items: any[] = queries.flatMap((q) => q.Items ?? []);

    // In-memory filters
    if (!args.includeExpired) {
        items = items.filter((i) => !i.isExpired);
    }
    if (args.countries?.length) {
        items = items.filter((i) => args.countries!.includes(i.country));
    }
    if (typeof args.minScore === 'number') {
        items = items.filter((i) => (i.overallScore ?? 0) >= args.minScore!);
    }
    if (args.postedDateFrom) {
        items = items.filter((i) => (i.postedDate ?? '') >= args.postedDateFrom!);
    }
    if (args.postedDateTo) {
        items = items.filter((i) => (i.postedDate ?? '') <= args.postedDateTo!);
    }
    if (args.search) {
        const needle = args.search.toLowerCase();
        items = items.filter((i) =>
            (i.title ?? '').toLowerCase().includes(needle) ||
            (i.agency ?? '').toLowerCase().includes(needle),
        );
    }
    if (args.categories?.length) {
        // Match against matchedProductCategories (denormalized array on Tender; written by classify-and-store)
        items = items.filter((i) => {
            const cats = (i.matchedProductCategories ?? []) as string[];
            return args.categories!.some((c) => cats.includes(c));
        });
    }

    // Sort
    const cmp = (a: any, b: any) => {
        let av: any; let bv: any;
        if (sortBy === 'score') { av = a.overallScore ?? 0; bv = b.overallScore ?? 0; }
        else if (sortBy === 'postedDate') { av = a.postedDate ?? ''; bv = b.postedDate ?? ''; }
        else if (sortBy === 'deadline') { av = a.deadline ?? '9999-99-99'; bv = b.deadline ?? '9999-99-99'; }
        else { av = 0; bv = 0; }
        const dir = sortDir === 'asc' ? 1 : -1;
        return av < bv ? -dir : av > bv ? dir : 0;
    };
    items.sort(cmp);

    // totalActiveUnfiltered — fire one COUNT query per active status
    const countQueries = await Promise.all(
        ACTIVE_TENDER_STATUSES.map((s) =>
            ddb.send(new QueryCommand({
                TableName: TABLE(),
                IndexName: 'GSI1',
                KeyConditionExpression: 'GSI1PK = :pk',
                ExpressionAttributeValues: { ':pk': `TENDER_STATUS#${s}` },
                Select: 'COUNT',
            })),
        ),
    );
    const totalActiveUnfiltered = countQueries.reduce((sum, q) => sum + ((q as any).Count ?? 0), 0);

    return {
        items: items.slice(0, limit),
        nextToken: null,  // TODO(phase-d): true pagination — current pass returns first page only
        totalActiveUnfiltered,
    };
}
```

Update the `export` block at the bottom to include `listTenders`:

```typescript
export { dispatchFieldName, requireAdmin, ddb, TABLE, listTenders };
```

- [ ] **Step 6.4: Run tests**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```
Expected: PASS (5 total: 3 dispatcher + 2 listTenders).

- [ ] **Step 6.5: Commit**

```bash
git add amplify/functions/tender-api/handler.ts amplify/functions/tender-api/handler.test.ts
git commit -m "$(cat <<'EOF'
feat(tender): implement listTenders fieldName

Multi-status GSI1 fanout (one Query per requested TENDER_STATUS partition),
merge results, apply in-memory filters (country, category, minScore, date
range, search, includeExpired), sort by score/postedDate/deadline (DESC
default).

Also fires 4 COUNT queries (one per ACTIVE_TENDER_STATUS) to populate
totalActiveUnfiltered for the list page header.

nextToken returns null in Phase 2 — pagination is a follow-up (matches
the same pattern flagged in Phase C's listOrganizations).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Lambda `getTender` — META + matches + log bundle

**Files:**
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

GetItem META + 2 Queries (matches + log) in parallel; returns the bundle.

- [ ] **Step 7.1: Append tests**

```typescript
describe('getTender', () => {
    it('returns bundle with tender + matches + log', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        // GetCommand META
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', title: 'X', agency: 'A', source: 'ted', sourceUrl: 'http://x' } });
        // Query matches
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', productSlug: 'ald-system', score: 85, reasoning: 'good fit' },
        ] });
        // Query log
        sendMock.mockResolvedValueOnce({ Items: [
            { tenderId: 't1', toStatus: 'new', changedBy: 'cron', changedAt: '2026-05-10T00:00:00Z' },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'getTender' },
            arguments: { tenderId: 't1' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.tender.tenderId).toBe('t1');
        expect(result.matches).toHaveLength(1);
        expect(result.log).toHaveLength(1);
    });

    it('throws 404 when tender META missing', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: undefined });

        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'getTender' },
            arguments: { tenderId: 'ghost' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/not found/);
    });
});
```

- [ ] **Step 7.2: Verify failing**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```
Expected: 2 new tests fail with "Unknown fieldName: getTender".

- [ ] **Step 7.3: Implement `getTender`**

Add `GetCommand` to the imports:

```typescript
import {
    DynamoDBDocumentClient,
    GetCommand,
    QueryCommand,
} from '@aws-sdk/lib-dynamodb';
```

Update `dispatchFieldName` switch:

```typescript
        case 'listTenders':
            return listTenders(event.arguments);
        case 'getTender':
            return getTender(event.arguments);
```

Add the function before the export block:

```typescript
async function getTender(args: { tenderId: string }) {
    const [metaRes, matchesRes, logRes] = await Promise.all([
        ddb.send(new GetCommand({
            TableName: TABLE(),
            Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
        })),
        ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :m)',
            ExpressionAttributeValues: { ':pk': `TENDER#${args.tenderId}`, ':m': 'MATCH#' },
        })),
        ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk AND begins_with(SK, :l)',
            ExpressionAttributeValues: { ':pk': `TENDER#${args.tenderId}`, ':l': 'LOG#' },
            ScanIndexForward: false,
            Limit: 100,
        })),
    ]);
    if (!metaRes.Item) throw new Error(`Tender not found: ${args.tenderId}`);
    return {
        tender: metaRes.Item,
        matches: (matchesRes.Items ?? []).sort((a: any, b: any) => (b.score ?? 0) - (a.score ?? 0)),
        log: logRes.Items ?? [],
    };
}
```

Update export:

```typescript
export { dispatchFieldName, requireAdmin, ddb, TABLE, listTenders, getTender };
```

- [ ] **Step 7.4: Run tests**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```
Expected: PASS (7 tests).

- [ ] **Step 7.5: Commit**

```bash
git add amplify/functions/tender-api/handler.ts amplify/functions/tender-api/handler.test.ts
git commit -m "$(cat <<'EOF'
feat(tender): implement getTender fieldName

GetItem METADATA + 2 parallel Queries (MATCH#* and LOG#*, newest-first
on log via ScanIndexForward:false) → TenderDetailBundle. Sorts matches
by score DESC client-side. Throws 'Tender not found' if METADATA absent.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Lambda `listTenderKeywordConfigs`

**Files:**
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

GSI1 (active only) vs base-table Query for all.

- [ ] **Step 8.1: Append test**

```typescript
describe('listTenderKeywordConfigs', () => {
    it('queries GSI1 by default (active only)', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Items: [
            { productCategory: 'ALD', isActive: true, keywords: ['atomic'], synonyms: [], blacklist: [], productSlugs: ['ald-system'], naicsCodes: [], cpvCodes: [] },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'listTenderKeywordConfigs' },
            arguments: {},
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.length).toBe(1);
        // Verify GSI1 was used
        const cmd = sendMock.mock.calls[0][0];
        expect(cmd.input.IndexName).toBe('GSI1');
    });

    it('queries base table when includeInactive=true', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Items: [
            { productCategory: 'ALD', isActive: true, keywords: [], synonyms: [], blacklist: [], productSlugs: [], naicsCodes: [], cpvCodes: [] },
            { productCategory: 'Old', isActive: false, keywords: [], synonyms: [], blacklist: [], productSlugs: [], naicsCodes: [], cpvCodes: [] },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'listTenderKeywordConfigs' },
            arguments: { includeInactive: true },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.length).toBe(2);
        const cmd = sendMock.mock.calls[0][0];
        expect(cmd.input.IndexName).toBeUndefined();
    });
});
```

- [ ] **Step 8.2: Verify failing**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```
Expected: 2 new tests fail.

- [ ] **Step 8.3: Implement**

Update `dispatchFieldName` switch:

```typescript
        case 'listTenderKeywordConfigs':
            return listKeywordConfigs(event.arguments);
```

Add the function:

```typescript
async function listKeywordConfigs(args: { includeInactive?: boolean }) {
    if (args.includeInactive) {
        const r = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            KeyConditionExpression: 'PK = :pk',
            ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG' },
        }));
        return r.Items ?? [];
    }
    const r = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG_ACTIVE' },
    }));
    return r.Items ?? [];
}
```

Update export to include `listKeywordConfigs`.

- [ ] **Step 8.4: Run tests + commit**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```
Expected: PASS (9 tests).

```bash
git add amplify/functions/tender-api/
git commit -m "feat(tender): implement listTenderKeywordConfigs

GSI1 query on TENDER_KEYWORD_CONFIG_ACTIVE for the default active-only
path; base-table Query on PK=TENDER_KEYWORD_CONFIG when includeInactive
flag is set.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Lambda `updateTenderStatus` — optimistic lock + log write

**Files:**
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

UpdateItem with `ConditionExpression: updatedAt = :prev`; on success, PutItem TENDER_STATUS_LOG row; return updated Tender.

- [ ] **Step 9.1: Append tests**

```typescript
describe('updateTenderStatus', () => {
    it('updates status + writes log entry on success', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // GetCommand current META
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', status: 'new', updatedAt: '2026-05-10T00:00:00Z' } });
        // UpdateCommand
        sendMock.mockResolvedValueOnce({ Attributes: { tenderId: 't1', status: 'reviewing', updatedAt: '2026-05-11T00:00:00Z' } });
        // PutCommand log
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'updateTenderStatus' },
            arguments: { tenderId: 't1', toStatus: 'reviewing', note: 'looks promising' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.status).toBe('reviewing');
        // Verify log PutCommand was made
        const putCmds = sendMock.mock.calls.filter((c: any) => c[0].constructor.name === 'PutCommand');
        expect(putCmds.length).toBeGreaterThanOrEqual(1);
    });

    it('throws Conflict on ConditionalCheckFailedException', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', status: 'new', updatedAt: '2026-05-10T00:00:00Z' } });
        const ccfe = new Error('CCFE');
        (ccfe as any).name = 'ConditionalCheckFailedException';
        sendMock.mockRejectedValueOnce(ccfe);

        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'updateTenderStatus' },
            arguments: { tenderId: 't1', toStatus: 'reviewing' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/Conflict|modified/);
    });

    it('updates assignedTo when provided alongside status', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', status: 'new', updatedAt: '2026-05-10T00:00:00Z' } });
        sendMock.mockResolvedValueOnce({ Attributes: { tenderId: 't1', status: 'pursuing', assignedTo: 'alice' } });
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'updateTenderStatus' },
            arguments: { tenderId: 't1', toStatus: 'pursuing', assignedTo: 'alice' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.assignedTo).toBe('alice');
    });
});
```

- [ ] **Step 9.2: Verify failing**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```

- [ ] **Step 9.3: Implement**

Add `PutCommand`, `UpdateCommand`, and `ulid` to imports:

```typescript
import {
    DynamoDBDocumentClient,
    GetCommand,
    PutCommand,
    QueryCommand,
    UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { ulid } from 'ulid';
import {
    tenderStatusLogItemKey,
    TENDER_STATUSES, ACTIVE_TENDER_STATUSES, type TenderStatus,
} from '../../lib/tender-watch/keys';
```

Update `dispatchFieldName` switch:

```typescript
        case 'updateTenderStatus':
            return updateTenderStatus(event.arguments, identity);
```

Add the function:

```typescript
async function updateTenderStatus(
    args: { tenderId: string; toStatus: string; note?: string; assignedTo?: string },
    identity: string,
) {
    if (!(TENDER_STATUSES as readonly string[]).includes(args.toStatus)) {
        throw new Error(`Invalid status: ${args.toStatus}`);
    }
    // 1. GetItem current to know fromStatus + updatedAt for optimistic lock
    const existing = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
    }));
    if (!existing.Item) throw new Error(`Tender not found: ${args.tenderId}`);
    const fromStatus = (existing.Item.status as string) ?? 'new';
    const prevUpdatedAt = existing.Item.updatedAt as string;
    const nowIso = new Date().toISOString();

    // 2. UpdateItem with optimistic lock
    const setExprs: string[] = [
        '#st = :toStatus',
        'lastStatusChangedAt = :now',
        'updatedAt = :now',
        'GSI1PK = :gsi1pk',
    ];
    const exprValues: Record<string, unknown> = {
        ':toStatus': args.toStatus,
        ':now': nowIso,
        ':gsi1pk': `TENDER_STATUS#${args.toStatus}`,
        ':prevUpdatedAt': prevUpdatedAt,
    };
    const exprNames: Record<string, string> = { '#st': 'status' };
    if (args.note !== undefined) {
        setExprs.push('statusNote = :note');
        exprValues[':note'] = args.note;
    }
    if (args.assignedTo !== undefined) {
        setExprs.push('assignedTo = :assigned');
        exprValues[':assigned'] = args.assignedTo;
    }

    let updated;
    try {
        updated = await ddb.send(new UpdateCommand({
            TableName: TABLE(),
            Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
            UpdateExpression: `SET ${setExprs.join(', ')}`,
            ConditionExpression: 'updatedAt = :prevUpdatedAt',
            ExpressionAttributeNames: exprNames,
            ExpressionAttributeValues: exprValues,
            ReturnValues: 'ALL_NEW',
        }));
    } catch (err: any) {
        if (err?.name === 'ConditionalCheckFailedException') {
            throw new Error('Conflict: tender was modified by another user');
        }
        throw err;
    }

    // 3. PutItem log entry
    await ddb.send(new PutCommand({
        TableName: TABLE(),
        Item: {
            ...tenderStatusLogItemKey(args.tenderId, nowIso, ulid()),
            entityType: 'TENDER_STATUS_LOG',
            tenderId: args.tenderId,
            fromStatus,
            toStatus: args.toStatus,
            changedBy: identity,
            changedAt: nowIso,
            ...(args.note !== undefined ? { note: args.note } : {}),
        },
    }));

    console.log(JSON.stringify({
        event: 'tender.status.updated',
        tenderId: args.tenderId,
        fromStatus,
        toStatus: args.toStatus,
        changedBy: identity,
    }));

    return updated.Attributes;
}
```

Update export.

- [ ] **Step 9.4: Run tests + commit**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
git add amplify/functions/tender-api/
git commit -m "feat(tender): implement updateTenderStatus with optimistic lock + log

GetItem current → UpdateItem with ConditionExpression 'updatedAt = :prev'
to detect concurrent writes (rejected as 'Conflict: tender was modified by
another user'). On success, PutItem TENDER_STATUS_LOG entry with from/to
status + changedBy + optional note. Updates assignedTo when provided.

Status validated against TENDER_STATUSES enum from Phase 1's keys.ts.
GSI1PK rewritten to reflect new status so admin list queries find it under
the new partition.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Lambda `bulkUpdateTenderStatus`

**Files:**
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

Promise.all with concurrency limit 10; per-tender failures tallied not rolled back; cap 50 tenderIds.

- [ ] **Step 10.1: Append tests**

```typescript
describe('bulkUpdateTenderStatus', () => {
    it('updates each tender and returns success count', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        // For each tender: Get + Update + Put = 3 calls
        for (const tid of ['t1', 't2']) {
            sendMock.mockResolvedValueOnce({ Item: { tenderId: tid, status: 'new', updatedAt: '2026-05-10T00:00:00Z' } });
            sendMock.mockResolvedValueOnce({ Attributes: {} });
            sendMock.mockResolvedValueOnce({});
        }

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'bulkUpdateTenderStatus' },
            arguments: { tenderIds: ['t1', 't2'], toStatus: 'reviewing' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result).toBe(2);
    });

    it('throws when more than 50 ids are passed', async () => {
        const { handler } = await import('./handler');
        await expect(handler({
            info: { fieldName: 'bulkUpdateTenderStatus' },
            arguments: { tenderIds: Array.from({ length: 51 }, (_, i) => `t${i}`), toStatus: 'reviewing' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any)).rejects.toThrow(/bulk update limit/);
    });
});
```

- [ ] **Step 10.2: Verify failing**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
```

- [ ] **Step 10.3: Implement**

Update `dispatchFieldName`:

```typescript
        case 'bulkUpdateTenderStatus':
            return bulkUpdateTenderStatus(event.arguments, identity);
```

Add function:

```typescript
async function bulkUpdateTenderStatus(
    args: { tenderIds: string[]; toStatus: string },
    identity: string,
) {
    if (args.tenderIds.length > 50) {
        throw new Error('bulk update limit exceeded: maximum 50 tenders per request');
    }
    // Concurrency limit of 10 — simple chunking instead of pulling in p-limit.
    let success = 0;
    for (let i = 0; i < args.tenderIds.length; i += 10) {
        const chunk = args.tenderIds.slice(i, i + 10);
        const results = await Promise.allSettled(
            chunk.map((tid) => updateTenderStatus({ tenderId: tid, toStatus: args.toStatus }, identity)),
        );
        success += results.filter((r) => r.status === 'fulfilled').length;
        const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
        for (const f of failed) {
            console.warn(JSON.stringify({
                event: 'tender.bulk.update-failed',
                error: String(f.reason),
                changedBy: identity,
            }));
        }
    }
    return success;
}
```

Update export.

- [ ] **Step 10.4: Run + commit**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
git add amplify/functions/tender-api/
git commit -m "feat(tender): implement bulkUpdateTenderStatus

Chunks tenderIds into batches of 10, runs Promise.allSettled per chunk
(reuses updateTenderStatus single-tender path so log writes happen the
same way). Returns count of successes; partial failures logged but not
rolled back. Hard cap of 50 ids per request.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Lambda `upsertTenderKeywordConfig`

**Files:**
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

PutItem with GSI1 active key set only when `isActive`.

- [ ] **Step 11.1: Append tests**

```typescript
describe('upsertTenderKeywordConfig', () => {
    it('writes config with GSI1 active key when isActive', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        await handler({
            info: { fieldName: 'upsertTenderKeywordConfig' },
            arguments: {
                productCategory: 'ALD',
                productSlugs: ['ald-system'],
                keywords: ['ALD'],
                synonyms: ['atomic layer deposition'],
                blacklist: [],
                naicsCodes: [],
                cpvCodes: [],
                isActive: true,
            },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        const put = sendMock.mock.calls[0][0];
        expect(put.input.Item.GSI1PK).toBe('TENDER_KEYWORD_CONFIG_ACTIVE');
    });

    it('omits GSI1 key when isActive=false', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({});

        const { handler } = await import('./handler');
        await handler({
            info: { fieldName: 'upsertTenderKeywordConfig' },
            arguments: {
                productCategory: 'OldCat',
                productSlugs: [], keywords: [], synonyms: [], blacklist: [], naicsCodes: [], cpvCodes: [],
                isActive: false,
            },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        const put = sendMock.mock.calls[0][0];
        expect(put.input.Item.GSI1PK).toBeUndefined();
    });
});
```

- [ ] **Step 11.2: Verify failing + implement**

Add to imports:

```typescript
import {
    tenderKeywordConfigItemKey, tenderKeywordConfigActiveGsiKey,
    tenderStatusLogItemKey,
    TENDER_STATUSES, ACTIVE_TENDER_STATUSES, type TenderStatus,
} from '../../lib/tender-watch/keys';
```

Update `dispatchFieldName`:

```typescript
        case 'upsertTenderKeywordConfig':
            return upsertKeywordConfig(event.arguments, identity);
```

Add function:

```typescript
async function upsertKeywordConfig(
    args: {
        productCategory: string;
        productSlugs: string[];
        keywords: string[];
        synonyms: string[];
        blacklist: string[];
        naicsCodes: string[];
        cpvCodes: string[];
        isActive: boolean;
    },
    identity: string,
) {
    const nowIso = new Date().toISOString();
    const item: Record<string, unknown> = {
        ...tenderKeywordConfigItemKey(args.productCategory),
        entityType: 'TENDER_KEYWORD_CONFIG',
        ...args,
        updatedBy: identity,
        updatedAt: nowIso,
        ...(args.isActive ? tenderKeywordConfigActiveGsiKey(args.productCategory) : {}),
    };
    await ddb.send(new PutCommand({ TableName: TABLE(), Item: item }));
    console.log(JSON.stringify({
        event: 'tender.config.upserted',
        productCategory: args.productCategory,
        isActive: args.isActive,
        changedBy: identity,
    }));
    return item;
}
```

Update export. Run tests + commit:

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
git add amplify/functions/tender-api/
git commit -m "feat(tender): implement upsertTenderKeywordConfig

PutItem with GSI1 active key set only when isActive=true. Active configs
appear in the prefilter loadActiveConfigs() Query on
TENDER_KEYWORD_CONFIG_ACTIVE. Setting isActive=false removes the key, so
the config remains for audit but stops driving prefilter matches.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Lambda `runPrefilterPreview`

**Files:**
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

Two paths: configOverride (parse + use as the single config) vs saved (load all active configs).

- [ ] **Step 12.1: Append tests**

```typescript
describe('runPrefilterPreview', () => {
    it('uses configOverride when provided', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'runPrefilterPreview' },
            arguments: {
                title: 'atomic layer deposition tool',
                description: '',
                configOverride: {
                    productCategory: 'ALD',
                    productSlugs: ['ald-system'],
                    keywords: ['atomic layer deposition'],
                    synonyms: [],
                    blacklist: [],
                    naicsCodes: [],
                    cpvCodes: [],
                    isActive: true,
                },
            },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.passed).toBe(true);
        expect(result.matchedCategories).toEqual(['ALD']);
    });

    it('loads saved active configs when configOverride is omitted', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Items: [
            { productCategory: 'PECVD', isActive: true, keywords: ['PECVD'], synonyms: [], blacklist: [], naicsCodes: [], cpvCodes: [], productSlugs: ['p1'] },
        ] });

        const { handler } = await import('./handler');
        const result: any = await handler({
            info: { fieldName: 'runPrefilterPreview' },
            arguments: { title: 'PECVD reactor for university', description: '' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result.passed).toBe(true);
        expect(result.matchedCategories).toEqual(['PECVD']);
    });
});
```

- [ ] **Step 12.2: Implement**

Add to imports:

```typescript
import { matchesAnyConfig } from '../../lib/tender-watch/prefilter';
import type { TenderKeywordConfigItem } from '../../lib/tender-watch/types';
```

Update `dispatchFieldName`:

```typescript
        case 'runPrefilterPreview':
            return runPrefilterPreview(event.arguments);
```

Add function:

```typescript
async function runPrefilterPreview(args: {
    title: string;
    description: string;
    naicsCodes?: string[];
    cpvCodes?: string[];
    configOverride?: any;
}) {
    const tender = {
        title: args.title,
        description: args.description,
        naicsCodes: args.naicsCodes ?? [],
        cpvCodes: args.cpvCodes ?? [],
    };
    let configs: TenderKeywordConfigItem[];
    if (args.configOverride) {
        configs = [args.configOverride as TenderKeywordConfigItem];
    } else {
        const r = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG_ACTIVE' },
        }));
        configs = (r.Items ?? []) as TenderKeywordConfigItem[];
    }
    const result = matchesAnyConfig(tender, configs);
    return {
        matchedCategories: result.matchedCategories,
        matchedKeywords: result.matchedKeywords,
        passed: result.matchedCategories.length > 0,
    };
}
```

- [ ] **Step 12.3: Run + commit**

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
git add amplify/functions/tender-api/
git commit -m "feat(tender): implement runPrefilterPreview

Two paths: when configOverride is provided (admin testing unsaved form
state), wrap it as a single-config array; otherwise load all active
configs via GSI1. Either way, delegate to matchesAnyConfig from
lib/tender-watch/prefilter (Task 1's extracted pure function).

Mutation (not query) so AppSync caching doesn't return stale results
when the same input text is run against different unsaved configs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Lambda `translateTenderDescription` — Bedrock + Anthropic fallback

**Files:**
- Modify: `amplify/functions/tender-api/handler.ts`
- Modify: `amplify/functions/tender-api/handler.test.ts`

GetItem → return cached `descriptionEn` unless `force`; else Bedrock with Anthropic fallback; UpdateItem to cache result (without touching `updatedAt`).

- [ ] **Step 13.1: Append tests**

```typescript
describe('translateTenderDescription', () => {
    function bedrockBody(text: string) {
        const wrap = JSON.stringify({ content: [{ type: 'text', text }] });
        return { body: { transformToString: vi.fn().mockResolvedValue(wrap) } };
    }

    it('returns cached descriptionEn without calling Bedrock', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', descriptionEn: 'already translated' } });

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn();
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'translateTenderDescription' },
            arguments: { tenderId: 't1' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result).toBe('already translated');
        expect(bedrockSend).not.toHaveBeenCalled();
    });

    it('translates via Bedrock when no cached value and updates item', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', description: 'Descrizione tecnica', language: 'it' } });
        sendMock.mockResolvedValueOnce({});  // UpdateCommand to cache

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockResolvedValueOnce(bedrockBody('Technical description'));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'translateTenderDescription' },
            arguments: { tenderId: 't1' },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result).toBe('Technical description');
        expect(bedrockSend).toHaveBeenCalled();
    });

    it('force=true re-translates even when cached', async () => {
        const docMock = await import('@aws-sdk/lib-dynamodb');
        const sendMock = vi.fn();
        (docMock.DynamoDBDocumentClient.from as any).mockReturnValue({ send: sendMock });
        sendMock.mockResolvedValueOnce({ Item: { tenderId: 't1', description: 'src', language: 'it', descriptionEn: 'stale' } });
        sendMock.mockResolvedValueOnce({});

        const bedrockMock = await import('@aws-sdk/client-bedrock-runtime');
        const bedrockSend = vi.fn().mockResolvedValueOnce(bedrockBody('fresh'));
        (bedrockMock.BedrockRuntimeClient as any).mockImplementation(() => ({ send: bedrockSend }));

        const { handler } = await import('./handler');
        const result = await handler({
            info: { fieldName: 'translateTenderDescription' },
            arguments: { tenderId: 't1', force: true },
            identity: { username: 'admin', groups: ['admin'] },
        } as any);

        expect(result).toBe('fresh');
    });
});
```

- [ ] **Step 13.2: Implement**

Add to imports:

```typescript
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import Anthropic from '@anthropic-ai/sdk';

const bedrock = new BedrockRuntimeClient({});
const BEDROCK_TIMEOUT_MS = 8000;
const ANTHROPIC_TIMEOUT_MS = 20000;
```

Update `dispatchFieldName`:

```typescript
        case 'translateTenderDescription':
            return translateDescription(event.arguments);
```

Add functions:

```typescript
async function translateDescription(args: { tenderId: string; force?: boolean }): Promise<string> {
    const existing = await ddb.send(new GetCommand({
        TableName: TABLE(),
        Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
    }));
    if (!existing.Item) throw new Error(`Tender not found: ${args.tenderId}`);

    const cached = existing.Item.descriptionEn as string | undefined;
    if (cached && !args.force) return cached;

    const description = (existing.Item.description as string | undefined) ?? '';
    const language = (existing.Item.language as string | undefined) ?? 'unknown';
    const prompt = buildTranslatePrompt(description, language);

    let translated: string | null = null;
    try {
        translated = await callBedrock(prompt);
    } catch (err) {
        console.warn(JSON.stringify({ event: 'tender.translate.bedrock-failed', tenderId: args.tenderId, error: String(err) }));
        try {
            translated = await callAnthropic(prompt);
        } catch (err2) {
            console.error(JSON.stringify({
                event: 'tender.translate.both-providers-failed',
                tenderId: args.tenderId,
                bedrockError: String(err),
                anthropicError: String(err2),
            }));
            throw new Error('Translation unavailable');
        }
    }

    const nowIso = new Date().toISOString();
    // Don't touch updatedAt — translation is a derived field, doesn't invalidate optimistic lock token.
    await ddb.send(new UpdateCommand({
        TableName: TABLE(),
        Key: { PK: `TENDER#${args.tenderId}`, SK: 'METADATA' },
        UpdateExpression: 'SET descriptionEn = :en, descriptionEnAt = :now',
        ExpressionAttributeValues: { ':en': translated, ':now': nowIso },
    }));
    return translated;
}

function buildTranslatePrompt(description: string, language: string): string {
    const truncated = description.length > 4000 ? description.slice(0, 4000) : description;
    return [
        'Translate this procurement tender description to English. Preserve technical terminology (CPV codes, model numbers, scientific units) verbatim. Output translation only, no commentary.',
        '',
        `Original (language: ${language}):`,
        truncated,
    ].join('\n');
}

async function callBedrock(prompt: string): Promise<string> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), BEDROCK_TIMEOUT_MS);
    try {
        const res = await bedrock.send(new InvokeModelCommand({
            modelId: process.env.BEDROCK_MODEL_ID!,
            contentType: 'application/json',
            accept: 'application/json',
            body: JSON.stringify({
                anthropic_version: 'bedrock-2023-05-31',
                max_tokens: 2000,
                messages: [{ role: 'user', content: prompt }],
            }),
        }), { abortSignal: ctrl.signal });
        const text = await (res.body as any).transformToString('utf-8');
        const wrap = JSON.parse(text);
        return ((wrap.content?.[0]?.text as string) ?? '').trim();
    } finally {
        clearTimeout(t);
    }
}

async function callAnthropic(prompt: string): Promise<string> {
    const client = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY!,
        timeout: ANTHROPIC_TIMEOUT_MS,
    });
    const res = await client.messages.create({
        model: process.env.CLAUDE_MODEL!,
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
    });
    const block = res.content[0] as any;
    return ((block?.text as string) ?? '').trim();
}
```

Update export. Run + commit:

```bash
npm test -- amplify/functions/tender-api/handler.test.ts
git add amplify/functions/tender-api/
git commit -m "feat(tender): implement translateTenderDescription with provider fallback

Cached path: return descriptionEn from META if present and force=false.
Translation path: Bedrock Claude Haiku with 8s AbortController timeout;
on failure, Anthropic API with 20s timeout. On both-providers failure,
throw 'Translation unavailable' — does NOT cache.

On success, UpdateItem to cache descriptionEn + descriptionEnAt. Crucially
does NOT touch updatedAt — translation is a derived field, and bumping
updatedAt would invalidate the optimistic-lock token used by
updateTenderStatus (race: someone clicks Translate between a tender load
and a status save → spurious Conflict).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: backend.ts wiring — IAM, env, Bedrock grant

**Files:**
- Modify: `amplify/backend.ts`

Register tenderApi, grant intelligenceTable r/w + Bedrock invoke + env vars.

- [ ] **Step 14.1: Add import + defineBackend entry**

Add near the other function imports at the top of `amplify/backend.ts`:

```typescript
import { tenderApi } from './functions/tender-api/resource';
```

In the `defineBackend({...})` block, add `tenderApi`:

```typescript
const backend = defineBackend({
    // ...existing functions...
    submitLead,
    submitQuestion,
    tenderApi,
    // Tender Watch — Phase 1
    fetchSam,
    // ...
});
```

- [ ] **Step 14.2: Add CDK section at end of file**

Append after the existing CloudWatch alarms / org wiring sections:

```typescript
// =============================================================================
// Tender Admin (Phase 2)
// See docs/superpowers/specs/2026-05-15-tender-watch-phase-2-design.md
// =============================================================================

const tenderApiStack = Stack.of(backend.tenderApi.resources.lambda);

intelligenceTable.grantReadWriteData(backend.tenderApi.resources.lambda);
backend.tenderApi.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);

// Bedrock invoke (mirrors match-with-llm / organization-api).
backend.tenderApi.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
    ],
}));
```

- [ ] **Step 14.3: Type-check**

```bash
npx tsc --noEmit -p amplify 2>&1 | head -5
```
Expected: clean.

- [ ] **Step 14.4: Commit**

```bash
git add amplify/backend.ts
git commit -m "chore(tender): wire tender-api Lambda in backend.ts

- Register in defineBackend
- Grant intelligenceTable read/write
- Inject INTELLIGENCE_TABLE env var
- Bedrock invoke policy (same model ARNs as match-with-llm / org-api)

ANTHROPIC_API_KEY / BEDROCK_MODEL_ID / CLAUDE_MODEL come from the
secrets + literals declared in resource.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Install `react-hot-toast` + Toaster mount + `notify.ts` wrapper

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/lib/notify.ts`
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 15.1: Install dep**

```bash
npm install react-hot-toast@^2.4.1
```

- [ ] **Step 15.2: Create wrapper `src/lib/notify.ts`**

```typescript
import toast from 'react-hot-toast';

/**
 * Notification helper — wraps react-hot-toast so the library is swappable
 * without touching every call site (Phase 2 spec risk #6).
 */
export const notify = {
    success(message: string) { toast.success(message); },
    error(message: string) { toast.error(message); },
    info(message: string) { toast(message); },
    loading(message: string, id?: string) {
        return toast.loading(message, id ? { id } : undefined);
    },
    dismiss(id?: string) { toast.dismiss(id); },
};
```

- [ ] **Step 15.3: Mount `<Toaster />` in AdminLayout**

In `src/components/admin/AdminLayout.tsx`, add at the top with other imports:

```typescript
import { Toaster } from 'react-hot-toast';
```

Inside the layout JSX, just before the closing `</div>` of the root container (after `<Outlet />`):

```tsx
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
```

- [ ] **Step 15.4: Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add package.json package-lock.json src/lib/notify.ts src/components/admin/AdminLayout.tsx
git commit -m "chore(tender): install react-hot-toast + Toaster mount + notify wrapper

Tender admin actions need user feedback (status saved, conflict, etc.).
react-hot-toast is ~2KB gzipped, headless, matches our existing styling
needs. Mounted in AdminLayout so the surface is admin-only.

notify.ts wraps the library API so a future swap is a one-file change
(Phase 2 spec Risk #6).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: Frontend service layer `tenderAdminService.ts`

**Files:**
- Create: `src/services/tenderAdminService.ts`

Thin wrappers around `client.queries/mutations.*` matching `orderAdminService` / `organizationAdminService` pattern.

- [ ] **Step 16.1: Create service**

```typescript
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const AUTH = { authMode: 'userPool' as const };

export interface ListTendersArgs {
    statuses?: string[];
    includeExpired?: boolean;
    countries?: string[];
    categories?: string[];
    minScore?: number;
    postedDateFrom?: string;
    postedDateTo?: string;
    search?: string;
    sortBy?: 'score' | 'postedDate' | 'deadline';
    sortDir?: 'asc' | 'desc';
    limit?: number;
    nextToken?: string;
}

export async function listTenders(args: ListTendersArgs) {
    const { data, errors } = await client.queries.listTenders(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function getTender(tenderId: string) {
    const { data, errors } = await client.queries.getTender({ tenderId } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function listKeywordConfigs(includeInactive = false) {
    const { data, errors } = await client.queries.listTenderKeywordConfigs({ includeInactive } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data ?? [];
}

export async function updateTenderStatus(args: { tenderId: string; toStatus: string; note?: string; assignedTo?: string }) {
    const { data, errors } = await client.mutations.updateTenderStatus(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function bulkUpdateTenderStatus(args: { tenderIds: string[]; toStatus: string }): Promise<number> {
    const { data, errors } = await client.mutations.bulkUpdateTenderStatus(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data as number;
}

export async function upsertKeywordConfig(args: {
    productCategory: string;
    productSlugs: string[];
    keywords: string[];
    synonyms: string[];
    blacklist: string[];
    naicsCodes: string[];
    cpvCodes: string[];
    isActive: boolean;
}) {
    const { data, errors } = await client.mutations.upsertTenderKeywordConfig(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function runPrefilterPreview(args: {
    title: string;
    description: string;
    naicsCodes?: string[];
    cpvCodes?: string[];
    configOverride?: any;
}) {
    const { data, errors } = await client.mutations.runPrefilterPreview(args as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data;
}

export async function translateTenderDescription(tenderId: string, force = false): Promise<string> {
    const { data, errors } = await client.mutations.translateTenderDescription({ tenderId, force } as any, AUTH);
    if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
    return data as string;
}

/**
 * Loops nextToken to fetch all tenders matching the filter, caps at 500 rows.
 * Returns a CSV Blob.
 */
export async function exportTendersAsCsv(filters: ListTendersArgs): Promise<Blob> {
    const MAX_ROWS = 500;
    const rows: any[] = [];
    let nextToken: string | undefined = undefined;
    while (rows.length < MAX_ROWS) {
        const page: any = await listTenders({ ...filters, limit: 100, nextToken });
        rows.push(...((page?.items ?? []) as any[]));
        nextToken = page?.nextToken ?? undefined;
        if (!nextToken) break;
    }
    const truncated = rows.slice(0, MAX_ROWS);
    const header = ['tenderId', 'source', 'title', 'agency', 'country', 'postedDate', 'deadline', 'overallScore', 'status', 'sourceUrl'];
    const escape = (v: any) => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [
        header.join(','),
        ...truncated.map((r) => header.map((h) => escape(r[h])).join(',')),
    ].join('\n');
    return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}
```

- [ ] **Step 16.2: Type-check + commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add src/services/tenderAdminService.ts
git commit -m "feat(tender): frontend service layer

8 wrappers around client.queries/mutations + CSV export helper. Matches
the orderAdminService / organizationAdminService thin-wrapper pattern
with consistent error concatenation.

CSV export loops nextToken with a 500-row cap (spec Risk #4 mitigation).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: Frontend hooks — `useTenders`, `useTender`, `useKeywordConfigs`

**Files:**
- Create: `src/hooks/useTenders.ts`
- Create: `src/hooks/useTender.ts`
- Create: `src/hooks/useKeywordConfigs.ts`

`{data, loading, error, refresh, filters, setFilters}` shape (matches `useOrganizations`).

- [ ] **Step 17.1: `useTenders.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/tenderAdminService';
import type { ListTendersArgs } from '../services/tenderAdminService';

export function useTenders(initial: ListTendersArgs = {}) {
    const [filters, setFilters] = useState<ListTendersArgs>(initial);
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await svc.listTenders(filters);
            setData(result);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { void refresh(); }, [refresh]);

    return { data, loading, error, refresh, filters, setFilters };
}
```

- [ ] **Step 17.2: `useTender.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/tenderAdminService';

export function useTender(tenderId: string | undefined) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (!tenderId) return;
        setLoading(true);
        setError(null);
        try {
            const result = await svc.getTender(tenderId);
            setData(result);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [tenderId]);

    useEffect(() => { void refresh(); }, [refresh]);

    return { data, loading, error, refresh };
}
```

- [ ] **Step 17.3: `useKeywordConfigs.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/tenderAdminService';

export function useKeywordConfigs(includeInactive = false) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await svc.listKeywordConfigs(includeInactive);
            setData((result ?? []) as any[]);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => { void refresh(); }, [refresh]);

    return { data, loading, error, refresh };
}
```

- [ ] **Step 17.4: Commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add src/hooks/useTenders.ts src/hooks/useTender.ts src/hooks/useKeywordConfigs.ts
git commit -m "feat(tender): frontend hooks — useTenders, useTender, useKeywordConfigs

Same {data, loading, error, refresh} shape as useOrganizations.
useTenders also exposes {filters, setFilters} for filter-bar binding.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: Nav integration + routes

**Files:**
- Modify: `src/components/admin/AdminLayout.tsx`
- Modify: `src/routes/index.tsx`

- [ ] **Step 18.1: Add `Tenders` to NAV_ITEMS**

In `src/components/admin/AdminLayout.tsx`, find the `NAV_ITEMS` array and add the Tenders entry between RFQs and Leads:

```typescript
const NAV_ITEMS = [
    { path: '/admin/dashboard',     label: 'Dashboard',     icon: 'dashboard' },
    { path: '/admin/orders',        label: 'Orders',        icon: 'shopping_cart' },
    { path: '/admin/rfqs',          label: 'RFQs',          icon: 'request_quote' },
    { path: '/admin/tenders',       label: 'Tenders',       icon: 'gavel' },
    { path: '/admin/leads',         label: 'Leads',         icon: 'contact_mail' },
    { path: '/admin/organizations', label: 'Organizations', icon: 'business' },
    { path: '/admin/insights',      label: 'Insights',      icon: 'insights' },
    { path: '/admin/questions',     label: 'Q&A',           icon: 'forum' },
    { path: '/admin/analytics',     label: 'Analytics',     icon: 'analytics' },
];
```

(Match whatever exact prop names the existing `NAV_ITEMS` uses — `path`/`label`/`icon` per Phase C precedent.)

- [ ] **Step 18.2: Add routes**

In `src/routes/index.tsx`, add the 3 lazy imports near other admin imports:

```typescript
const TenderListPage = lazy(() => import('../pages/admin/TenderListPage').then(m => ({ default: m.TenderListPage })));
const TenderDetailPage = lazy(() => import('../pages/admin/TenderDetailPage').then(m => ({ default: m.TenderDetailPage })));
const TenderKeywordConfigPage = lazy(() => import('../pages/admin/TenderKeywordConfigPage').then(m => ({ default: m.TenderKeywordConfigPage })));
```

Inside the `<Route path="/admin" element={<AdminRoute />}>` block, add (order matters — `/keywords` before `/:tenderId`):

```typescript
          <Route path="tenders" element={<TenderListPage />} />
          <Route path="tenders/keywords" element={<TenderKeywordConfigPage />} />
          <Route path="tenders/:tenderId" element={<TenderDetailPage />} />
```

- [ ] **Step 18.3: Note about type-check**

`tsc --noEmit` will fail because the page modules don't exist yet. That's expected — they land in Tasks 20–23. Skip type-check; commit anyway.

- [ ] **Step 18.4: Commit**

```bash
git add src/components/admin/AdminLayout.tsx src/routes/index.tsx
git commit -m "chore(tender): nav + routes for tender admin pages

Tenders nav entry between RFQs and Leads (workflow order: RFQ = current
sales, Tenders = potential opportunities, Leads = early funnel).

Three routes: list, keywords (BEFORE :tenderId so 'keywords' isn't
captured as a tender id), detail.

Pages themselves land in Tasks 20-23; commit will not type-check
standalone, that's intentional.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 19: Shared `TagInput` component

**Files:**
- Create: `src/components/admin/TagInput.tsx`

Used in 6+ fields on keyword config page. Preserves special characters (`/`, `-`, `+`, `.`) — only commits on Enter or `, `.

- [ ] **Step 19.1: Create component**

```tsx
import { useState, KeyboardEvent, ClipboardEvent } from 'react';

interface Props {
    value: string[];
    onChange: (next: string[]) => void;
    placeholder?: string;
    validate?: (term: string) => boolean;
}

export function TagInput({ value, onChange, placeholder, validate }: Props) {
    const [draft, setDraft] = useState('');

    function commit(raw: string) {
        const term = raw.trim();
        if (!term) return;
        if (validate && !validate(term)) return;
        if (value.includes(term)) return;
        onChange([...value, term]);
    }

    function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') {
            e.preventDefault();
            commit(draft);
            setDraft('');
        } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
            onChange(value.slice(0, -1));
        }
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const next = e.target.value;
        // Auto-commit when user types ', ' (comma + space)
        if (next.endsWith(', ')) {
            commit(next.slice(0, -2));
            setDraft('');
        } else {
            setDraft(next);
        }
    }

    function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
        const text = e.clipboardData.getData('text');
        if (text.includes('\n') || text.includes(', ')) {
            e.preventDefault();
            const parts = text.split(/\n|,\s/).map((p) => p.trim()).filter(Boolean);
            const additions = parts.filter((p) => !value.includes(p) && (!validate || validate(p)));
            onChange([...value, ...additions]);
            setDraft('');
        }
    }

    function remove(idx: number) {
        onChange([...value.slice(0, idx), ...value.slice(idx + 1)]);
    }

    return (
        <div className="flex flex-wrap gap-1.5 p-2 rounded-lg border border-outline-variant bg-surface-container-lowest focus-within:ring-2 focus-within:ring-primary">
            {value.map((t, i) => (
                <span key={`${t}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-xs font-medium text-on-secondary-container">
                    {t}
                    <button type="button" onClick={() => remove(i)} className="text-on-secondary-container/70 hover:text-on-secondary-container">×</button>
                </span>
            ))}
            <input
                type="text"
                value={draft}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder={value.length === 0 ? placeholder : ''}
                className="flex-1 min-w-[120px] bg-transparent outline-none text-sm text-on-surface placeholder:text-on-surface-variant"
            />
        </div>
    );
}
```

- [ ] **Step 19.2: Commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add src/components/admin/TagInput.tsx
git commit -m "feat(tender): TagInput shared component

Chip + free-text input that ONLY commits on Enter or comma+space (per
spec — semiconductor terminology often includes /, -, +, . which must
not auto-split). Backspace on empty removes last tag. Paste splits on
\\n or ', ' separators only. Optional validate fn for code formats.

Tailwind + MD3 tokens matching existing admin styling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 20: List page (a) — KPI cards + filter bar + table shell

**Files:**
- Create: `src/pages/admin/TenderListPage.tsx`
- Create: `src/components/admin/TenderKpiCards.tsx`
- Create: `src/components/admin/TenderFilterBar.tsx`
- Create: `src/components/admin/TenderTable.tsx`

List page chrome + table (without inline status edit / bulk actions — those land in Task 21).

- [ ] **Step 20.1: `TenderKpiCards.tsx`**

```tsx
interface Props {
    todayNew: number;
    weekNew: number;
    highPriority: number;
    closingSoon: number;
    onClick: (kpi: 'todayNew' | 'weekNew' | 'highPriority' | 'closingSoon') => void;
}

const CARDS: Array<{ key: keyof Props extends infer K ? K : never; label: string; field: string }> = [
    { key: 'todayNew', label: 'Today (new)', field: 'todayNew' } as any,
    { key: 'weekNew', label: 'This week (new)', field: 'weekNew' } as any,
    { key: 'highPriority', label: 'High priority (≥80)', field: 'highPriority' } as any,
    { key: 'closingSoon', label: 'Closing <7 days', field: 'closingSoon' } as any,
];

export function TenderKpiCards({ todayNew, weekNew, highPriority, closingSoon, onClick }: Props) {
    const values = { todayNew, weekNew, highPriority, closingSoon } as const;
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {CARDS.map((c: any) => (
                <button
                    key={c.key}
                    onClick={() => onClick(c.key as any)}
                    className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm hover:-translate-y-0.5 transition-transform p-4 text-left"
                >
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{c.label}</p>
                    <div className="mt-2 text-2xl md:text-3xl font-headline font-black text-on-surface">{(values as any)[c.key as string]}</div>
                </button>
            ))}
        </div>
    );
}
```

- [ ] **Step 20.2: `TenderFilterBar.tsx`**

```tsx
import type { ListTendersArgs } from '../../services/tenderAdminService';

interface Props {
    filters: ListTendersArgs;
    onChange: (next: ListTendersArgs) => void;
}

const STATUS_OPTIONS = ['new', 'reviewing', 'pursuing', 'submitted', 'won', 'lost', 'not_relevant'];

export function TenderFilterBar({ filters, onChange }: Props) {
    return (
        <div className="flex flex-wrap gap-2 items-center mb-3 p-3 bg-surface-container-lowest rounded-lg border border-outline-variant/30">
            <input
                type="text"
                value={filters.search ?? ''}
                onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
                placeholder="Search title / agency..."
                className="flex-1 min-w-[200px] px-3 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            />
            <select
                value={(filters.statuses ?? [])[0] ?? ''}
                onChange={(e) => onChange({ ...filters, statuses: e.target.value ? [e.target.value] : undefined })}
                className="px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            >
                <option value="">All active</option>
                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <input
                type="number"
                value={filters.minScore ?? ''}
                onChange={(e) => onChange({ ...filters, minScore: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Min score"
                className="w-28 px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            />
            <select
                value={filters.sortBy ?? 'score'}
                onChange={(e) => onChange({ ...filters, sortBy: e.target.value as any })}
                className="px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            >
                <option value="score">Sort: Score</option>
                <option value="postedDate">Sort: Posted</option>
                <option value="deadline">Sort: Deadline</option>
            </select>
            <label className="flex items-center gap-1 text-xs text-on-surface-variant">
                <input
                    type="checkbox"
                    checked={!!filters.includeExpired}
                    onChange={(e) => onChange({ ...filters, includeExpired: e.target.checked || undefined })}
                />
                Include expired
            </label>
        </div>
    );
}
```

- [ ] **Step 20.3: `TenderTable.tsx`**

```tsx
import { Link } from 'react-router-dom';

interface Props {
    items: any[];
}

function scoreColor(score: number): string {
    if (score >= 80) return 'bg-error-container text-on-error-container';
    if (score >= 60) return 'bg-tertiary-container text-on-tertiary-container';
    if (score >= 30) return 'bg-secondary-container text-on-secondary-container';
    return 'bg-surface-container-high text-on-surface-variant';
}

function deadlineLabel(deadline: string | null | undefined): string {
    if (!deadline) return '—';
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return deadline;
    const days = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const dateStr = deadline.slice(0, 10);
    if (days < 0) return `${dateStr} (expired)`;
    if (days < 7) return `${dateStr} (${days}d)`;
    return `${dateStr} (${days}d)`;
}

export function TenderTable({ items }: Props) {
    if (items.length === 0) {
        return <div className="p-8 text-center text-sm text-on-surface-variant">No tenders match these filters.</div>;
    }
    return (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-surface-container-low border-b border-outline-variant/30">
                    <tr>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Score</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Title</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Agency</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Country</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Deadline</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((t) => {
                        const dlLabel = deadlineLabel(t.deadline);
                        const closingSoon = t.deadline && (new Date(t.deadline).getTime() - Date.now()) < 7 * 86400_000;
                        return (
                            <tr key={t.tenderId} className="border-b border-outline-variant/10 hover:bg-surface-container-low/50">
                                <td className="px-3 py-2">
                                    <span className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-[11px] font-bold ${scoreColor(t.overallScore ?? 0)}`}>
                                        {t.overallScore ?? 0}
                                    </span>
                                </td>
                                <td className="px-3 py-2 max-w-md truncate">
                                    <Link to={`/admin/tenders/${t.tenderId}`} className="text-primary hover:underline" title={t.title}>{t.title}</Link>
                                </td>
                                <td className="px-3 py-2 max-w-[200px] truncate" title={t.agency}>{t.agency}</td>
                                <td className="px-3 py-2 text-xs text-on-surface-variant">{t.country ?? '—'}</td>
                                <td className={`px-3 py-2 text-xs ${closingSoon ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{dlLabel}</td>
                                <td className="px-3 py-2">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-on-surface-variant uppercase tracking-wider">{t.status ?? 'new'}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 20.4: `TenderListPage.tsx`**

```tsx
import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTenders } from '../../hooks/useTenders';
import { TenderKpiCards } from '../../components/admin/TenderKpiCards';
import { TenderFilterBar } from '../../components/admin/TenderFilterBar';
import { TenderTable } from '../../components/admin/TenderTable';
import type { ListTendersArgs } from '../../services/tenderAdminService';

export function TenderListPage() {
    const [searchParams, setSearchParams] = useSearchParams();

    // URL → filters
    const initialFilters: ListTendersArgs = useMemo(() => ({
        statuses: searchParams.get('statuses')?.split(',').filter(Boolean) ?? undefined,
        countries: searchParams.get('countries')?.split(',').filter(Boolean) ?? undefined,
        minScore: searchParams.get('minScore') ? Number(searchParams.get('minScore')) : undefined,
        sortBy: (searchParams.get('sortBy') as any) ?? undefined,
        sortDir: (searchParams.get('sortDir') as any) ?? undefined,
        search: searchParams.get('search') ?? undefined,
        includeExpired: searchParams.get('includeExpired') === '1' || undefined,
    }), []); // intentionally empty — initial mount only

    const { data, loading, error, filters, setFilters, refresh } = useTenders(initialFilters);

    function updateFilters(next: ListTendersArgs) {
        setFilters(next);
        // Sync to URL
        const p = new URLSearchParams();
        if (next.statuses?.length) p.set('statuses', next.statuses.join(','));
        if (next.countries?.length) p.set('countries', next.countries.join(','));
        if (typeof next.minScore === 'number') p.set('minScore', String(next.minScore));
        if (next.sortBy) p.set('sortBy', next.sortBy);
        if (next.sortDir) p.set('sortDir', next.sortDir);
        if (next.search) p.set('search', next.search);
        if (next.includeExpired) p.set('includeExpired', '1');
        setSearchParams(p);
    }

    const items = (data?.items ?? []) as any[];
    const totalActive = data?.totalActiveUnfiltered ?? items.length;

    // Compute KPI values client-side from the loaded page (Phase 2 spec accepted this approach)
    const now = Date.now();
    const todayKey = new Date().toISOString().slice(0, 10);
    const todayNew = items.filter((i) => i.status === 'new' && (i.postedDate ?? '').slice(0, 10) === todayKey).length;
    const weekNew = items.filter((i) => {
        if (i.status !== 'new' || !i.postedDate) return false;
        return now - new Date(i.postedDate).getTime() <= 7 * 86400_000;
    }).length;
    const highPriority = items.filter((i) => (i.overallScore ?? 0) >= 80).length;
    const closingSoon = items.filter((i) => i.deadline && (new Date(i.deadline).getTime() - now) <= 7 * 86400_000).length;

    return (
        <div>
            <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-1">Tender Watch</p>
                <h1 className="font-headline text-2xl md:text-4xl font-black text-on-surface tracking-tighter">Tenders</h1>
                <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-on-surface-variant">Showing {items.length} / ~{totalActive} active</span>
                    <Link to="/admin/tenders/keywords" className="text-xs text-primary hover:underline">⚙ Keyword config</Link>
                    <button onClick={refresh} className="text-xs text-primary hover:underline">↻ Refresh</button>
                </div>
            </div>

            <TenderKpiCards
                todayNew={todayNew}
                weekNew={weekNew}
                highPriority={highPriority}
                closingSoon={closingSoon}
                onClick={(kpi) => {
                    if (kpi === 'todayNew') updateFilters({ ...filters, statuses: ['new'] });
                    else if (kpi === 'weekNew') updateFilters({ ...filters, statuses: ['new'] });
                    else if (kpi === 'highPriority') updateFilters({ ...filters, minScore: 80 });
                    // closingSoon — client-side filter, no server param yet
                }}
            />

            <TenderFilterBar filters={filters} onChange={updateFilters} />

            {loading && <div className="text-center py-8 text-sm text-on-surface-variant">Loading tenders…</div>}
            {error && <div className="bg-error-container text-on-error-container p-4 rounded-lg mb-3 text-sm">{error.message}</div>}
            {data && <TenderTable items={items} />}
        </div>
    );
}
```

- [ ] **Step 20.5: Commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add src/pages/admin/TenderListPage.tsx src/components/admin/TenderKpiCards.tsx src/components/admin/TenderFilterBar.tsx src/components/admin/TenderTable.tsx
git commit -m "feat(tender): list page (KPI cards + filter bar + table)

TenderListPage with URL-synced filters (statuses, countries, minScore,
sortBy/Dir, search, includeExpired), 4 click-through KPI cards, filter
bar, and a sortable table with score chip + deadline countdown.

Inline status edit and bulk actions land in Task 21.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 21: List page (b) — inline status dropdown + bulk actions + CSV export

**Files:**
- Create: `src/components/admin/TenderStatusDropdown.tsx`
- Create: `src/components/admin/TenderStatusChangeDialog.tsx`
- Create: `src/components/admin/TenderBulkActionBar.tsx`
- Modify: `src/components/admin/TenderTable.tsx`
- Modify: `src/pages/admin/TenderListPage.tsx`

- [ ] **Step 21.1: `TenderStatusChangeDialog.tsx`**

```tsx
import { useState } from 'react';

interface Props {
    tenderId: string;
    fromStatus: string;
    toStatus: string;
    noteRequired: boolean;
    onConfirm: (note: string | undefined) => Promise<void>;
    onCancel: () => void;
}

export function TenderStatusChangeDialog({ tenderId, fromStatus, toStatus, noteRequired, onConfirm, onCancel }: Props) {
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const canConfirm = !noteRequired || note.trim().length >= 3;

    async function submit() {
        if (!canConfirm) return;
        setBusy(true);
        try { await onConfirm(note.trim() || undefined); }
        finally { setBusy(false); }
    }

    return (
        <div className="fixed inset-0 z-50 bg-scrim/50 flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl p-5 max-w-md w-full shadow-xl">
                <h3 className="font-headline text-lg font-bold text-on-surface mb-2">
                    Change status: {fromStatus} → {toStatus}
                </h3>
                <p className="text-sm text-on-surface-variant mb-3">{tenderId}</p>
                <label className="text-xs font-medium uppercase tracking-wider text-on-surface-variant mb-1 block">
                    {noteRequired ? <>Reason <span className="text-error">*</span></> : 'Note (optional)'}
                </label>
                <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface text-sm text-on-surface mb-4"
                    placeholder={noteRequired ? 'At least 3 characters required' : 'Anything noteworthy about this change'}
                />
                <div className="flex justify-end gap-2">
                    <button onClick={onCancel} disabled={busy} className="px-3 py-1.5 text-sm rounded-md border border-outline-variant text-on-surface hover:bg-surface-container-low">Cancel</button>
                    <button onClick={submit} disabled={!canConfirm || busy} className="px-3 py-1.5 text-sm rounded-md bg-primary text-on-primary disabled:opacity-50">Confirm</button>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 21.2: `TenderStatusDropdown.tsx`**

```tsx
import { useState } from 'react';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';
import { TenderStatusChangeDialog } from './TenderStatusChangeDialog';

const STATUSES = ['new', 'reviewing', 'pursuing', 'submitted', 'won', 'lost', 'not_relevant'] as const;
const NOTE_REQUIRED = new Set(['not_relevant', 'lost']);

interface Props {
    tender: any;
    onUpdated: () => void;
}

export function TenderStatusDropdown({ tender, onUpdated }: Props) {
    const [pending, setPending] = useState<string | null>(null);

    async function applyStatus(toStatus: string, note?: string) {
        try {
            await svc.updateTenderStatus({ tenderId: tender.tenderId, toStatus, note });
            notify.success(`Status → ${toStatus}`);
            onUpdated();
        } catch (err: any) {
            const msg = String(err?.message ?? err);
            if (/Conflict/i.test(msg)) {
                notify.error('Tender was modified by another user — refreshing.');
                onUpdated();
            } else {
                notify.error(`Failed: ${msg}`);
            }
        }
    }

    function handleChange(toStatus: string) {
        if (toStatus === tender.status) return;
        if (NOTE_REQUIRED.has(toStatus)) {
            setPending(toStatus);
        } else {
            void applyStatus(toStatus);
        }
    }

    return (
        <>
            <select
                value={tender.status ?? 'new'}
                onChange={(e) => handleChange(e.target.value)}
                className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-container-high text-on-surface-variant uppercase tracking-wider border border-outline-variant/30"
            >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {pending && (
                <TenderStatusChangeDialog
                    tenderId={tender.tenderId}
                    fromStatus={tender.status ?? 'new'}
                    toStatus={pending}
                    noteRequired
                    onConfirm={async (note) => { await applyStatus(pending, note); setPending(null); }}
                    onCancel={() => setPending(null)}
                />
            )}
        </>
    );
}
```

- [ ] **Step 21.3: `TenderBulkActionBar.tsx`**

```tsx
import { useState } from 'react';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';

const BULK_TARGETS = ['reviewing', 'pursuing', 'not_relevant'] as const;

interface Props {
    selectedIds: string[];
    onCleared: () => void;
    onUpdated: () => void;
}

export function TenderBulkActionBar({ selectedIds, onCleared, onUpdated }: Props) {
    const [busy, setBusy] = useState(false);
    if (selectedIds.length === 0) return null;

    async function apply(target: string) {
        setBusy(true);
        try {
            const count = await svc.bulkUpdateTenderStatus({ tenderIds: selectedIds, toStatus: target });
            notify.success(`${count}/${selectedIds.length} tenders → ${target}`);
            onUpdated();
            onCleared();
        } catch (err: any) {
            notify.error(String(err?.message ?? err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="sticky bottom-3 mx-auto mt-4 max-w-2xl bg-surface-container-high rounded-full px-4 py-2 shadow-lg border border-outline-variant flex items-center gap-3">
            <span className="text-sm font-medium text-on-surface">{selectedIds.length} selected</span>
            <span className="flex-1" />
            {BULK_TARGETS.map((t) => (
                <button
                    key={t}
                    onClick={() => apply(t)}
                    disabled={busy}
                    className="px-3 py-1 text-xs rounded-full bg-primary text-on-primary disabled:opacity-50 hover:bg-primary/90"
                >
                    → {t}
                </button>
            ))}
            <button onClick={onCleared} className="px-2 py-1 text-xs text-on-surface-variant hover:text-on-surface">Clear</button>
        </div>
    );
}
```

- [ ] **Step 21.4: Update `TenderTable.tsx` to add checkboxes + inline status dropdown**

Replace the existing `TenderTable.tsx` with a version that takes `selectedIds`, `onToggleSelected`, `onRefresh` props and uses `TenderStatusDropdown` in the Status column:

```tsx
import { Link } from 'react-router-dom';
import { TenderStatusDropdown } from './TenderStatusDropdown';

interface Props {
    items: any[];
    selectedIds: string[];
    onToggleSelected: (id: string) => void;
    onRefresh: () => void;
}

function scoreColor(score: number): string {
    if (score >= 80) return 'bg-error-container text-on-error-container';
    if (score >= 60) return 'bg-tertiary-container text-on-tertiary-container';
    if (score >= 30) return 'bg-secondary-container text-on-secondary-container';
    return 'bg-surface-container-high text-on-surface-variant';
}

function deadlineLabel(deadline: string | null | undefined): string {
    if (!deadline) return '—';
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return deadline;
    const days = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const dateStr = deadline.slice(0, 10);
    if (days < 0) return `${dateStr} (expired)`;
    return `${dateStr} (${days}d)`;
}

export function TenderTable({ items, selectedIds, onToggleSelected, onRefresh }: Props) {
    if (items.length === 0) {
        return <div className="p-8 text-center text-sm text-on-surface-variant">No tenders match these filters.</div>;
    }
    const selectedSet = new Set(selectedIds);
    return (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-surface-container-low border-b border-outline-variant/30">
                    <tr>
                        <th className="px-2 py-2 w-8"></th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Score</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Title</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Agency</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Country</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Deadline</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((t) => {
                        const dlLabel = deadlineLabel(t.deadline);
                        const closingSoon = t.deadline && (new Date(t.deadline).getTime() - Date.now()) < 7 * 86400_000;
                        return (
                            <tr key={t.tenderId} className="border-b border-outline-variant/10 hover:bg-surface-container-low/50">
                                <td className="px-2 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedSet.has(t.tenderId)}
                                        onChange={() => onToggleSelected(t.tenderId)}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <span className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-[11px] font-bold ${scoreColor(t.overallScore ?? 0)}`}>
                                        {t.overallScore ?? 0}
                                    </span>
                                </td>
                                <td className="px-3 py-2 max-w-md truncate">
                                    <Link to={`/admin/tenders/${t.tenderId}`} className="text-primary hover:underline" title={t.title}>{t.title}</Link>
                                </td>
                                <td className="px-3 py-2 max-w-[200px] truncate" title={t.agency}>{t.agency}</td>
                                <td className="px-3 py-2 text-xs text-on-surface-variant">{t.country ?? '—'}</td>
                                <td className={`px-3 py-2 text-xs ${closingSoon ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{dlLabel}</td>
                                <td className="px-3 py-2">
                                    <TenderStatusDropdown tender={t} onUpdated={onRefresh} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
```

- [ ] **Step 21.5: Update `TenderListPage.tsx` to wire selection state + bulk bar + CSV export button**

Add to the existing `TenderListPage`:

```tsx
import { useState } from 'react';
import { TenderBulkActionBar } from '../../components/admin/TenderBulkActionBar';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';
```

Inside the component, add state:

```tsx
const [selectedIds, setSelectedIds] = useState<string[]>([]);

function toggleSelected(id: string) {
    setSelectedIds((curr) => curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id]);
}

async function exportCsv() {
    try {
        const blob = await svc.exportTendersAsCsv(filters);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `tenders-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        notify.success('CSV downloaded');
    } catch (err: any) {
        notify.error(String(err?.message ?? err));
    }
}
```

Add a CSV button next to the Refresh button:

```tsx
<button onClick={exportCsv} className="text-xs text-primary hover:underline">⬇ Export CSV</button>
```

Update the Table render:

```tsx
{data && <TenderTable items={items} selectedIds={selectedIds} onToggleSelected={toggleSelected} onRefresh={refresh} />}
<TenderBulkActionBar selectedIds={selectedIds} onCleared={() => setSelectedIds([])} onUpdated={refresh} />
```

- [ ] **Step 21.6: Commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add src/components/admin/TenderStatusDropdown.tsx src/components/admin/TenderStatusChangeDialog.tsx src/components/admin/TenderBulkActionBar.tsx src/components/admin/TenderTable.tsx src/pages/admin/TenderListPage.tsx
git commit -m "feat(tender): inline status edit + bulk actions + CSV export

- TenderStatusDropdown: inline select per row. For status changes that
  require a note (not_relevant / lost), opens TenderStatusChangeDialog
  with required-note textarea (Confirm disabled until len >= 3).
- TenderBulkActionBar: sticky bottom bar when 1+ rows selected; bulk
  targets reviewing / pursuing / not_relevant only (won/lost/submitted
  excluded — they need per-tender notes).
- TenderTable: checkboxes + status dropdown column.
- TenderListPage: selection state, CSV export button, bulk bar mount.

Conflict on optimistic-lock failure shows the toast + refreshes list.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 22: Detail page

**Files:**
- Create: `src/pages/admin/TenderDetailPage.tsx`
- Create: `src/components/admin/TenderHeaderPanel.tsx`
- Create: `src/components/admin/TenderMatchCard.tsx`
- Create: `src/components/admin/TenderAuditLog.tsx`

- [ ] **Step 22.1: `TenderHeaderPanel.tsx`**

```tsx
import { useState } from 'react';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';
import { TenderStatusChangeDialog } from './TenderStatusChangeDialog';

const STATUSES = ['new', 'reviewing', 'pursuing', 'submitted', 'won', 'lost', 'not_relevant'] as const;
const NOTE_REQUIRED = new Set(['not_relevant', 'lost']);

interface Props {
    tender: any;
    onUpdated: () => void;
}

export function TenderHeaderPanel({ tender, onUpdated }: Props) {
    const [pending, setPending] = useState<string | null>(null);

    async function applyStatus(toStatus: string, note?: string, assignedTo?: string) {
        try {
            await svc.updateTenderStatus({ tenderId: tender.tenderId, toStatus, note, assignedTo });
            notify.success(`Status → ${toStatus}`);
            onUpdated();
        } catch (err: any) {
            const msg = String(err?.message ?? err);
            if (/Conflict/i.test(msg)) {
                notify.error('Tender modified by another user — refreshing.');
                onUpdated();
            } else {
                notify.error(`Failed: ${msg}`);
            }
        }
    }

    function handleStatusChange(toStatus: string) {
        if (toStatus === tender.status) return;
        if (NOTE_REQUIRED.has(toStatus)) setPending(toStatus);
        else void applyStatus(toStatus);
    }

    const score = tender.overallScore ?? 0;
    const scoreColor = score >= 80 ? 'text-error' : score >= 60 ? 'text-tertiary' : score >= 30 ? 'text-secondary' : 'text-on-surface-variant';

    return (
        <aside className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4 lg:sticky lg:top-6 self-start">
            <h2 className="font-headline text-lg font-bold text-on-surface leading-snug">{tender.title}</h2>
            <p className="text-xs text-on-surface-variant mt-1">{tender.agency} {tender.country ? `· ${tender.country}` : ''}</p>
            <div className="mt-4 flex items-baseline gap-2">
                <span className={`text-3xl font-headline font-black ${scoreColor}`}>{score}</span>
                <span className="text-xs text-on-surface-variant">/100</span>
                {tender.isHighPriority && <span className="text-xs">🔥</span>}
            </div>
            <p className="text-xs text-on-surface-variant mt-2">
                Deadline: {tender.deadline ? tender.deadline.slice(0, 10) : 'no deadline'}
            </p>
            <div className="mt-4 space-y-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</label>
                <select
                    value={tender.status ?? 'new'}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
                >
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div className="mt-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">Assigned to</label>
                <input
                    type="text"
                    defaultValue={tender.assignedTo ?? ''}
                    onBlur={(e) => {
                        if (e.target.value !== (tender.assignedTo ?? '')) {
                            void applyStatus(tender.status ?? 'new', undefined, e.target.value || undefined);
                        }
                    }}
                    placeholder="username"
                    className="w-full px-2 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
                />
            </div>
            <div className="mt-4 space-y-2">
                <a href={tender.sourceUrl} target="_blank" rel="noreferrer" className="block px-3 py-1.5 rounded-md text-xs text-center bg-primary text-on-primary hover:bg-primary/90">
                    View on {tender.source}
                </a>
                {tender.status !== 'not_relevant' && (
                    <button onClick={() => setPending('not_relevant')} className="block w-full px-3 py-1.5 rounded-md text-xs text-error border border-error hover:bg-error-container/30">
                        Mark not relevant
                    </button>
                )}
            </div>
            {(tender.naicsCodes?.length || tender.cpvCodes?.length) ? (
                <div className="mt-4 text-xs">
                    {tender.naicsCodes?.length > 0 && <div className="mb-1"><strong>NAICS:</strong> {tender.naicsCodes.join(', ')}</div>}
                    {tender.cpvCodes?.length > 0 && <div><strong>CPV:</strong> {tender.cpvCodes.join(', ')}</div>}
                </div>
            ) : null}
            {pending && (
                <TenderStatusChangeDialog
                    tenderId={tender.tenderId}
                    fromStatus={tender.status ?? 'new'}
                    toStatus={pending}
                    noteRequired
                    onConfirm={async (note) => { await applyStatus(pending, note); setPending(null); }}
                    onCancel={() => setPending(null)}
                />
            )}
        </aside>
    );
}
```

- [ ] **Step 22.2: `TenderMatchCard.tsx`**

```tsx
import { Link } from 'react-router-dom';

interface Props {
    match: any;
}

export function TenderMatchCard({ match }: Props) {
    return (
        <div className="bg-surface-container-lowest rounded-lg border border-outline-variant/30 p-3 mb-2">
            <div className="flex items-center justify-between">
                <Link to={`/products/${match.productSlug}`} target="_blank" className="text-sm font-medium text-primary hover:underline">
                    {match.productSlug}
                </Link>
                <span className="text-sm font-bold text-on-surface">{match.score}/100</span>
            </div>
            {match.reasoning && (
                <p className="mt-1 text-xs italic text-on-surface-variant">"{match.reasoning}"</p>
            )}
            {match.matchedKeywords?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                    {match.matchedKeywords.map((k: string) => (
                        <span key={k} className="px-2 py-0.5 text-[10px] rounded-full bg-secondary-container text-on-secondary-container">{k}</span>
                    ))}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 22.3: `TenderAuditLog.tsx`**

```tsx
import { useState } from 'react';

interface Props {
    log: any[];
}

export function TenderAuditLog({ log }: Props) {
    const [expanded, setExpanded] = useState(false);
    if (log.length === 0) {
        return <div className="text-xs text-on-surface-variant">No status changes yet.</div>;
    }
    const visible = expanded ? log : log.slice(0, 5);
    return (
        <div>
            <ul className="space-y-1 text-xs text-on-surface-variant">
                {visible.map((l, i) => (
                    <li key={`${l.changedAt}-${i}`}>
                        <span className="text-on-surface-variant">{l.changedAt?.slice(0, 16)?.replace('T', ' ')}</span>
                        {' · '}
                        <span className="font-medium text-on-surface">{l.changedBy}</span>
                        {' · '}
                        status: {l.fromStatus ?? '—'} → <strong className="text-on-surface">{l.toStatus}</strong>
                        {l.note && <> · <em>"{l.note}"</em></>}
                    </li>
                ))}
            </ul>
            {log.length > 5 && (
                <button onClick={() => setExpanded(!expanded)} className="mt-2 text-xs text-primary hover:underline">
                    {expanded ? 'Show fewer' : `Show all (${log.length})`}
                </button>
            )}
        </div>
    );
}
```

- [ ] **Step 22.4: `TenderDetailPage.tsx`**

```tsx
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTender } from '../../hooks/useTender';
import { TenderHeaderPanel } from '../../components/admin/TenderHeaderPanel';
import { TenderMatchCard } from '../../components/admin/TenderMatchCard';
import { TenderAuditLog } from '../../components/admin/TenderAuditLog';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';

export function TenderDetailPage() {
    const { tenderId } = useParams<{ tenderId: string }>();
    const { data, loading, error, refresh } = useTender(tenderId);
    const [translating, setTranslating] = useState(false);
    const [showFullDesc, setShowFullDesc] = useState(false);

    if (loading) return <div className="text-sm text-on-surface-variant p-6">Loading tender…</div>;
    if (error) return <div className="bg-error-container text-on-error-container p-4 rounded-lg">{error.message}</div>;
    if (!data) return <div className="text-sm text-on-surface-variant p-6">Tender not found. <Link to="/admin/tenders" className="text-primary hover:underline">← Back</Link></div>;

    const t = data.tender;
    const description = t.description ?? '';
    const showCollapsedDesc = description.length > 500 && !showFullDesc;
    const langTag = t.language && t.language !== 'en' ? ` (original: ${t.language})` : '';

    async function translate() {
        if (!tenderId) return;
        setTranslating(true);
        try {
            await svc.translateTenderDescription(tenderId);
            notify.success('Translation cached');
            refresh();
        } catch (err: any) {
            notify.error(String(err?.message ?? err));
        } finally {
            setTranslating(false);
        }
    }

    return (
        <div>
            <Link to="/admin/tenders" className="text-xs text-primary hover:underline">← Back to tenders</Link>
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
                <TenderHeaderPanel tender={t} onUpdated={refresh} />
                <main className="space-y-4">
                    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
                        <h3 className="font-headline text-base font-bold text-on-surface mb-2">Description{langTag}</h3>
                        <p className="text-sm text-on-surface whitespace-pre-wrap">
                            {showCollapsedDesc ? description.slice(0, 200) + '…' : description}
                        </p>
                        {description.length > 500 && (
                            <button onClick={() => setShowFullDesc(!showFullDesc)} className="mt-2 text-xs text-primary hover:underline">
                                {showFullDesc ? 'Show less' : 'Show more'}
                            </button>
                        )}
                        {t.language && t.language !== 'en' && (
                            <div className="mt-3 pt-3 border-t border-outline-variant/30">
                                <button onClick={translate} disabled={translating} className="text-xs text-primary hover:underline disabled:opacity-50">
                                    {translating ? 'Translating…' : t.descriptionEn ? 'Retranslate' : 'Translate to English'}
                                </button>
                                {t.descriptionEn && (
                                    <div className="mt-2 text-sm text-on-surface italic whitespace-pre-wrap">
                                        <p className="text-[10px] text-on-surface-variant mb-1">Translation (machine, may contain errors)</p>
                                        {t.descriptionEn}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
                        <h3 className="font-headline text-base font-bold text-on-surface mb-2">Product matches ({data.matches.length})</h3>
                        {data.matches.length === 0
                            ? <p className="text-xs text-on-surface-variant">No product matches recorded.</p>
                            : data.matches.map((m: any) => <TenderMatchCard key={m.productSlug} match={m} />)}
                    </section>

                    <section className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4">
                        <h3 className="font-headline text-base font-bold text-on-surface mb-2">Audit log</h3>
                        <TenderAuditLog log={data.log ?? []} />
                    </section>
                </main>
            </div>
        </div>
    );
}
```

- [ ] **Step 22.5: Commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add src/pages/admin/TenderDetailPage.tsx src/components/admin/TenderHeaderPanel.tsx src/components/admin/TenderMatchCard.tsx src/components/admin/TenderAuditLog.tsx
git commit -m "feat(tender): detail page (header panel + matches + audit log + translate)

Two-column lg-sticky layout. Left panel: title, agency, score, deadline,
status dropdown (note-required dialog for not_relevant/lost), assigned-to
field with onBlur save, View on source button, Mark not relevant.

Right column: description with collapse-at-500 and 'Translate to English'
button (only for non-English tenders; result cached on first call); product
match cards with score + reasoning + matched keywords; audit log newest-
first with show-more.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 23: Keyword config page

**Files:**
- Create: `src/pages/admin/TenderKeywordConfigPage.tsx`
- Create: `src/components/admin/KeywordConfigSidebar.tsx`
- Create: `src/components/admin/KeywordConfigEditor.tsx`
- Create: `src/components/admin/KeywordConfigTestPanel.tsx`

- [ ] **Step 23.1: `KeywordConfigSidebar.tsx`**

```tsx
interface Props {
    configs: any[];
    selectedCategory: string | null;
    onSelect: (productCategory: string) => void;
    onNew: () => void;
}

export function KeywordConfigSidebar({ configs, selectedCategory, onSelect, onNew }: Props) {
    return (
        <aside className="w-44 bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-2 self-start">
            <ul className="space-y-0.5">
                {configs.map((c) => (
                    <li key={c.productCategory}>
                        <button
                            onClick={() => onSelect(c.productCategory)}
                            className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium ${selectedCategory === c.productCategory ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface hover:bg-surface-container-low'} ${!c.isActive ? 'italic text-on-surface-variant' : ''}`}
                        >
                            {c.productCategory}
                            {c.productSlugs?.length > 0 && <span className="float-right text-[10px] opacity-70">{c.productSlugs.length}</span>}
                        </button>
                    </li>
                ))}
            </ul>
            <button onClick={onNew} className="w-full mt-2 px-2 py-1.5 text-xs text-primary border border-primary/30 rounded hover:bg-primary/10">+ New category</button>
        </aside>
    );
}
```

- [ ] **Step 23.2: `KeywordConfigEditor.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { TagInput } from './TagInput';

export interface ConfigFormState {
    productCategory: string;
    productSlugs: string[];
    keywords: string[];
    synonyms: string[];
    blacklist: string[];
    naicsCodes: string[];
    cpvCodes: string[];
    isActive: boolean;
}

interface Props {
    initial: ConfigFormState;
    onChange: (next: ConfigFormState) => void;
    isDirty: boolean;
}

export function KeywordConfigEditor({ initial, onChange, isDirty }: Props) {
    const [state, setState] = useState(initial);

    useEffect(() => { setState(initial); }, [initial]);

    function update<K extends keyof ConfigFormState>(field: K, value: ConfigFormState[K]) {
        const next = { ...state, [field]: value };
        setState(next);
        onChange(next);
    }

    return (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 p-4 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-headline text-base font-bold text-on-surface">{state.productCategory}</h3>
                <label className="flex items-center gap-2 text-xs">
                    <input
                        type="checkbox"
                        checked={state.isActive}
                        onChange={(e) => update('isActive', e.target.checked)}
                    />
                    isActive
                </label>
            </div>
            {isDirty && <div className="px-3 py-1.5 bg-tertiary-container text-on-tertiary-container text-xs rounded">Unsaved changes</div>}

            {(['productSlugs', 'keywords', 'synonyms', 'blacklist', 'naicsCodes', 'cpvCodes'] as const).map((field) => (
                <div key={field}>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">{field}</label>
                    <TagInput
                        value={state[field] as string[]}
                        onChange={(v) => update(field, v as any)}
                        placeholder={`Add ${field}...`}
                    />
                </div>
            ))}
        </div>
    );
}
```

- [ ] **Step 23.3: `KeywordConfigTestPanel.tsx`**

```tsx
import { useState } from 'react';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';
import type { ConfigFormState } from './KeywordConfigEditor';

interface Props {
    formState: ConfigFormState;
}

export function KeywordConfigTestPanel({ formState }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [result, setResult] = useState<any>(null);
    const [busy, setBusy] = useState(false);

    async function run() {
        setBusy(true);
        try {
            const r = await svc.runPrefilterPreview({
                title,
                description,
                configOverride: formState,
            });
            setResult(r);
        } catch (err: any) {
            notify.error(String(err?.message ?? err));
        } finally { setBusy(false); }
    }

    return (
        <div className="mt-4 bg-tertiary-container/30 rounded-xl border-2 border-dashed border-tertiary p-4">
            <h4 className="text-sm font-bold text-on-surface mb-2">⚡ Test match against this (unsaved) config</h4>
            <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Tender title…"
                className="w-full mb-2 px-3 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            />
            <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tender description…"
                rows={3}
                className="w-full mb-2 px-3 py-1.5 rounded-md border border-outline-variant text-sm bg-surface text-on-surface"
            />
            <button onClick={run} disabled={busy || !title} className="px-3 py-1 text-xs rounded-md bg-primary text-on-primary disabled:opacity-50">
                {busy ? 'Testing…' : 'Run test'}
            </button>
            {result && (
                <div className={`mt-2 p-2 rounded text-xs ${result.passed ? 'bg-secondary-container text-on-secondary-container' : 'bg-error-container text-on-error-container'}`}>
                    {result.passed
                        ? <>✓ PASS · Matched: {result.matchedKeywords.join(', ')}</>
                        : <>✗ FAIL · No keyword matched</>}
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 23.4: `TenderKeywordConfigPage.tsx`**

```tsx
import { useState, useEffect } from 'react';
import { useKeywordConfigs } from '../../hooks/useKeywordConfigs';
import { KeywordConfigSidebar } from '../../components/admin/KeywordConfigSidebar';
import { KeywordConfigEditor, type ConfigFormState } from '../../components/admin/KeywordConfigEditor';
import { KeywordConfigTestPanel } from '../../components/admin/KeywordConfigTestPanel';
import * as svc from '../../services/tenderAdminService';
import { notify } from '../../lib/notify';

function emptyFormState(category: string): ConfigFormState {
    return {
        productCategory: category,
        productSlugs: [],
        keywords: [],
        synonyms: [],
        blacklist: [],
        naicsCodes: [],
        cpvCodes: [],
        isActive: true,
    };
}

export function TenderKeywordConfigPage() {
    const { data: configs, loading, refresh } = useKeywordConfigs(true);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [formState, setFormState] = useState<ConfigFormState | null>(null);
    const [serverState, setServerState] = useState<ConfigFormState | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!selectedCategory && configs.length > 0) {
            setSelectedCategory(configs[0].productCategory);
        }
    }, [configs, selectedCategory]);

    useEffect(() => {
        if (!selectedCategory) return;
        const found = configs.find((c: any) => c.productCategory === selectedCategory);
        if (found) {
            const initial: ConfigFormState = {
                productCategory: found.productCategory,
                productSlugs: found.productSlugs ?? [],
                keywords: found.keywords ?? [],
                synonyms: found.synonyms ?? [],
                blacklist: found.blacklist ?? [],
                naicsCodes: found.naicsCodes ?? [],
                cpvCodes: found.cpvCodes ?? [],
                isActive: found.isActive ?? true,
            };
            setFormState(initial);
            setServerState(initial);
        }
    }, [selectedCategory, configs]);

    const isDirty = !!(formState && serverState && JSON.stringify(formState) !== JSON.stringify(serverState));

    function newCategory() {
        const name = prompt('New category name (immutable; used as PK):');
        if (!name?.trim()) return;
        if (configs.some((c: any) => c.productCategory === name)) {
            notify.error('Category already exists');
            return;
        }
        const fresh = emptyFormState(name.trim());
        setSelectedCategory(name.trim());
        setFormState(fresh);
        setServerState(emptyFormState(name.trim()));  // server doesn't have it yet, so any edit is "dirty"
    }

    async function save() {
        if (!formState) return;
        if (formState.keywords.length === 0 && formState.synonyms.length === 0) {
            notify.error('At least one keyword or synonym is required');
            return;
        }
        if (formState.productSlugs.length === 0) {
            notify.error('At least one linked product slug is required');
            return;
        }
        setBusy(true);
        try {
            await svc.upsertKeywordConfig(formState);
            notify.success('Saved — takes effect on next daily run');
            refresh();
        } catch (err: any) {
            notify.error(String(err?.message ?? err));
        } finally { setBusy(false); }
    }

    return (
        <div>
            <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-1">Tender Watch</p>
                <h1 className="font-headline text-2xl md:text-4xl font-black text-on-surface tracking-tighter">Keyword config</h1>
            </div>
            {loading && <div className="text-sm text-on-surface-variant">Loading configs…</div>}
            {!loading && (
                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4">
                    <KeywordConfigSidebar
                        configs={configs}
                        selectedCategory={selectedCategory}
                        onSelect={(cat) => {
                            if (isDirty && !confirm('Discard unsaved changes?')) return;
                            setSelectedCategory(cat);
                        }}
                        onNew={newCategory}
                    />
                    <div>
                        {formState && (
                            <>
                                <KeywordConfigEditor initial={formState} onChange={setFormState} isDirty={isDirty} />
                                <div className="mt-3 flex justify-end gap-2">
                                    <button
                                        onClick={save}
                                        disabled={busy || !isDirty}
                                        className="px-4 py-1.5 text-sm rounded-md bg-primary text-on-primary disabled:opacity-50"
                                    >
                                        {busy ? 'Saving…' : 'Save changes'}
                                    </button>
                                </div>
                                <KeywordConfigTestPanel formState={formState} />
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
```

- [ ] **Step 23.5: Commit**

```bash
npx tsc --noEmit 2>&1 | head -5
git add src/pages/admin/TenderKeywordConfigPage.tsx src/components/admin/KeywordConfigSidebar.tsx src/components/admin/KeywordConfigEditor.tsx src/components/admin/KeywordConfigTestPanel.tsx
git commit -m "feat(tender): keyword config page (master-detail + test panel)

Sidebar lists all configs (active + inactive marked italic). Editor pane
shows all 7 fields wired through TagInput (Task 19). Dirty-state banner.
Switching categories with unsaved changes prompts confirm.

KeywordConfigTestPanel calls runPrefilterPreview with configOverride =
current unsaved form state, so admin can iterate without saving.

Save validates ≥1 keyword/synonym + ≥1 product slug client-side before
calling upsertKeywordConfig.

New category creation via prompt() (productCategory is PK and immutable).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 24: Sandbox deploy + e2e verification

This task does not modify code. Walks through real Amplify sandbox deploy and exercises the full flow.

- [ ] **Step 24.1: Verify all tests pass**

```bash
npm test -- amplify/
```
Expected: all tests pass (existing + new tender-api tests).

- [ ] **Step 24.2: Type-check both contexts**

```bash
npx tsc --noEmit
npx tsc --noEmit -p amplify
```
Expected: both clean.

- [ ] **Step 24.3: Push branch + open PR (does NOT auto-merge)**

```bash
git push -u origin feat/tender-admin-ui
gh pr create --title "Phase 2: Tender admin UI" --base main --body "Phase 2 implementation per docs/superpowers/specs/2026-05-15-tender-watch-phase-2-design.md. 3 admin pages + tender-api Lambda with 8 fieldNames."
```

- [ ] **Step 24.4: Deploy sandbox**

```bash
npx ampx sandbox
```

Watch for: `Watching for file changes` (success). If deploy fails (CFN rollback), investigate via build log. Common Phase C-era gotchas to watch for:
- MetricFilter pattern syntax (already proven OK; this Phase 2 PR doesn't add new metric filters)
- CircularDependency on tender-api stack (mitigated by `resourceGroupName: 'tender-api-stack'`)
- Schema datetime serialization (avoid `a.date()` on fields the Lambda writes as ISO datetime)

- [ ] **Step 24.5: Manual UI smoke test**

Open `http://localhost:5173/admin/tenders` (or whichever Vite port is free).

Verify:
- List page loads with KPI cards, filter bar, table
- Click a tender → detail page renders with header panel + matches + log
- Status dropdown change to `reviewing` (no-note) → toast "Status → reviewing"
- Status dropdown change to `not_relevant` → dialog opens, type 3+ char note, Confirm → toast
- Bulk-select 2 tenders → action bar appears → click "→ reviewing" → toast with count
- Click CSV export → file downloads
- Navigate to `/admin/tenders/keywords` → sidebar lists categories, editor pane shows fields
- TagInput: type "ALD" + Enter → chip appears; backspace on empty → last chip removed
- Edit keywords list → "Unsaved changes" banner appears
- Switch category with unsaved changes → confirm prompt
- Click "Run test" with sample title → result PASS/FAIL displayed
- Save changes → toast "Saved"
- Create new category via "+ New category" → prompt → category appears in sidebar

- [ ] **Step 24.6: CloudWatch logs spot-check**

```bash
TENDER_API_FN=$(aws lambda list-functions --region us-east-2 --query 'Functions[?contains(FunctionName,`tenderapi`)].FunctionName' --output text | head -1)
aws logs tail "/aws/lambda/$TENDER_API_FN" --region us-east-2 --since 5m --filter-pattern '"tender."'
```

Expected events visible: `tender.status.updated`, `tender.config.upserted`, etc.

- [ ] **Step 24.7: Mark PR ready + request review**

```bash
gh pr ready  # (only if it was opened as draft)
```

---

## Self-review checklist

After writing this plan, look at it with fresh eyes:

**1. Spec coverage:**
- [ ] All 4 customTypes + 3 connections + 3 queries + 5 mutations covered (Tasks 3–5)
- [ ] All 8 Lambda fieldNames covered (Tasks 6–13)
- [ ] All 3 admin pages covered (Tasks 20–23)
- [ ] Toast system covered (Task 15)
- [ ] Library reorg covered (Task 1)
- [ ] Nav + routing covered (Task 18)
- [ ] Optimistic locking covered (Task 9)
- [ ] Translation Bedrock+Anthropic fallback covered (Task 13)
- [ ] CSV export covered (Task 21)
- [ ] URL state sync covered (Task 20)
- [ ] TagInput special-char handling covered (Task 19)

**2. Placeholder scan:** All steps have actual code, exact file paths, exact commands.

**3. Type consistency:**
- `TenderStatus` type imported from `lib/tender-watch/keys`
- `MatchableTender` interface in `lib/tender-watch/prefilter` (Task 1)
- `TenderKeywordConfigItem` from `lib/tender-watch/types` (Phase 1)
- Service method names match across hooks + pages (`listTenders`, `getTender`, `updateTenderStatus`, etc.)
- Filter prop names consistent (`statuses`, `countries`, `minScore`, `sortBy`, `sortDir`, `search`, `includeExpired`)

---

## Open follow-ups (documented but deferred)

- **Pagination on listTenders** — currently returns first page only; nextToken hardcoded to null. Add a real cursor-based pagination loop matching the backfill script pattern.
- **CSV export 500-row cap** — surface a warning toast when truncation occurs.
- **CloudWatch alarms for tender-api** — mirror Phase C #144 pattern after this PR merges; out-of-band SNS topic creation.
- **Phase 3** — Convert to RFQ wiring (omitted intentionally per spec).
