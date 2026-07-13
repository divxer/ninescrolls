# Evidence Framework — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a structured Evidence proof-layer for Phase 1 — a new `Evidence` data model, a published-only Lambda read boundary, admin CRUD, and a conditional product-page "Evidence" summary module that stays invisible until real content exists.

**Architecture:** `Evidence` is an independent Amplify Gen 2 model (authenticated-only — no public read). Anonymous reads flow exclusively through a Lambda-backed custom query `listPublishedEvidence` that filters `status='published'` server-side and paginates to completeness. The product-page module reads through that query and renders grouped-by-type counts (display-only) or nothing at zero. Admin authors Evidence through a form/list mirroring the existing Insights admin, reusing the existing image-upload pipeline.

**Tech Stack:** Amplify Gen 2 (`a.model` / `a.query` / `a.handler.function`), AWS SDK v3 (`@aws-sdk/lib-dynamodb` DocumentClient + `ScanCommand`; `@aws-sdk/client-iam`/`client-lambda` for the IAM acceptance check), React + TypeScript, Vitest, Tailwind, React Router.

**Spec:** `docs/superpowers/specs/2026-07-04-evidence-framework-design.md` (read it first — all normative constraints live there).

**Review deltas addressed in this revision:** base-ARN-only IAM (index ARNs deliberately not granted); executable Task-14 security acceptance; canonical product options derived from a config registry; real `articleSlug` select + image uploader; shared `EVIDENCE_STATUS` module (no bare `'published'`); slug check via the `slug` GSI query + paginated admin list; exact published-only Lambda assertions; real placement red-test; explicit `git add`.

---

## File Structure

**Shared (imported by both `amplify/` and `src/`):**
- `amplify/lib/evidence/status.ts` — *create*: dependency-free `EVIDENCE_STATUS` + `EVIDENCE_TYPE` string constants.

**Frontend constants + pure helpers:**
- `src/config/evidence.ts` — *create*: re-exports the shared constants; adds ordered type list, labels, help text, `hasPayload()`, `countEvidenceByType()`.
- `src/config/evidence.test.ts` — *create*.

**Product config registry (canonical product slugs):**
- `src/components/products/productDetailConfigs/index.ts` — *create*: `productConfigs` array (all configs) + derived `productOptions`.
- `src/components/products/productDetailConfigs/index.test.ts` — *create*.

**Backend (Amplify):**
- `amplify/data/resource.ts` — *modify*: `Evidence` model (authenticated-only) + `listPublishedEvidence` query.
- `amplify/functions/evidence-api/{resource.ts,handler.ts,handler.test.ts,package.json}` — *create*.
- `amplify/backend.ts` — *modify*: register `evidenceApi`; grant `Scan` on the base table ARN only; inject `EVIDENCE_TABLE`.

**Frontend services:**
- `src/services/evidenceService.ts` (+ `.test.ts`) — *create*: public read wrapper.
- `src/services/evidenceAdminService.ts` (+ `.test.ts`) — *create*: CRUD + slug-GSI guard + paginated list + payload validation.

**Product-page module:**
- `src/components/products/ProductEvidence.tsx` (+ `.test.tsx`) — *create*.
- `src/components/products/ProductDetailPage.tsx` — *modify*: insert module after applications; add a `data-testid` anchor.

**Admin:**
- `src/components/admin/EvidenceForm.tsx` (+ `.test.tsx`) — *create*.
- `src/pages/admin/AdminEvidenceListPage.tsx` (+ `.test.tsx`) — *create*.
- `src/pages/admin/AdminEvidenceFormPage.tsx` (+ `.test.tsx`) — *create*.
- `src/routes/AdminRoutes.tsx` — *modify*.
- `src/components/admin/AdminLayout.tsx` — *modify*.

**Acceptance (Task 14):**
- `scripts/verify-evidence-boundary.ts` — *create*: executable public no-leak check.
- `scripts/verify-evidence-iam.ts` — *create*: executable least-privilege IAM check.

---

## Task 1: Shared status/type constants module

Dependency-free constants both the Lambda and the frontend import — the single source of truth that keeps `'published'` out of implementation code.

**Files:**
- Create: `amplify/lib/evidence/status.ts`

- [ ] **Step 1: Create the shared module**

```ts
// amplify/lib/evidence/status.ts
// Dependency-free single source of truth for Evidence status/type strings.
// Imported by the evidence-api Lambda (../../lib/evidence/status), by the data
// schema (../lib/evidence/status), and re-exported by src/config/evidence.ts.
// MUST stay import-free so both the esbuild (Lambda) and Vite (frontend)
// bundlers can include it without pulling in extra dependencies.

export const EVIDENCE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUS)[keyof typeof EVIDENCE_STATUS];

export const EVIDENCE_TYPE = {
  APPLICATION_NOTE: 'application_note',
  PROCESS_NOTE: 'process_note',
  TECHNICAL_NOTE: 'technical_note',
  PUBLICATION: 'publication',
  CASE_STUDY: 'case_study',
  VALIDATION: 'validation',
} as const;
export type EvidenceType = (typeof EVIDENCE_TYPE)[keyof typeof EVIDENCE_TYPE];
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors (pure constants).

- [ ] **Step 3: Commit**

```bash
git add amplify/lib/evidence/status.ts
git commit -m "feat(evidence): shared dependency-free EVIDENCE_STATUS/EVIDENCE_TYPE module"
```

---

## Task 2: Frontend constants + pure helpers

Re-exports the shared constants and adds display/order/validation helpers. TDD-first.

**Files:**
- Create: `src/config/evidence.ts`
- Test: `src/config/evidence.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/config/evidence.test.ts
import { describe, it, expect } from 'vitest';
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_TYPE_ORDER,
  evidenceTypeLabel,
  hasPayload,
  countEvidenceByType,
} from './evidence';
// Import the shared source directly to prove the re-export is identical.
import { EVIDENCE_STATUS as SHARED_STATUS } from '../../amplify/lib/evidence/status';

describe('evidence constants', () => {
  it('re-exports the shared status object unchanged', () => {
    expect(EVIDENCE_STATUS).toBe(SHARED_STATUS);
    expect(EVIDENCE_STATUS).toEqual({ DRAFT: 'draft', PUBLISHED: 'published', ARCHIVED: 'archived' });
  });

  it('maps types to fixed public labels (validation is "Process Validation")', () => {
    expect(evidenceTypeLabel(EVIDENCE_TYPE.VALIDATION)).toBe('Process Validation');
    expect(evidenceTypeLabel(EVIDENCE_TYPE.PUBLICATION)).toBe('Published Research');
    expect(evidenceTypeLabel(EVIDENCE_TYPE.APPLICATION_NOTE)).toBe('Application Note');
  });
});

describe('hasPayload', () => {
  it('is false when every string target is blank/whitespace and images is empty/nullish', () => {
    expect(hasPayload({ articleSlug: '', pdfUrl: '  ', sourceUrl: undefined, images: [] })).toBe(false);
    expect(hasPayload({ images: null })).toBe(false);
    expect(hasPayload({})).toBe(false);
  });
  it('is true when any string target is non-blank', () => {
    expect(hasPayload({ sourceUrl: 'https://doi.org/x' })).toBe(true);
    expect(hasPayload({ articleSlug: 'temporary-bonding' })).toBe(true);
  });
  it('requires images.length > 0 — an empty array does not count', () => {
    expect(hasPayload({ images: [] })).toBe(false);
    expect(hasPayload({ images: ['sem-1.webp'] })).toBe(true);
  });
});

