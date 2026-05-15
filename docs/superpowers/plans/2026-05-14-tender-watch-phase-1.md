# Tender Watch — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Tender Watch daily data pipeline: fetch SAM.gov + TED tenders, dedupe across sources, keyword prefilter, Bedrock Haiku relevance scoring, store in the existing `intelligenceTable` with TENDER#/MATCH# prefixes, send daily digest + high-priority email alerts.

**Architecture:** AWS Step Functions Standard workflow triggered daily by EventBridge. Each step is a Lambda (`fetch-sam`, `fetch-ted`, `normalize-dedupe`, `prefilter-by-keyword`, `match-with-llm`, `classify-and-store`, `notify-high-priority`, `notify-daily-digest`, `expire-old-tenders`). Lambdas stage large payloads through an S3 bucket. All persistence is single-table design on the existing `NineScrollsIntelligence` DynamoDB table.

**Tech Stack:** TypeScript, Node 22, AWS Amplify Gen 2, AWS CDK v2 (Step Functions, S3, EventBridge), AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`, `@aws-sdk/client-s3`, `@aws-sdk/client-bedrock-runtime`, `@aws-sdk/client-sfn`, `@aws-sdk/client-sesv2`), Zod for input validation, vitest for unit tests, `@anthropic-ai/sdk` for fallback API.

**Reference:** [docs/superpowers/specs/2026-05-14-tender-watch-design.md](../specs/2026-05-14-tender-watch-design.md)

---

## File structure

**Shared library (Tasks 1–4):**

```
amplify/lib/tender-watch/
├── keys.ts          # PK/SK/GSI builders
├── keys.test.ts
├── hash.ts          # sourceTenderHash
├── hash.test.ts
├── types.ts         # NormalizedTender Zod schema + TenderEntity types
└── s3-staging.ts    # readStagedJson / writeStagedJson helpers
```

**Lambdas (Tasks 5–13):**

```
amplify/functions/
├── fetch-sam/                       # Task 5
│   ├── handler.ts
│   ├── handler.test.ts
│   ├── resource.ts
│   ├── package.json
│   └── fixtures/sam-sample.json
├── fetch-ted/                       # Task 6
│   └── ... (same shape)
├── normalize-dedupe/                # Task 7
├── prefilter-by-keyword/            # Task 8
├── match-with-llm/                  # Task 9
├── classify-and-store/              # Task 10
├── notify-high-priority/            # Task 11
├── notify-daily-digest/             # Task 12
└── expire-old-tenders/              # Task 13
```

**Infrastructure (Tasks 14–15):**

- `amplify/backend.ts` — modified to wire S3 staging bucket, all 9 Lambdas, Step Functions state machine, EventBridge rule, IAM

**Seed script (Task 16):**

- `scripts/seed-tender-keyword-config.ts`

**Manual verification (Task 17).**

---

## Conventions

- Each Lambda has its own `package.json` with the SDK deps it uses (matches existing pattern in `amplify/functions/submit-rfq/package.json`).
- Each Lambda has `handler.ts` (named export `handler`), `handler.test.ts` (vitest), and `resource.ts` (Amplify `defineFunction`).
- Lambda env access pattern (matches `submit-rfq` handler): wrap each env read in an arrow function `const TABLE = () => process.env.INTELLIGENCE_TABLE!` so tests can mock with `vi.stubEnv()` before importing.
- All Lambdas reference `intelligenceTable` via `INTELLIGENCE_TABLE` env var.
- All Lambdas log via `console.log` with structured JSON (one log line per significant event) — matches `submit-rfq` style; CloudWatch Logs Insights queries against this format.
- Commit messages: `feat(tender-watch): <imperative summary>` for new code, `chore(tender-watch): <summary>` for infra wiring. All commits include the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- Run tests after every task with `npm test -- amplify/<path>` and confirm pass before commit.

---

## Task 1: Shared key builders

**Files:**
- Create: `amplify/lib/tender-watch/keys.ts`
- Test: `amplify/lib/tender-watch/keys.test.ts`

The single-table design encodes every tender entity through a few key builders. Centralizing them prevents the GSI prefix strings from drifting across 9 Lambdas.

- [ ] **Step 1.1: Write the failing test**

Create `amplify/lib/tender-watch/keys.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
    tenderItemKey,
    tenderMatchItemKey,
    tenderStatusLogItemKey,
    tenderKeywordConfigItemKey,
    tenderStatusGsiKey,
    tenderHashGsiKey,
    tenderHighPriorityGsiKey,
    tenderKeywordConfigActiveGsiKey,
    scoreSortToken,
} from './keys';

describe('keys', () => {
    describe('tenderItemKey', () => {
        it('builds the TENDER metadata key', () => {
            expect(tenderItemKey('sam-12345')).toEqual({
                PK: 'TENDER#sam-12345',
                SK: 'METADATA',
            });
        });
    });

    describe('tenderMatchItemKey', () => {
        it('builds the MATCH key for a product slug', () => {
            expect(tenderMatchItemKey('sam-12345', 'pluto-f')).toEqual({
                PK: 'TENDER#sam-12345',
                SK: 'MATCH#pluto-f',
            });
        });
    });

    describe('tenderStatusLogItemKey', () => {
        it('builds the LOG key with a sortable timestamp prefix', () => {
            const key = tenderStatusLogItemKey('sam-12345', '2026-05-14T10:30:00.000Z', 'abc123');
            expect(key.PK).toBe('TENDER#sam-12345');
            expect(key.SK).toBe('LOG#2026-05-14T10:30:00.000Z#abc123');
        });
    });

    describe('tenderKeywordConfigItemKey', () => {
        it('builds the CATEGORY key', () => {
            expect(tenderKeywordConfigItemKey('PECVD')).toEqual({
                PK: 'TENDER_KEYWORD_CONFIG',
                SK: 'CATEGORY#PECVD',
            });
        });
    });

    describe('tenderStatusGsiKey', () => {
        it('builds GSI1 key with inverse-score sort token', () => {
            expect(tenderStatusGsiKey('new', 87, '2026-05-14', 'sam-12345')).toEqual({
                GSI1PK: 'TENDER_STATUS#new',
                GSI1SK: '013#2026-05-14#sam-12345',
            });
        });

        it('zero-pads the score token to 3 digits', () => {
            expect(tenderStatusGsiKey('new', 0, '2026-05-14', 'a').GSI1SK).toBe('100#2026-05-14#a');
            expect(tenderStatusGsiKey('new', 100, '2026-05-14', 'a').GSI1SK).toBe('000#2026-05-14#a');
            expect(tenderStatusGsiKey('new', 50, '2026-05-14', 'a').GSI1SK).toBe('050#2026-05-14#a');
        });
    });

    describe('tenderHashGsiKey', () => {
        it('builds GSI2 dedupe key', () => {
            expect(tenderHashGsiKey('abc123')).toEqual({
                GSI2PK: 'TENDER_HASH#abc123',
                GSI2SK: 'TENDER',
            });
        });
    });

    describe('tenderHighPriorityGsiKey', () => {
        it('builds GSI3 high-priority key', () => {
            expect(tenderHighPriorityGsiKey('2026-05-14', 'sam-12345')).toEqual({
                GSI3PK: 'TENDER_HIGH_PRIORITY',
                GSI3SK: '2026-05-14#sam-12345',
            });
        });
    });

    describe('tenderKeywordConfigActiveGsiKey', () => {
        it('builds GSI1 active config key', () => {
            expect(tenderKeywordConfigActiveGsiKey('PECVD')).toEqual({
                GSI1PK: 'TENDER_KEYWORD_CONFIG_ACTIVE',
                GSI1SK: 'CATEGORY#PECVD',
            });
        });
    });

    describe('scoreSortToken', () => {
        it('clamps negative scores to 100 (lowest priority)', () => {
            expect(scoreSortToken(-5)).toBe('100');
        });
        it('clamps scores above 100 to 0 (highest priority)', () => {
            expect(scoreSortToken(150)).toBe('000');
        });
    });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npm test -- amplify/lib/tender-watch/keys.test.ts`
Expected: FAIL — `Cannot find module './keys'`

- [ ] **Step 1.3: Implement keys.ts**

Create `amplify/lib/tender-watch/keys.ts`:

```typescript
/**
 * Single-table key builders for Tender Watch entities.
 * See docs/superpowers/specs/2026-05-14-tender-watch-design.md § Data model.
 */

export function scoreSortToken(score: number): string {
    const clamped = Math.min(100, Math.max(0, Math.round(score)));
    // Inverse so lexicographic ASC = score DESC.
    return String(100 - clamped).padStart(3, '0');
}

export function tenderItemKey(tenderId: string) {
    return { PK: `TENDER#${tenderId}`, SK: 'METADATA' as const };
}

export function tenderMatchItemKey(tenderId: string, productSlug: string) {
    return { PK: `TENDER#${tenderId}`, SK: `MATCH#${productSlug}` };
}

export function tenderStatusLogItemKey(tenderId: string, isoTimestamp: string, ulid: string) {
    return { PK: `TENDER#${tenderId}`, SK: `LOG#${isoTimestamp}#${ulid}` };
}

export function tenderKeywordConfigItemKey(productCategory: string) {
    return { PK: 'TENDER_KEYWORD_CONFIG' as const, SK: `CATEGORY#${productCategory}` };
}

export function tenderStatusGsiKey(status: string, overallScore: number, postedDate: string, tenderId: string) {
    return {
        GSI1PK: `TENDER_STATUS#${status}`,
        GSI1SK: `${scoreSortToken(overallScore)}#${postedDate}#${tenderId}`,
    };
}

export function tenderHashGsiKey(sourceTenderHash: string) {
    return { GSI2PK: `TENDER_HASH#${sourceTenderHash}`, GSI2SK: 'TENDER' as const };
}

export function tenderHighPriorityGsiKey(postedDate: string, tenderId: string) {
    return { GSI3PK: 'TENDER_HIGH_PRIORITY' as const, GSI3SK: `${postedDate}#${tenderId}` };
}

export function tenderKeywordConfigActiveGsiKey(productCategory: string) {
    return {
        GSI1PK: 'TENDER_KEYWORD_CONFIG_ACTIVE' as const,
        GSI1SK: `CATEGORY#${productCategory}`,
    };
}

export const TENDER_STATUSES = [
    'new',
    'reviewing',
    'pursuing',
    'submitted',
    'won',
    'lost',
    'not_relevant',
] as const;
export type TenderStatus = (typeof TENDER_STATUSES)[number];

export const ACTIVE_TENDER_STATUSES: ReadonlyArray<TenderStatus> = [
    'new',
    'reviewing',
    'pursuing',
    'submitted',
];
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npm test -- amplify/lib/tender-watch/keys.test.ts`
Expected: PASS (all assertions green)

- [ ] **Step 1.5: Commit**

```bash
git add amplify/lib/tender-watch/keys.ts amplify/lib/tender-watch/keys.test.ts
git commit -m "$(cat <<'EOF'
feat(tender-watch): add single-table key builders

Centralized PK/SK/GSI builders for TENDER entities (metadata, match,
status log, keyword config) so the 9 pipeline Lambdas share one source
of truth for the layered prefixes on intelligenceTable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: sourceTenderHash helper

**Files:**
- Create: `amplify/lib/tender-watch/hash.ts`
- Test: `amplify/lib/tender-watch/hash.test.ts`

- [ ] **Step 2.1: Write the failing test**

Create `amplify/lib/tender-watch/hash.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { sourceTenderHash } from './hash';

describe('sourceTenderHash', () => {
    it('is deterministic for identical inputs', () => {
        const a = sourceTenderHash({
            title: 'PECVD System for Stanford Cleanroom',
            agency: 'Stanford University',
            deadline: '2026-08-15',
        });
        const b = sourceTenderHash({
            title: 'PECVD System for Stanford Cleanroom',
            agency: 'Stanford University',
            deadline: '2026-08-15',
        });
        expect(a).toBe(b);
        expect(a).toHaveLength(64); // sha256 hex
    });

    it('ignores leading/trailing whitespace and case in title and agency', () => {
        const a = sourceTenderHash({
            title: '  PECVD System  ',
            agency: 'Stanford University',
            deadline: '2026-08-15',
        });
        const b = sourceTenderHash({
            title: 'pecvd system',
            agency: 'stanford university',
            deadline: '2026-08-15',
        });
        expect(a).toBe(b);
    });

    it('treats missing deadline as empty string', () => {
        const a = sourceTenderHash({
            title: 'X',
            agency: 'Y',
            deadline: undefined,
        });
        const b = sourceTenderHash({
            title: 'X',
            agency: 'Y',
            deadline: null,
        });
        expect(a).toBe(b);
    });

    it('produces different hashes for different titles', () => {
        const a = sourceTenderHash({ title: 'A', agency: 'X', deadline: '2026-01-01' });
        const b = sourceTenderHash({ title: 'B', agency: 'X', deadline: '2026-01-01' });
        expect(a).not.toBe(b);
    });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `npm test -- amplify/lib/tender-watch/hash.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2.3: Implement hash.ts**

Create `amplify/lib/tender-watch/hash.ts`:

```typescript
import crypto from 'node:crypto';

export interface TenderHashInput {
    title: string;
    agency: string;
    deadline?: string | null;
}

export function sourceTenderHash(input: TenderHashInput): string {
    const normalized = [
        input.title.trim().toLowerCase(),
        input.agency.trim().toLowerCase(),
        input.deadline ?? '',
    ].join('|');
    return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

- [ ] **Step 2.4: Run test to verify it passes**

Run: `npm test -- amplify/lib/tender-watch/hash.test.ts`
Expected: PASS

- [ ] **Step 2.5: Commit**

```bash
git add amplify/lib/tender-watch/hash.ts amplify/lib/tender-watch/hash.test.ts
git commit -m "$(cat <<'EOF'
feat(tender-watch): add sourceTenderHash dedupe helper

SHA-256 of normalized title|agency|deadline. Used by normalize-dedupe
to skip the same tender appearing in multiple sources.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: NormalizedTender Zod schema

**Files:**
- Create: `amplify/lib/tender-watch/types.ts`

This is the schema every `fetch-*` Lambda emits and `normalize-dedupe` consumes. No test required because the implementation IS the schema (Zod's own tests are upstream).

- [ ] **Step 3.1: Create types.ts**

Create `amplify/lib/tender-watch/types.ts`:

```typescript
import { z } from 'zod';

/** Common shape every fetch-* Lambda emits and normalize-dedupe consumes. */
export const NormalizedTenderSchema = z.object({
    source: z.enum(['sam', 'ted', 'uk', 'canada', 'australia', 'singapore', 'korea']),
    externalId: z.string().min(1),
    url: z.string().url(),
    title: z.string().min(1),
    agency: z.string().min(1),
    country: z.string().length(2),                 // ISO 3166-1 alpha-2
    language: z.string().length(2),                // ISO 639-1
    description: z.string(),
    estimatedValue: z
        .object({ amount: z.number(), currency: z.string() })
        .nullable()
        .optional(),
    postedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
    naicsCodes: z.array(z.string()),
    cpvCodes: z.array(z.string()),
    rawPayload: z.unknown(),
});
export type NormalizedTender = z.infer<typeof NormalizedTenderSchema>;

/** What each fetch-* Lambda returns to Step Functions. */
export const FetchOutputSchema = z.object({
    source: z.string(),
    stagedKey: z.string(),                         // S3 key with the normalized tender array
    fetched: z.number().int().nonneg(),
    error: z.string().optional(),
});
export type FetchOutput = z.infer<typeof FetchOutputSchema>;

/** Persisted Tender METADATA item shape (what's written to DynamoDB). */
export interface TenderItem {
    PK: string;                                    // TENDER#<id>
    SK: 'METADATA';
    GSI1PK: string;                                // TENDER_STATUS#<status>
    GSI1SK: string;                                // <scoreToken>#<postedDate>#<id>
    GSI2PK: string;                                // TENDER_HASH#<hash>
    GSI2SK: 'TENDER';
    GSI3PK?: string;                               // TENDER_HIGH_PRIORITY (only when isHighPriority)
    GSI3SK?: string;                               // <postedDate>#<id>
    tenderId: string;
    entityType: 'TENDER';
    source: string;
    sourceUrl: string;
    sourceTenderHash: string;
    title: string;
    agency: string;
    country: string;
    language: string;
    description: string;
    estimatedValueUSD: number | null;
    estimatedValueOriginal: string | null;
    postedDate: string;
    deadline: string | null;
    naicsCodes: string[];
    cpvCodes: string[];
    rawPayload: unknown;
    overallScore: number;
    isHighPriority: boolean;
    isExpired: boolean;
    status: 'new' | 'reviewing' | 'pursuing' | 'submitted' | 'won' | 'lost' | 'not_relevant';
    statusNote: string | null;
    assignedTo: string | null;
    lastStatusChangedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

/** Persisted MATCH item shape. */
export interface TenderMatchItem {
    PK: string;                                    // TENDER#<id>
    SK: string;                                    // MATCH#<productSlug>
    tenderId: string;
    productSlug: string;
    entityType: 'TENDER_MATCH';
    score: number;
    reasoning: string;
    matchedKeywords: string[];
    createdAt: string;
}

/** Persisted TENDER_KEYWORD_CONFIG item shape. */
export interface TenderKeywordConfigItem {
    PK: 'TENDER_KEYWORD_CONFIG';
    SK: string;                                    // CATEGORY#<productCategory>
    GSI1PK?: 'TENDER_KEYWORD_CONFIG_ACTIVE';
    GSI1SK?: string;
    productCategory: string;
    entityType: 'TENDER_KEYWORD_CONFIG';
    productSlugs: string[];
    keywords: string[];
    synonyms: string[];
    blacklist: string[];
    naicsCodes: string[];
    cpvCodes: string[];
    isActive: boolean;
    updatedBy: string;
    updatedAt: string;
}

/** USD conversion rate table (refresh quarterly; see expire-old-tenders for refresh cadence). */
export const USD_RATES: Record<string, number> = {
    USD: 1.0,
    EUR: 1.08,
    GBP: 1.27,
    CAD: 0.73,
    AUD: 0.66,
    JPY: 0.0065,
    KRW: 0.00073,
    SGD: 0.74,
};

export function toUsd(amount: number | undefined | null, currency: string | undefined | null): number | null {
    if (amount == null || !currency) return null;
    const rate = USD_RATES[currency.toUpperCase()];
    if (rate == null) return null;
    return Math.round(amount * rate);
}
```

- [ ] **Step 3.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit -p amplify`
Expected: PASS (no errors). If the amplify directory lacks a tsconfig pointed at this file, run `npx tsc --noEmit amplify/lib/tender-watch/types.ts --skipLibCheck --module nodenext --target es2022 --moduleResolution nodenext` as a fallback.

- [ ] **Step 3.3: Commit**

```bash
git add amplify/lib/tender-watch/types.ts
git commit -m "$(cat <<'EOF'
feat(tender-watch): add NormalizedTender schema and TenderItem types

Zod schema is the contract between fetch-* Lambdas and normalize-dedupe.
TenderItem/TenderMatchItem/TenderKeywordConfigItem describe persisted
shapes for the single-table DynamoDB store. USD conversion table for
estimatedValueUSD lives here for quarterly refresh.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: S3 staging helpers

**Files:**
- Create: `amplify/lib/tender-watch/s3-staging.ts`

Fetch output (potentially thousands of tenders) is too large for Step Functions' 256 KB inline payload limit. Each fetch Lambda writes a JSON blob to S3 and returns the key; downstream Lambdas read it back.

- [ ] **Step 4.1: Implement (no test needed — pure SDK passthrough verified by integration)**

Create `amplify/lib/tender-watch/s3-staging.ts`:

```typescript
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const client = new S3Client({});

export interface StagingRef {
    bucket: string;
    key: string;
}

export async function writeStagedJson<T>(bucket: string, key: string, payload: T): Promise<StagingRef> {
    await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: JSON.stringify(payload),
        ContentType: 'application/json',
    }));
    return { bucket, key };
}

export async function readStagedJson<T>(ref: StagingRef): Promise<T> {
    const res = await client.send(new GetObjectCommand({
        Bucket: ref.bucket,
        Key: ref.key,
    }));
    if (!res.Body) throw new Error(`S3 object ${ref.bucket}/${ref.key} has no body`);
    const text = await res.Body.transformToString('utf-8');
    return JSON.parse(text) as T;
}

/**
 * Generate a staged-payload S3 key. Step Functions execution id segments the path.
 * Example: tender-watch/2026-05-14T02:00:00.000Z-abc123/fetch-sam/output.json
 */
export function stagedKey(executionId: string, kind: string, name: string): string {
    return `tender-watch/${executionId}/${kind}/${name}.json`;
}
```

- [ ] **Step 4.2: Commit**

```bash
git add amplify/lib/tender-watch/s3-staging.ts
git commit -m "$(cat <<'EOF'
feat(tender-watch): add S3 staging helpers for Step Functions payloads

Inter-state payloads (fetch output, prefilter candidates) exceed the
256KB Step Functions inline limit. Each Lambda writes to s3://staging/
and returns a {bucket, key} ref consumed by the next state.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: fetch-sam Lambda

**Files:**
- Create: `amplify/functions/fetch-sam/handler.ts`
- Create: `amplify/functions/fetch-sam/handler.test.ts`
- Create: `amplify/functions/fetch-sam/resource.ts`
- Create: `amplify/functions/fetch-sam/package.json`
- Create: `amplify/functions/fetch-sam/fixtures/sam-sample.json`

Fetches active US federal opportunities from SAM.gov, normalizes each one to `NormalizedTender`, writes the array to S3 staging, returns a `FetchOutput`.

- [ ] **Step 5.1: Create package.json**

Create `amplify/functions/fetch-sam/package.json`:

```json
{
    "name": "fetch-sam",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-s3": "^3.758.0",
        "@aws-sdk/client-ssm": "^3.758.0",
        "axios": "^1.7.7",
        "zod": "^3.24.0"
    }
}
```

- [ ] **Step 5.2: Create fixture**

Create `amplify/functions/fetch-sam/fixtures/sam-sample.json` with one real-shape opportunity response (truncated):

```json
{
    "totalRecords": 2,
    "page": 0,
    "size": 2,
    "_embedded": {
        "opportunity": [
            {
                "noticeId": "abcdef01234567890",
                "title": "PECVD Deposition System for University Cleanroom",
                "fullParentPathName": "DEPT OF EDUCATION.NATIONAL SCIENCE FOUNDATION",
                "organizationName": "Stanford University",
                "postedDate": "2026-05-10",
                "responseDeadLine": "2026-08-15T23:59:00-04:00",
                "type": "Solicitation",
                "active": "Yes",
                "naicsCode": "334516",
                "uiLink": "https://sam.gov/opp/abcdef01234567890",
                "description": "The university seeks a plasma-enhanced chemical vapor deposition (PECVD) system capable of depositing silicon nitride and silicon dioxide thin films on 6-inch wafers. Throughput >= 25 wafers/hour.",
                "additionalInfoLink": null,
                "officeAddress": { "city": "Stanford", "state": "CA", "countryCode": "USA" },
                "placeOfPerformance": { "country": { "code": "USA" } }
            },
            {
                "noticeId": "fedcba98765432100",
                "title": "Maintenance contract for HVAC systems",
                "fullParentPathName": "DEPT OF DEFENSE.NAVY",
                "organizationName": "Naval Base San Diego",
                "postedDate": "2026-05-11",
                "responseDeadLine": "2026-07-01T17:00:00-08:00",
                "type": "Combined Synopsis/Solicitation",
                "active": "Yes",
                "naicsCode": "238220",
                "uiLink": "https://sam.gov/opp/fedcba98765432100",
                "description": "Routine HVAC maintenance for facility 4B.",
                "additionalInfoLink": null,
                "officeAddress": { "city": "San Diego", "state": "CA", "countryCode": "USA" },
                "placeOfPerformance": { "country": { "code": "USA" } }
            }
        ]
    }
}
```

- [ ] **Step 5.3: Write the failing test**

Create `amplify/functions/fetch-sam/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/sam-sample.json';

// ---------------------------------------------------------------------------
// Mock axios
// ---------------------------------------------------------------------------
const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { get: axiosGet }, get: axiosGet }));

