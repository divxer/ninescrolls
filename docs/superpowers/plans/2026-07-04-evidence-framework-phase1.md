# Evidence Framework — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a structured Evidence proof-layer for Phase 1 — a new `Evidence` data model, a published-only Lambda read boundary, admin CRUD, and a conditional product-page "Evidence" summary module that stays invisible until real content exists.

**Architecture:** `Evidence` is an independent Amplify Gen 2 model (authenticated-only — no public read). Anonymous reads flow exclusively through a Lambda-backed custom query `listPublishedEvidence` that filters `status='published'` server-side and paginates to completeness. The product-page module reads through that query and renders grouped-by-type counts (display-only) or nothing at zero. Admin authors Evidence through a form/list mirroring the existing Insights admin.

**Tech Stack:** Amplify Gen 2 (`a.model` / `a.query` / `a.handler.function`), AWS SDK v3 `@aws-sdk/lib-dynamodb` (DocumentClient + `ScanCommand`), React + TypeScript, Vitest, Tailwind, React Router.

**Spec:** `docs/superpowers/specs/2026-07-04-evidence-framework-design.md` (read it first — all normative constraints live there).

---

## File Structure

**Backend (Amplify):**
- `amplify/data/resource.ts` — *modify*: add `Evidence` model (authenticated-only) + `listPublishedEvidence` custom query.
- `amplify/functions/evidence-api/resource.ts` — *create*: `defineFunction` for the read Lambda.
- `amplify/functions/evidence-api/handler.ts` — *create*: paginated, published-only, server-side-filtered Scan resolver.
- `amplify/functions/evidence-api/handler.test.ts` — *create*: published-only, ≥2-page pagination, productSlug filter.
- `amplify/functions/evidence-api/package.json` — *create*: matches the sibling functions' minimal package.json.
- `amplify/backend.ts` — *modify*: register `evidenceApi`; grant exactly `dynamodb:Query`/`Scan` on the Evidence table ARN; inject `EVIDENCE_TABLE`.

**Shared constants + pure helpers (fully unit-testable, no I/O):**
- `src/config/evidence.ts` — *create*: `EVIDENCE_STATUS`, `EVIDENCE_TYPE`, ordered type list, type→label map, `PRODUCT_OPTIONS`, `hasPayload()`, `countEvidenceByType()`.
- `src/config/evidence.test.ts` — *create*.

**Frontend services:**
- `src/services/evidenceService.ts` — *create*: public `listPublishedEvidence` wrapper (apiKey).
- `src/services/evidenceService.test.ts` — *create*.
- `src/services/evidenceAdminService.ts` — *create*: CRUD (userPool) + best-effort slug check + payload validation.
- `src/services/evidenceAdminService.test.ts` — *create*.

**Product-page module:**
- `src/components/products/ProductEvidence.tsx` — *create*: conditional grouped-count module.
- `src/components/products/ProductEvidence.test.tsx` — *create*.
- `src/components/products/ProductDetailPage.tsx` — *modify*: insert `<ProductEvidence productSlug={config.slug} />` after the applications section.

**Admin:**
- `src/components/admin/EvidenceForm.tsx` — *create*: controlled form for all Evidence fields.
- `src/pages/admin/AdminEvidenceListPage.tsx` — *create*: list + type/status filters.
- `src/pages/admin/AdminEvidenceFormPage.tsx` — *create*: new/edit page wrapper.
- `src/routes/AdminRoutes.tsx` — *modify*: register three `/admin/evidence*` routes.
- `src/components/admin/AdminLayout.tsx` — *modify*: add an "Evidence" nav item.

---

## Task 1: Shared constants + pure helpers

Pure, dependency-free functions and constants. TDD-first because everything downstream imports them.

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

describe('evidence constants', () => {
  it('exposes the three statuses', () => {
    expect(EVIDENCE_STATUS).toEqual({ DRAFT: 'draft', PUBLISHED: 'published', ARCHIVED: 'archived' });
  });

  it('maps types to fixed public labels (validation is "Process Validation")', () => {
    expect(evidenceTypeLabel(EVIDENCE_TYPE.VALIDATION)).toBe('Process Validation');
    expect(evidenceTypeLabel(EVIDENCE_TYPE.PUBLICATION)).toBe('Published Research');
    expect(evidenceTypeLabel(EVIDENCE_TYPE.APPLICATION_NOTE)).toBe('Application Note');
  });
});