describe('countEvidenceByType', () => {
  it('returns per-type counts in canonical order, omitting zero-count types', () => {
    const records = [
      { type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { type: EVIDENCE_TYPE.PUBLICATION },
      { type: EVIDENCE_TYPE.VALIDATION },
      { type: EVIDENCE_TYPE.VALIDATION },
      { type: EVIDENCE_TYPE.APPLICATION_NOTE },
    ];
    expect(countEvidenceByType(records)).toEqual([
      { type: EVIDENCE_TYPE.APPLICATION_NOTE, label: 'Application Note', count: 3 },
      { type: EVIDENCE_TYPE.PUBLICATION, label: 'Published Research', count: 1 },
      { type: EVIDENCE_TYPE.VALIDATION, label: 'Process Validation', count: 2 },
    ]);
  });
  it('follows EVIDENCE_TYPE_ORDER regardless of insertion order', () => {
    const out = countEvidenceByType([
      { type: EVIDENCE_TYPE.VALIDATION },
      { type: EVIDENCE_TYPE.APPLICATION_NOTE },
    ]);
    expect(out.map((g) => g.type)).toEqual([EVIDENCE_TYPE.APPLICATION_NOTE, EVIDENCE_TYPE.VALIDATION]);
    expect(EVIDENCE_TYPE_ORDER[0]).toBe(EVIDENCE_TYPE.APPLICATION_NOTE);
  });
  it('returns [] for no records and ignores unknown types', () => {
    expect(countEvidenceByType([])).toEqual([]);
    expect(countEvidenceByType([{ type: 'bogus' }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/evidence.test.ts`
Expected: FAIL — `Cannot find module './evidence'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/config/evidence.ts
// Re-exports the shared status/type constants (single source of truth in
// amplify/lib/evidence/status.ts) and adds frontend-only display + validation
// helpers. Mirrors the existing src -> amplify type import in amplifyClient.ts;
// the imported file is pure constants, so Vite bundles only those values.
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  type EvidenceStatus,
  type EvidenceType,
} from '../../amplify/lib/evidence/status';

export { EVIDENCE_STATUS, EVIDENCE_TYPE };
export type { EvidenceStatus, EvidenceType };

/** Canonical display order for grouped counts. */
export const EVIDENCE_TYPE_ORDER: EvidenceType[] = [
  EVIDENCE_TYPE.APPLICATION_NOTE,
  EVIDENCE_TYPE.PROCESS_NOTE,
  EVIDENCE_TYPE.TECHNICAL_NOTE,
  EVIDENCE_TYPE.PUBLICATION,
  EVIDENCE_TYPE.CASE_STUDY,
  EVIDENCE_TYPE.VALIDATION,
];

/** Fixed public labels — never hard-code these ad hoc. */
const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  [EVIDENCE_TYPE.APPLICATION_NOTE]: 'Application Note',
  [EVIDENCE_TYPE.PROCESS_NOTE]: 'Process Note',
  [EVIDENCE_TYPE.TECHNICAL_NOTE]: 'Technical Note',
  [EVIDENCE_TYPE.PUBLICATION]: 'Published Research',
  [EVIDENCE_TYPE.CASE_STUDY]: 'Case Study',
  [EVIDENCE_TYPE.VALIDATION]: 'Process Validation',
};
export function evidenceTypeLabel(type: string): string {
  return EVIDENCE_TYPE_LABELS[type as EvidenceType] ?? type;
}

/** Admin help text keeping the two "note" types distinct. */
export const EVIDENCE_TYPE_HELP: Partial<Record<EvidenceType, string>> = {
  [EVIDENCE_TYPE.PROCESS_NOTE]: 'Process recipe / process-specific explanation',
  [EVIDENCE_TYPE.TECHNICAL_NOTE]: 'Equipment / design / operation explanation',
};

type PayloadInput = {
  articleSlug?: string | null;
  pdfUrl?: string | null;
  sourceUrl?: string | null;
  images?: string[] | null;
};

/** Constraint 4: ≥1 non-empty payload/target. images must be non-empty. */
export function hasPayload(input: PayloadInput): boolean {
  const nonBlank = (s?: string | null) => typeof s === 'string' && s.trim().length > 0;
  const hasImages = Array.isArray(input.images) && input.images.length > 0;
  return nonBlank(input.articleSlug) || nonBlank(input.pdfUrl) || nonBlank(input.sourceUrl) || hasImages;
}

export type EvidenceTypeCount = { type: EvidenceType; label: string; count: number };

/** Count by type in canonical order; omits zero-count/unknown. Counting only — NOT status gating. */
export function countEvidenceByType(records: { type: string }[]): EvidenceTypeCount[] {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  return EVIDENCE_TYPE_ORDER
    .filter((type) => (counts.get(type) ?? 0) > 0)
    .map((type) => ({ type, label: evidenceTypeLabel(type), count: counts.get(type)! }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/config/evidence.test.ts`
Expected: PASS.

> If the `import ... from '../../amplify/lib/evidence/status'` fails the frontend typecheck/build (Vite or `tsc` `rootDir`/`include` rejects reaching into `amplify/`), fall back to: keep `EVIDENCE_STATUS`/`EVIDENCE_TYPE` defined locally in `src/config/evidence.ts` AND add `src/config/evidence.contract.test.ts` importing both this file and `amplify/lib/evidence/status.ts` and asserting `expect(localStatus).toEqual(sharedStatus)`. The Lambda still imports the amplify/lib copy. Only use the fallback if Step 4 actually fails — the re-export is preferred.

- [ ] **Step 5: Commit**

```bash
git add src/config/evidence.ts src/config/evidence.test.ts
git commit -m "feat(evidence): frontend constants re-export + labels/payload/count helpers"
```

---

## Task 3: Product config registry (canonical product options)

Derive the admin product multi-select from the real product configs (each exports `slug` + `schema.name`), so no hand-maintained list can drift or omit products (e.g. `hy-4l`, `pluto-*`).

**Files:**
- Create: `src/components/products/productDetailConfigs/index.ts`
- Test: `src/components/products/productDetailConfigs/index.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/components/products/productDetailConfigs/index.test.ts
import { describe, it, expect } from 'vitest';
import { productConfigs, productOptions } from './index';

describe('product config registry', () => {
  it('derives one option per config, preserving order', () => {
    expect(productOptions).toHaveLength(productConfigs.length);
    expect(productOptions.map((o) => o.slug)).toEqual(productConfigs.map((c) => c.slug));
  });

  it('covers the full canonical product set, including previously-omitted products', () => {
    const slugs = new Set(productOptions.map((o) => o.slug));
    for (const s of ['ald', 'rie-etcher', 'hy-4l', 'hy-20l', 'hy-20lrf', 'pluto-t', 'pluto-f', 'pluto-m', 'pluto-30']) {
      expect(slugs.has(s)).toBe(true);
    }
    // registry must not shrink below the 18 known product configs
    expect(productOptions.length).toBeGreaterThanOrEqual(18);
  });

  it('every option has a non-empty label', () => {
    for (const o of productOptions) expect(o.label.trim().length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/products/productDetailConfigs/index.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write the registry**

```ts
// src/components/products/productDetailConfigs/index.ts
// Canonical registry of product detail configs. The single source for the
// admin product multi-select (Evidence.products), so no separate hand-kept
// slug list can drift. Add a line here whenever a product config is added.
import type { ProductDetailConfig } from '../ProductDetailPage.types';

import { aldSystemConfig } from './aldSystemConfig';
import { coaterDeveloperConfig } from './coaterDeveloperConfig';
import { compactRieConfig } from './compactRieConfig';
import { eBeamEvaporatorConfig } from './eBeamEvaporatorConfig';
import { hdpCvdSystemConfig } from './hdpCvdSystemConfig';
import { hy20lConfig } from './hy20lConfig';
import { hy20lrfConfig } from './hy20lrfConfig';
import { hy4lConfig } from './hy4lConfig';
import { ibeRibeSystemConfig } from './ibeRibeSystemConfig';
import { icpEtcherConfig } from './icpEtcherConfig';
import { pecvdSystemConfig } from './pecvdSystemConfig';
import { pluto30Config } from './pluto30Config';
import { plutoFConfig } from './plutoFConfig';
import { plutoMConfig } from './plutoMConfig';
import { plutoTConfig } from './plutoTConfig';
import { rieEtcherConfig } from './rieEtcherConfig';
import { sputterSystemConfig } from './sputterSystemConfig';
import { striperSystemConfig } from './striperSystemConfig';

export const productConfigs: ProductDetailConfig[] = [
  aldSystemConfig,
  pecvdSystemConfig,
  hdpCvdSystemConfig,
  rieEtcherConfig,
  compactRieConfig,
  icpEtcherConfig,
  ibeRibeSystemConfig,
  sputterSystemConfig,
  eBeamEvaporatorConfig,
  striperSystemConfig,
  coaterDeveloperConfig,
  hy4lConfig,
  hy20lConfig,
  hy20lrfConfig,
  plutoTConfig,
  plutoMConfig,
  plutoFConfig,
  pluto30Config,
];

export interface ProductOption {
  slug: string;
  label: string;
}

/** Canonical product options for the admin Evidence multi-select. */
export const productOptions: ProductOption[] = productConfigs.map((config) => ({
  slug: config.slug,
  label: config.schema.name,
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/products/productDetailConfigs/index.test.ts`
Expected: PASS.

> If any import name mismatches (a config file exports a differently-named const), the test file fails to import and the run errors — fix the import to match the file's actual `export const` name, then re-run. All 18 files follow the `<basename>Config` convention (`aldSystemConfig`, `hy4lConfig`, `plutoTConfig`, …).

- [ ] **Step 5: Commit**

```bash
git add src/components/products/productDetailConfigs/index.ts src/components/products/productDetailConfigs/index.test.ts
git commit -m "feat(evidence): canonical product config registry + derived product options"
```

---

## Task 4: `Evidence` model (authenticated-only)

**Files:**
- Modify: `amplify/data/resource.ts`

- [ ] **Step 1: Import the shared status constant**

Near the top of `amplify/data/resource.ts` (backend importing backend lib — no boundary concern):

```ts
import { EVIDENCE_STATUS } from '../lib/evidence/status';
```

- [ ] **Step 2: Add the model**

Insert into the `a.schema({ ... })` object, right after the `InsightsPost` model:

```ts
  Evidence: a
    .model({
      id: a.id().required(),
      slug: a.string().required(),
      title: a.string().required(),
      type: a.string().required(),
      summary: a.string(),
      products: a.string().array().required(),
      process: a.string(),
      materials: a.string().array(),
      keywords: a.string().array(),
      metrics: a.json(),
      articleSlug: a.string(),
      pdfUrl: a.string(),
      images: a.string().array(),
      sourceUrl: a.string(),
      meta: a.json(),
      publishDate: a.string(),
      status: a.string().default(EVIDENCE_STATUS.DRAFT),
    })
    .authorization((allow) => [
      // Authenticated identities only. NOT public read — anonymous reads go
      // through listPublishedEvidence (Public Read Boundary). Per spec "Write
      // Authorization Premise", this is not admin-only authz.
      allow.authenticated(),
    ])
    .secondaryIndexes((index) => [index('slug')]),
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat(evidence): authenticated-only Evidence model with slug index"
```

---

## Task 5: `evidence-api` Lambda — published-only, paginated, server-filtered

**Files:**
- Create: `amplify/functions/evidence-api/resource.ts`
- Create: `amplify/functions/evidence-api/handler.ts`
- Create: `amplify/functions/evidence-api/package.json`
- Test: `amplify/functions/evidence-api/handler.test.ts`

- [ ] **Step 1: Create the function resource**

```ts
// amplify/functions/evidence-api/resource.ts
import { defineFunction } from '@aws-amplify/backend';

export const evidenceApi = defineFunction({
  name: 'evidence-api',
  entry: './handler.ts',
  runtime: 22,
  timeoutSeconds: 30,
  memoryMB: 512,
  resourceGroupName: 'evidence-api-stack',
});
```

- [ ] **Step 2: Create package.json**

```json
{
  "name": "evidence-api",
  "version": "1.0.0",
  "private": true,
  "type": "module"
}
```

- [ ] **Step 3: Write the failing handler test**

```ts
// amplify/functions/evidence-api/handler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockScan = vi.fn();
const mockSend = vi.fn().mockImplementation((cmd: unknown) => {
  const name = (cmd as { constructor: { name: string } }).constructor.name;
  if (name === 'ScanCommand') return mockScan();
  return Promise.resolve({});
});

vi.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: vi.fn().mockImplementation(() => ({})),
}));
vi.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: { from: vi.fn().mockReturnValue({ send: mockSend }) },
  ScanCommand: vi.fn().mockImplementation((p) => ({ ...p, constructor: { name: 'ScanCommand' } })),
}));

import { handler } from './handler';

const invoke = (args: Record<string, unknown> = {}) =>
  handler({ arguments: args } as never) as Promise<unknown[]>;

beforeEach(() => {
  process.env.EVIDENCE_TABLE = 'Evidence-test';
  mockScan.mockReset();
  mockSend.mockClear();
});

describe('evidence-api listPublishedEvidence', () => {
  it('scans the configured table with an EXACT published-only filter', async () => {
    mockScan.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await invoke();
    const sent = mockSend.mock.calls[0][0];
    expect(sent.TableName).toBe('Evidence-test');
    expect(sent.FilterExpression).toBe('#status = :published');
    expect(sent.ExpressionAttributeNames).toEqual({ '#status': 'status' });
    expect(sent.ExpressionAttributeValues).toEqual({ ':published': 'published' });
  });

  it('adds a server-side products membership filter when productSlug is given', async () => {
    mockScan.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await invoke({ productSlug: 'ald' });
    const sent = mockSend.mock.calls[0][0];
    expect(sent.FilterExpression).toBe('#status = :published AND contains(products, :slug)');
    expect(sent.ExpressionAttributeValues).toEqual({ ':published': 'published', ':slug': 'ald' });
  });

  it('drains LastEvaluatedKey across pages and accumulates published items', async () => {
    mockScan
      .mockResolvedValueOnce({ Items: [{ id: '1', type: 'application_note', status: 'published' }], LastEvaluatedKey: { id: '1' } })
      .mockResolvedValueOnce({ Items: [{ id: '2', type: 'publication', status: 'published' }], LastEvaluatedKey: undefined });
    const result = await invoke();
    expect(mockScan).toHaveBeenCalledTimes(2);
    expect((result as { id: string }[]).map((r) => r.id)).toEqual(['1', '2']); // 2nd-page record included
    expect(mockSend.mock.calls[1][0].ExclusiveStartKey).toEqual({ id: '1' }); // carried forward
  });

  it('throws if EVIDENCE_TABLE is unset', async () => {
    delete process.env.EVIDENCE_TABLE;
    await expect(invoke()).rejects.toThrow(/EVIDENCE_TABLE/);
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run amplify/functions/evidence-api/handler.test.ts`
Expected: FAIL — `Cannot find module './handler'`.

- [ ] **Step 5: Write the handler**

```ts
// amplify/functions/evidence-api/handler.ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EVIDENCE_STATUS } from '../../lib/evidence/status';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface EvidenceApiEvent {
  arguments?: { productSlug?: string | null };
}

/**
 * listPublishedEvidence: the ONLY public read path for Evidence.
 * - status = published enforced server-side (never a client responsibility).
 * - optional productSlug membership filter applied server-side.
 * - paginates to completeness (drains LastEvaluatedKey) so counts are never
 *   silently truncated by DynamoDB's 1 MB page limit.
 */
export const handler = async (event: EvidenceApiEvent): Promise<unknown[]> => {
  const tableName = process.env.EVIDENCE_TABLE;
  if (!tableName) throw new Error('EVIDENCE_TABLE env var is not set');

  const productSlug = event.arguments?.productSlug?.trim();

  const filters = ['#status = :published'];
  const values: Record<string, unknown> = { ':published': EVIDENCE_STATUS.PUBLISHED };
  if (productSlug) {
    filters.push('contains(products, :slug)');
    values[':slug'] = productSlug;
  }

  const items: unknown[] = [];
  let ExclusiveStartKey: Record<string, unknown> | undefined;
  do {
    const res = await ddb.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: filters.join(' AND '),
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: values,
        ExclusiveStartKey,
      })
    );
    if (res.Items) items.push(...res.Items);
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items;
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run amplify/functions/evidence-api/handler.test.ts`
Expected: PASS (exact published-only filter + 2-page pagination).

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/evidence-api/
git commit -m "feat(evidence): evidence-api Lambda — published-only, server-filtered, paginated"
```

---

## Task 6: Wire the custom query + least-privilege IAM + env

**Files:**
- Modify: `amplify/data/resource.ts`
- Modify: `amplify/backend.ts`

- [ ] **Step 1: Import the function in the schema file**

Alongside the other function imports at the top of `amplify/data/resource.ts`:

```ts
import { evidenceApi } from '../functions/evidence-api/resource';
```

- [ ] **Step 2: Add the custom query**

In the Queries section of the schema (near `listOrders`):

```ts
  listPublishedEvidence: a
    .query()
    .arguments({ productSlug: a.string() })
    .returns(a.ref('Evidence').array().required())
    .handler(a.handler.function(evidenceApi))
    .authorization((allow) => [allow.publicApiKey()]),
```

- [ ] **Step 3: Register the function**

In `amplify/backend.ts`: add `import { evidenceApi } from './functions/evidence-api/resource';` to the imports, and `evidenceApi,` to the `defineBackend({ ... })` object.

- [ ] **Step 4: Grant base-ARN-only Scan + inject env**

Append after the existing table grants in `amplify/backend.ts` (`PolicyStatement` is already imported at line 52):

```ts
// Evidence read path: the evidence-api Lambda gets EXACTLY dynamodb:Scan on the
// Evidence BASE TABLE ARN. No Query (the handler never Query's), no index ARNs
// (never touches the slug GSI — that GSI is used only by the admin client's
// listEvidenceBySlug via AppSync's own resolver, not here), no write actions,
// no other tables. This is the no-leak boundary.
const evidenceTable = backend.data.resources.tables['Evidence'];
backend.evidenceApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Scan'],
    resources: [evidenceTable.tableArn],
  })
);
backend.evidenceApi.addEnvironment('EVIDENCE_TABLE', evidenceTable.tableName);
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add amplify/data/resource.ts amplify/backend.ts
git commit -m "feat(evidence): wire listPublishedEvidence with base-ARN-only Scan IAM + env"
```

---

## Task 7: Public `evidenceService`

**Files:**
- Create: `src/services/evidenceService.ts`
- Test: `src/services/evidenceService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/services/evidenceService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = { listPublishedEvidence: vi.fn() };
vi.mock('./amplifyClient', () => ({ getAmplifyDataClient: () => ({ queries }) }));

import { fetchPublishedEvidence } from './evidenceService';

beforeEach(() => queries.listPublishedEvidence.mockReset());

describe('fetchPublishedEvidence', () => {
  it('calls the query with productSlug under apiKey auth and returns the array', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: [{ id: '1', type: 'application_note' }], errors: null });
    const res = await fetchPublishedEvidence('ald');
    expect(queries.listPublishedEvidence).toHaveBeenCalledWith({ productSlug: 'ald' }, { authMode: 'apiKey' });
    expect(res).toEqual([{ id: '1', type: 'application_note' }]);
  });
  it('unwraps a JSON-string payload', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: JSON.stringify([{ id: '2', type: 'publication' }]), errors: null });
    expect(await fetchPublishedEvidence('rie-etcher')).toEqual([{ id: '2', type: 'publication' }]);
  });
  it('returns [] on errors and on null data (public page must not crash)', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: null, errors: [{ message: 'boom' }] });
    expect(await fetchPublishedEvidence('ald')).toEqual([]);
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: null, errors: null });
    expect(await fetchPublishedEvidence('ald')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/evidenceService.test.ts`
Expected: FAIL — `Cannot find module './evidenceService'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/services/evidenceService.ts
import { getAmplifyDataClient } from './amplifyClient';

export interface PublishedEvidence {
  id: string;
  slug: string;
  title: string;
  type: string;
  summary?: string | null;
  products: string[];
  process?: string | null;
  materials?: (string | null)[] | null;
  keywords?: (string | null)[] | null;
  metrics?: unknown;
  articleSlug?: string | null;
  pdfUrl?: string | null;
  images?: (string | null)[] | null;
  sourceUrl?: string | null;
  meta?: unknown;
  publishDate?: string | null;
  status: string;
}

/** Public read of published Evidence for a product. Never throws. */
export async function fetchPublishedEvidence(productSlug: string): Promise<PublishedEvidence[]> {
  try {
    const { data, errors } = await getAmplifyDataClient().queries.listPublishedEvidence(
      { productSlug },
      { authMode: 'apiKey' }
    );
    if (errors || !data) return [];
    const parsed = typeof data === 'string' ? JSON.parse(data) : data;
    return Array.isArray(parsed) ? (parsed as PublishedEvidence[]) : [];
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/evidenceService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/evidenceService.ts src/services/evidenceService.test.ts
git commit -m "feat(evidence): public evidenceService.fetchPublishedEvidence (apiKey, never throws)"
```

---

## Task 8: `evidenceAdminService` (slug-GSI guard, paginated list, payload rule)

**Files:**
- Create: `src/services/evidenceAdminService.ts`
- Test: `src/services/evidenceAdminService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/services/evidenceAdminService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const model = {
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  list: vi.fn(),
  listEvidenceBySlug: vi.fn(),
};
vi.mock('./amplifyClient', () => ({ getAmplifyDataClient: () => ({ models: { Evidence: model } }) }));

import { createEvidence, updateEvidence, listAllEvidence } from './evidenceAdminService';
import { EVIDENCE_STATUS, EVIDENCE_TYPE } from '../config/evidence';

const base = {
  slug: 'si-deep-etch',
  title: 'Silicon Deep Etch',
  type: EVIDENCE_TYPE.APPLICATION_NOTE,
  products: ['ald'],
  sourceUrl: 'https://example.com/note.pdf',
  status: EVIDENCE_STATUS.DRAFT,
};

beforeEach(() => Object.values(model).forEach((f) => f.mockReset()));

describe('createEvidence', () => {
  it('rejects a record with no payload target (empty images does not count)', async () => {
    await expect(createEvidence({ ...base, sourceUrl: '', articleSlug: '', pdfUrl: '', images: [] }))
      .rejects.toThrow(/payload/i);
    expect(model.create).not.toHaveBeenCalled();
    expect(model.listEvidenceBySlug).not.toHaveBeenCalled(); // payload check precedes slug check
  });

  it('rejects a duplicate slug via the slug GSI query (nextToken in options param)', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [{ id: 'existing', slug: 'si-deep-etch' }], nextToken: null });
    await expect(createEvidence(base)).rejects.toThrow(/slug/i);
    expect(model.listEvidenceBySlug).toHaveBeenCalledWith({ slug: 'si-deep-etch' }, { authMode: 'userPool', nextToken: undefined });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('detects a clash that appears only on the second GSI page (drains nextToken)', async () => {
    model.listEvidenceBySlug
      .mockResolvedValueOnce({ data: [], nextToken: 'p2' })
      .mockResolvedValueOnce({ data: [{ id: 'dup', slug: 'si-deep-etch' }], nextToken: null });
    await expect(createEvidence(base)).rejects.toThrow(/slug/i);
    expect(model.listEvidenceBySlug).toHaveBeenCalledTimes(2);
    expect(model.listEvidenceBySlug.mock.calls[1][1]).toEqual({ authMode: 'userPool', nextToken: 'p2' });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates under userPool auth when slug is free and payload exists', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [], nextToken: null });
    model.create.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await createEvidence(base);
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'si-deep-etch' }), { authMode: 'userPool' });
  });

  it('auto-sets publishDate when created directly as published', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [], nextToken: null });
    model.create.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await createEvidence({ ...base, status: EVIDENCE_STATUS.PUBLISHED });
    expect(model.create.mock.calls[0][0].publishDate).toBeTruthy();
  });
});