// ---------------------------------------------------------------------------
// Mock SSM and S3
// ---------------------------------------------------------------------------
const ssmSend = vi.fn().mockResolvedValue({ Parameter: { Value: 'fake-key' } });
vi.mock('@aws-sdk/client-ssm', () => ({
    SSMClient: vi.fn().mockImplementation(() => ({ send: ssmSend })),
    GetParameterCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'GetParameter', ...args })),
}));

const s3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'PutObject', ...args })),
    GetObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'GetObject', ...args })),
}));

// Stub env before importing handler
vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');
vi.stubEnv('SAM_API_KEY_PARAM', '/tender-watch/sam/api-key');

beforeEach(() => {
    axiosGet.mockReset();
    s3Send.mockClear();
});

describe('fetch-sam handler', () => {
    it('fetches, normalizes, and stages every opportunity', async () => {
        axiosGet.mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-1' });

        expect(result.source).toBe('sam');
        expect(result.fetched).toBe(2);
        expect(result.stagedKey).toMatch(/tender-watch\/exec-1\/fetch-sam\/output\.json/);

        const putCall = s3Send.mock.calls.find((c) => c[0].__cmd === 'PutObject');
        expect(putCall).toBeDefined();
        const body = JSON.parse(putCall![0].Body);
        expect(body).toHaveLength(2);
        expect(body[0]).toMatchObject({
            source: 'sam',
            externalId: 'abcdef01234567890',
            title: 'PECVD Deposition System for University Cleanroom',
            country: 'US',
            language: 'en',
            postedDate: '2026-05-10',
            deadline: '2026-08-15',
            naicsCodes: ['334516'],
            cpvCodes: [],
        });
    });

    it('returns fetched=0 and an error field when the SAM API rejects', async () => {
        axiosGet.mockRejectedValueOnce(new Error('upstream 503'));
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-1' });

        expect(result.fetched).toBe(0);
        expect(result.error).toContain('upstream 503');
    });
});
```

- [ ] **Step 5.4: Run test to verify it fails**

Run: `npm test -- amplify/functions/fetch-sam/handler.test.ts`
Expected: FAIL — `Cannot find module './handler'`.

- [ ] **Step 5.5: Implement resource.ts**

Create `amplify/functions/fetch-sam/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const fetchSam = defineFunction({
    name: 'fetch-sam',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 300,
    memoryMB: 512,
    environment: {
        SAM_API_KEY_PARAM: '/tender-watch/sam/api-key',
    },
});
```

- [ ] **Step 5.6: Implement handler.ts**

Create `amplify/functions/fetch-sam/handler.ts`:

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import axios from 'axios';
import type {
    NormalizedTender,
    FetchOutput,
} from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const ssm = new SSMClient({});

const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;
const SAM_API_KEY_PARAM = () => process.env.SAM_API_KEY_PARAM!;

const SAM_URL = 'https://api.sam.gov/prod/opportunities/v2/search';
const NAICS_WHITELIST = '334516,334519,333242,541380';
const PAGE_SIZE = 1000;
const LOOKBACK_DAYS = 2;

export interface FetchSamEvent {
    executionId: string;
}

interface SamOpportunity {
    noticeId: string;
    title: string;
    fullParentPathName?: string;
    organizationName?: string;
    postedDate: string;
    responseDeadLine?: string | null;
    type?: string;
    active?: string;
    naicsCode?: string;
    uiLink: string;
    description: string;
    placeOfPerformance?: { country?: { code?: string } };
}

interface SamResponse {
    totalRecords: number;
    _embedded?: { opportunity?: SamOpportunity[] };
}

function isoCountryFromUsa(code: string | undefined): string {
    if (!code) return 'US';
    if (code === 'USA' || code === 'US') return 'US';
    // SAM.gov returns 3-letter codes; for non-US the place is unusual but map common ones.
    const map: Record<string, string> = { CAN: 'CA', MEX: 'MX', GBR: 'GB' };
    return map[code] ?? code.slice(0, 2);
}

function toIsoDate(input: string | null | undefined): string | null {
    if (!input) return null;
    // SAM returns dates like "2026-08-15T23:59:00-04:00" or "2026-05-10"
    const match = input.match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : null;
}

function normalize(op: SamOpportunity): NormalizedTender {
    return {
        source: 'sam',
        externalId: op.noticeId,
        url: op.uiLink,
        title: op.title,
        agency: op.organizationName ?? op.fullParentPathName ?? 'Unknown',
        country: isoCountryFromUsa(op.placeOfPerformance?.country?.code),
        language: 'en',
        description: op.description ?? '',
        estimatedValue: null,
        postedDate: toIsoDate(op.postedDate) ?? new Date().toISOString().slice(0, 10),
        deadline: toIsoDate(op.responseDeadLine),
        naicsCodes: op.naicsCode ? [op.naicsCode] : [],
        cpvCodes: [],
        rawPayload: op,
    };
}

async function getApiKey(): Promise<string> {
    const res = await ssm.send(new GetParameterCommand({ Name: SAM_API_KEY_PARAM(), WithDecryption: true }));
    return res.Parameter?.Value ?? '';
}

export async function handler(event: FetchSamEvent): Promise<FetchOutput> {
    try {
        const apiKey = await getApiKey();
        const today = new Date();
        const lookback = new Date(today.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000);
        const postedFrom = lookback.toISOString().slice(0, 10);
        const postedTo = today.toISOString().slice(0, 10);

        const out: NormalizedTender[] = [];
        let page = 0;
        for (;;) {
            const { data } = await axios.get<SamResponse>(SAM_URL, {
                params: {
                    api_key: apiKey,
                    postedFrom,
                    postedTo,
                    ptype: 'k,o',                  // Combined Synopsis/Solicitation, Solicitation
                    ncode: NAICS_WHITELIST,
                    limit: PAGE_SIZE,
                    offset: page * PAGE_SIZE,
                },
                timeout: 30_000,
            });
            const opps = data._embedded?.opportunity ?? [];
            for (const op of opps) {
                if (op.active === 'Yes' || op.active === undefined) {
                    out.push(normalize(op));
                }
            }
            const total = data.totalRecords ?? out.length;
            page += 1;
            if (page * PAGE_SIZE >= total || opps.length === 0) break;
        }

        const key = stagedKey(event.executionId, 'fetch-sam', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.log(JSON.stringify({ event: 'fetch-sam.success', count: out.length, executionId: event.executionId }));
        return { source: 'sam', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ event: 'fetch-sam.failure', error: message, executionId: event.executionId }));
        return { source: 'sam', stagedKey: '', fetched: 0, error: message };
    }
}
```