describe('hasPayload', () => {
  it('is false when every target is empty/blank/whitespace and images is empty', () => {
    expect(hasPayload({ articleSlug: '', pdfUrl: '  ', sourceUrl: undefined, images: [] })).toBe(false);
    expect(hasPayload({ images: null })).toBe(false);
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
    // canonical order follows EVIDENCE_TYPE_ORDER, not insertion order
    expect(countEvidenceByType(records).map((g) => g.type))
      .toEqual([...EVIDENCE_TYPE_ORDER].filter((t) =>
        [EVIDENCE_TYPE.APPLICATION_NOTE, EVIDENCE_TYPE.PUBLICATION, EVIDENCE_TYPE.VALIDATION].includes(t)));
  });

  it('returns an empty array for no records', () => {
    expect(countEvidenceByType([])).toEqual([]);
  });

  it('ignores unknown types defensively', () => {
    expect(countEvidenceByType([{ type: 'bogus' }])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config/evidence.test.ts`
Expected: FAIL — `Cannot find module './evidence'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/config/evidence.ts

/** Publish state. Public reads only ever see PUBLISHED (enforced server-side). */
export const EVIDENCE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUS)[keyof typeof EVIDENCE_STATUS];

/** Evidence type discriminator. `publication` is the Oxford-citation analogue. */
export const EVIDENCE_TYPE = {
  APPLICATION_NOTE: 'application_note',
  PROCESS_NOTE: 'process_note',
  TECHNICAL_NOTE: 'technical_note',
  PUBLICATION: 'publication',
  CASE_STUDY: 'case_study',
  VALIDATION: 'validation',
} as const;
export type EvidenceType = (typeof EVIDENCE_TYPE)[keyof typeof EVIDENCE_TYPE];

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

/**
 * Canonical product slugs for the admin multi-select (constraint 5). These MUST
 * match the product route slugs in src/routes/index.tsx. Keep in sync when a
 * product is added/removed.
 */
export const PRODUCT_OPTIONS: { slug: string; label: string }[] = [
  { slug: 'ald', label: 'ALD System' },
  { slug: 'pecvd', label: 'PECVD System' },
  { slug: 'hdp-cvd', label: 'HDP-CVD System' },
  { slug: 'rie-etcher', label: 'RIE Etcher' },
  { slug: 'compact-rie', label: 'Compact RIE' },
  { slug: 'icp-etcher', label: 'ICP Etcher' },
  { slug: 'ibe-ribe', label: 'IBE / RIBE System' },
  { slug: 'sputter', label: 'Sputter System' },
  { slug: 'e-beam-evaporator', label: 'E-Beam Evaporator' },
  { slug: 'striper', label: 'Striper System' },
  { slug: 'coater-developer', label: 'Coater / Developer' },
];

type PayloadInput = {
  articleSlug?: string | null;
  pdfUrl?: string | null;
  sourceUrl?: string | null;
  images?: string[] | null;
};

/**
 * Constraint 4: a record must have ≥1 non-empty payload/target. Strings must be
 * non-blank; images must be a non-empty array (an empty array does NOT count).
 */
export function hasPayload(input: PayloadInput): boolean {
  const nonBlank = (s?: string | null) => typeof s === 'string' && s.trim().length > 0;
  const hasImages = Array.isArray(input.images) && input.images.length > 0;
  return nonBlank(input.articleSlug) || nonBlank(input.pdfUrl) || nonBlank(input.sourceUrl) || hasImages;
}

export type EvidenceTypeCount = { type: EvidenceType; label: string; count: number };

/**
 * Count records by type in canonical order, omitting zero-count and unknown
 * types. This counts only — it does NOT gate status (that is enforced upstream
 * by listPublishedEvidence).
 */
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
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/config/evidence.ts src/config/evidence.test.ts
git commit -m "feat(evidence): shared status/type constants, labels, payload + count helpers"
```

---

## Task 2: `Evidence` model (authenticated-only)

Add the model to the schema. No public read — that is deliberate (Public Read Boundary).

**Files:**
- Modify: `amplify/data/resource.ts` (add the model near the other models, e.g. after `InsightsPost`'s block around line 90)

- [ ] **Step 1: Add the model**

Insert this model definition into the `a.schema({ ... })` object (place it right after the `InsightsPost` model's closing `,`):

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
      status: a.string().default('draft'),
    })
    .authorization((allow) => [
      // Authenticated identities only. NOT public read — anonymous reads go
      // through the listPublishedEvidence custom query (Public Read Boundary).
      // See spec "Write Authorization Premise": this is not admin-only authz.
      allow.authenticated(),
    ])
    .secondaryIndexes((index) => [index('slug')]),
```

- [ ] **Step 2: Typecheck the schema**

Run: `npx tsc -p amplify/tsconfig.json --noEmit` (if that config exists) or `npx tsc --noEmit`
Expected: no new type errors from the added model.

- [ ] **Step 3: Commit**

```bash
git add amplify/data/resource.ts
git commit -m "feat(evidence): add authenticated-only Evidence model with slug index"
```

---

## Task 3: `evidence-api` Lambda — published-only, paginated, server-filtered

The single public read path. Scans the base table with a `status = published` filter, optional `productSlug` membership filter, and drains `LastEvaluatedKey`.

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

- [ ] **Step 2: Create the package.json**

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
  handler({ arguments: args } as never, {} as never, () => {}) as Promise<unknown[]>;

beforeEach(() => {
  process.env.EVIDENCE_TABLE = 'Evidence-test';
  mockScan.mockReset();
  mockSend.mockClear();
});

describe('evidence-api listPublishedEvidence', () => {
  it('sends a Scan with a published-only FilterExpression', async () => {
    mockScan.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await invoke();
    const sent = mockSend.mock.calls[0][0];
    expect(sent.TableName).toBe('Evidence-test');
    expect(sent.FilterExpression).toContain('#status = :published');
    expect(sent.ExpressionAttributeValues[':published']).toBe('published');
  });

  it('adds a products membership filter when productSlug is given', async () => {
    mockScan.mockResolvedValueOnce({ Items: [], LastEvaluatedKey: undefined });
    await invoke({ productSlug: 'ald' });
    const sent = mockSend.mock.calls[0][0];
    expect(sent.FilterExpression).toContain('contains(products, :slug)');
    expect(sent.ExpressionAttributeValues[':slug']).toBe('ald');
  });

  it('drains LastEvaluatedKey across pages and accumulates published items', async () => {
    mockScan
      .mockResolvedValueOnce({ Items: [{ id: '1', type: 'application_note', status: 'published' }], LastEvaluatedKey: { id: '1' } })
      .mockResolvedValueOnce({ Items: [{ id: '2', type: 'publication', status: 'published' }], LastEvaluatedKey: undefined });
    const result = await invoke();
    expect(mockScan).toHaveBeenCalledTimes(2);
    // second-page record IS included (proves pagination completeness)
    expect(result.map((r: any) => r.id)).toEqual(['1', '2']);
    // second Scan carried the ExclusiveStartKey from page 1
    expect(mockSend.mock.calls[1][0].ExclusiveStartKey).toEqual({ id: '1' });
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

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Kept in the Lambda (not imported from src/) to avoid bundling frontend code.
const PUBLISHED = 'published';

interface EvidenceApiEvent {
  arguments?: { productSlug?: string | null };
}

/**
 * listPublishedEvidence: the ONLY public read path for Evidence.
 * - status = 'published' is enforced here, server-side.
 * - optional productSlug membership filter is applied server-side.
 * - paginates to completeness (drains LastEvaluatedKey) so counts are never
 *   silently truncated by DynamoDB's 1 MB page limit.
 */
export const handler = async (event: EvidenceApiEvent): Promise<unknown[]> => {
  const tableName = process.env.EVIDENCE_TABLE;
  if (!tableName) throw new Error('EVIDENCE_TABLE env var is not set');

  const productSlug = event.arguments?.productSlug?.trim();

  const filters = ['#status = :published'];
  const values: Record<string, unknown> = { ':published': PUBLISHED };
  const names: Record<string, string> = { '#status': 'status' };
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
        ExpressionAttributeNames: names,
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
Expected: PASS (all three cases, including the 2-page pagination assertion).

- [ ] **Step 7: Commit**

```bash
git add amplify/functions/evidence-api/
git commit -m "feat(evidence): evidence-api Lambda — published-only, paginated, server-filtered read"
```

---

## Task 4: Wire the custom query + IAM + env

Expose the Lambda as `listPublishedEvidence` (apiKey) and grant it least-privilege table access.

**Files:**
- Modify: `amplify/data/resource.ts` (import + query definition)
- Modify: `amplify/backend.ts` (register + grant + env)

- [ ] **Step 1: Import the function in the schema file**

At the top of `amplify/data/resource.ts`, alongside the other function imports (after line 6):

```ts
import { evidenceApi } from '../functions/evidence-api/resource';
```

- [ ] **Step 2: Add the custom query**

Add to the `a.schema({ ... })` object, in the Queries section (near `listOrders`, ~line 793):

```ts
  listPublishedEvidence: a
    .query()
    .arguments({ productSlug: a.string() })
    .returns(a.ref('Evidence').array().required())
    .handler(a.handler.function(evidenceApi))
    .authorization((allow) => [allow.publicApiKey()]),
```

- [ ] **Step 3: Register the function in defineBackend**

In `amplify/backend.ts`, add `evidenceApi` to the imports (near line 15) and to the `defineBackend({ ... })` object (near line 89, where `orderApi` is listed):

```ts
// top imports
import { evidenceApi } from './functions/evidence-api/resource';

// inside defineBackend({ ... })
  evidenceApi,
```

- [ ] **Step 4: Grant least-privilege table access + inject env**

Append this block in `amplify/backend.ts` after the existing `backend.data.resources.tables[...]` grants (e.g. after line 220), following the explicit-policy pattern already used there:

```ts
// Evidence read path: the evidence-api Lambda gets EXACTLY dynamodb:Query and
// dynamodb:Scan on the Evidence base table (no writes, no other tables, no
// index ARNs — the handler scans the base table). This is the no-leak boundary.
const evidenceTable = backend.data.resources.tables['Evidence'];
backend.evidenceApi.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    actions: ['dynamodb:Query', 'dynamodb:Scan'],
    resources: [evidenceTable.tableArn],
  })
);
backend.evidenceApi.addEnvironment('EVIDENCE_TABLE', evidenceTable.tableName);
```

> Note: `PolicyStatement` is already imported in `backend.ts` (used by the crm-api grant). If a fresh file, import from `aws-cdk-lib/aws-iam`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors. (A full `npx ampx sandbox` deploy is done during execution review, not in this step.)

- [ ] **Step 6: Commit**

```bash
git add amplify/data/resource.ts amplify/backend.ts
git commit -m "feat(evidence): wire listPublishedEvidence query with Query/Scan-only IAM + EVIDENCE_TABLE env"
```

---

## Task 5: Public `evidenceService` (apiKey read wrapper)

Thin wrapper the product module calls. Uses `apiKey` auth (public), tolerates typed-array or JSON-string payloads (matching the logistics service defensive pattern).

**Files:**
- Create: `src/services/evidenceService.ts`
- Test: `src/services/evidenceService.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/services/evidenceService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queries = { listPublishedEvidence: vi.fn() };
vi.mock('./amplifyClient', () => ({
  getAmplifyDataClient: () => ({ queries }),
}));

import { fetchPublishedEvidence } from './evidenceService';

beforeEach(() => queries.listPublishedEvidence.mockReset());

describe('fetchPublishedEvidence', () => {
  it('calls the query with productSlug under apiKey auth and returns the array', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({
      data: [{ id: '1', type: 'application_note' }],
      errors: null,
    });
    const res = await fetchPublishedEvidence('ald');
    expect(queries.listPublishedEvidence).toHaveBeenCalledWith({ productSlug: 'ald' }, { authMode: 'apiKey' });
    expect(res).toEqual([{ id: '1', type: 'application_note' }]);
  });

  it('unwraps a JSON-string payload', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({
      data: JSON.stringify([{ id: '2', type: 'publication' }]),
      errors: null,
    });
    expect(await fetchPublishedEvidence('rie-etcher')).toEqual([{ id: '2', type: 'publication' }]);
  });

  it('returns [] on errors instead of throwing (public page must not crash)', async () => {
    queries.listPublishedEvidence.mockResolvedValueOnce({ data: null, errors: [{ message: 'boom' }] });
    expect(await fetchPublishedEvidence('ald')).toEqual([]);
  });

  it('returns [] when data is null', async () => {
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

/**
 * Public read of published Evidence for a product. Never throws — a failed
 * fetch renders the (hidden) empty state rather than crashing the product page.
 */
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

## Task 6: `evidenceAdminService` (CRUD + slug check + payload validation)

Admin writes under `userPool` auth. Enforces best-effort slug uniqueness and the ≥1-payload rule; auto-sets `publishDate` on first transition to published.

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
};
vi.mock('./amplifyClient', () => ({
  getAmplifyDataClient: () => ({ models: { Evidence: model } }),
}));

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
    model.list.mockResolvedValueOnce({ data: [] });
    await expect(
      createEvidence({ ...base, sourceUrl: '', articleSlug: '', pdfUrl: '', images: [] })
    ).rejects.toThrow(/payload/i);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('rejects a duplicate slug (best-effort check)', async () => {
    model.list.mockResolvedValueOnce({ data: [{ id: 'existing', slug: 'si-deep-etch' }] });
    await expect(createEvidence(base)).rejects.toThrow(/slug/i);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('creates under userPool auth when slug is free and payload exists', async () => {
    model.list.mockResolvedValueOnce({ data: [] });
    model.create.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await createEvidence(base);
    expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'si-deep-etch' }), { authMode: 'userPool' });
  });

  it('auto-sets publishDate when created directly as published', async () => {
    model.list.mockResolvedValueOnce({ data: [] });
    model.create.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await createEvidence({ ...base, status: EVIDENCE_STATUS.PUBLISHED });
    const arg = model.create.mock.calls[0][0];
    expect(arg.publishDate).toBeTruthy();
  });
});

describe('updateEvidence', () => {
  it('sets publishDate on first transition to published', async () => {
    model.update.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await updateEvidence({ ...base, id: 'e-1', status: EVIDENCE_STATUS.PUBLISHED, publishDate: null });
    expect(model.update.mock.calls[0][0].publishDate).toBeTruthy();
  });

  it('does not overwrite an existing publishDate', async () => {
    model.update.mockResolvedValueOnce({ data: { id: 'e-1' }, errors: null });
    await updateEvidence({ ...base, id: 'e-1', status: EVIDENCE_STATUS.PUBLISHED, publishDate: '2026-01-01' });
    expect(model.update.mock.calls[0][0].publishDate).toBe('2026-01-01');
  });
});

describe('listAllEvidence', () => {
  it('lists under userPool auth (admin sees all statuses)', async () => {
    model.list.mockResolvedValueOnce({ data: [{ id: 'e-1' }], errors: null });
    const res = await listAllEvidence();
    expect(model.list).toHaveBeenCalledWith({ authMode: 'userPool' });
    expect(res).toEqual([{ id: 'e-1' }]);
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

/** Best-effort duplicate-slug guard (not atomic — see spec constraint 1). */
async function assertSlugFree(slug: string, ignoreId?: string) {
  const { data } = await client().models.Evidence.list({
    filter: { slug: { eq: slug } },
    authMode: 'userPool',
  });
  const clash = (data ?? []).some((r: { id: string }) => r.id !== ignoreId);
  if (clash) throw new Error(`Evidence slug "${slug}" already exists — choose a unique slug.`);
}

/** Stamp publishDate when publishing for the first time. */
function withPublishDate<T extends { status: string; publishDate?: string | null }>(input: T): T {
  if (input.status === EVIDENCE_STATUS.PUBLISHED && !input.publishDate) {
    return { ...input, publishDate: new Date().toISOString() };
  }
  return input;
}

export async function createEvidence(input: EvidenceInput) {
  assertPayload(input);
  await assertSlugFree(input.slug);
  const { data, errors } = await client().models.Evidence.create(withPublishDate(input), {
    authMode: 'userPool',
  });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateEvidence(input: EvidenceUpdateInput) {
  assertPayload(input);
  await assertSlugFree(input.slug, input.id);
  const { data, errors } = await client().models.Evidence.update(withPublishDate(input), {
    authMode: 'userPool',
  });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function deleteEvidence(id: string) {
  const { errors } = await client().models.Evidence.delete({ id }, { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
}

export async function listAllEvidence() {
  const { data, errors } = await client().models.Evidence.list({ authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data ?? [];
}

export async function getEvidence(id: string) {
  const { data, errors } = await client().models.Evidence.get({ id }, { authMode: 'userPool' });
  if (errors) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}
```

> Note: the duplicate-slug test stubs `model.list` to resolve once for `assertSlugFree`; the create-success cases provide that `list` resolution before the `create` resolution — keep that ordering when reading the test.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/evidenceAdminService.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/evidenceAdminService.ts src/services/evidenceAdminService.test.ts
git commit -m "feat(evidence): evidenceAdminService CRUD with slug guard, payload rule, publishDate stamping"
```

---

## Task 7: `ProductEvidence` module (conditional, display-only)

Reads via `fetchPublishedEvidence`, renders grouped counts or nothing.

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

  it('renders nothing on fetch failure (service returns [])', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([]);
    const { container } = render(<ProductEvidence productSlug="rie-etcher" />);
    await waitFor(() => expect(fetchPublishedEvidence).toHaveBeenCalled());
    expect(container.textContent).toBe('');
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

/**
 * Phase 1 product-page Evidence module. Single job: signal "this product has
 * verifiable evidence" via grouped-by-type counts. Display-only — no links, no
 * expand. Renders nothing when the product has no published evidence, so the
 * section is invisible until real content exists.
 *
 * Pluralization is naive-but-correct for the fixed labels: appending "s" to
 * "Application Note"/"Technical Note"/"Process Note"/"Case Study"→"Case Studys"
 * would be wrong, so we special-case with an explicit plural map.
 */
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

export function ProductEvidence({ productSlug }: ProductEvidenceProps) {
  const [groups, setGroups] = useState<EvidenceTypeCount[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchPublishedEvidence(productSlug).then((records) => {
      if (active) setGroups(countEvidenceByType(records));
    });
    return () => {
      active = false;
    };
  }, [productSlug]);

  if (!groups || groups.length === 0) return null;

  return (
    <section className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
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
Expected: PASS. (Note the test's "3 Application Notes", "1 Published Research", "2 Process Validation" all exercise the plural map.)

- [ ] **Step 5: Commit**

```bash
git add src/components/products/ProductEvidence.tsx src/components/products/ProductEvidence.test.tsx
git commit -m "feat(evidence): conditional display-only ProductEvidence summary module"
```

---

## Task 8: Insert the module into the product template

One insertion — the shared `ProductDetailPage` template — placed right after the applications ("capabilities") section.

**Files:**
- Modify: `src/components/products/ProductDetailPage.tsx`

- [ ] **Step 1: Add the import**

Near the other component imports at the top of `ProductDetailPage.tsx`:

```tsx
import { ProductEvidence } from './ProductEvidence';
```

- [ ] **Step 2: Insert the module after the applications section**

Find the applications section's closing `</section>` (currently at line 274, immediately before `{config.gallery && (`) and insert the module between them:

```tsx
        </section>

        <ProductEvidence productSlug={config.slug} />

        {config.gallery && (
```

- [ ] **Step 3: Verify the existing template test still passes**

Run: `npx vitest run src/components/products/ProductDetailPage.test.tsx --exclude '**/.claude/**'`
Expected: PASS — the module renders `null` in tests (no evidence data / mocked service returns nothing), so existing assertions are unaffected.

> If `ProductDetailPage.test.tsx` renders without mocking `evidenceService`, the real `fetchPublishedEvidence` runs and swallows its error → `[]` → the module renders `null`. No test change needed. If it produces a console warning, add `vi.mock('../../services/evidenceService', () => ({ fetchPublishedEvidence: () => Promise.resolve([]) }))` to that test file.

- [ ] **Step 4: Commit**

```bash
git add src/components/products/ProductDetailPage.tsx
git commit -m "feat(evidence): render ProductEvidence after the applications section in the product template"
```

---

## Task 9: `EvidenceForm` (controlled admin form)

All fields, controlled inputs, product multi-select from `PRODUCT_OPTIONS`, client-side payload guard mirroring the service.

**Files:**
- Create: `src/components/admin/EvidenceForm.tsx`
- Test: `src/components/admin/EvidenceForm.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/admin/EvidenceForm.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EvidenceForm } from './EvidenceForm';
import { EVIDENCE_TYPE, EVIDENCE_STATUS } from '../../config/evidence';

const noop = () => {};

describe('EvidenceForm', () => {
  it('blocks submit and shows an error when no payload target is provided', () => {
    const onSubmit = vi.fn();
    render(<EvidenceForm onSubmit={onSubmit} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Deep Etch' } });
    fireEvent.change(screen.getByLabelText(/Slug/i), { target: { value: 'deep-etch' } });
    fireEvent.click(screen.getByLabelText('ald'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/at least one/i)).toBeInTheDocument();
  });

  it('submits a valid record with selected products and a sourceUrl', () => {
    const onSubmit = vi.fn();
    render(<EvidenceForm onSubmit={onSubmit} onCancel={noop} />);
    fireEvent.change(screen.getByLabelText(/Title/i), { target: { value: 'Deep Etch' } });
    fireEvent.change(screen.getByLabelText(/Slug/i), { target: { value: 'deep-etch' } });
    fireEvent.change(screen.getByLabelText(/Source URL/i), { target: { value: 'https://x/y.pdf' } });
    fireEvent.click(screen.getByLabelText('ald'));
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const payload = onSubmit.mock.calls[0][0];
    expect(payload).toMatchObject({
      title: 'Deep Etch',
      slug: 'deep-etch',
      products: ['ald'],
      sourceUrl: 'https://x/y.pdf',
      type: EVIDENCE_TYPE.APPLICATION_NOTE,
      status: EVIDENCE_STATUS.DRAFT,
    });
  });

  it('pre-fills fields from an initial value (edit mode)', () => {
    render(
      <EvidenceForm
        onSubmit={noop}
        onCancel={noop}
        initial={{
          id: 'e-1', slug: 'x', title: 'Existing', type: EVIDENCE_TYPE.PUBLICATION,
          products: ['rie-etcher'], sourceUrl: 'https://nature.com/x', status: EVIDENCE_STATUS.PUBLISHED,
        }}
      />
    );
    expect((screen.getByLabelText(/Title/i) as HTMLInputElement).value).toBe('Existing');
    expect((screen.getByLabelText('rie-etcher') as HTMLInputElement).checked).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/EvidenceForm.test.tsx`
Expected: FAIL — `Cannot find module './EvidenceForm'`.

- [ ] **Step 3: Write the form**

```tsx
// src/components/admin/EvidenceForm.tsx
import { useState } from 'react';
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  EVIDENCE_TYPE_ORDER,
  EVIDENCE_TYPE_HELP,
  evidenceTypeLabel,
  hasPayload,
  PRODUCT_OPTIONS,
} from '../../config/evidence';
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
  const [metrics, setMetrics] = useState<Metric[]>(
    Array.isArray(initial?.metrics) ? (initial!.metrics as Metric[]) : []
  );
  const [articleSlug, setArticleSlug] = useState(initial?.articleSlug ?? '');
  const [pdfUrl, setPdfUrl] = useState(initial?.pdfUrl ?? '');
  const [images, setImages] = useState(toLines(initial?.images));
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '');
  const [metaText, setMetaText] = useState(initial?.meta ? JSON.stringify(initial.meta, null, 2) : '');
  const [status, setStatus] = useState<string>(initial?.status ?? EVIDENCE_STATUS.DRAFT);
  const [error, setError] = useState<string | null>(null);

  const effectiveSlug = slugEdited ? slug : slugify(title);

  function toggleProduct(productSlug: string) {
    setProducts((prev) =>
      prev.includes(productSlug) ? prev.filter((s) => s !== productSlug) : [...prev, productSlug]
    );
  }

  function updateMetric(i: number, field: keyof Metric, value: string) {
    setMetrics((prev) => prev.map((m, idx) => (idx === i ? { ...m, [field]: value } : m)));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const imageList = fromLines(images);
    if (!hasPayload({ articleSlug, pdfUrl, sourceUrl, images: imageList })) {
      setError('Provide at least one payload/target: a non-blank Article slug, PDF URL, or Source URL, or one or more images.');
      return;
    }
    if (products.length === 0) {
      setError('Select at least one product.');
      return;
    }

    let meta: unknown = undefined;
    if (metaText.trim()) {
      try {
        meta = JSON.parse(metaText);
      } catch {
        setError('Meta must be valid JSON.');
        return;
      }
    }

    const value = {
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
      images: imageList,
      sourceUrl: sourceUrl.trim() || null,
      meta,
      status,
      publishDate: initial?.publishDate ?? null,
    } as EvidenceInput | EvidenceUpdateInput;

    onSubmit(value);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-2xl">
      <label className="flex flex-col gap-1">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>

      <label className="flex flex-col gap-1">
        <span>Slug</span>
        <input
          value={effectiveSlug}
          onChange={(e) => { setSlugEdited(true); setSlug(e.target.value); }}
          required
        />
      </label>

      <label className="flex flex-col gap-1">
        <span>Type</span>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {EVIDENCE_TYPE_ORDER.map((t) => (
            <option key={t} value={t}>{evidenceTypeLabel(t)}</option>
          ))}
        </select>
        {EVIDENCE_TYPE_HELP[type as keyof typeof EVIDENCE_TYPE_HELP] && (
          <small>{EVIDENCE_TYPE_HELP[type as keyof typeof EVIDENCE_TYPE_HELP]}</small>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span>Summary</span>
        <input value={summary} onChange={(e) => setSummary(e.target.value)} />
      </label>

      <fieldset className="flex flex-col gap-1">
        <legend>Products</legend>
        {PRODUCT_OPTIONS.map((p) => (
          <label key={p.slug} className="flex items-center gap-2">
            <input
              type="checkbox"
              aria-label={p.slug}
              checked={products.includes(p.slug)}
              onChange={() => toggleProduct(p.slug)}
            />
            <span>{p.label} <code>({p.slug})</code></span>
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1">
        <span>Process</span>
        <input value={process} onChange={(e) => setProcess(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span>Materials (one per line)</span>
        <textarea value={materials} onChange={(e) => setMaterials(e.target.value)} rows={3} />
      </label>

      <label className="flex flex-col gap-1">
        <span>Keywords (one per line)</span>
        <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)} rows={3} />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend>Metrics</legend>
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

      <label className="flex flex-col gap-1">
        <span>Article slug (optional link to an Insights post)</span>
        <input value={articleSlug} onChange={(e) => setArticleSlug(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span>PDF URL</span>
        <input value={pdfUrl} onChange={(e) => setPdfUrl(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span>Images (one URL per line)</span>
        <textarea value={images} onChange={(e) => setImages(e.target.value)} rows={3} />
      </label>

      <label className="flex flex-col gap-1">
        <span>Source URL</span>
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
      </label>

      <label className="flex flex-col gap-1">
        <span>Meta (JSON, optional)</span>
        <textarea value={metaText} onChange={(e) => setMetaText(e.target.value)} rows={4} />
      </label>

      <label className="flex flex-col gap-1">
        <span>Status</span>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value={EVIDENCE_STATUS.DRAFT}>Draft</option>
          <option value={EVIDENCE_STATUS.PUBLISHED}>Published</option>
          <option value={EVIDENCE_STATUS.ARCHIVED}>Archived</option>
        </select>
      </label>

      {error && <p role="alert" className="text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={submitting}>Save</button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/EvidenceForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/EvidenceForm.tsx src/components/admin/EvidenceForm.test.tsx
git commit -m "feat(evidence): EvidenceForm with product multi-select, metrics rows, payload guard"
```

---

## Task 10: Admin list + form pages

`AdminEvidenceListPage` (filters by type/status, admin sees all statuses) and `AdminEvidenceFormPage` (new/edit wrapper wiring the service).

**Files:**
- Create: `src/pages/admin/AdminEvidenceListPage.tsx`
- Create: `src/pages/admin/AdminEvidenceFormPage.tsx`
- Test: `src/pages/admin/AdminEvidenceListPage.test.tsx`

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
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE_ORDER,
  evidenceTypeLabel,
} from '../../config/evidence';

interface Row {
  id: string;
  title: string;
  type: string;
  status: string;
  products?: (string | null)[] | null;
}

export function AdminEvidenceListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  async function load() {
    setLoading(true);
    try {
      setRows((await listAllEvidence()) as Row[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => rows.filter((r) =>
      (typeFilter === 'all' || r.type === typeFilter) &&
      (statusFilter === 'all' || r.status === statusFilter)
    ),
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
        <label className="flex items-center gap-2">
          <span>Filter by type</span>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All</option>
            {EVIDENCE_TYPE_ORDER.map((t) => <option key={t} value={t}>{evidenceTypeLabel(t)}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span>Filter by status</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All</option>
            <option value={EVIDENCE_STATUS.DRAFT}>Draft</option>
            <option value={EVIDENCE_STATUS.PUBLISHED}>Published</option>
            <option value={EVIDENCE_STATUS.ARCHIVED}>Archived</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="mt-6">Loading…</p>
      ) : (
        <table className="mt-6 w-full text-left">
          <thead>
            <tr><th>Title</th><th>Type</th><th>Status</th><th>Products</th><th></th></tr>
          </thead>
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

- [ ] **Step 5: Write the form page (no new test — thin wiring; covered by EvidenceForm + service tests)**

```tsx
// src/pages/admin/AdminEvidenceFormPage.tsx
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EvidenceForm, EvidenceFormValue } from '../../components/admin/EvidenceForm';
import {
  createEvidence,
  updateEvidence,
  getEvidence,
} from '../../services/evidenceAdminService';
import type { EvidenceInput, EvidenceUpdateInput } from '../../services/evidenceAdminService';

export function AdminEvidenceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initial, setInitial] = useState<EvidenceFormValue | undefined>();
  const [loading, setLoading] = useState(Boolean(id));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getEvidence(id)
      .then((data) => setInitial((data ?? undefined) as EvidenceFormValue | undefined))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSubmit(value: EvidenceInput | EvidenceUpdateInput) {
    setSubmitting(true);
    setError(null);
    try {
      if ('id' in value && value.id) {
        await updateEvidence(value as EvidenceUpdateInput);
      } else {
        await createEvidence(value as EvidenceInput);
      }
      navigate('/admin/evidence');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p className="p-6">Loading…</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">{id ? 'Edit evidence' : 'New evidence'}</h1>
      {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
      <div className="mt-6">
        <EvidenceForm
          initial={initial}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/admin/evidence')}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the admin suite to confirm nothing regressed**

Run: `npx vitest run src/pages/admin/AdminEvidenceListPage.test.tsx src/components/admin/EvidenceForm.test.tsx src/services/evidenceAdminService.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pages/admin/AdminEvidenceListPage.tsx src/pages/admin/AdminEvidenceFormPage.tsx src/pages/admin/AdminEvidenceListPage.test.tsx
git commit -m "feat(evidence): admin list (type/status filters, all statuses) + form page"
```

---

## Task 11: Register admin routes + nav

**Files:**
- Modify: `src/routes/AdminRoutes.tsx`
- Modify: `src/components/admin/AdminLayout.tsx`

- [ ] **Step 1: Add lazy imports + routes**

In `src/routes/AdminRoutes.tsx`, add the lazy declarations (next to the `AdminInsights*` ones, ~line 12):

```tsx
const AdminEvidenceListPage = lazyWithReload(() => import('../pages/admin/AdminEvidenceListPage').then(m => ({ default: m.AdminEvidenceListPage })));
const AdminEvidenceFormPage = lazyWithReload(() => import('../pages/admin/AdminEvidenceFormPage').then(m => ({ default: m.AdminEvidenceFormPage })));
```

Add the routes inside `<Route path="/admin" ...>` (next to the `insights` routes, ~line 52):

```tsx
          <Route path="evidence" element={<AdminEvidenceListPage />} />
          <Route path="evidence/new" element={<AdminEvidenceFormPage />} />
          <Route path="evidence/:id/edit" element={<AdminEvidenceFormPage />} />
```

- [ ] **Step 2: Add the nav item**

In `src/components/admin/AdminLayout.tsx`, add to the nav-items array (next to the Insights entry, line 20):

```tsx
  { path: '/admin/evidence', label: 'Evidence', icon: 'verified' },
```

- [ ] **Step 3: Verify build + typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: the full suite passes (Evidence tests green, nothing else regressed).

- [ ] **Step 4: Commit**

```bash
git add src/routes/AdminRoutes.tsx src/components/admin/AdminLayout.tsx
git commit -m "feat(evidence): register /admin/evidence routes and nav item"
```

---

## Task 12: Deploy the backend + end-to-end smoke (execution-review gate)

The prior tasks are unit-tested; this task deploys and verifies the live boundary. Do this during execution review, not in isolation.

- [ ] **Step 1: Deploy to the sandbox**

Run: `npx ampx sandbox` (let it provision the `Evidence` table, `evidence-api` Lambda, and the `listPublishedEvidence` query). Confirm no CloudFormation errors.

- [ ] **Step 2: Verify the no-leak boundary manually**

- In the admin UI (`/admin/evidence/new`) create one record with `status = draft`, products `['ald']`, and a `sourceUrl`. Confirm the ALD product page shows **no** Evidence section.
- Flip it to `published`. Reload the ALD product page (`/products/ald`) → the Evidence section appears with `✓ 1 Application Note`.
- Flip it to `archived` → the section disappears again.
- Confirm a second product with no evidence still shows no section.

- [ ] **Step 3: Verify draft is not publicly readable**

Using the app's public apiKey client, call `listPublishedEvidence({ productSlug: 'ald' })` while the record is `draft` → returns `[]`. Confirm there is no public path (base-model query) that returns the draft. (This is the manual counterpart to the auth test; the base `Evidence` model has no `publicApiKey` rule, so an anonymous base-model query is rejected.)

- [ ] **Step 4: Commit any fixes discovered during smoke**

```bash
git add -A
git commit -m "fix(evidence): address issues found during sandbox smoke test"
```

---

## Self-Review (completed during authoring)

**Spec coverage** — every spec section maps to a task:
- Data model → Task 2. Public Read Boundary (authenticated-only base + Lambda) → Tasks 2–4. Pagination contract → Task 3. Lambda least-privilege IAM → Task 4. Write Authorization Premise → Task 2 (auth block comment; no group, by decision). Constants/labels/help-text → Task 1. `status` semantics → Tasks 1, 6, 10. Product module (0→hidden, ≥1→grouped counts, display-only) → Tasks 7–8. Admin (fields, product multi-select, slug best-effort, ≥1-payload incl. empty-array, publishDate auto-set, archived visible/never public) → Tasks 6, 9, 10, 12. Testing (server-boundary security, pagination ≥2 pages, counting-only helper, admin validations) → Tasks 1, 3, 6, 9, 10, 12.

**Placeholder scan** — no TBD/TODO; every code step has complete code.

**Type consistency** — `EvidenceInput`/`EvidenceUpdateInput` defined in Task 6 and consumed in Tasks 9–10; `countEvidenceByType`/`EvidenceTypeCount`/`hasPayload`/`EVIDENCE_STATUS`/`EVIDENCE_TYPE` defined in Task 1 and used consistently downstream; `fetchPublishedEvidence` defined in Task 5, consumed in Task 7; `listPublishedEvidence` query name identical across Tasks 3/4/5.