describe('updateEvidence', () => {
  it('allows saving with the same slug on the same record (self is not a clash)', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [{ id: 'e-1', slug: 'si-deep-etch' }], nextToken: null });
    model.update.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await updateEvidence({ ...base, id: 'e-1' });
    expect(model.update).toHaveBeenCalled();
  });

  it('rejects when another record already owns the slug', async () => {
    model.listEvidenceBySlug.mockResolvedValueOnce({ data: [{ id: 'other', slug: 'si-deep-etch' }], nextToken: null });
    await expect(updateEvidence({ ...base, id: 'e-1' })).rejects.toThrow(/slug/i);
    expect(model.update).not.toHaveBeenCalled();
  });

  it('rejects when only self is on page 1 but another id owns the slug on page 2', async () => {
    model.listEvidenceBySlug
      .mockResolvedValueOnce({ data: [{ id: 'e-1', slug: 'si-deep-etch' }], nextToken: 'p2' })
      .mockResolvedValueOnce({ data: [{ id: 'other', slug: 'si-deep-etch' }], nextToken: null });
    await expect(updateEvidence({ ...base, id: 'e-1' })).rejects.toThrow(/slug/i);
    expect(model.listEvidenceBySlug).toHaveBeenCalledTimes(2);
    expect(model.update).not.toHaveBeenCalled();
  });

  it('sets publishDate on first transition to published, and does not overwrite an existing one', async () => {
    model.listEvidenceBySlug.mockResolvedValue({ data: [], nextToken: null });
    model.update.mockResolvedValue({ data: { id: 'e-1' }, errors: null });
    await updateEvidence({ ...base, id: 'e-1', status: EVIDENCE_STATUS.PUBLISHED, publishDate: null });
    expect(model.update.mock.calls[0][0].publishDate).toBeTruthy();
    await updateEvidence({ ...base, id: 'e-1', status: EVIDENCE_STATUS.PUBLISHED, publishDate: '2026-01-01' });
    expect(model.update.mock.calls[1][0].publishDate).toBe('2026-01-01');
  });
});