- [ ] **Step 5.7: Run test to verify it passes**

Run: `npm test -- amplify/functions/fetch-sam/handler.test.ts`
Expected: PASS

- [ ] **Step 5.8: Commit**

```bash
git add amplify/functions/fetch-sam/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add fetch-sam Lambda

Pulls SAM.gov opportunities from the last 2 days filtered by scientific-
instrument NAICS codes (334516, 334519, 333242, 541380), normalizes each
to NormalizedTender, stages to S3, returns FetchOutput. Failures return
fetched=0 + error to let Step Functions Parallel state continue.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: fetch-ted Lambda

**Files:**
- Create: `amplify/functions/fetch-ted/handler.ts`
- Create: `amplify/functions/fetch-ted/handler.test.ts`
- Create: `amplify/functions/fetch-ted/resource.ts`
- Create: `amplify/functions/fetch-ted/package.json`
- Create: `amplify/functions/fetch-ted/fixtures/ted-sample.json`

TED is the EU's daily public-procurement bulletin. Free API, no key. Returns notices in OJ/S format.

- [ ] **Step 6.1: package.json**

Create `amplify/functions/fetch-ted/package.json`:

```json
{
    "name": "fetch-ted",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-s3": "^3.758.0",
        "axios": "^1.7.7",
        "zod": "^3.24.0"
    }
}
```

- [ ] **Step 6.2: fixture**

Create `amplify/functions/fetch-ted/fixtures/ted-sample.json`:

```json
{
    "total": 2,
    "results": [
        {
            "ND": "TED-2026-100001",
            "TI": { "en": "Atomic Layer Deposition system for nanoelectronics research" },
            "DD": "2026-05-12",
            "RC": "DE",
            "OL": "DE",
            "AC": { "official-name": "Technische Universität München" },
            "CPV": [{ "code": "38540000" }, { "code": "38500000" }],
            "DT": "2026-08-30",
            "VAL": { "amount": 480000, "currency": "EUR" },
            "TX": {
                "en": "Procurement of an atomic layer deposition (ALD) system for nano-electronics research with high uniformity and trench coverage on 200mm wafers."
            },
            "URI": "https://ted.europa.eu/notice/-/detail/100001-2026"
        },
        {
            "ND": "TED-2026-100002",
            "TI": { "en": "Office cleaning services" },
            "DD": "2026-05-12",
            "RC": "FR",
            "OL": "FR",
            "AC": { "official-name": "Mairie de Lyon" },
            "CPV": [{ "code": "90919200" }],
            "DT": "2026-07-01",
            "VAL": { "amount": 95000, "currency": "EUR" },
            "TX": { "en": "Three-year contract for daily office cleaning at municipal facilities." },
            "URI": "https://ted.europa.eu/notice/-/detail/100002-2026"
        }
    ]
}
```

- [ ] **Step 6.3: Failing test**

Create `amplify/functions/fetch-ted/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fixture from './fixtures/ted-sample.json';

const axiosPost = vi.fn();
const axiosGet = vi.fn();
vi.mock('axios', () => ({ default: { post: axiosPost, get: axiosGet }, post: axiosPost, get: axiosGet }));

const s3Send = vi.fn().mockResolvedValue({});
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({ send: s3Send })),
    PutObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'PutObject', ...args })),
    GetObjectCommand: vi.fn().mockImplementation((args) => ({ __cmd: 'GetObject', ...args })),
}));

vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');

beforeEach(() => {
    axiosPost.mockReset();
    axiosGet.mockReset();
    s3Send.mockClear();
});

describe('fetch-ted handler', () => {
    it('fetches CPV-filtered notices and normalizes them', async () => {
        axiosPost.mockResolvedValueOnce({ data: fixture });
        const { handler } = await import('./handler');

        const result = await handler({ executionId: 'exec-2' });

        expect(result.source).toBe('ted');
        expect(result.fetched).toBe(2);

        const putCall = s3Send.mock.calls.find((c) => c[0].__cmd === 'PutObject');
        const body = JSON.parse(putCall![0].Body);
        expect(body[0]).toMatchObject({
            source: 'ted',
            externalId: 'TED-2026-100001',
            title: 'Atomic Layer Deposition system for nanoelectronics research',
            country: 'DE',
            language: 'de',
            postedDate: '2026-05-12',
            deadline: '2026-08-30',
            cpvCodes: ['38540000', '38500000'],
            naicsCodes: [],
            estimatedValue: { amount: 480000, currency: 'EUR' },
        });
    });

    it('returns fetched=0 + error on upstream failure', async () => {
        axiosPost.mockRejectedValueOnce(new Error('timeout'));
        const { handler } = await import('./handler');
        const result = await handler({ executionId: 'exec-2' });
        expect(result.fetched).toBe(0);
        expect(result.error).toContain('timeout');
    });
});
```

- [ ] **Step 6.4: Verify failing**

Run: `npm test -- amplify/functions/fetch-ted/handler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6.5: resource.ts**

Create `amplify/functions/fetch-ted/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const fetchTed = defineFunction({
    name: 'fetch-ted',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 300,
    memoryMB: 512,
});
```

- [ ] **Step 6.6: handler.ts**

Create `amplify/functions/fetch-ted/handler.ts`:

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import type { NormalizedTender, FetchOutput } from '../../lib/tender-watch/types';
import { stagedKey } from '../../lib/tender-watch/s3-staging';

const s3 = new S3Client({});
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

const TED_URL = 'https://ted.europa.eu/api/v3.0/notices/search';
const CPV_WHITELIST = ['38000000', '38500000', '38540000', '31700000'];
const LOOKBACK_DAYS = 2;

export interface FetchTedEvent {
    executionId: string;
}

interface TedNotice {
    ND: string;
    TI?: Record<string, string>;
    DD: string;
    RC?: string;
    OL?: string;
    AC?: { 'official-name'?: string };
    CPV?: Array<{ code: string }>;
    DT?: string | null;
    VAL?: { amount: number; currency: string } | null;
    TX?: Record<string, string>;
    URI: string;
}

interface TedResponse {
    total: number;
    results: TedNotice[];
}

function pickLocalized(map: Record<string, string> | undefined, lang: string | undefined): string {
    if (!map) return '';
    if (map.en) return map.en;
    if (lang && map[lang.toLowerCase()]) return map[lang.toLowerCase()];
    const first = Object.values(map)[0];
    return first ?? '';
}

function normalize(n: TedNotice): NormalizedTender {
    const cpv = (n.CPV ?? []).map((c) => c.code);
    return {
        source: 'ted',
        externalId: n.ND,
        url: n.URI,
        title: pickLocalized(n.TI, n.OL),
        agency: n.AC?.['official-name'] ?? 'Unknown',
        country: (n.RC ?? 'EU').slice(0, 2),
        language: (n.OL ?? 'EN').toLowerCase().slice(0, 2),
        description: pickLocalized(n.TX, n.OL),
        estimatedValue: n.VAL ?? null,
        postedDate: n.DD,
        deadline: n.DT ?? null,
        naicsCodes: [],
        cpvCodes: cpv,
        rawPayload: n,
    };
}

export async function handler(event: FetchTedEvent): Promise<FetchOutput> {
    try {
        const today = new Date();
        const lookback = new Date(today.getTime() - LOOKBACK_DAYS * 24 * 3600 * 1000);
        const updatedFrom = lookback.toISOString().slice(0, 10);

        const out: NormalizedTender[] = [];
        let page = 1;
        const pageSize = 250;
        for (;;) {
            const { data } = await axios.post<TedResponse>(
                TED_URL,
                {
                    query: `CPV IN (${CPV_WHITELIST.join(',')}) AND PD>=${updatedFrom}`,
                    page,
                    pageSize,
                    scope: '3',                    // active notices
                },
                { timeout: 30_000 },
            );
            for (const n of data.results ?? []) out.push(normalize(n));
            const total = data.total ?? out.length;
            if (page * pageSize >= total || (data.results ?? []).length === 0) break;
            page += 1;
        }

        const key = stagedKey(event.executionId, 'fetch-ted', 'output');
        await s3.send(new PutObjectCommand({
            Bucket: STAGING_BUCKET(),
            Key: key,
            Body: JSON.stringify(out),
            ContentType: 'application/json',
        }));

        console.log(JSON.stringify({ event: 'fetch-ted.success', count: out.length }));
        return { source: 'ted', stagedKey: key, fetched: out.length };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ event: 'fetch-ted.failure', error: message }));
        return { source: 'ted', stagedKey: '', fetched: 0, error: message };
    }
}
```

- [ ] **Step 6.7: Run test to verify pass**

Run: `npm test -- amplify/functions/fetch-ted/handler.test.ts`
Expected: PASS

- [ ] **Step 6.8: Commit**

```bash
git add amplify/functions/fetch-ted/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add fetch-ted Lambda

Pulls TED (EU) notices filtered by CPV codes 38000000 (lab/precision
equipment), 38500000 (testing apparatus), 38540000 (measuring), and
31700000 (electronic supplies). Prefers English title/description when
available, otherwise the notice's original language is preserved with
the language code recorded for downstream LLM scoring.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: normalize-dedupe Lambda

**Files:**
- Create: `amplify/functions/normalize-dedupe/handler.ts`
- Create: `amplify/functions/normalize-dedupe/handler.test.ts`
- Create: `amplify/functions/normalize-dedupe/resource.ts`
- Create: `amplify/functions/normalize-dedupe/package.json`

Consumes the staged-key references from all fetch Lambdas, merges, computes `sourceTenderHash`, looks up GSI2 for existing matches, writes new TENDER items, returns a list of `newTenderIds`.

- [ ] **Step 7.1: package.json**

Create `amplify/functions/normalize-dedupe/package.json`:

```json
{
    "name": "normalize-dedupe",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0",
        "@aws-sdk/client-s3": "^3.758.0"
    }
}
```

- [ ] **Step 7.2: Failing test**

Create `amplify/functions/normalize-dedupe/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NormalizedTender } from '../../lib/tender-watch/types';

const mockQuery = vi.fn();
const mockPut = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const name = cmd.constructor.name;
                if (name === 'QueryCommand') return mockQuery(cmd);
                if (name === 'PutCommand') return mockPut(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
    PutCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const s3Get = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
    S3Client: vi.fn().mockImplementation(() => ({
        send: vi.fn().mockImplementation((cmd: any) => {
            if (cmd.constructor.name === 'GetObjectCommand') return s3Get(cmd);
            return Promise.resolve({});
        }),
    })),
    GetObjectCommand: class { input: any; constructor(input: any) { this.input = input; } },
    PutObjectCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('STAGING_BUCKET', 'tender-watch-raw-test');

beforeEach(() => {
    mockQuery.mockReset();
    mockPut.mockReset();
    s3Get.mockReset();
});

function makeTender(externalId: string, source: 'sam' | 'ted', title: string): NormalizedTender {
    return {
        source,
        externalId,
        url: `https://example.com/${externalId}`,
        title,
        agency: 'Test Agency',
        country: source === 'sam' ? 'US' : 'DE',
        language: 'en',
        description: 'desc',
        postedDate: '2026-05-12',
        deadline: '2026-08-15',
        naicsCodes: [],
        cpvCodes: [],
        rawPayload: {},
    };
}

function s3JsonBody(payload: unknown) {
    const text = JSON.stringify(payload);
    return {
        Body: { transformToString: vi.fn().mockResolvedValue(text) },
    };
}

describe('normalize-dedupe handler', () => {
    it('writes new tenders and skips duplicates by sourceTenderHash', async () => {
        s3Get.mockResolvedValueOnce(s3JsonBody([makeTender('111', 'sam', 'PECVD System')]));
        s3Get.mockResolvedValueOnce(s3JsonBody([makeTender('222', 'ted', 'PECVD System')]));

        // First tender: hash not in DDB. Second tender: hash already present.
        mockQuery
            .mockResolvedValueOnce({ Items: [] })           // sam-111 lookup → new
            .mockResolvedValueOnce({ Items: [{ PK: 'TENDER#sam-111' }] }); // ted-222 lookup → dup

        mockPut.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({
            executionId: 'exec-3',
            fetchOutputs: [
                { source: 'sam', stagedKey: 'k1', fetched: 1 },
                { source: 'ted', stagedKey: 'k2', fetched: 1 },
            ],
        });

        expect(result.newTenderIds).toEqual(['sam-111']);
        expect(result.skipped).toBe(1);
        expect(mockPut).toHaveBeenCalledTimes(1);
        const putItem = mockPut.mock.calls[0][0].input.Item;
        expect(putItem.PK).toBe('TENDER#sam-111');
        expect(putItem.SK).toBe('METADATA');
        expect(putItem.GSI1PK).toBe('TENDER_STATUS#new');
        expect(putItem.GSI2PK).toMatch(/^TENDER_HASH#/);
        expect(putItem.status).toBe('new');
        expect(putItem.overallScore).toBe(0);
        expect(putItem.isHighPriority).toBe(false);
    });

    it('ignores fetch outputs with fetched=0', async () => {
        const { handler } = await import('./handler');
        const result = await handler({
            executionId: 'exec-3',
            fetchOutputs: [
                { source: 'sam', stagedKey: '', fetched: 0, error: 'upstream' },
                { source: 'ted', stagedKey: '', fetched: 0 },
            ],
        });
        expect(result.newTenderIds).toEqual([]);
        expect(s3Get).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 7.3: Verify failing**

Run: `npm test -- amplify/functions/normalize-dedupe/handler.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7.4: resource.ts**

Create `amplify/functions/normalize-dedupe/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const normalizeDedupe = defineFunction({
    name: 'normalize-dedupe',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 300,
    memoryMB: 512,
});
```

- [ ] **Step 7.5: handler.ts**

Create `amplify/functions/normalize-dedupe/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import type { NormalizedTender, FetchOutput, TenderItem } from '../../lib/tender-watch/types';
import { toUsd } from '../../lib/tender-watch/types';
import { sourceTenderHash } from '../../lib/tender-watch/hash';
import {
    tenderItemKey,
    tenderStatusGsiKey,
    tenderHashGsiKey,
} from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const s3 = new S3Client({});

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const STAGING_BUCKET = () => process.env.STAGING_BUCKET!;

export interface NormalizeDedupeEvent {
    executionId: string;
    fetchOutputs: FetchOutput[];
}

export interface NormalizeDedupeResult {
    newTenderIds: string[];
    skipped: number;
}

async function loadStaged(key: string): Promise<NormalizedTender[]> {
    const res = await s3.send(new GetObjectCommand({ Bucket: STAGING_BUCKET(), Key: key }));
    if (!res.Body) return [];
    const text = await res.Body.transformToString('utf-8');
    return JSON.parse(text) as NormalizedTender[];
}

async function hashExists(hash: string): Promise<boolean> {
    const res = await ddb.send(new QueryCommand({
        TableName: TABLE(),
        IndexName: 'GSI2',
        KeyConditionExpression: 'GSI2PK = :pk AND GSI2SK = :sk',
        ExpressionAttributeValues: { ':pk': `TENDER_HASH#${hash}`, ':sk': 'TENDER' },
        Limit: 1,
    }));
    return (res.Items?.length ?? 0) > 0;
}

function buildItem(t: NormalizedTender, hash: string, now: string): TenderItem {
    const tenderId = `${t.source}-${t.externalId}`;
    const status = 'new' as const;
    const overallScore = 0;
    const isHighPriority = false;
    const isExpired = t.deadline ? t.deadline < now.slice(0, 10) : false;
    const usd = toUsd(t.estimatedValue?.amount, t.estimatedValue?.currency);
    return {
        ...tenderItemKey(tenderId),
        ...tenderStatusGsiKey(status, overallScore, t.postedDate, tenderId),
        ...tenderHashGsiKey(hash),
        tenderId,
        entityType: 'TENDER',
        source: t.source,
        sourceUrl: t.url,
        sourceTenderHash: hash,
        title: t.title,
        agency: t.agency,
        country: t.country,
        language: t.language,
        description: t.description,
        estimatedValueUSD: usd,
        estimatedValueOriginal: t.estimatedValue ? `${t.estimatedValue.currency} ${t.estimatedValue.amount}` : null,
        postedDate: t.postedDate,
        deadline: t.deadline ?? null,
        naicsCodes: t.naicsCodes,
        cpvCodes: t.cpvCodes,
        rawPayload: t.rawPayload,
        overallScore,
        isHighPriority,
        isExpired,
        status,
        statusNote: null,
        assignedTo: null,
        lastStatusChangedAt: null,
        createdAt: now,
        updatedAt: now,
    };
}

export async function handler(event: NormalizeDedupeEvent): Promise<NormalizeDedupeResult> {
    const now = new Date().toISOString();
    const newTenderIds: string[] = [];
    let skipped = 0;

    for (const fo of event.fetchOutputs) {
        if (fo.fetched <= 0 || !fo.stagedKey) continue;
        const tenders = await loadStaged(fo.stagedKey);
        for (const t of tenders) {
            const hash = sourceTenderHash({
                title: t.title,
                agency: t.agency,
                deadline: t.deadline,
            });
            if (await hashExists(hash)) { skipped += 1; continue; }
            const item = buildItem(t, hash, now);
            try {
                await ddb.send(new PutCommand({
                    TableName: TABLE(),
                    Item: item,
                    ConditionExpression: 'attribute_not_exists(PK)',
                }));
                newTenderIds.push(item.tenderId);
            } catch (err) {
                if (err instanceof Error && err.name === 'ConditionalCheckFailedException') {
                    skipped += 1;
                } else { throw err; }
            }
        }
    }

    console.log(JSON.stringify({ event: 'normalize-dedupe.done', newTenderIds: newTenderIds.length, skipped }));
    return { newTenderIds, skipped };
}
```

- [ ] **Step 7.6: Run test to verify pass**

Run: `npm test -- amplify/functions/normalize-dedupe/handler.test.ts`
Expected: PASS

- [ ] **Step 7.7: Commit**

```bash
git add amplify/functions/normalize-dedupe/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add normalize-dedupe Lambda

Reads all fetch-* S3-staged outputs, computes sourceTenderHash for each
tender, queries GSI2 to skip duplicates seen in prior days or other
sources, and PutItems new TENDER entities with status='new',
overallScore=0, and proper GSI1/GSI2 keys. Returns newTenderIds for the
prefilter step.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: prefilter-by-keyword Lambda

**Files:**
- Create: `amplify/functions/prefilter-by-keyword/handler.ts`
- Create: `amplify/functions/prefilter-by-keyword/handler.test.ts`
- Create: `amplify/functions/prefilter-by-keyword/resource.ts`
- Create: `amplify/functions/prefilter-by-keyword/package.json`

Pure-function-style core: load active `TenderKeywordConfig` items, for each new tender check (keyword OR synonym match) AND no-blacklist AND (NAICS or CPV whitelist match OR no codes provided). The matchable logic is exported separately so the Phase 2 admin UI's `runPrefilterPreview` mutation can reuse it.

- [ ] **Step 8.1: package.json**

Create `amplify/functions/prefilter-by-keyword/package.json`:

```json
{
    "name": "prefilter-by-keyword",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0"
    }
}
```

- [ ] **Step 8.2: Failing test**

Create `amplify/functions/prefilter-by-keyword/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchesAnyConfig } from './handler';

const mockQuery = vi.fn();
const mockBatchGet = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({
    DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'QueryCommand') return mockQuery(cmd);
                if (n === 'BatchGetCommand') return mockBatchGet(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
    BatchGetCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');

beforeEach(() => {
    mockQuery.mockReset();
    mockBatchGet.mockReset();
});

describe('matchesAnyConfig (pure logic)', () => {
    const pecvd = {
        productCategory: 'PECVD',
        productSlugs: ['pluto-f'],
        keywords: ['PECVD', 'plasma-enhanced chemical vapor deposition'],
        synonyms: ['plasma enhanced cvd'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '334519'],
        cpvCodes: ['38540000'],
        isActive: true,
    };

    it('passes a tender that matches keyword and NAICS', () => {
        const r = matchesAnyConfig(
            { title: 'PECVD System for Cleanroom', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [pecvd],
        );
        expect(r.matchedCategories).toContain('PECVD');
        expect(r.matchedKeywords).toContain('PECVD');
    });

    it('rejects a tender that matches keyword but is on the blacklist', () => {
        const r = matchesAnyConfig(
            { title: 'PECVD advertisement campaign', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [pecvd],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('rejects a tender with no code match and no keyword match', () => {
        const r = matchesAnyConfig(
            { title: 'Pool cleaning services', description: '', naicsCodes: ['561720'], cpvCodes: [] },
            [pecvd],
        );
        expect(r.matchedCategories).toEqual([]);
    });

    it('passes when NAICS is empty in config (no code restriction)', () => {
        const noCodes = { ...pecvd, naicsCodes: [], cpvCodes: [] };
        const r = matchesAnyConfig(
            { title: 'plasma enhanced cvd machine', description: '', naicsCodes: [], cpvCodes: [] },
            [noCodes],
        );
        expect(r.matchedCategories).toContain('PECVD');
        expect(r.matchedKeywords).toContain('plasma enhanced cvd');
    });

    it('matches synonyms case-insensitively', () => {
        const r = matchesAnyConfig(
            { title: 'plasma enhanced CVD tool', description: '', naicsCodes: ['334516'], cpvCodes: [] },
            [pecvd],
        );
        expect(r.matchedKeywords).toContain('plasma enhanced cvd');
    });

    it('matches by CPV code when keyword is absent but description mentions related work', () => {
        const r = matchesAnyConfig(
            { title: 'Equipment supply', description: 'Various', naicsCodes: [], cpvCodes: ['38540000'] },
            [pecvd],
        );
        // CPV alone is not enough — keyword/synonym must also hit. Otherwise too noisy.
        expect(r.matchedCategories).toEqual([]);
    });
});

describe('prefilter-by-keyword handler', () => {
    it('returns only tenders that pass at least one config', async () => {
        // First query: list active configs from GSI1
        mockQuery.mockResolvedValueOnce({
            Items: [
                {
                    productCategory: 'PECVD',
                    productSlugs: ['pluto-f'],
                    keywords: ['PECVD'],
                    synonyms: [],
                    blacklist: [],
                    naicsCodes: ['334516'],
                    cpvCodes: [],
                    isActive: true,
                },
            ],
        });
        // BatchGet for the candidate tender items
        mockBatchGet.mockResolvedValueOnce({
            Responses: {
                NineScrollsIntelligence: [
                    { tenderId: 'sam-1', title: 'PECVD System', description: '', naicsCodes: ['334516'], cpvCodes: [] },
                    { tenderId: 'sam-2', title: 'HVAC Service Contract', description: '', naicsCodes: ['238220'], cpvCodes: [] },
                ],
            },
        });

        const { handler } = await import('./handler');
        const result = await handler({ newTenderIds: ['sam-1', 'sam-2'] });

        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].tenderId).toBe('sam-1');
        expect(result.candidates[0].matchedKeywords).toContain('PECVD');
    });

    it('returns empty candidates when there are no new tenders', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ newTenderIds: [] });
        expect(result.candidates).toEqual([]);
        expect(result.candidatesCount).toBe(0);
    });
});
```

- [ ] **Step 8.3: Verify failing**

Run: `npm test -- amplify/functions/prefilter-by-keyword/handler.test.ts`
Expected: FAIL

- [ ] **Step 8.4: resource.ts**

Create `amplify/functions/prefilter-by-keyword/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const prefilterByKeyword = defineFunction({
    name: 'prefilter-by-keyword',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 60,
    memoryMB: 512,
});
```

- [ ] **Step 8.5: handler.ts**

Create `amplify/functions/prefilter-by-keyword/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';
import type { TenderKeywordConfigItem } from '../../lib/tender-watch/types';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

export interface PrefilterEvent { newTenderIds: string[]; }
export interface PrefilterCandidate {
    tenderId: string;
    matchedCategories: string[];
    matchedKeywords: string[];
}
export interface PrefilterResult {
    candidates: PrefilterCandidate[];
    candidatesCount: number;  // duplicate of candidates.length so the Step Functions Choice state can read a primitive instead of invoking States.ArrayLength
}

interface MatchableTender {
    title: string;
    description: string;
    naicsCodes: string[];
    cpvCodes: string[];
}

/** Exported for reuse by Phase 2 admin `runPrefilterPreview` mutation. */
export function matchesAnyConfig(
    t: MatchableTender,
    configs: TenderKeywordConfigItem[],
): { matchedCategories: string[]; matchedKeywords: string[] } {
    const haystack = `${t.title}\n${t.description}`.toLowerCase();
    const matchedCategories: string[] = [];
    const matchedKeywords = new Set<string>();

    for (const c of configs) {
        if (!c.isActive) continue;
        // Blacklist check
        if (c.blacklist.some((b) => haystack.includes(b.toLowerCase()))) continue;
        // Keyword/synonym match
        const terms = [...c.keywords, ...c.synonyms];
        const hits = terms.filter((term) => haystack.includes(term.toLowerCase()));
        if (hits.length === 0) continue;
        // Optional code whitelist: if both codes set are non-empty AND tender has no overlap, reject.
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

async function loadActiveConfigs(): Promise<TenderKeywordConfigItem[]> {
    const out: TenderKeywordConfigItem[] = [];
    let cursor: Record<string, unknown> | undefined;
    do {
        const res = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG_ACTIVE' },
            ExclusiveStartKey: cursor,
        }));
        for (const it of (res.Items ?? [])) out.push(it as TenderKeywordConfigItem);
        cursor = res.LastEvaluatedKey;
    } while (cursor);
    return out;
}

async function loadTenders(tenderIds: string[]): Promise<MatchableTender[] & { tenderId: string }[]> {
    if (tenderIds.length === 0) return [] as never;
    const out: any[] = [];
    for (let i = 0; i < tenderIds.length; i += 100) {
        const batch = tenderIds.slice(i, i + 100);
        const res = await ddb.send(new BatchGetCommand({
            RequestItems: {
                [TABLE()]: { Keys: batch.map((id) => tenderItemKey(id)) },
            },
        }));
        for (const it of (res.Responses?.[TABLE()] ?? [])) out.push(it);
    }
    return out;
}

export async function handler(event: PrefilterEvent): Promise<PrefilterResult> {
    if (event.newTenderIds.length === 0) {
        return { candidates: [] };
    }
    const [configs, tenders] = await Promise.all([
        loadActiveConfigs(),
        loadTenders(event.newTenderIds),
    ]);

    const candidates: PrefilterCandidate[] = [];
    for (const t of tenders) {
        const r = matchesAnyConfig(t, configs);
        if (r.matchedCategories.length > 0) {
            candidates.push({ tenderId: t.tenderId, ...r });
        }
    }

    console.log(JSON.stringify({
        event: 'prefilter.done',
        in: event.newTenderIds.length,
        out: candidates.length,
        configs: configs.length,
    }));
    return { candidates, candidatesCount: candidates.length };
}
```

- [ ] **Step 8.6: Run test to verify pass**

Run: `npm test -- amplify/functions/prefilter-by-keyword/handler.test.ts`
Expected: PASS

- [ ] **Step 8.7: Commit**

```bash
git add amplify/functions/prefilter-by-keyword/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add prefilter-by-keyword Lambda

Loads all active TenderKeywordConfig rows, runs each new tender through
keyword/synonym match, blacklist exclusion, and optional NAICS/CPV
whitelist. The match logic is exported as matchesAnyConfig so the
Phase 2 admin UI's runPrefilterPreview mutation can reuse it.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: match-with-llm Lambda

**Files:**
- Create: `amplify/functions/match-with-llm/handler.ts`
- Create: `amplify/functions/match-with-llm/handler.test.ts`
- Create: `amplify/functions/match-with-llm/resource.ts`
- Create: `amplify/functions/match-with-llm/package.json`

Invoked as a Step Functions Map state — one call per candidate tender. Builds a Bedrock Haiku prompt asking for JSON-array scoring against all active keyword configs, parses the result, drops `score < 30`, writes `TENDER_MATCH` items, and returns the list of (productSlug, score) pairs for the classify step.

- [ ] **Step 9.1: package.json**

Create `amplify/functions/match-with-llm/package.json`:

```json
{
    "name": "match-with-llm",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@anthropic-ai/sdk": "^0.32.1",
        "@aws-sdk/client-bedrock-runtime": "^3.758.0",
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/client-s3": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0"
    }
}
```

- [ ] **Step 9.2: Failing test**

Create `amplify/functions/match-with-llm/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockQuery = vi.fn();
const mockPut = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'GetCommand') return mockGet(cmd);
                if (n === 'QueryCommand') return mockQuery(cmd);
                if (n === 'PutCommand') return mockPut(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    GetCommand: class { input: any; constructor(input: any) { this.input = input; } },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
    PutCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const mockBedrockSend = vi.fn();
vi.mock('@aws-sdk/client-bedrock-runtime', () => ({
    BedrockRuntimeClient: vi.fn().mockImplementation(() => ({ send: mockBedrockSend })),
    InvokeModelCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const mockAnthropic = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
    default: class { messages = { create: mockAnthropic }; },
    Anthropic: class { messages = { create: mockAnthropic }; },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('BEDROCK_MODEL_ID', 'us.anthropic.claude-haiku-4-5-20251001-v1:0');
vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');

beforeEach(() => {
    mockGet.mockReset(); mockQuery.mockReset(); mockPut.mockReset();
    mockBedrockSend.mockReset(); mockAnthropic.mockReset();
});

function bedrockOk(body: object) {
    const json = JSON.stringify({ content: [{ type: 'text', text: JSON.stringify(body) }] });
    return { body: { transformToString: vi.fn().mockResolvedValue(json) } };
}

describe('match-with-llm handler', () => {
    it('writes MATCH items for scores >= 30 and skips lower scores', async () => {
        mockGet.mockResolvedValueOnce({
            Item: { tenderId: 'sam-1', title: 'PECVD System', description: 'desc' },
        });
        mockQuery.mockResolvedValueOnce({
            Items: [
                { productCategory: 'PECVD', productSlugs: ['pluto-f'], isActive: true },
                { productCategory: 'AFM', productSlugs: ['hy20l'], isActive: true },
            ],
        });
        mockBedrockSend.mockResolvedValueOnce(bedrockOk([
            { category: 'PECVD', score: 87, reasoning: 'strong PECVD match', matchedKeywords: ['PECVD'] },
            { category: 'AFM', score: 15, reasoning: 'not relevant', matchedKeywords: [] },
        ]));
        mockPut.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({ tenderId: 'sam-1' });

        expect(result.tenderId).toBe('sam-1');
        expect(result.matches).toHaveLength(1);
        expect(result.matches[0]).toMatchObject({ productSlug: 'pluto-f', score: 87 });
        expect(mockPut).toHaveBeenCalledTimes(1);
        const item = mockPut.mock.calls[0][0].input.Item;
        expect(item.PK).toBe('TENDER#sam-1');
        expect(item.SK).toBe('MATCH#pluto-f');
        expect(item.entityType).toBe('TENDER_MATCH');
        expect(item.score).toBe(87);
    });

    it('falls back to Anthropic API on Bedrock failure', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-2', title: 'ALD', description: '' } });
        mockQuery.mockResolvedValueOnce({ Items: [{ productCategory: 'ALD', productSlugs: ['ald-tool'], isActive: true }] });
        mockBedrockSend.mockRejectedValueOnce(new Error('Bedrock down'));
        mockAnthropic.mockResolvedValueOnce({
            content: [{ type: 'text', text: JSON.stringify([{ category: 'ALD', score: 75, reasoning: 'ok', matchedKeywords: ['ALD'] }]) }],
        });
        mockPut.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({ tenderId: 'sam-2' });
        expect(result.matches[0].score).toBe(75);
        expect(mockAnthropic).toHaveBeenCalled();
    });

    it('returns empty matches when both providers fail', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-3', title: 'X', description: '' } });
        mockQuery.mockResolvedValueOnce({ Items: [{ productCategory: 'PECVD', productSlugs: ['pluto-f'], isActive: true }] });
        mockBedrockSend.mockRejectedValueOnce(new Error('throttle'));
        mockAnthropic.mockRejectedValueOnce(new Error('500'));

        const { handler } = await import('./handler');
        const result = await handler({ tenderId: 'sam-3' });
        expect(result.matches).toEqual([]);
        expect(result.error).toBeDefined();
    });
});
```

- [ ] **Step 9.3: Verify failing**

Run: `npm test -- amplify/functions/match-with-llm/handler.test.ts`
Expected: FAIL.

- [ ] **Step 9.4: resource.ts**

Create `amplify/functions/match-with-llm/resource.ts`:

```typescript
import { defineFunction, secret } from '@aws-amplify/backend';

export const matchWithLlm = defineFunction({
    name: 'match-with-llm',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 120,
    memoryMB: 1024,
    environment: {
        ANTHROPIC_API_KEY: secret('ANTHROPIC_API_KEY'),
        BEDROCK_MODEL_ID: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
        CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
    },
});
```

- [ ] **Step 9.5: handler.ts**

Create `amplify/functions/match-with-llm/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import Anthropic from '@anthropic-ai/sdk';
import type { TenderKeywordConfigItem, TenderMatchItem } from '../../lib/tender-watch/types';
import { tenderItemKey, tenderMatchItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const bedrock = new BedrockRuntimeClient({});

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const BEDROCK_MODEL_ID = () => process.env.BEDROCK_MODEL_ID!;
const CLAUDE_MODEL = () => process.env.CLAUDE_MODEL!;
const ANTHROPIC_API_KEY = () => process.env.ANTHROPIC_API_KEY!;

const BEDROCK_TIMEOUT_MS = 8000;
const ANTHROPIC_TIMEOUT_MS = 20000;
const MIN_SCORE = 30;
const DESCRIPTION_MAX_CHARS = 4000;

export interface MatchEvent { tenderId: string; }
export interface MatchResult {
    tenderId: string;
    matches: { productSlug: string; productCategory: string; score: number }[];
    error?: string;
}

interface LlmMatch {
    category: string;
    score: number;
    reasoning: string;
    matchedKeywords: string[];
}

function buildPrompt(
    tender: { title: string; description: string },
    configs: TenderKeywordConfigItem[],
): string {
    const desc = tender.description.length > DESCRIPTION_MAX_CHARS
        ? tender.description.slice(0, DESCRIPTION_MAX_CHARS) + '…'
        : tender.description;
    const catalog = configs.filter((c) => c.isActive).map((c) => ({
        category: c.productCategory,
        productSlugs: c.productSlugs,
    }));
    return [
        'You are scoring how relevant a public procurement tender is to NineScrolls\' product catalog.',
        'NineScrolls sells semiconductor and MEMS fabrication equipment (PECVD, ALD, RIE/ICP etchers, e-beam evaporator, sputter systems, atomic-force microscopes).',
        'Score on a 0–100 scale where 0 means clearly unrelated and 100 means the tender is unambiguously asking for one of these products.',
        '',
        'Output JSON only — an array of objects, one per product category from the catalog. Schema:',
        '[{ "category": string, "score": number 0-100, "reasoning": string, "matchedKeywords": string[] }]',
        '',
        'Reasoning must be in English. Do not include explanations outside the JSON.',
        '',
        'Tender:',
        `  Title: ${tender.title}`,
        `  Description: ${desc}`,
        '',
        'Catalog:',
        JSON.stringify(catalog),
    ].join('\n');
}

async function callBedrock(prompt: string): Promise<LlmMatch[]> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), BEDROCK_TIMEOUT_MS);
    try {
        const res = await bedrock.send(new InvokeModelCommand({
            modelId: BEDROCK_MODEL_ID(),
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
        const inner: string = wrap.content?.[0]?.text ?? '[]';
        return JSON.parse(inner) as LlmMatch[];
    } finally { clearTimeout(t); }
}

async function callAnthropic(prompt: string): Promise<LlmMatch[]> {
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY(), timeout: ANTHROPIC_TIMEOUT_MS });
    const res = await client.messages.create({
        model: CLAUDE_MODEL(),
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
    });
    const block = (res.content[0] as any);
    const text: string = block?.text ?? '[]';
    return JSON.parse(text) as LlmMatch[];
}

export async function handler(event: MatchEvent): Promise<MatchResult> {
    let tender: any;
    let configs: TenderKeywordConfigItem[] = [];

    try {
        const t = await ddb.send(new GetCommand({ TableName: TABLE(), Key: tenderItemKey(event.tenderId) }));
        tender = t.Item;
        if (!tender) throw new Error(`tender ${event.tenderId} not found`);

        const c = await ddb.send(new QueryCommand({
            TableName: TABLE(),
            IndexName: 'GSI1',
            KeyConditionExpression: 'GSI1PK = :pk',
            ExpressionAttributeValues: { ':pk': 'TENDER_KEYWORD_CONFIG_ACTIVE' },
        }));
        configs = (c.Items ?? []) as TenderKeywordConfigItem[];
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { tenderId: event.tenderId, matches: [], error: message };
    }

    const prompt = buildPrompt(tender, configs);
    let llmOut: LlmMatch[];
    try {
        llmOut = await callBedrock(prompt);
    } catch (bedrockErr) {
        console.warn(JSON.stringify({ event: 'match.bedrock.fail', tenderId: event.tenderId, error: String(bedrockErr) }));
        try {
            llmOut = await callAnthropic(prompt);
        } catch (anthropicErr) {
            const message = String(anthropicErr);
            console.error(JSON.stringify({ event: 'match.anthropic.fail', tenderId: event.tenderId, error: message }));
            return { tenderId: event.tenderId, matches: [], error: message };
        }
    }

    const matches: MatchResult['matches'] = [];
    const now = new Date().toISOString();
    for (const m of llmOut) {
        if (!m || typeof m.score !== 'number' || m.score < MIN_SCORE) continue;
        const config = configs.find((c) => c.productCategory === m.category);
        if (!config) continue;
        for (const productSlug of config.productSlugs) {
            const item: TenderMatchItem = {
                ...tenderMatchItemKey(event.tenderId, productSlug),
                tenderId: event.tenderId,
                productSlug,
                entityType: 'TENDER_MATCH',
                score: Math.round(m.score),
                reasoning: m.reasoning ?? '',
                matchedKeywords: Array.isArray(m.matchedKeywords) ? m.matchedKeywords : [],
                createdAt: now,
            };
            await ddb.send(new PutCommand({ TableName: TABLE(), Item: item }));
            matches.push({ productSlug, productCategory: m.category, score: item.score });
        }
    }

    console.log(JSON.stringify({ event: 'match.done', tenderId: event.tenderId, matchCount: matches.length }));
    return { tenderId: event.tenderId, matches };
}
```

- [ ] **Step 9.6: Run test to verify pass**

Run: `npm test -- amplify/functions/match-with-llm/handler.test.ts`
Expected: PASS

- [ ] **Step 9.7: Commit**

```bash
git add amplify/functions/match-with-llm/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add match-with-llm Lambda

Bedrock Claude Haiku 4.5 scores each candidate tender against the active
keyword-config categories. Anthropic API fallback on Bedrock throttling
or schema-version mismatch. Writes one TENDER_MATCH item per product
slug for every category with score >= 30; <30 dropped to keep the
admin UI focused.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: classify-and-store Lambda

**Files:**
- Create: `amplify/functions/classify-and-store/handler.ts`
- Create: `amplify/functions/classify-and-store/handler.test.ts`
- Create: `amplify/functions/classify-and-store/resource.ts`
- Create: `amplify/functions/classify-and-store/package.json`

Reads the array of `MatchResult` objects from the Map state, computes `overallScore` per tender (max of its match scores), updates the TENDER metadata item (including GSI1SK refresh because the score moved, and GSI3PK/SK set/cleared based on the new isHighPriority).

- [ ] **Step 10.1: package.json**

Create `amplify/functions/classify-and-store/package.json`:

```json
{
    "name": "classify-and-store",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0"
    }
}
```

- [ ] **Step 10.2: Failing test**

Create `amplify/functions/classify-and-store/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'GetCommand') return mockGet(cmd);
                if (n === 'UpdateCommand') return mockUpdate(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    GetCommand: class { input: any; constructor(input: any) { this.input = input; } },
    UpdateCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');

beforeEach(() => { mockGet.mockReset(); mockUpdate.mockReset(); });

describe('classify-and-store handler', () => {
    it('sets overallScore=max, isHighPriority=true, GSI3 when score >= 80', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-1', status: 'new', postedDate: '2026-05-10' } });
        mockUpdate.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({
            matchResults: [
                { tenderId: 'sam-1', matches: [
                    { productSlug: 'pluto-f', productCategory: 'PECVD', score: 87 },
                    { productSlug: 'hy20l', productCategory: 'AFM', score: 42 },
                ] },
            ],
        });

        expect(result.tendersUpdated).toBe(1);
        expect(result.highPriorityTenderIds).toEqual(['sam-1']);
        const update = mockUpdate.mock.calls[0][0].input;
        expect(update.Key).toEqual({ PK: 'TENDER#sam-1', SK: 'METADATA' });
        const expressionValues = update.ExpressionAttributeValues;
        expect(expressionValues[':overallScore']).toBe(87);
        expect(expressionValues[':isHighPriority']).toBe(true);
        expect(expressionValues[':gsi3pk']).toBe('TENDER_HIGH_PRIORITY');
        expect(expressionValues[':gsi3sk']).toBe('2026-05-10#sam-1');
        expect(expressionValues[':gsi1sk']).toMatch(/^013#2026-05-10#sam-1$/); // 100 - 87
    });

    it('clears GSI3 when no matches reach 80', async () => {
        mockGet.mockResolvedValueOnce({ Item: { tenderId: 'sam-2', status: 'new', postedDate: '2026-05-10' } });
        mockUpdate.mockResolvedValue({});

        const { handler } = await import('./handler');
        await handler({
            matchResults: [
                { tenderId: 'sam-2', matches: [{ productSlug: 'pluto-f', productCategory: 'PECVD', score: 45 }] },
            ],
        });

        const update = mockUpdate.mock.calls[0][0].input;
        // UpdateExpression should REMOVE GSI3PK and GSI3SK
        expect(update.UpdateExpression).toContain('REMOVE');
        expect(update.UpdateExpression).toContain('GSI3PK');
    });

    it('skips tenders with no matches at all', async () => {
        const { handler } = await import('./handler');
        const result = await handler({
            matchResults: [{ tenderId: 'sam-3', matches: [] }],
        });
        expect(result.tendersUpdated).toBe(0);
        expect(mockUpdate).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 10.3: Verify failing**

Run: `npm test -- amplify/functions/classify-and-store/handler.test.ts`
Expected: FAIL.

- [ ] **Step 10.4: resource.ts**

Create `amplify/functions/classify-and-store/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const classifyAndStore = defineFunction({
    name: 'classify-and-store',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 60,
    memoryMB: 512,
});
```

- [ ] **Step 10.5: handler.ts**

Create `amplify/functions/classify-and-store/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import {
    tenderItemKey,
    scoreSortToken,
    tenderHighPriorityGsiKey,
} from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const HIGH_PRIORITY_THRESHOLD = 80;

export interface MatchResultInput {
    tenderId: string;
    matches: { productSlug: string; productCategory: string; score: number }[];
}

export interface ClassifyEvent { matchResults: MatchResultInput[]; }
export interface ClassifyResult {
    tendersUpdated: number;
    highPriorityTenderIds: string[];
    digestTenderIds: string[];
}

export async function handler(event: ClassifyEvent): Promise<ClassifyResult> {
    const highPriority: string[] = [];
    const digest: string[] = [];
    let updated = 0;
    const now = new Date().toISOString();

    for (const r of event.matchResults) {
        if (r.matches.length === 0) continue;

        const overallScore = Math.max(...r.matches.map((m) => m.score));
        const isHighPriority = overallScore >= HIGH_PRIORITY_THRESHOLD;

        const t = await ddb.send(new GetCommand({
            TableName: TABLE(),
            Key: tenderItemKey(r.tenderId),
            ProjectionExpression: 'tenderId, #st, postedDate',
            ExpressionAttributeNames: { '#st': 'status' },
        }));
        const tender = t.Item;
        if (!tender) {
            console.warn(JSON.stringify({ event: 'classify.missing', tenderId: r.tenderId }));
            continue;
        }

        const gsi1Sk = `${scoreSortToken(overallScore)}#${tender.postedDate}#${r.tenderId}`;

        const expressionValues: Record<string, unknown> = {
            ':overallScore': overallScore,
            ':isHighPriority': isHighPriority,
            ':updatedAt': now,
            ':gsi1sk': gsi1Sk,
        };
        let setExpr = 'SET overallScore = :overallScore, isHighPriority = :isHighPriority, updatedAt = :updatedAt, GSI1SK = :gsi1sk';
        let removeExpr = '';

        if (isHighPriority) {
            const k = tenderHighPriorityGsiKey(tender.postedDate, r.tenderId);
            expressionValues[':gsi3pk'] = k.GSI3PK;
            expressionValues[':gsi3sk'] = k.GSI3SK;
            setExpr += ', GSI3PK = :gsi3pk, GSI3SK = :gsi3sk';
            highPriority.push(r.tenderId);
        } else {
            removeExpr = ' REMOVE GSI3PK, GSI3SK';
        }

        await ddb.send(new UpdateCommand({
            TableName: TABLE(),
            Key: tenderItemKey(r.tenderId),
            UpdateExpression: setExpr + removeExpr,
            ExpressionAttributeValues: expressionValues,
        }));

        digest.push(r.tenderId);
        updated += 1;
    }

    console.log(JSON.stringify({ event: 'classify.done', updated, highPriority: highPriority.length }));
    return { tendersUpdated: updated, highPriorityTenderIds: highPriority, digestTenderIds: digest };
}
```

- [ ] **Step 10.6: Run test to verify pass**

Run: `npm test -- amplify/functions/classify-and-store/handler.test.ts`
Expected: PASS

- [ ] **Step 10.7: Commit**

```bash
git add amplify/functions/classify-and-store/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add classify-and-store Lambda

Aggregates per-tender match scores from the LLM Map state, writes
overallScore + isHighPriority to the TENDER metadata, refreshes GSI1SK
(score sort key) and conditionally sets/clears GSI3 (high-priority
digest index) based on the 80-point threshold.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: notify-high-priority Lambda

**Files:**
- Create: `amplify/functions/notify-high-priority/handler.ts`
- Create: `amplify/functions/notify-high-priority/handler.test.ts`
- Create: `amplify/functions/notify-high-priority/resource.ts`
- Create: `amplify/functions/notify-high-priority/package.json`

For each tender in `highPriorityTenderIds`, load the metadata + match list, send one SES email with all the relevant info.

- [ ] **Step 11.1: package.json**

Create `amplify/functions/notify-high-priority/package.json`:

```json
{
    "name": "notify-high-priority",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0",
        "@aws-sdk/client-sesv2": "^3.758.0"
    }
}
```

- [ ] **Step 11.2: Failing test**

Create `amplify/functions/notify-high-priority/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGet = vi.fn();
const mockQuery = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'GetCommand') return mockGet(cmd);
                if (n === 'QueryCommand') return mockQuery(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    GetCommand: class { input: any; constructor(input: any) { this.input = input; } },
    QueryCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const sesSend = vi.fn().mockResolvedValue({ MessageId: 'mid-1' });
vi.mock('@aws-sdk/client-sesv2', () => ({
    SESv2Client: vi.fn().mockImplementation(() => ({ send: sesSend })),
    SendEmailCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('NOTIFICATION_FROM', 'info@ninescrolls.com');
vi.stubEnv('NOTIFICATION_TO', 'info@ninescrolls.com');

beforeEach(() => { mockGet.mockReset(); mockQuery.mockReset(); sesSend.mockClear(); });

describe('notify-high-priority handler', () => {
    it('sends one email per high-priority tender with score, agency, deadline', async () => {
        mockGet
            .mockResolvedValueOnce({ Item: {
                tenderId: 'sam-1', title: 'PECVD System', agency: 'Stanford',
                country: 'US', deadline: '2026-08-15', overallScore: 87,
                sourceUrl: 'https://sam.gov/opp/abc', estimatedValueUSD: 250000,
            } });
        mockQuery.mockResolvedValueOnce({
            Items: [
                { productSlug: 'pluto-f', score: 87, reasoning: 'strong match', matchedKeywords: ['PECVD'] },
            ],
        });

        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: ['sam-1'] });

        expect(result.sent).toBe(1);
        const email = sesSend.mock.calls[0][0].input;
        expect(email.FromEmailAddress).toBe('info@ninescrolls.com');
        expect(email.Destination.ToAddresses).toContain('info@ninescrolls.com');
        const subject = email.Content.Simple.Subject.Data;
        expect(subject).toContain('Stanford');
        expect(subject).toContain('87');
        const body = email.Content.Simple.Body.Html.Data;
        expect(body).toContain('PECVD System');
        expect(body).toContain('https://sam.gov/opp/abc');
        expect(body).toContain('strong match');
    });

    it('does nothing when the list is empty', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ highPriorityTenderIds: [] });
        expect(result.sent).toBe(0);
        expect(sesSend).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 11.3: Verify failing**

Run: `npm test -- amplify/functions/notify-high-priority/handler.test.ts`
Expected: FAIL.

- [ ] **Step 11.4: resource.ts**

Create `amplify/functions/notify-high-priority/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const notifyHighPriority = defineFunction({
    name: 'notify-high-priority',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 120,
    memoryMB: 256,
    environment: {
        NOTIFICATION_FROM: 'info@ninescrolls.com',
        NOTIFICATION_TO: 'info@ninescrolls.com',
    },
});
```

- [ ] **Step 11.5: handler.ts**

Create `amplify/functions/notify-high-priority/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { tenderItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESv2Client({});

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const FROM = () => process.env.NOTIFICATION_FROM!;
const TO = () => process.env.NOTIFICATION_TO!;

export interface NotifyHighPriorityEvent { highPriorityTenderIds: string[]; }
export interface NotifyResult { sent: number; failed: number; }

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function daysUntil(dateIso: string | null | undefined): string {
    if (!dateIso) return 'no deadline';
    const ms = new Date(dateIso).getTime() - Date.now();
    const days = Math.ceil(ms / 86_400_000);
    return `${days} day${Math.abs(days) === 1 ? '' : 's'}`;
}

export async function handler(event: NotifyHighPriorityEvent): Promise<NotifyResult> {
    let sent = 0; let failed = 0;

    for (const tenderId of event.highPriorityTenderIds) {
        try {
            const meta = await ddb.send(new GetCommand({ TableName: TABLE(), Key: tenderItemKey(tenderId) }));
            const t = meta.Item;
            if (!t) { failed += 1; continue; }

            const matches = await ddb.send(new QueryCommand({
                TableName: TABLE(),
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
                ExpressionAttributeValues: { ':pk': `TENDER#${tenderId}`, ':sk': 'MATCH#' },
            }));

            const subject = `🔥 [Tender Watch] ${t.country} · ${t.agency} · score ${t.overallScore}`;
            const matchesHtml = (matches.Items ?? []).map((m) =>
                `<li><strong>${escapeHtml(m.productSlug)}</strong> — ${m.score}/100<br><em>${escapeHtml(m.reasoning)}</em></li>`
            ).join('');

            const html = [
                `<h2>${escapeHtml(t.title)}</h2>`,
                `<p><strong>Agency:</strong> ${escapeHtml(t.agency)} (${escapeHtml(t.country)})<br>`,
                `<strong>Deadline:</strong> ${t.deadline ?? 'N/A'} (${daysUntil(t.deadline)})<br>`,
                t.estimatedValueUSD ? `<strong>Estimated value:</strong> ~$${t.estimatedValueUSD.toLocaleString('en-US')}<br>` : '',
                `<strong>Score:</strong> ${t.overallScore}/100<br>`,
                `<strong>Source:</strong> <a href="${escapeHtml(t.sourceUrl)}">${escapeHtml(t.sourceUrl)}</a></p>`,
                `<h3>Product matches</h3><ul>${matchesHtml}</ul>`,
                `<h3>Description</h3><p>${escapeHtml(t.description).replace(/\n/g, '<br>')}</p>`,
            ].join('\n');

            await ses.send(new SendEmailCommand({
                FromEmailAddress: FROM(),
                Destination: { ToAddresses: [TO()] },
                Content: {
                    Simple: {
                        Subject: { Data: subject, Charset: 'UTF-8' },
                        Body: { Html: { Data: html, Charset: 'UTF-8' } },
                    },
                },
            }));
            sent += 1;
        } catch (err) {
            console.error(JSON.stringify({ event: 'notify-high-priority.fail', tenderId, error: String(err) }));
            failed += 1;
        }
    }
    return { sent, failed };
}
```

- [ ] **Step 11.6: Run test to verify pass**

Run: `npm test -- amplify/functions/notify-high-priority/handler.test.ts`
Expected: PASS

- [ ] **Step 11.7: Commit**

```bash
git add amplify/functions/notify-high-priority/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add notify-high-priority Lambda

Sends one SES email per tender with overallScore >= 80. Email body
includes title, agency, deadline (with days-until), USD estimate,
source URL, every product match's score + reasoning, and the full
tender description.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: notify-daily-digest Lambda

**Files:**
- Create: `amplify/functions/notify-daily-digest/handler.ts`
- Create: `amplify/functions/notify-daily-digest/handler.test.ts`
- Create: `amplify/functions/notify-daily-digest/resource.ts`
- Create: `amplify/functions/notify-daily-digest/package.json`

Single email per day. Groups tenders by country. Skips sending when the list is empty.

- [ ] **Step 12.1: package.json**

Create `amplify/functions/notify-daily-digest/package.json`:

```json
{
    "name": "notify-daily-digest",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0",
        "@aws-sdk/client-sesv2": "^3.758.0"
    }
}
```

- [ ] **Step 12.2: Failing test**

Create `amplify/functions/notify-daily-digest/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockBatchGet = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                if (cmd.constructor.name === 'BatchGetCommand') return mockBatchGet(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    BatchGetCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

const sesSend = vi.fn().mockResolvedValue({ MessageId: 'mid' });
vi.mock('@aws-sdk/client-sesv2', () => ({
    SESv2Client: vi.fn().mockImplementation(() => ({ send: sesSend })),
    SendEmailCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');
vi.stubEnv('NOTIFICATION_FROM', 'info@ninescrolls.com');
vi.stubEnv('NOTIFICATION_TO', 'info@ninescrolls.com');

beforeEach(() => { mockBatchGet.mockReset(); sesSend.mockClear(); });

describe('notify-daily-digest handler', () => {
    it('sends a single grouped email when tenders exist', async () => {
        mockBatchGet.mockResolvedValueOnce({
            Responses: {
                NineScrollsIntelligence: [
                    { tenderId: 'sam-1', title: 'PECVD System', agency: 'Stanford', country: 'US', overallScore: 87, sourceUrl: 'https://sam.gov/1', deadline: '2026-08-01' },
                    { tenderId: 'sam-2', title: 'ALD Tool', agency: 'MIT', country: 'US', overallScore: 64, sourceUrl: 'https://sam.gov/2', deadline: '2026-09-01' },
                    { tenderId: 'ted-1', title: 'AFM Microscope', agency: 'TU Munich', country: 'DE', overallScore: 72, sourceUrl: 'https://ted.eu/1', deadline: '2026-07-15' },
                ],
            },
        });

        const { handler } = await import('./handler');
        const result = await handler({ digestTenderIds: ['sam-1', 'sam-2', 'ted-1'] });

        expect(result.sent).toBe(1);
        const html = sesSend.mock.calls[0][0].input.Content.Simple.Body.Html.Data;
        expect(html).toContain('US');
        expect(html).toContain('DE');
        expect(html).toContain('Stanford');
        expect(html).toContain('TU Munich');
    });

    it('does not send when the list is empty', async () => {
        const { handler } = await import('./handler');
        const result = await handler({ digestTenderIds: [] });
        expect(result.sent).toBe(0);
        expect(sesSend).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 12.3: Verify failing**

Run: `npm test -- amplify/functions/notify-daily-digest/handler.test.ts`
Expected: FAIL.

- [ ] **Step 12.4: resource.ts**

Create `amplify/functions/notify-daily-digest/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const notifyDailyDigest = defineFunction({
    name: 'notify-daily-digest',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 60,
    memoryMB: 256,
    environment: {
        NOTIFICATION_FROM: 'info@ninescrolls.com',
        NOTIFICATION_TO: 'info@ninescrolls.com',
    },
});
```

- [ ] **Step 12.5: handler.ts**

Create `amplify/functions/notify-daily-digest/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { tenderItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ses = new SESv2Client({});

const TABLE = () => process.env.INTELLIGENCE_TABLE!;
const FROM = () => process.env.NOTIFICATION_FROM!;
const TO = () => process.env.NOTIFICATION_TO!;

export interface DigestEvent { digestTenderIds: string[]; }
export interface DigestResult { sent: number; }

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function loadTenders(ids: string[]): Promise<any[]> {
    const out: any[] = [];
    for (let i = 0; i < ids.length; i += 100) {
        const batch = ids.slice(i, i + 100);
        const res = await ddb.send(new BatchGetCommand({
            RequestItems: { [TABLE()]: { Keys: batch.map((id) => tenderItemKey(id)) } },
        }));
        for (const it of (res.Responses?.[TABLE()] ?? [])) out.push(it);
    }
    return out;
}

export async function handler(event: DigestEvent): Promise<DigestResult> {
    if (event.digestTenderIds.length === 0) return { sent: 0 };
    const tenders = await loadTenders(event.digestTenderIds);
    if (tenders.length === 0) return { sent: 0 };

    const byCountry = new Map<string, any[]>();
    for (const t of tenders) {
        const c = t.country ?? 'XX';
        if (!byCountry.has(c)) byCountry.set(c, []);
        byCountry.get(c)!.push(t);
    }
    for (const arr of byCountry.values()) arr.sort((a, b) => b.overallScore - a.overallScore);

    const sections = [...byCountry.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([c, items]) => {
        const rows = items.map((t) =>
            `<tr><td>${t.overallScore}</td><td><a href="${escapeHtml(t.sourceUrl)}">${escapeHtml(t.title)}</a></td><td>${escapeHtml(t.agency)}</td><td>${t.deadline ?? 'N/A'}</td></tr>`
        ).join('');
        return `<h3>${c} (${items.length})</h3><table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse"><thead><tr><th>Score</th><th>Title</th><th>Agency</th><th>Deadline</th></tr></thead><tbody>${rows}</tbody></table>`;
    }).join('\n');

    const html = `<h2>Tender Watch — daily digest</h2><p>${tenders.length} new tenders today.</p>\n${sections}`;
    const subject = `[Tender Watch] Daily digest — ${tenders.length} new tenders (${[...byCountry.keys()].sort().join(', ')})`;

    await ses.send(new SendEmailCommand({
        FromEmailAddress: FROM(),
        Destination: { ToAddresses: [TO()] },
        Content: {
            Simple: {
                Subject: { Data: subject, Charset: 'UTF-8' },
                Body: { Html: { Data: html, Charset: 'UTF-8' } },
            },
        },
    }));

    return { sent: 1 };
}
```

- [ ] **Step 12.6: Run test to verify pass**

Run: `npm test -- amplify/functions/notify-daily-digest/handler.test.ts`
Expected: PASS

- [ ] **Step 12.7: Commit**

```bash
git add amplify/functions/notify-daily-digest/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add notify-daily-digest Lambda

Single HTML digest grouped by country, sorted by overallScore within
country. Skips sending when the day has no new tenders so admin inbox
stays quiet on slow days.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: expire-old-tenders Lambda

**Files:**
- Create: `amplify/functions/expire-old-tenders/handler.ts`
- Create: `amplify/functions/expire-old-tenders/handler.test.ts`
- Create: `amplify/functions/expire-old-tenders/resource.ts`
- Create: `amplify/functions/expire-old-tenders/package.json`

Walks TENDER metadata items with `isExpired = false`, sets `isExpired = true` where `deadline < today`. Implemented as a paginated Scan with a FilterExpression — the table is small enough that this is fine (alternative: a fifth GSI for "active tenders by deadline"; deferred until volume warrants).

- [ ] **Step 13.1: package.json**

Create `amplify/functions/expire-old-tenders/package.json`:

```json
{
    "name": "expire-old-tenders",
    "version": "1.0.0",
    "type": "module",
    "dependencies": {
        "@aws-sdk/client-dynamodb": "^3.758.0",
        "@aws-sdk/lib-dynamodb": "^3.758.0"
    }
}
```

- [ ] **Step 13.2: Failing test**

Create `amplify/functions/expire-old-tenders/handler.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockScan = vi.fn();
const mockUpdate = vi.fn();
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient: vi.fn().mockImplementation(() => ({})) }));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
    DynamoDBDocumentClient: {
        from: vi.fn().mockReturnValue({
            send: vi.fn().mockImplementation((cmd: any) => {
                const n = cmd.constructor.name;
                if (n === 'ScanCommand') return mockScan(cmd);
                if (n === 'UpdateCommand') return mockUpdate(cmd);
                return Promise.resolve({});
            }),
        }),
    },
    ScanCommand: class { input: any; constructor(input: any) { this.input = input; } },
    UpdateCommand: class { input: any; constructor(input: any) { this.input = input; } },
}));

vi.stubEnv('INTELLIGENCE_TABLE', 'NineScrollsIntelligence');

beforeEach(() => { mockScan.mockReset(); mockUpdate.mockReset(); });

describe('expire-old-tenders handler', () => {
    it('marks tenders whose deadline is in the past as expired', async () => {
        const past = '2020-01-01';
        const future = '2099-12-31';
        mockScan.mockResolvedValueOnce({
            Items: [
                { tenderId: 'sam-1', deadline: past, isExpired: false },
                { tenderId: 'ted-1', deadline: future, isExpired: false },
                { tenderId: 'sam-2', deadline: null, isExpired: false },
            ],
        });
        mockUpdate.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({});

        expect(result.expired).toBe(1);
        expect(mockUpdate).toHaveBeenCalledTimes(1);
        expect(mockUpdate.mock.calls[0][0].input.Key).toEqual({ PK: 'TENDER#sam-1', SK: 'METADATA' });
    });

    it('handles paginated Scan results', async () => {
        mockScan
            .mockResolvedValueOnce({ Items: [{ tenderId: 'a', deadline: '2020-01-01', isExpired: false }], LastEvaluatedKey: { PK: 'A' } })
            .mockResolvedValueOnce({ Items: [{ tenderId: 'b', deadline: '2020-01-01', isExpired: false }] });
        mockUpdate.mockResolvedValue({});

        const { handler } = await import('./handler');
        const result = await handler({});
        expect(result.expired).toBe(2);
    });
});
```

- [ ] **Step 13.3: Verify failing**

Run: `npm test -- amplify/functions/expire-old-tenders/handler.test.ts`
Expected: FAIL.

- [ ] **Step 13.4: resource.ts**

Create `amplify/functions/expire-old-tenders/resource.ts`:

```typescript
import { defineFunction } from '@aws-amplify/backend';

export const expireOldTenders = defineFunction({
    name: 'expire-old-tenders',
    entry: './handler.ts',
    runtime: 22,
    timeoutSeconds: 120,
    memoryMB: 256,
});
```

- [ ] **Step 13.5: handler.ts**

Create `amplify/functions/expire-old-tenders/handler.ts`:

```typescript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { tenderItemKey } from '../../lib/tender-watch/keys';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = () => process.env.INTELLIGENCE_TABLE!;

export interface ExpireEvent { /* no input */ }
export interface ExpireResult { expired: number; scanned: number; }

export async function handler(_: ExpireEvent): Promise<ExpireResult> {
    const today = new Date().toISOString().slice(0, 10);
    let expired = 0;
    let scanned = 0;
    let cursor: Record<string, unknown> | undefined;

    do {
        const res = await ddb.send(new ScanCommand({
            TableName: TABLE(),
            FilterExpression: 'entityType = :et AND isExpired = :no AND attribute_exists(deadline) AND deadline < :today',
            ExpressionAttributeValues: { ':et': 'TENDER', ':no': false, ':today': today },
            ExclusiveStartKey: cursor,
        }));
        for (const item of (res.Items ?? [])) {
            scanned += 1;
            await ddb.send(new UpdateCommand({
                TableName: TABLE(),
                Key: tenderItemKey(item.tenderId),
                UpdateExpression: 'SET isExpired = :yes, updatedAt = :now',
                ExpressionAttributeValues: { ':yes': true, ':now': new Date().toISOString() },
            }));
            expired += 1;
        }
        cursor = res.LastEvaluatedKey;
    } while (cursor);

    console.log(JSON.stringify({ event: 'expire.done', expired, scanned }));
    return { expired, scanned };
}
```

- [ ] **Step 13.6: Run test to verify pass**

Run: `npm test -- amplify/functions/expire-old-tenders/handler.test.ts`
Expected: PASS

- [ ] **Step 13.7: Commit**

```bash
git add amplify/functions/expire-old-tenders/
git commit -m "$(cat <<'EOF'
feat(tender-watch): add expire-old-tenders Lambda

Daily sweep that flips isExpired=true on TENDER items whose deadline has
passed, so the Phase 2 admin default view can hide them without
recomputing per-row. Paginated Scan with filter; revisit if volume grows
past ~50k items.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: Step Functions state machine + S3 staging bucket

**Files:**
- Modify: `amplify/backend.ts`

Wire all 9 Lambdas, the S3 staging bucket, IAM permissions, the Step Functions state machine, and `INTELLIGENCE_TABLE` env vars.

This task touches the bottom of `amplify/backend.ts` (where new resources go). It's larger than other tasks because Step Functions is being introduced for the first time.

- [ ] **Step 14.1: Add new imports at top of backend.ts**

Open `amplify/backend.ts`. After the existing `defineBackend` import block (around line 41), add imports for the 9 new function resources and the Step Functions CDK constructs:

Edit `amplify/backend.ts` near the top (after the existing `import { submitQuestion } from ...` line):

```typescript
// Tender Watch — Phase 1
import { fetchSam } from './functions/fetch-sam/resource';
import { fetchTed } from './functions/fetch-ted/resource';
import { normalizeDedupe } from './functions/normalize-dedupe/resource';
import { prefilterByKeyword } from './functions/prefilter-by-keyword/resource';
import { matchWithLlm } from './functions/match-with-llm/resource';
import { classifyAndStore } from './functions/classify-and-store/resource';
import { notifyHighPriority } from './functions/notify-high-priority/resource';
import { notifyDailyDigest } from './functions/notify-daily-digest/resource';
import { expireOldTenders } from './functions/expire-old-tenders/resource';

import {
    StateMachine, StateMachineType, Pass, Parallel, Map as SfnMap,
    Choice, Condition, Succeed, JsonPath, LogLevel, TaskInput,
} from 'aws-cdk-lib/aws-stepfunctions';
import { LambdaInvoke } from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { SfnStateMachine } from 'aws-cdk-lib/aws-events-targets';
```

- [ ] **Step 14.2: Register new functions in defineBackend**

Locate the `defineBackend({...})` call (around line 43). Add the 9 new functions inside the object literal:

```typescript
const backend = defineBackend({
    auth,
    data,
    // ...existing functions...
    submitLead,
    submitQuestion,

    // Tender Watch
    fetchSam,
    fetchTed,
    normalizeDedupe,
    prefilterByKeyword,
    matchWithLlm,
    classifyAndStore,
    notifyHighPriority,
    notifyDailyDigest,
    expireOldTenders,
});
```

- [ ] **Step 14.3: Add Step Functions stack and S3 staging bucket at bottom of backend.ts**

Append at the end of `amplify/backend.ts` (after the last existing block, before the file ends):

```typescript
// =============================================================================
// Tender Watch — Phase 1 infrastructure
// See docs/superpowers/specs/2026-05-14-tender-watch-design.md
// =============================================================================

const tenderWatchStack = backend.createStack('tender-watch-stack');

// --- S3 staging bucket: holds inter-state Step Functions payloads (fetch output, etc.).
//     7-day lifecycle policy keeps debug history without unbounded growth.
const tenderRawBucket = new Bucket(tenderWatchStack, 'TenderWatchRawBucket', {
    blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
    encryption: BucketEncryption.S3_MANAGED,
    lifecycleRules: [{ id: 'expire-7d', expiration: Duration.days(7) }],
    enforceSSL: true,
});

// --- Grant each Lambda what it needs.
const tenderLambdas = [
    backend.fetchSam, backend.fetchTed, backend.normalizeDedupe,
    backend.prefilterByKeyword, backend.matchWithLlm, backend.classifyAndStore,
    backend.notifyHighPriority, backend.notifyDailyDigest, backend.expireOldTenders,
];

for (const fn of tenderLambdas) {
    intelligenceTable.grantReadWriteData(fn.resources.lambda);
    fn.addEnvironment('INTELLIGENCE_TABLE', intelligenceTable.tableName);
    fn.addEnvironment('STAGING_BUCKET', tenderRawBucket.bucketName);
}

// fetch-sam + fetch-ted + normalize-dedupe write/read the staging bucket
[backend.fetchSam, backend.fetchTed].forEach((fn) => tenderRawBucket.grantWrite(fn.resources.lambda));
[backend.normalizeDedupe].forEach((fn) => tenderRawBucket.grantRead(fn.resources.lambda));

// fetch-sam needs SSM parameter read
backend.fetchSam.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['ssm:GetParameter'],
    resources: ['arn:aws:ssm:*:*:parameter/tender-watch/sam/api-key'],
}));

// match-with-llm: Bedrock invoke (same model arn pattern as classify-org)
backend.matchWithLlm.resources.lambda.addToRolePolicy(new PolicyStatement({
    effect: Effect.ALLOW,
    actions: ['bedrock:InvokeModel'],
    resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-*',
        'arn:aws:bedrock:*:*:inference-profile/us.anthropic.claude-*',
    ],
}));

// notify-* SES send
[backend.notifyHighPriority, backend.notifyDailyDigest].forEach((fn) => {
    fn.resources.lambda.addToRolePolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ['ses:SendEmail', 'ses:SendRawEmail'],
        resources: ['*'],
    }));
});