describe('listAllEvidence', () => {
  it('drains nextToken across pages (admin list must not miss records)', async () => {
    model.list
      .mockResolvedValueOnce({ data: [{ id: 'e-1' }], nextToken: 'tok', errors: null })
      .mockResolvedValueOnce({ data: [{ id: 'e-2' }], nextToken: null, errors: null });
    const res = await listAllEvidence();
    expect(model.list).toHaveBeenCalledTimes(2);
    expect(model.list.mock.calls[0][0]).toEqual({ authMode: 'userPool', nextToken: undefined });
    expect(model.list.mock.calls[1][0]).toEqual({ authMode: 'userPool', nextToken: 'tok' });
    expect(res.map((r: { id: string }) => r.id)).toEqual(['e-1', 'e-2']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/evidenceAdminService.test.ts`
Expected: FAIL — `Cannot find module './evidenceAdminService'`.

- [ ] **Step 3: Write the implementation**

```ts
// src/services/evidenceAdminService.ts
import { getAmplifyDataClient } from './amplifyClient';
import { EVIDENCE_STATUS, hasPayload } from '../config/evidence';

const client = getAmplifyDataClient;

export interface EvidenceInput {
  slug: string;
  title: string;
  type: string;
  summary?: string | null;
  products: string[];
  process?: string | null;
  materials?: string[] | null;
  keywords?: string[] | null;
  metrics?: unknown;
  articleSlug?: string | null;
  pdfUrl?: string | null;
  images?: string[] | null;
  sourceUrl?: string | null;
  meta?: unknown;
  publishDate?: string | null;
  status: string;
}
export interface EvidenceUpdateInput extends EvidenceInput {
  id: string;
}

function assertPayload(input: EvidenceInput) {
  if (!hasPayload(input)) {
    throw new Error(
      'Evidence needs at least one payload/target: a non-blank articleSlug, pdfUrl, or sourceUrl, or a non-empty images array.'
    );
  }
}

/**
 * Best-effort duplicate-slug guard using the slug GSI (not atomic — spec
 * constraint 1). Drains nextToken so a clashing record on a later page is not
 * missed, and returns early once any different-id record is found. Excludes the
 * record itself on update (ignoreId). nextToken belongs in the options (2nd)
 * param, alongside authMode — the index input (1st param) carries only `slug`.
 */
async function assertSlugFree(slug: string, ignoreId?: string) {
  let nextToken: string | undefined = undefined;
  do {
    const { data, nextToken: next } = await client().models.Evidence.listEvidenceBySlug(
      { slug },
      { authMode: 'userPool', nextToken }
    );
    if ((data ?? []).some((r: { id: string }) => r.id !== ignoreId)) {
      throw new Error(`Evidence slug "${slug}" already exists — choose a unique slug.`);
    }
    nextToken = next ?? undefined;
  } while (nextToken);
}

function withPublishDate<T extends { status: string; publishDate?: string | null }>(input: T): T {
  if (input.status === EVIDENCE_STATUS.PUBLISHED && !input.publishDate) {
    return { ...input, publishDate: new Date().toISOString() };
  }
  return input;
}

export async function createEvidence(input: EvidenceInput) {
  assertPayload(input);
  await assertSlugFree(input.slug);
  const { data, errors } = await client().models.Evidence.create(withPublishDate(input), { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateEvidence(input: EvidenceUpdateInput) {
  assertPayload(input);
  await assertSlugFree(input.slug, input.id);
  const { data, errors } = await client().models.Evidence.update(withPublishDate(input), { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function deleteEvidence(id: string) {
  const { errors } = await client().models.Evidence.delete({ id }, { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
}

/** Admin list — drains nextToken so no record is missed across pages. */
export async function listAllEvidence() {
  const all: unknown[] = [];
  let nextToken: string | undefined = undefined;
  do {
    const { data, nextToken: next, errors } = await client().models.Evidence.list({ authMode: 'userPool', nextToken });
    if (errors) throw new Error(errors.map((e) => e.message).join(', '));
    if (data) all.push(...data);
    nextToken = next ?? undefined;
  } while (nextToken);
  return all;
}

export async function getEvidence(id: string) {
  const { data, errors } = await client().models.Evidence.get({ id }, { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/evidenceAdminService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/evidenceAdminService.ts src/services/evidenceAdminService.test.ts
git commit -m "feat(evidence): admin service — slug-GSI guard, paginated list, payload rule, publishDate"
```

---

## Task 9: `ProductEvidence` module (conditional, display-only)

**Files:**
- Create: `src/components/products/ProductEvidence.tsx`
- Test: `src/components/products/ProductEvidence.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/products/ProductEvidence.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProductEvidence } from './ProductEvidence';
import { EVIDENCE_TYPE } from '../../config/evidence';

const fetchPublishedEvidence = vi.fn();
vi.mock('../../services/evidenceService', () => ({
  fetchPublishedEvidence: (slug: string) => fetchPublishedEvidence(slug),
}));

beforeEach(() => fetchPublishedEvidence.mockReset());

describe('ProductEvidence', () => {
  it('renders nothing when there is no published evidence', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([]);
    const { container } = render(<ProductEvidence productSlug="ald" />);
    await waitFor(() => expect(fetchPublishedEvidence).toHaveBeenCalledWith('ald'));
    expect(container.querySelector('section')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('renders grouped counts with fixed labels when evidence exists', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([
      { id: '1', type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { id: '2', type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { id: '3', type: EVIDENCE_TYPE.APPLICATION_NOTE },
      { id: '4', type: EVIDENCE_TYPE.PUBLICATION },
      { id: '5', type: EVIDENCE_TYPE.VALIDATION },
      { id: '6', type: EVIDENCE_TYPE.VALIDATION },
    ]);
    render(<ProductEvidence productSlug="ald" />);
    expect(await screen.findByText('Evidence')).toBeInTheDocument();
    expect(screen.getByText('3 Application Notes')).toBeInTheDocument();
    expect(screen.getByText('1 Published Research')).toBeInTheDocument();
    expect(screen.getByText('2 Process Validation')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/products/ProductEvidence.test.tsx`
Expected: FAIL — `Cannot find module './ProductEvidence'`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/products/ProductEvidence.tsx
import { useEffect, useState } from 'react';
import { fetchPublishedEvidence } from '../../services/evidenceService';
import { countEvidenceByType, EvidenceTypeCount } from '../../config/evidence';

interface ProductEvidenceProps {
  productSlug: string;
}

// Explicit plural map — naive "+s" would produce "Case Studys"/"Process Validations".
const PLURALS: Record<string, string> = {
  'Application Note': 'Application Notes',
  'Process Note': 'Process Notes',
  'Technical Note': 'Technical Notes',
  'Published Research': 'Published Research',
  'Case Study': 'Case Studies',
  'Process Validation': 'Process Validation',
};
function labelFor(group: EvidenceTypeCount): string {
  return group.count === 1 ? group.label : (PLURALS[group.label] ?? `${group.label}s`);
}

/**
 * Phase 1 product-page Evidence module. Signals "this product has verifiable
 * evidence" via grouped-by-type counts. Display-only — no links, no expand.
 * Renders nothing when the product has no published evidence.
 */
export function ProductEvidence({ productSlug }: ProductEvidenceProps) {
  const [groups, setGroups] = useState<EvidenceTypeCount[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublishedEvidence(productSlug).then((records) => {
      if (active) setGroups(countEvidenceByType(records));
    });
    return () => { active = false; };
  }, [productSlug]);

  if (!groups || groups.length === 0) return null;

  return (
    <section data-testid="product-evidence" className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
      <div className="mx-auto max-w-screen-2xl">
        <h2 className="font-headline text-4xl font-semibold tracking-normal text-slate-950">Evidence</h2>
        <ul className="mt-8 flex flex-col gap-3">
          {groups.map((group) => (
            <li key={group.type} className="flex items-center gap-3 text-lg text-slate-800">
              <span aria-hidden className="text-sky-600">✓</span>
              <span className="font-semibold">{group.count} {labelFor(group)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/products/ProductEvidence.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/products/ProductEvidence.tsx src/components/products/ProductEvidence.test.tsx
git commit -m "feat(evidence): conditional display-only ProductEvidence summary module"
```

---

## Task 10: Insert the module into the product template (with a real placement test)

**Files:**
- Modify: `src/components/products/ProductDetailPage.tsx`
- Modify: `src/components/products/ProductDetailPage.test.tsx`

- [ ] **Step 1: Add a stable anchor + the import + the insertion**

In `ProductDetailPage.tsx`:

a) Add the import near the other component imports:
```tsx
import { ProductEvidence } from './ProductEvidence';
```

b) Add a `data-testid` to the applications section opening tag (currently line 258) so placement is assertable:
```tsx
        <section data-testid="product-applications" className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
```

c) Insert the module between the applications `</section>` (line 274) and `{config.gallery && (`:
```tsx
        </section>

        <ProductEvidence productSlug={config.slug} />

        {config.gallery && (
```

- [ ] **Step 2: Add the placement red-test**

Append to `src/components/products/ProductDetailPage.test.tsx`. It mocks the service, gives the config a gallery, and asserts DOM order applications → Evidence → gallery:

```tsx
// --- Evidence module placement ---
vi.mock('../../services/evidenceService', () => ({
  fetchPublishedEvidence: vi.fn().mockResolvedValue([{ id: '1', type: 'application_note' }]),
}));

it('renders the Evidence module after applications and before the gallery', async () => {
  const configWithGallery: ProductDetailConfig = {
    ...icpEtcherConfig,
    gallery: {
      heading: 'Gallery Fixture',
      images: [{ src: '/x.webp', alt: 'x', width: 100, height: 100 }],
    },
  };
  const { getByTestId, findByText, getByText } = render(
    <HelmetProvider>
      <MemoryRouter>
        <ProductDetailPage config={configWithGallery} />
      </MemoryRouter>
    </HelmetProvider>
  );

  const evidence = await findByText('Evidence');
  const evidenceSection = getByTestId('product-evidence');
  const applications = getByTestId('product-applications');
  const gallery = getByText('Gallery Fixture');

  // applications precedes evidence
  expect(applications.compareDocumentPosition(evidenceSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // evidence precedes gallery
  expect(evidenceSection.compareDocumentPosition(gallery) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(evidence).toBeInTheDocument();
});
```

> If `ProductDetailPage.test.tsx` lacks a top-level `vi.mock` region, place the `vi.mock('../../services/evidenceService', ...)` call at module top with the other `vi.mock` calls (it is hoisted regardless). Confirm `ProductDetailConfig`, `HelmetProvider`, `MemoryRouter`, and `icpEtcherConfig` are already imported in that file (they are, per the existing tests).

- [ ] **Step 3: Run the template tests**

Run: `npx vitest run src/components/products/ProductDetailPage.test.tsx`
Expected: PASS — including the new placement test and all pre-existing tests (the mocked service returns a record, so the module renders; other configs in existing tests render the module as `null` since the same mock returns a record only when called — if an existing test asserts absence of extra sections, it still passes because it does not assert on Evidence).

- [ ] **Step 4: Commit**

```bash
git add src/components/products/ProductDetailPage.tsx src/components/products/ProductDetailPage.test.tsx
git commit -m "feat(evidence): render ProductEvidence between applications and gallery (+ placement test)"
```

---

## Task 11: `EvidenceForm` (product multi-select, article select, real uploader)

**Files:**
- Create: `src/components/admin/EvidenceForm.tsx`
- Test: `src/components/admin/EvidenceForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/EvidenceForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EvidenceForm } from './EvidenceForm';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const fetchAllInsightsPosts = vi.fn();
vi.mock('../../services/insightsService', () => ({
  fetchAllInsightsPosts: () => fetchAllInsightsPosts(),
}));

const getContentImageUploadUrl = vi.fn();
const uploadImageToS3 = vi.fn();
vi.mock('../../services/insightsImageService', () => ({
  getContentImageUploadUrl: (...a: unknown[]) => getContentImageUploadUrl(...a),
  uploadImageToS3: (...a: unknown[]) => uploadImageToS3(...a),
}));

const noop = () => {};
beforeEach(() => {
  fetchAllInsightsPosts.mockReset().mockResolvedValue([{ slug: 'temporary-bonding' }, { slug: 'via-etch' }]);
  getContentImageUploadUrl.mockReset();
  uploadImageToS3.mockReset();
});

describe('EvidenceForm', () => {
  it('renders a product checkbox for every canonical product, including hy-4l and pluto-t', () => {
    render(<EvidenceForm onSubmit={noop} onCancel={noop} />);
    expect(screen.getByLabelText('ald')).toBeInTheDocument();
    expect(screen.getByLabelText('hy-4l')).toBeInTheDocument();
    expect(screen.getByLabelText('pluto-t')).toBeInTheDocument();
  });

  it('populates the article-slug select from existing insights posts', async () => {
    render(<EvidenceForm onSubmit={noop} onCancel={noop} />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'temporary-bonding' })).toBeInTheDocument());
  });

  it('blocks submit and shows an error when no payload target is provided', () => {
    const onSubmit = vi.fn();
    render(<EvidenceForm onSubmit={onSubmit} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Deep Etch' } });
    fireEvent.change(screen.getByLabelText(/^Slug/i), { target: { value: 'deep-etch' } });
    fireEvent.click(screen.getByLabelText('ald'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one/i)).toBeInTheDocument();
  });

  it('uploads an image via the content pipeline and adds the returned cdnUrl as a payload', async () => {
    getContentImageUploadUrl.mockResolvedValueOnce({ uploadUrl: 'https://s3/put', s3Key: 'k', cdnUrl: 'https://cdn/x.webp' });
    uploadImageToS3.mockResolvedValueOnce(undefined);
    const onSubmit = vi.fn();
    render(<EvidenceForm onSubmit={onSubmit} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'SEM Set' } });
    fireEvent.change(screen.getByLabelText(/^Slug/i), { target: { value: 'sem-set' } });
    fireEvent.click(screen.getByLabelText('ald'));

    const file = new File(['x'], 'sem.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText(/Upload image/i), { target: { files: [file] } });
    await waitFor(() => expect(uploadImageToS3).toHaveBeenCalledWith('https://s3/put', file));
    await waitFor(() => expect(screen.getByText('https://cdn/x.webp')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].images).toEqual(['https://cdn/x.webp']);
  });

  it('submits a valid record with selected products and a sourceUrl', () => {
    const onSubmit = vi.fn();
    render(<EvidenceForm onSubmit={onSubmit} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Deep Etch' } });
    fireEvent.change(screen.getByLabelText(/^Slug/i), { target: { value: 'deep-etch' } });
    fireEvent.change(screen.getByLabelText(/Source URL/i), { target: { value: 'https://x/y.pdf' } });
    fireEvent.click(screen.getByLabelText('ald'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      title: 'Deep Etch', slug: 'deep-etch', products: ['ald'], sourceUrl: 'https://x/y.pdf',
      type: EVIDENCE_TYPE.APPLICATION_NOTE, status: EVIDENCE_STATUS.DRAFT,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/EvidenceForm.test.tsx`
Expected: FAIL — `Cannot find module './EvidenceForm'`.

- [ ] **Step 3: Write the form**

```tsx
// src/components/admin/EvidenceForm.tsx
import { useEffect, useState } from 'react';
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_TYPE_ORDER,
  EVIDENCE_TYPE_HELP,
  evidenceTypeLabel,
  hasPayload,
} from '../../config/evidence';
import { productOptions } from '../products/productDetailConfigs';
import { fetchAllInsightsPosts } from '../../services/insightsService';
import { getContentImageUploadUrl, uploadImageToS3 } from '../../services/insightsImageService';
import type { EvidenceInput, EvidenceUpdateInput } from '../../services/evidenceAdminService';

type Metric = { label: string; value: string; unit: string };
export interface EvidenceFormValue extends Partial<EvidenceUpdateInput> {}

interface EvidenceFormProps {
  initial?: EvidenceFormValue;
  onSubmit: (value: EvidenceInput | EvidenceUpdateInput) => void;
  onCancel: () => void;
  submitting?: boolean;
}

function slugify(title: string): string {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function toLines(arr?: (string | null)[] | null): string {
  return (arr ?? []).filter(Boolean).join('\n');
}
function fromLines(text: string): string[] {
  return text.split('\n').map((s) => s.trim()).filter(Boolean);
}

export function EvidenceForm({ initial, onSubmit, onCancel, submitting }: EvidenceFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugEdited, setSlugEdited] = useState(Boolean(initial?.slug));
  const [type, setType] = useState<string>(initial?.type ?? EVIDENCE_TYPE.APPLICATION_NOTE);
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [products, setProducts] = useState<string[]>(initial?.products ?? []);
  const [process, setProcess] = useState(initial?.process ?? '');
  const [materials, setMaterials] = useState(toLines(initial?.materials));
  const [keywords, setKeywords] = useState(toLines(initial?.keywords));
  const [metrics, setMetrics] = useState<Metric[]>(Array.isArray(initial?.metrics) ? (initial!.metrics as Metric[]) : []);
  const [articleSlug, setArticleSlug] = useState(initial?.articleSlug ?? '');
  const [pdfUrl, setPdfUrl] = useState(initial?.pdfUrl ?? '');
  const [images, setImages] = useState<string[]>((initial?.images ?? []).filter(Boolean) as string[]);
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '');
  const [metaText, setMetaText] = useState(initial?.meta ? JSON.stringify(initial.meta, null, 2) : '');
  const [status, setStatus] = useState<string>(initial?.status ?? EVIDENCE_STATUS.DRAFT);
  const [insightSlugs, setInsightSlugs] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(title);

  useEffect(() => {
    fetchAllInsightsPosts()
      .then((posts) => setInsightSlugs((posts ?? []).map((p: { slug: string }) => p.slug)))
      .catch(() => setInsightSlugs([]));
  }, []);

  function toggleProduct(s: string) {
    setProducts((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }
  function updateMetric(i: number, field: keyof Metric, value: string) {
    setMetrics((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }

  async function handleUpload(file: File) {
    if (!effectiveSlug) { setError('Set a title/slug before uploading images.'); return; }
    setUploading(true);
    setError(null);
    try {
      const { uploadUrl, cdnUrl } = await getContentImageUploadUrl(effectiveSlug, file.name, file.type);
      await uploadImageToS3(uploadUrl, file);
      setImages((prev) => [...prev, cdnUrl]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Image upload failed');
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasPayload({ articleSlug, pdfUrl, sourceUrl, images })) {
      setError('Provide at least one payload/target: a non-blank Article slug, PDF URL, or Source URL, or one or more uploaded images.');
      return;
    }
    if (products.length === 0) { setError('Select at least one product.'); return; }

    let meta: unknown = undefined;
    if (metaText.trim()) {
      try { meta = JSON.parse(metaText); } catch { setError('Meta must be valid JSON.'); return; }
    }

    onSubmit({
      ...(initial?.id ? { id: initial.id } : {}),
      slug: effectiveSlug,
      title: title.trim(),
      type,
      summary: summary.trim() || null,
      products,
      process: process.trim() || null,
      materials: fromLines(materials),
      keywords: fromLines(keywords),
      metrics: metrics.filter((m) => m.label.trim() || m.value.trim()),
      articleSlug: articleSlug.trim() || null,
      pdfUrl: pdfUrl.trim() || null,
      images,
      sourceUrl: sourceUrl.trim() || null,
      meta,
      status,
      publishDate: initial?.publishDate ?? null,
    } as EvidenceInput | EvidenceUpdateInput);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      <label className="flex flex-col gap-1"><span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required /></label>

      <label className="flex flex-col gap-1"><span>Slug</span>
        <input value={effectiveSlug} onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }} required /></label>

      <label className="flex flex-col gap-1"><span>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {EVIDENCE_TYPE_ORDER.map((t) => <option key={t} value={t}>{evidenceTypeLabel(t)}</option>)}
        </select>
        {EVIDENCE_TYPE_HELP[type as keyof typeof EVIDENCE_TYPE_HELP] && (
          <small>{EVIDENCE_TYPE_HELP[type as keyof typeof EVIDENCE_TYPE_HELP]}</small>
        )}
      </label>

      <label className="flex flex-col gap-1"><span>Summary</span>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} /></label>

      <fieldset className="flex flex-col gap-1"><legend>Products</legend>
        {productOptions.map((p) => (
          <label key={p.slug} className="flex items-center gap-2">
            <input type="checkbox" aria-label={p.slug} checked={products.includes(p.slug)} onChange={() => toggleProduct(p.slug)} />
            <span>{p.label} <code>({p.slug})</code></span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1"><span>Process</span>
        <input value={process} onChange={(e) => setProcess(e.target.value)} /></label>

      <label className="flex flex-col gap-1"><span>Materials (one per line)</span>
        <textarea value={materials} onChange={(e) => setMaterials(e.target.value)} rows={3} /></label>

      <label className="flex flex-col gap-1"><span>Keywords (one per line)</span>
        <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} /></label>

      <fieldset className="flex flex-col gap-2"><legend>Metrics</legend>
        {metrics.map((m, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label={`metric-label-${i}`} placeholder="label" value={m.label} onChange={(e) => updateMetric(i, 'label', e.target.value)} />
            <input aria-label={`metric-value-${i}`} placeholder="value" value={m.value} onChange={(e) => updateMetric(i, 'value', e.target.value)} />
            <input aria-label={`metric-unit-${i}`} placeholder="unit" value={m.unit} onChange={(e) => updateMetric(i, 'unit', e.target.value)} />
            <button type="button" onClick={() => setMetrics((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
          </div>
        ))}
        <button type="button" onClick={() => setMetrics((prev) => [...prev, { label: '', value: '', unit: '' }])}>Add metric</button>
      </fieldset>

      <label className="flex flex-col gap-1"><span>Article slug (link to an Insights post)</span>
        <select value={articleSlug} onChange={(e) => setArticleSlug(e.target.value)}>
          <option value="">— none —</option>
          {insightSlugs.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </label>

      <label className="flex flex-col gap-1"><span>PDF URL</span>
        <input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} /></label>

      <fieldset className="flex flex-col gap-2"><legend>Images</legend>
        <label className="flex flex-col gap-1"><span>Upload image</span>
          <input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} disabled={uploading} />
        </label>
        <ul>
          {images.map((url, i) => (
            <li key={url} className="flex items-center gap-2">
              <span>{url}</span>
              <button type="button" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>Remove</button>
            </li>
          ))}
        </ul>
      </fieldset>

      <label className="flex flex-col gap-1"><span>Source URL</span>
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} /></label>

      <label className="flex flex-col gap-1"><span>Meta (JSON, optional)</span>
        <textarea value={metaText} onChange={(e) => setMetaText(e.target.value)} rows={4} /></label>

      <label className="flex flex-col gap-1"><span>Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={EVIDENCE_STATUS.DRAFT}>Draft</option>
          <option value={EVIDENCE_STATUS.PUBLISHED}>Published</option>
          <option value={EVIDENCE_STATUS.ARCHIVED}>Archived</option>
        </select>
      </label>

      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={submitting || uploading}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/EvidenceForm.test.tsx`
Expected: PASS.

> Note: the images pipeline reuses the insights content-image uploader (`getContentImageUploadUrl` keys uploads under the shared insights image namespace by slug). This is the spec-sanctioned reuse for Phase 1; a dedicated evidence namespace is a P2 concern.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/EvidenceForm.tsx src/components/admin/EvidenceForm.test.tsx
git commit -m "feat(evidence): EvidenceForm — canonical product multi-select, article select, image uploader"
```

---

## Task 12: Admin list + form pages

**Files:**
- Create: `src/pages/admin/AdminEvidenceListPage.tsx` (+ `.test.tsx`)
- Create: `src/pages/admin/AdminEvidenceFormPage.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Write the failing list test**

```tsx
// src/pages/admin/AdminEvidenceListPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AdminEvidenceListPage } from './AdminEvidenceListPage';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const listAllEvidence = vi.fn();
vi.mock('../../services/evidenceAdminService', () => ({
  listAllEvidence: () => listAllEvidence(),
  deleteEvidence: vi.fn(),
}));
beforeEach(() => listAllEvidence.mockReset());

const rows = [
  { id: 'e-1', title: 'Draft Note', type: EVIDENCE_TYPE.APPLICATION_NOTE, status: EVIDENCE_STATUS.DRAFT, products: ['ald'] },
  { id: 'e-2', title: 'Pub Paper', type: EVIDENCE_TYPE.PUBLICATION, status: EVIDENCE_STATUS.PUBLISHED, products: ['rie-etcher'] },
  { id: 'e-3', title: 'Archived Val', type: EVIDENCE_TYPE.VALIDATION, status: EVIDENCE_STATUS.ARCHIVED, products: ['ald'] },
];

describe('AdminEvidenceListPage', () => {
  it('shows all statuses including draft and archived', async () => {
    listAllEvidence.mockResolvedValueOnce(rows);
    render(<MemoryRouter><AdminEvidenceListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Draft Note')).toBeInTheDocument());
    expect(screen.getByText('Pub Paper')).toBeInTheDocument();
    expect(screen.getByText('Archived Val')).toBeInTheDocument();
  });

  it('filters by status', async () => {
    listAllEvidence.mockResolvedValueOnce(rows);
    render(<MemoryRouter><AdminEvidenceListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Draft Note')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText(/Filter by status/i), { target: { value: EVIDENCE_STATUS.PUBLISHED } });
    expect(screen.queryByText('Draft Note')).not.toBeInTheDocument();
    expect(screen.getByText('Pub Paper')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/AdminEvidenceListPage.test.tsx`
Expected: FAIL — `Cannot find module './AdminEvidenceListPage'`.

- [ ] **Step 3: Write the list page**

```tsx
// src/pages/admin/AdminEvidenceListPage.tsx
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAllEvidence, deleteEvidence } from '../../services/evidenceAdminService';
import { EVIDENCE_STATUS, EVIDENCE_TYPE_ORDER, evidenceTypeLabel } from '../../config/evidence';

interface Row { id: string; title: string; type: string; status: string; products?: (string | null)[] | null; }

export function AdminEvidenceListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try { setRows((await listAllEvidence()) as Row[]); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter((r) => (typeFilter === 'all' || r.type === typeFilter) && (statusFilter === 'all' || r.status === statusFilter)),
    [rows, typeFilter, statusFilter]
  );

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this evidence record?')) return;
    await deleteEvidence(id);
    await load();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Evidence</h1>
        <Link to="/admin/evidence/new" className="rounded bg-sky-600 px-4 py-2 text-white">New evidence</Link>
      </div>
      <div className="mt-4 flex gap-4">
        <label className="flex items-center gap-2"><span>Filter by type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All</option>
            {EVIDENCE_TYPE_ORDER.map((t) => <option key={t} value={t}>{evidenceTypeLabel(t)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2"><span>Filter by status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value={EVIDENCE_STATUS.DRAFT}>Draft</option>
            <option value={EVIDENCE_STATUS.PUBLISHED}>Published</option>
            <option value={EVIDENCE_STATUS.ARCHIVED}>Archived</option>
          </select>
        </label>
      </div>
      {loading ? <p className="mt-6">Loading…</p> : (
        <table className="mt-6 w-full text-left">
          <thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Products</th><th></th></tr></thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-slate-200">
                <td><Link to={`/admin/evidence/${r.id}/edit`}>{r.title}</Link></td>
                <td>{evidenceTypeLabel(r.type)}</td>
                <td>{r.status}</td>
                <td>{(r.products ?? []).filter(Boolean).join(', ')}</td>
                <td><button onClick={() => handleDelete(r.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/admin/AdminEvidenceListPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing form-page test (covers the load-error state)**

```tsx
// src/pages/admin/AdminEvidenceFormPage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AdminEvidenceFormPage } from './AdminEvidenceFormPage';

const getEvidence = vi.fn();
vi.mock('../../services/evidenceAdminService', () => ({
  getEvidence: (id: string) => getEvidence(id),
  createEvidence: vi.fn(),
  updateEvidence: vi.fn(),
}));
// Stub the heavy form so this test focuses on the page's load/error wiring.
vi.mock('../../components/admin/EvidenceForm', () => ({
  EvidenceForm: () => <div data-testid="evidence-form" />,
}));

beforeEach(() => getEvidence.mockReset());

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/evidence/new" element={<AdminEvidenceFormPage />} />
        <Route path="/admin/evidence/:id/edit" element={<AdminEvidenceFormPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminEvidenceFormPage', () => {
  it('shows a load error when fetching the record fails', async () => {
    getEvidence.mockRejectedValueOnce(new Error('not found'));
    renderAt('/admin/evidence/e-1/edit');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/not found/i));
    expect(screen.queryByTestId('evidence-form')).not.toBeInTheDocument();
  });

  it('renders the form for the new route without loading', () => {
    renderAt('/admin/evidence/new');
    expect(screen.getByTestId('evidence-form')).toBeInTheDocument();
    expect(getEvidence).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/AdminEvidenceFormPage.test.tsx`
Expected: FAIL — `Cannot find module './AdminEvidenceFormPage'`.

- [ ] **Step 7: Write the form page (with load-error state)**

```tsx
// src/pages/admin/AdminEvidenceFormPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EvidenceForm, EvidenceFormValue } from '../../components/admin/EvidenceForm';
import { createEvidence, updateEvidence, getEvidence } from '../../services/evidenceAdminService';
import type { EvidenceInput, EvidenceUpdateInput } from '../../services/evidenceAdminService';

export function AdminEvidenceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<EvidenceFormValue | undefined>();
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getEvidence(id)
      .then((data) => setInitial((data ?? undefined) as EvidenceFormValue | undefined))
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load evidence'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(value: EvidenceInput | EvidenceUpdateInput) {
    setSubmitting(true);
    setSaveError(null);
    try {
      if ('id' in value && value.id) await updateEvidence(value as EvidenceUpdateInput);
      else await createEvidence(value as EvidenceInput);
      navigate('/admin/evidence');
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="p-6">Loading…</p>;
  if (loadError) return <div className="p-6"><p role="alert" className="text-red-600">{loadError}</p></div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{id ? 'Edit evidence' : 'New evidence'}</h1>
      {saveError && <p role="alert" className="mt-2 text-red-600">{saveError}</p>}
      <div className="mt-6">
        <EvidenceForm initial={initial} submitting={submitting} onSubmit={handleSubmit} onCancel={() => navigate('/admin/evidence')} />
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/pages/admin/AdminEvidenceFormPage.test.tsx src/pages/admin/AdminEvidenceListPage.test.tsx`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/AdminEvidenceListPage.tsx src/pages/admin/AdminEvidenceListPage.test.tsx src/pages/admin/AdminEvidenceFormPage.tsx src/pages/admin/AdminEvidenceFormPage.test.tsx
git commit -m "feat(evidence): admin list (filters, all statuses) + form page (load-error state)"
```

---

## Task 13: Register admin routes + nav

**Files:**
- Modify: `src/routes/AdminRoutes.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: Add lazy imports + routes**

In `src/routes/AdminRoutes.tsx`, next to the `AdminInsights*` lazy declarations:

```tsx
const AdminEvidenceListPage = lazyWithReload(() => import('../pages/admin/AdminEvidenceListPage').then(m => ({ default: m.AdminEvidenceListPage })));
const AdminEvidenceFormPage = lazyWithReload(() => import('../pages/admin/AdminEvidenceFormPage').then(m => ({ default: m.AdminEvidenceFormPage })));
```

And inside `<Route path="/admin" ...>`, next to the `insights` routes:

```tsx
          <Route path="evidence" element={<AdminEvidenceListPage />} />
          <Route path="evidence/new" element={<AdminEvidenceFormPage />} />
          <Route path="evidence/:id/edit" element={<AdminEvidenceFormPage />} />
```

- [ ] **Step 2: Add the nav item**

In `src/components/admin/AdminLayout.tsx`, next to the Insights entry:

```tsx
  { path: '/admin/evidence', label: 'Evidence', icon: 'verified' },
```

- [ ] **Step 3: Typecheck + full suite**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: full suite green (Evidence tests pass; nothing regressed).

- [ ] **Step 4: Commit**

```bash
git add src/routes/AdminRoutes.tsx src/components/admin/AdminLayout.tsx
git commit -m "feat(evidence): register /admin/evidence routes and nav item"
```

---

## Task 14: Deploy + executable security acceptance

Deploy the backend, then run **executable** checks for the no-leak boundary and least-privilege IAM (not manual confirmation).

**Files:**
- Create: `scripts/verify-evidence-boundary.ts`
- Create: `scripts/verify-evidence-iam.ts`

- [ ] **Step 1: Deploy to the sandbox**

Run: `npx ampx sandbox` (provisions the `Evidence` table, `evidence-api` Lambda, `listPublishedEvidence`). Confirm no CloudFormation errors and that `amplify_outputs.json` is refreshed.

- [ ] **Step 2: Seed one record with a UNIQUE slug via the admin UI**

At `/admin/evidence/new`, create a record with a unique, identifiable slug — e.g. `boundary-test-2026-07-04` — products `['ald']`, a `sourceUrl`, `status = draft`. The unique slug lets the boundary script assert on THIS record's lifecycle independent of any other published Evidence. You will run the script three times, flipping this record's status (`draft` → `published` → `archived`) between runs.

- [ ] **Step 3: Write the public no-leak acceptance script**

```ts
// scripts/verify-evidence-boundary.ts
// Executable acceptance for the no-leak boundary + seed lifecycle. Asserts:
//  (a) the base Evidence model is NOT publicly readable via apiKey;
//  (b) listPublishedEvidence succeeds (errors are a failure, not an empty set)
//      and returns a well-formed array of published-only records;
//  (c) a UNIQUE seed slug is present exactly once when published and absent when
//      draft/archived — independent of any other published Evidence, and immune
//      to a broken resolver that always returns [].
// Usage:
//   EVIDENCE_TEST_SLUG=boundary-test-2026-07-04 EVIDENCE_EXPECT=draft \
//   npx tsx scripts/verify-evidence-boundary.ts
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';
import { EVIDENCE_STATUS } from '../amplify/lib/evidence/status';

Amplify.configure(outputs);
const client = generateClient<Schema>({ authMode: 'apiKey' });

const TEST_SLUG = process.env.EVIDENCE_TEST_SLUG;
const EXPECT = process.env.EVIDENCE_EXPECT; // draft | published | archived
const PRODUCT = process.env.EVIDENCE_TEST_PRODUCT ?? 'ald';
const VALID_EXPECT = new Set(Object.values(EVIDENCE_STATUS));

async function main() {
  if (!TEST_SLUG || !EXPECT || !VALID_EXPECT.has(EXPECT as never)) {
    throw new Error('Set EVIDENCE_TEST_SLUG and EVIDENCE_EXPECT (draft|published|archived).');
  }

  // (a) base-model public read must be DENIED *by authorization* — not merely
  // "errored". A schema/resolver/service error must NOT be mistaken for a denial.
  const baseRead = await client.models.Evidence.list();
  if (!baseRead.errors || baseRead.errors.length === 0) {
    throw new Error('SECURITY FAIL: base Evidence model is publicly readable via apiKey');
  }
  // AppSync surfaces authorization failures with errorType 'Unauthorized'
  // (occasionally 'UnauthorizedException'). Fall back to a message match only if
  // the deployed error shape lacks errorType — confirm against the sandbox's
  // actual response and tighten if needed.
  const isAuthDenial = (e: { errorType?: string; message?: string }) =>
    e.errorType === 'Unauthorized' ||
    e.errorType === 'UnauthorizedException' ||
    /not\s*authorized|unauthorized/i.test(e.message ?? '');
  if (!baseRead.errors.some(isAuthDenial)) {
    throw new Error(`SECURITY FAIL: expected an authorization denial on the base model, got: ${JSON.stringify(baseRead.errors)}`);
  }
  console.log('OK: base model apiKey read denied (authorization):', baseRead.errors.find(isAuthDenial)?.message);

  // (b) custom query must SUCCEED — a null/errored response is a failure, not [].
  const res = await client.queries.listPublishedEvidence({ productSlug: PRODUCT });
  if (res.errors?.length) {
    throw new Error(`SECURITY FAIL: listPublishedEvidence errored: ${res.errors.map((e) => e.message).join(', ')}`);
  }
  const parsed = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
  if (!Array.isArray(parsed)) {
    throw new Error(`SECURITY FAIL: listPublishedEvidence returned a non-array payload: ${JSON.stringify(res.data)}`);
  }
  const items = parsed as { slug: string; status: string }[];

  // every returned record must be published
  const leaked = items.filter((e) => e.status !== EVIDENCE_STATUS.PUBLISHED);
  if (leaked.length) throw new Error(`SECURITY FAIL: ${leaked.length} non-published record(s) returned`);

  // (c) seed-identity lifecycle — independent of other published data
  const mine = items.filter((e) => e.slug === TEST_SLUG);
  if (EXPECT === EVIDENCE_STATUS.PUBLISHED) {
    if (mine.length !== 1) throw new Error(`FAIL: expected seed "${TEST_SLUG}" exactly once while published, saw ${mine.length}`);
  } else {
    if (mine.length !== 0) throw new Error(`FAIL: seed "${TEST_SLUG}" must be absent while ${EXPECT}, saw ${mine.length}`);
  }
  console.log(`OK: phase=${EXPECT}, seed "${TEST_SLUG}" occurrences=${mine.length}, all ${items.length} returned record(s) published.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run it three times, flipping the seed record's status in the admin UI between runs so the env `EVIDENCE_EXPECT` matches the record's actual status:

```bash
# record is draft → seed must be ABSENT
EVIDENCE_TEST_SLUG=boundary-test-2026-07-04 EVIDENCE_EXPECT=draft     npx tsx scripts/verify-evidence-boundary.ts
# flip to published → seed must appear EXACTLY ONCE
EVIDENCE_TEST_SLUG=boundary-test-2026-07-04 EVIDENCE_EXPECT=published npx tsx scripts/verify-evidence-boundary.ts
# flip to archived → seed must be ABSENT again
EVIDENCE_TEST_SLUG=boundary-test-2026-07-04 EVIDENCE_EXPECT=archived  npx tsx scripts/verify-evidence-boundary.ts
```

Expected: each run prints "OK: base model apiKey read denied" and an "OK: phase=… occurrences=…" line matching the phase (0 while draft/archived, 1 while published). Also reload `/products/ald` while published to confirm the Evidence section appears, and while archived to confirm it disappears.

- [ ] **Step 3b: Add the AWS SDK clients the IAM script needs as direct devDependencies**

`@aws-sdk/client-dynamodb` is already a direct dependency, but `@aws-sdk/client-iam` and `@aws-sdk/client-lambda` are only present transitively today — a clean install must not rely on that.

Run: `npm install --save-dev @aws-sdk/client-iam @aws-sdk/client-lambda`
Then commit the manifest + lockfile so the script is reproducible:

```bash
git add package.json package-lock.json
git commit -m "build(evidence): add @aws-sdk/client-iam + client-lambda devDependencies for IAM verifier"
```

- [ ] **Step 4: Write the least-privilege IAM acceptance script**

```ts
// scripts/verify-evidence-iam.ts
// Executable least-privilege acceptance. Proves — across BOTH inline and
// attached managed policies (paginated) — that the evidence-api Lambda role's
// DynamoDB Allow set is non-empty, its action set is EXACTLY {dynamodb:Scan},
// and its only resource is EXACTLY the deployed Evidence base-table ARN
// (rejecting Query, '*', index ARNs, and any other table).
// Usage: AWS creds for the sandbox account in env, then:
//   npx tsx scripts/verify-evidence-iam.ts
import { LambdaClient, ListFunctionsCommand, GetFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
import {
  IAMClient, ListRolePoliciesCommand, GetRolePolicyCommand,
  ListAttachedRolePoliciesCommand, GetPolicyCommand, GetPolicyVersionCommand,
} from '@aws-sdk/client-iam';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';

const lambda = new LambdaClient({});
const iam = new IAMClient({});
const ddb = new DynamoDBClient({});

const EXPECTED_ACTIONS = new Set(['dynamodb:Scan']);
const toArray = <T>(v: T | T[] | undefined): T[] => (v == null ? [] : Array.isArray(v) ? v : [v]);

interface Stmt { Effect: string; Action?: string | string[]; NotAction?: string | string[]; Resource?: string | string[]; NotResource?: string | string[]; }

// Resolve the exact Lambda. Never "first substring match" — multiple sandboxes
// or stale stacks can each contain an evidence-api function. Prefer an explicit
// EVIDENCE_FN_NAME env var; otherwise require EXACTLY ONE candidate and fail
// (listing them) on zero or multiple.
async function findEvidenceFunctionName(): Promise<string> {
  // An explicit name is authoritative — use it directly. main() then calls
  // GetFunctionConfiguration on it, which throws ResourceNotFound if it is wrong.
  // Do NOT gate it behind the fuzzy substring enumeration.
  const explicit = process.env.EVIDENCE_FN_NAME;
  if (explicit) return explicit;

  const candidates: string[] = [];
  let Marker: string | undefined;
  do {
    const res = await lambda.send(new ListFunctionsCommand({ Marker }));
    for (const f of res.Functions ?? []) if (f.FunctionName?.includes('evidence-api')) candidates.push(f.FunctionName);
    Marker = res.NextMarker;
  } while (Marker);

  if (candidates.length === 0) throw new Error('No evidence-api Lambda found — is this sandbox deployed?');
  if (candidates.length > 1) {
    throw new Error(`Ambiguous: ${candidates.length} evidence-api candidates found — set EVIDENCE_FN_NAME to disambiguate:\n- ${candidates.join('\n- ')}`);
  }
  return candidates[0];
}

async function collectStatements(roleName: string): Promise<Stmt[]> {
  const out: Stmt[] = [];
  // Inline policies (paginated)
  let inlineMarker: string | undefined;
  do {
    const res = await iam.send(new ListRolePoliciesCommand({ RoleName: roleName, Marker: inlineMarker }));
    for (const name of res.PolicyNames ?? []) {
      const { PolicyDocument } = await iam.send(new GetRolePolicyCommand({ RoleName: roleName, PolicyName: name }));
      out.push(...toArray<Stmt>(JSON.parse(decodeURIComponent(PolicyDocument!)).Statement));
    }
    inlineMarker = res.Marker;
  } while (inlineMarker);
  // Attached managed policies (paginated) -> default version doc
  let attachedMarker: string | undefined;
  do {
    const res = await iam.send(new ListAttachedRolePoliciesCommand({ RoleName: roleName, Marker: attachedMarker }));
    for (const p of res.AttachedPolicies ?? []) {
      const pol = await iam.send(new GetPolicyCommand({ PolicyArn: p.PolicyArn }));
      const ver = await iam.send(new GetPolicyVersionCommand({ PolicyArn: p.PolicyArn, VersionId: pol.Policy!.DefaultVersionId }));
      out.push(...toArray<Stmt>(JSON.parse(decodeURIComponent(ver.PolicyVersion!.Document!)).Statement));
    }
    attachedMarker = res.Marker;
  } while (attachedMarker);
  return out;
}

async function main() {
  const fnName = await findEvidenceFunctionName();
  const cfg = await lambda.send(new GetFunctionConfigurationCommand({ FunctionName: fnName }));
  const roleName = cfg.Role!.split('/').pop()!;
  const tableName = cfg.Environment?.Variables?.EVIDENCE_TABLE;
  if (!tableName) throw new Error('EVIDENCE_TABLE env var missing on the Lambda');
  const described = await ddb.send(new DescribeTableCommand({ TableName: tableName }));
  const tableArn = described.Table!.TableArn!;

  const statements = await collectStatements(roleName);
  const violations: string[] = [];
  const ddbActions = new Set<string>();
  const ddbResources = new Set<string>();
  let ddbAllowCount = 0;

  for (const st of statements) {
    if (st.Effect !== 'Allow') continue;
    if (st.NotAction || st.NotResource) { violations.push('Allow statement uses NotAction/NotResource (unbounded)'); continue; }
    const actions = toArray(st.Action);
    const resources = toArray(st.Resource);
    const touchesDdb = actions.some((a) => a === '*' || a.toLowerCase().startsWith('dynamodb:'));
    if (!touchesDdb) continue;
    ddbAllowCount++;
    // A DynamoDB Allow with no Resource is unbounded — reject it explicitly
    // (otherwise the resource loop below is skipped and it slips through).
    if (resources.length === 0) violations.push('DynamoDB Allow statement has no Resource (unbounded)');
    for (const a of actions) {
      if (a === '*' || a.toLowerCase() === 'dynamodb:*') { violations.push(`wildcard DynamoDB action: ${a}`); continue; }
      if (a.toLowerCase().startsWith('dynamodb:')) ddbActions.add(a);
    }
    for (const r of resources) {
      ddbResources.add(r);
      if (r === '*') violations.push('wildcard resource "*" on a DynamoDB Allow');
      else if (r.includes('/index/')) violations.push(`index ARN granted (base-table only expected): ${r}`);
      else if (r !== tableArn) violations.push(`unexpected resource (want exactly ${tableArn}): ${r}`);
    }
  }

  if (ddbAllowCount === 0) violations.push('no DynamoDB Allow statement found (empty permission set)');

  const actionList = [...ddbActions].sort();
  const expectedActions = [...EXPECTED_ACTIONS].sort();
  if (JSON.stringify(actionList) !== JSON.stringify(expectedActions)) {
    violations.push(`DynamoDB action set is ${JSON.stringify(actionList)}, expected exactly ${JSON.stringify(expectedActions)}`);
  }

  // Aggregate closure: the set of ALL granted DynamoDB resources must be exactly
  // {tableArn} — non-empty, no wildcard, no index, no other table.
  const resourceList = [...ddbResources].sort();
  if (JSON.stringify(resourceList) !== JSON.stringify([tableArn])) {
    violations.push(`DynamoDB resource set is ${JSON.stringify(resourceList)}, expected exactly ${JSON.stringify([tableArn])}`);
  }

  if (violations.length) throw new Error('IAM FAIL:\n- ' + violations.join('\n- '));
  console.log(`OK: evidence-api DynamoDB permission is exactly {dynamodb:Scan} on ${tableArn} (inline + managed policies checked).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

Run: `npx tsx scripts/verify-evidence-iam.ts`
Expected: prints "OK: evidence-api DynamoDB permission is exactly {dynamodb:Scan} on arn:aws:dynamodb:…:table/Evidence-… (inline + managed policies checked)." A non-empty DynamoDB Allow set, action set exactly `{dynamodb:Scan}`, and resource exactly the deployed base-table ARN are all required to pass; `Query`, `*`, index ARNs, other tables, or an empty set each fail loudly. Non-DynamoDB permissions (CloudWatch Logs) are intentionally ignored.

- [ ] **Step 5: Commit (explicit files only — no `git add -A`)**

```bash
git add scripts/verify-evidence-boundary.ts scripts/verify-evidence-iam.ts
git commit -m "test(evidence): executable no-leak + least-privilege IAM acceptance scripts"
```

- [ ] **Step 6: If the smoke surfaces fixes, stage only the touched files**

```bash
# stage the specific files you changed, e.g.:
git add amplify/functions/evidence-api/handler.ts amplify/backend.ts
git commit -m "fix(evidence): address issues found during sandbox smoke"
```

---

## Self-Review (completed during authoring)

**Spec coverage** — every spec section maps to a task: Data model → Task 4. Public Read Boundary (authenticated-only base + Lambda) → Tasks 4–6, 14. Pagination contract → Tasks 5, 14. Lambda least-privilege IAM (base ARN only) → Tasks 6, 14. Write Authorization Premise → Task 4. Shared status module → Tasks 1–2, 4, 5. Constants/labels/help → Task 2. `status` semantics → Tasks 2, 8, 12. Product module (0→hidden, ≥1→counts, display-only) → Tasks 9–10. Admin (fields, canonical product multi-select, article select, real uploader, slug best-effort via GSI, ≥1-payload incl. empty-array, publishDate auto-set, archived visible/never public) → Tasks 8, 11, 12, 14. Testing (server-boundary security executable, pagination ≥2 pages, counting-only helper, admin validations, placement) → Tasks 2, 5, 8, 10, 11, 14.

**Placeholder scan** — none.

**Type consistency** — `EVIDENCE_STATUS`/`EVIDENCE_TYPE` from the shared module re-exported via `src/config/evidence.ts`, used everywhere; `EvidenceInput`/`EvidenceUpdateInput` (Task 8) consumed by Tasks 11–12; `fetchPublishedEvidence` (Task 7) consumed by Task 9; `productOptions` (Task 3) consumed by Task 11; `listPublishedEvidence` query name identical across Tasks 5/6/7/14; `listEvidenceBySlug`/`listAllEvidence` names consistent across Task 8 and its tests.