// --- Step Functions state machine.
const passInjectExecutionId = new Pass(tenderWatchStack, 'InjectExecutionId', {
    parameters: { 'executionId.$': '$$.Execution.Name' },
    resultPath: '$.exec',
});

const fetchSamTask = new LambdaInvoke(tenderWatchStack, 'FetchSam', {
    lambdaFunction: backend.fetchSam.resources.lambda,
    payload: TaskInput.fromObject({ executionId: JsonPath.stringAt('$.exec.executionId') }),
    outputPath: '$.Payload',
});
const fetchTedTask = new LambdaInvoke(tenderWatchStack, 'FetchTed', {
    lambdaFunction: backend.fetchTed.resources.lambda,
    payload: TaskInput.fromObject({ executionId: JsonPath.stringAt('$.exec.executionId') }),
    outputPath: '$.Payload',
});

const fetchParallel = new Parallel(tenderWatchStack, 'FetchAllSources', {
    resultPath: '$.fetchResults',
});
fetchParallel.branch(fetchSamTask);
fetchParallel.branch(fetchTedTask);

const normalizeTask = new LambdaInvoke(tenderWatchStack, 'NormalizeDedupe', {
    lambdaFunction: backend.normalizeDedupe.resources.lambda,
    payload: TaskInput.fromObject({
        executionId: JsonPath.stringAt('$.exec.executionId'),
        fetchOutputs: JsonPath.objectAt('$.fetchResults'),
    }),
    outputPath: '$.Payload',
    resultPath: '$.normalized',
});

const prefilterTask = new LambdaInvoke(tenderWatchStack, 'Prefilter', {
    lambdaFunction: backend.prefilterByKeyword.resources.lambda,
    payload: TaskInput.fromObject({ newTenderIds: JsonPath.objectAt('$.normalized.newTenderIds') }),
    outputPath: '$.Payload',
    resultPath: '$.prefilter',
});

const matchMap = new SfnMap(tenderWatchStack, 'LLMScoring', {
    maxConcurrency: 10,
    itemsPath: '$.prefilter.candidates',
    resultPath: '$.matches',
});
matchMap.iterator(
    new LambdaInvoke(tenderWatchStack, 'MatchOne', {
        lambdaFunction: backend.matchWithLlm.resources.lambda,
        payload: TaskInput.fromObject({ tenderId: JsonPath.stringAt('$.tenderId') }),
        outputPath: '$.Payload',
    }),
);

const classifyTask = new LambdaInvoke(tenderWatchStack, 'ClassifyAndStore', {
    lambdaFunction: backend.classifyAndStore.resources.lambda,
    payload: TaskInput.fromObject({ matchResults: JsonPath.objectAt('$.matches') }),
    outputPath: '$.Payload',
    resultPath: '$.classification',
});

const notifyHigh = new LambdaInvoke(tenderWatchStack, 'NotifyHighPriority', {
    lambdaFunction: backend.notifyHighPriority.resources.lambda,
    payload: TaskInput.fromObject({ highPriorityTenderIds: JsonPath.objectAt('$.classification.highPriorityTenderIds') }),
    outputPath: '$.Payload',
});
const notifyDigest = new LambdaInvoke(tenderWatchStack, 'NotifyDailyDigest', {
    lambdaFunction: backend.notifyDailyDigest.resources.lambda,
    payload: TaskInput.fromObject({ digestTenderIds: JsonPath.objectAt('$.classification.digestTenderIds') }),
    outputPath: '$.Payload',
});
const notifyParallel = new Parallel(tenderWatchStack, 'Notifications', { resultPath: '$.notifyResults' });
notifyParallel.branch(notifyHigh);
notifyParallel.branch(notifyDigest);

const expireTask = new LambdaInvoke(tenderWatchStack, 'ExpireOldTenders', {
    lambdaFunction: backend.expireOldTenders.resources.lambda,
    payload: TaskInput.fromObject({}),
    outputPath: '$.Payload',
});

const choice = new Choice(tenderWatchStack, 'HasCandidates')
    .when(
        Condition.numberGreaterThan(JsonPath.numberAt('$.prefilter.candidatesCount'), 0),
        matchMap.next(classifyTask).next(notifyParallel).next(expireTask),
    )
    .otherwise(new Succeed(tenderWatchStack, 'NoCandidates'));

const definition = passInjectExecutionId
    .next(fetchParallel)
    .next(normalizeTask)
    .next(prefilterTask)
    .next(choice);

const stateMachineLogGroup = new LogGroup(tenderWatchStack, 'TenderWatchLogs', {
    retention: RetentionDays.ONE_MONTH,
});

const tenderWatchStateMachine = new StateMachine(tenderWatchStack, 'TenderWatchDaily', {
    stateMachineName: 'tender-watch-daily',
    stateMachineType: StateMachineType.STANDARD,
    definition,
    logs: { destination: stateMachineLogGroup, level: LogLevel.ALL, includeExecutionData: true },
    tracingEnabled: true,
});

// --- EventBridge daily cron — 02:00 UTC
new Rule(tenderWatchStack, 'TenderWatchDailyRule', {
    schedule: Schedule.cron({ minute: '0', hour: '2', day: '*', month: '*', year: '*' }),
    targets: [new SfnStateMachine(tenderWatchStateMachine)],
});
```

> Note on `JsonPath.objectAt` vs `JsonPath.stringAt`: use `stringAt` for scalar string fields (e.g. executionId, tenderId), `objectAt` for arrays/objects. Mismatched types cause a synthesis-time error.

- [ ] **Step 14.4: Verify the CDK synthesizes**

Run: `npx ampx sandbox --once --identifier tender-watch-dry-run`
Expected: synthesis completes without TypeScript errors. (Sandbox attempts deploy — interrupt with Ctrl+C once synth is confirmed; we'll do the real deploy in Task 17.)

Common synth-time fixes:
- If the linter complains about `LifecycleRule` typing, drop the cast: `lifecycleRules: [{ id: 'expire-7d', expiration: Duration.days(7) }]`.
- If `BlockPublicAccess` / `BucketEncryption` aren't imported, they already are at the top of `backend.ts` for `orderDocumentsBucket`.

- [ ] **Step 14.5: Commit**

```bash
git add amplify/backend.ts
git commit -m "$(cat <<'EOF'
chore(tender-watch): wire Step Functions state machine and infra

Adds a tender-watch-stack with an S3 staging bucket (7-day lifecycle),
9 Lambda registrations, IAM grants for intelligenceTable / Bedrock /
SES / SSM, the Step Functions Standard state machine
(tender-watch-daily) with Parallel-Map-Choice-Parallel topology, and a
daily EventBridge cron at 02:00 UTC.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: SSM parameter for SAM.gov API key

**Files:**
- No file changes — this is an AWS console operation documented for the implementer.

- [ ] **Step 15.1: Confirm SSM parameter path**

The `fetch-sam` Lambda reads `/tender-watch/sam/api-key` via SSM `GetParameter`. The IAM policy added in Task 14 already covers this path.

- [ ] **Step 15.2: Create the parameter manually**

Obtain a SAM.gov API key (https://sam.gov/content/api → "Get API Key", free, requires sam.gov account).

Run:

```bash
aws ssm put-parameter \
    --name /tender-watch/sam/api-key \
    --value "<the-api-key-value>" \
    --type SecureString \
    --description "SAM.gov API key for tender-watch fetch-sam Lambda" \
    --overwrite
```

- [ ] **Step 15.3: No commit (no code change). Verify**

Run: `aws ssm get-parameter --name /tender-watch/sam/api-key --with-decryption --query 'Parameter.Name'`
Expected: returns `"/tender-watch/sam/api-key"`.

---

## Task 16: Seed initial TenderKeywordConfig items

**Files:**
- Create: `scripts/seed-tender-keyword-config.ts`

Pre-populate `intelligenceTable` with one TENDER_KEYWORD_CONFIG row per product category so the pipeline has something to match against on its first run. Matches the project convention of one-off admin scripts under `scripts/` (e.g. `scripts/seed-insights.ts`).

- [ ] **Step 16.1: Create script**

Create `scripts/seed-tender-keyword-config.ts`:

```typescript
import 'dotenv/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// `intelligenceTable` is created with a CDK-generated physical name. After the
// first deploy, find it via the AWS console (DynamoDB → Tables) or:
//     aws dynamodb list-tables --query 'TableNames[?contains(@, `Intelligence`)]'
// then run:
//     INTELLIGENCE_TABLE=<that-name> npx tsx scripts/seed-tender-keyword-config.ts
const TABLE = process.env.INTELLIGENCE_TABLE;
if (!TABLE) {
    throw new Error('INTELLIGENCE_TABLE env var is required. Find the name with `aws dynamodb list-tables`.');
}

interface SeedConfig {
    productCategory: string;
    productSlugs: string[];
    keywords: string[];
    synonyms: string[];
    blacklist: string[];
    naicsCodes: string[];
    cpvCodes: string[];
}

const SEEDS: SeedConfig[] = [
    {
        productCategory: 'PECVD',
        productSlugs: ['pluto-f', 'pluto-m', 'pluto-t'],
        keywords: ['PECVD', 'plasma-enhanced chemical vapor deposition', 'plasma enhanced CVD'],
        synonyms: ['plasma deposition', 'silicon nitride deposition', 'silicon oxide deposition'],
        blacklist: ['advertisement', 'recruiting'],
        naicsCodes: ['334516', '333242', '541380'],
        cpvCodes: ['38540000', '38500000', '31700000'],
    },
    {
        productCategory: 'ALD',
        productSlugs: ['ald-system'],
        keywords: ['atomic layer deposition', 'ALD'],
        synonyms: ['atomic layer epitaxy', 'thin film deposition'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000', '38500000'],
    },
    {
        productCategory: 'RIE-ICP',
        productSlugs: ['rie-etcher', 'icp-etcher', 'compact-rie'],
        keywords: ['reactive ion etching', 'RIE', 'inductively coupled plasma', 'ICP etcher', 'ICP etching'],
        synonyms: ['plasma etcher', 'dry etcher', 'silicon etching'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'E-Beam',
        productSlugs: ['ebeam-evaporator'],
        keywords: ['electron beam evaporator', 'e-beam evaporator', 'electron-beam evaporation'],
        synonyms: ['thin film deposition', 'metal evaporation', 'thermal evaporator'],
        blacklist: ['security camera', 'cosmetic'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000', '38500000'],
    },
    {
        productCategory: 'Sputter',
        productSlugs: ['sputter-system'],
        keywords: ['sputter deposition', 'sputtering system', 'magnetron sputter'],
        synonyms: ['PVD', 'physical vapor deposition'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000', '38500000'],
    },
    {
        productCategory: 'IBE-RIBE',
        productSlugs: ['ibe-ribe-system'],
        keywords: ['ion beam etching', 'IBE', 'RIBE', 'reactive ion beam etching'],
        synonyms: ['ion milling'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'HDPCVD',
        productSlugs: ['hdpcvd-system'],
        keywords: ['HDPCVD', 'high density plasma CVD', 'high-density plasma chemical vapor deposition'],
        synonyms: [],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'Coater-Developer',
        productSlugs: ['coater-developer'],
        keywords: ['photoresist coater', 'spin coater developer', 'track tool'],
        synonyms: ['lithography track'],
        blacklist: ['advertisement'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'Stripper',
        productSlugs: ['stripper-system'],
        keywords: ['photoresist stripper', 'plasma stripper', 'asher'],
        synonyms: ['photoresist removal'],
        blacklist: ['advertisement', 'paint stripper', 'wire stripper'],
        naicsCodes: ['334516', '333242'],
        cpvCodes: ['38540000'],
    },
    {
        productCategory: 'AFM',
        productSlugs: ['hy20l', 'hy20l-rf', 'hy4l'],
        keywords: ['atomic force microscope', 'atomic force microscopy', 'scanning probe microscope'],
        synonyms: ['nano-indenter', 'nanoindenter', 'SPM'],
        blacklist: ['automated facial recognition', 'anti-money laundering'],
        naicsCodes: ['334516', '334519'],
        cpvCodes: ['38540000', '38500000'],
    },
];

const now = new Date().toISOString();

const items = SEEDS.map((s) => ({
    PutRequest: {
        Item: {
            PK: 'TENDER_KEYWORD_CONFIG',
            SK: `CATEGORY#${s.productCategory}`,
            GSI1PK: 'TENDER_KEYWORD_CONFIG_ACTIVE',
            GSI1SK: `CATEGORY#${s.productCategory}`,
            entityType: 'TENDER_KEYWORD_CONFIG',
            ...s,
            isActive: true,
            updatedBy: 'seed-script',
            updatedAt: now,
        },
    },
}));

async function main() {
    // BatchWrite max 25 per call.
    for (let i = 0; i < items.length; i += 25) {
        const batch = items.slice(i, i + 25);
        await ddb.send(new BatchWriteCommand({
            RequestItems: { [TABLE!]: batch },
        }));
        console.log(`Wrote batch ${i / 25 + 1} (${batch.length} configs)`);
    }
    console.log(`Done. Seeded ${items.length} TenderKeywordConfig items.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
```

- [ ] **Step 16.2: Run the seed script**

(Real execution happens during Task 17 after deploy. For now just verify it type-checks.)

Run: `npx tsc --noEmit scripts/seed-tender-keyword-config.ts --skipLibCheck --module nodenext --target es2022 --moduleResolution nodenext`
Expected: PASS

- [ ] **Step 16.3: Commit**

```bash
git add scripts/seed-tender-keyword-config.ts
git commit -m "$(cat <<'EOF'
feat(tender-watch): add keyword-config seed script

Seeds 10 product-category configs (PECVD, ALD, RIE/ICP, e-beam, sputter,
IBE/RIBE, HDPCVD, coater-developer, stripper, AFM) with starter keyword
lists, NAICS/CPV whitelists, and ambiguity blacklists (e.g. AFM excludes
'automated facial recognition'). Phase 4 tuning will refine these as
real data arrives.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Deploy, seed, and end-to-end verification

This is the only task that touches AWS for real. Pre-requisites: AWS credentials configured, `ANTHROPIC_API_KEY` secret already exists from the `classify-org` Lambda.

- [ ] **Step 17.1: Deploy to sandbox**

Run: `npx ampx sandbox`

Wait for the sandbox to finish deploying. Watch the output for the synthesized `tender-watch-daily` state machine ARN and the staging bucket name. Expected: deploy succeeds.

If deploy fails:
- TypeScript errors in `backend.ts` → fix and retry.
- IAM "denied bedrock:InvokeModel" during stack creation → not possible at deploy time; only at runtime.
- Step Functions CDK errors → most common is JSONata vs JSONPath mode; the plan uses JSONPath (default). If the synth complains, check that `States.ArrayLength` is allowed in the choice.

- [ ] **Step 17.2: Set the SAM.gov API key in SSM (if not already done in Task 15)**

Run:

```bash
aws ssm put-parameter --name /tender-watch/sam/api-key --value "$SAM_API_KEY" --type SecureString --overwrite
```

- [ ] **Step 17.3: Look up the deployed intelligence table name**

Run: `aws cloudformation describe-stacks --stack-name <sandbox-stack-name> --query 'Stacks[0].Outputs[?ExportName==\`NineScrollsIntelligenceTableName\`]' || aws dynamodb list-tables --query 'TableNames[?contains(@, \`Intelligence\`)]'`

Note the table name (e.g. `NineScrollsIntelligence-xyz123`).

- [ ] **Step 17.4: Run the seed script**

Run:

```bash
INTELLIGENCE_TABLE=<table-name-from-step-17.3> npx tsx scripts/seed-tender-keyword-config.ts
```

Expected: `Done. Seeded 10 TenderKeywordConfig items.`

Verify: `aws dynamodb get-item --table-name <table-name> --key '{"PK":{"S":"TENDER_KEYWORD_CONFIG"},"SK":{"S":"CATEGORY#PECVD"}}' --query 'Item.keywords'`
Expected: returns the PECVD keyword list.

- [ ] **Step 17.5: Trigger a manual Step Functions execution**

Run:

```bash
aws stepfunctions start-execution \
    --state-machine-arn <state-machine-arn-from-step-17.1> \
    --name "manual-$(date +%s)" \
    --input '{}'
```

- [ ] **Step 17.6: Watch the execution**

Open the AWS console → Step Functions → `tender-watch-daily` → the latest execution. Confirm:
- `FetchAllSources` Parallel state succeeds (or any individual branch fails with Catch handled — still green overall)
- `NormalizeDedupe` reports a positive `newTenderIds.length` (or 0 if it's a slow day)
- `Prefilter` shows candidates
- `LLMScoring` Map state has child invocations (one per candidate)
- `ClassifyAndStore` runs
- `Notifications` Parallel both branches succeed
- `ExpireOldTenders` runs

- [ ] **Step 17.7: Verify email**

Check the `info@ninescrolls.com` inbox. Expected one or both of:
- A daily digest email titled `[Tender Watch] Daily digest — N new tenders (...)`
- One or more `🔥 [Tender Watch] ...` high-priority emails for any tender with `overallScore >= 80`

If no email arrives:
- Check CloudWatch logs for `notify-daily-digest` Lambda — confirm it received tenderIds
- Verify SES has `info@ninescrolls.com` as a verified sender identity in the deployment region

- [ ] **Step 17.8: Verify DynamoDB items**

Run: `aws dynamodb scan --table-name <table-name> --filter-expression 'entityType = :et' --expression-attribute-values '{":et":{"S":"TENDER"}}' --query 'Count'`
Expected: a positive count (typically 10–100 on a typical day).

Spot-check one: `aws dynamodb get-item --table-name <table-name> --key '{"PK":{"S":"TENDER#<some-id>"},"SK":{"S":"METADATA"}}'`
Expected: full TENDER item with `status="new"`, `overallScore` set, `isHighPriority` set, GSI1/2/3 keys present.

- [ ] **Step 17.9: Final commit (deployment log)**

No code changes for this step. Just a record of the verification:

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(tender-watch): record Phase 1 end-to-end verification

- Sandbox deploy succeeded
- 10 TenderKeywordConfig seeded
- Step Functions execution: <execution-arn>
- DynamoDB: <N> TENDER items, <M> MATCH items
- Email: digest received, <K> high-priority alerts received

Phase 1 complete. Next: write Phase 2 admin UI plan after one week of
real data to inform UI priorities.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (run after writing this plan)

- [ ] All 9 Lambdas + 4 shared library files + backend.ts changes + seed script + SSM step covered
- [ ] Each Lambda task includes TDD: failing test → fail-verification → implementation → pass-verification → commit
- [ ] Type names used across tasks are consistent: `NormalizedTender`, `FetchOutput`, `MatchResultInput`, `PrefilterCandidate`, `TenderItem`, `TenderMatchItem`, `TenderKeywordConfigItem`
- [ ] All key-builder functions referenced in handlers (`tenderItemKey`, `tenderMatchItemKey`, `tenderStatusGsiKey`, `tenderHashGsiKey`, `tenderHighPriorityGsiKey`) are defined in Task 1
- [ ] Step Functions state names match what the verification step expects
- [ ] Spec coverage:
    - [x] fetch-sam / fetch-ted Lambdas — Tasks 5, 6
    - [x] normalize-dedupe with hash GSI lookup — Task 7
    - [x] prefilter-by-keyword with reusable pure function — Task 8
    - [x] match-with-llm with Bedrock + Anthropic fallback — Task 9
    - [x] classify-and-store with overallScore + GSI1SK + GSI3 maintenance — Task 10
    - [x] notify-high-priority (per-tender email) — Task 11
    - [x] notify-daily-digest (single grouped email) — Task 12
    - [x] expire-old-tenders — Task 13
    - [x] S3 staging bucket with lifecycle — Task 14
    - [x] Step Functions Standard state machine — Task 14
    - [x] EventBridge daily cron — Task 14
    - [x] IAM grants (DDB, Bedrock, SES, SSM, S3) — Task 14
    - [x] SAM.gov API key SSM parameter — Task 15
    - [x] Seed TenderKeywordConfig — Task 16
    - [x] End-to-end manual verification — Task 17
- [ ] No `fetch-uk` (Phase 3 — out of scope here)
- [ ] No admin UI / AppSync changes (Phase 2)
