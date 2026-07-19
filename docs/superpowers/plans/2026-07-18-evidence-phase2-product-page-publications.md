# Evidence Phase 2 — Product-page publications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the 35 launch-eligible `publication` Evidence records and render them as an attribution-safe list on product detail pages, with a server-side whitelist that never emits the OEM name/model/slug to anonymous callers.

**Architecture:** The public `listPublishedEvidence` Lambda gains a whitelist projection (drops `slug` + raw `meta`, hoists only `journal/year/doi/publicSummary`). The product module renders one card per publication — title, journal badge, source link, and a science summary line **only when `meta.publicSummary` exists** (data-driven A→B: stage 2a has no summaries, stage 2b fills them in page-by-page). A `--apply`-gated script flips `meta.launchEligible === true` drafts to `published`. Two live acceptance scripts (no-leak boundary + banned-OEM-token scan) guard the boundary.

**Tech Stack:** TypeScript, AWS Amplify Gen 2 (AppSync + DynamoDB DocumentClient Scan), React + Tailwind, Vitest, `tsx` for ops scripts, the existing `scripts/lib/evidenceSeedOperations.ts` raw-GraphQL helpers.

**Scope:** This plan is the immediately-shippable unit (spec stages 2a §1–§3, §5). Stage 2b (writing `meta.publicSummary` per record via an LLM-assisted + human-reviewed rewrite pass) is a follow-on content plan — the module built here renders those summaries automatically as they land, with no further code change.

**Spec:** `docs/superpowers/specs/2026-07-18-evidence-phase2-product-page-publications-design.md`

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `amplify/functions/evidence-api/handler.ts` | add whitelist projection to the Scan result | 1 |
| `amplify/functions/evidence-api/handler.test.ts` | assert projection strips slug/OEM meta, hoists safe fields | 1 |
| `scripts/lib/bannedOem.ts` | banned OEM-name/model token list + matcher | 2 |
| `scripts/lib/bannedOem.test.ts` | matcher unit tests | 2 |
| `src/config/evidence.ts` | `journalBadge()` + `productPlatformLabel()` helpers | 3 |
| `src/config/evidence.test.ts` | helper unit tests | 3 |
| `src/services/evidenceService.ts` | `PublishedEvidence` type = new public payload shape | 4 |
| `src/components/products/ProductEvidence.tsx` | render publication cards (data-driven A→B) | 4 |
| `src/components/products/ProductEvidence.test.tsx` | list/badge/summary/expander behavior | 4 |
| `scripts/lib/evidenceSeedOperations.ts` | `publishLaunchEligible()` operation | 5 |
| `scripts/evidenceSeedSafety.test.ts` | `publishLaunchEligible()` unit tests | 5 |
| `scripts/publish-launch-eligible-evidence.ts` | dry-run/`--apply` publish script | 5 |
| `scripts/verify-evidence-no-oem.ts` | live banned-token scan of public payload | 6 |
| `scripts/verify-evidence-boundary.ts` | switch seed-identity match from `slug`→`title` | 6 |

---

## Task 1: Lambda whitelist projection

**Files:**
- Modify: `amplify/functions/evidence-api/handler.ts`
- Test: `amplify/functions/evidence-api/handler.test.ts`

- [ ] **Step 1: Write the failing tests** — append inside the existing `describe('evidence-api listPublishedEvidence', …)` block in `handler.test.ts`:

```ts
  it('projects each record to a whitelist: strips slug + OEM meta, hoists safe meta fields', async () => {
    mockScan.mockResolvedValueOnce({
      Items: [{
        id: 'x',
        slug: 'pub-tailong-icp100a-nanomaterials-2020',
        type: 'publication',
        status: 'published',
        title: 'A paper',
        sourceUrl: 'https://doi.org/10.1/x',
        publishDate: '2026-07-18',
        products: ['icp-etcher'],
        meta: JSON.stringify({
          journal: 'Nanomaterials', year: 2020, doi: '10.1/x',
          manufacturerAsNamed: 'Tailong Electronics', instrumentAsNamed: 'ICP-100A',
          verification: 'quote', publicSummary: 'Etched structures.',
        }),
      }],
      LastEvaluatedKey: undefined,
    });
    const [rec] = (await invoke()) as Record<string, unknown>[];
    expect(rec).toEqual({
      id: 'x', type: 'publication', status: 'published', title: 'A paper',
      sourceUrl: 'https://doi.org/10.1/x', publishDate: '2026-07-18', products: ['icp-etcher'],
      journal: 'Nanomaterials', year: 2020, doi: '10.1/x', publicSummary: 'Etched structures.',
    });
    expect(rec).not.toHaveProperty('slug');
    expect(rec).not.toHaveProperty('meta');
    expect(JSON.stringify(rec)).not.toMatch(/tailong|ICP-100A/i);
  });

  it('omits publicSummary when the record has none (treatment A)', async () => {
    mockScan.mockResolvedValueOnce({
      Items: [{ id: 'y', type: 'publication', status: 'published', title: 'T',
        meta: JSON.stringify({ journal: 'J', year: 2024, doi: '10.2/y' }) }],
      LastEvaluatedKey: undefined,
    });
    const [rec] = (await invoke()) as Record<string, unknown>[];
    expect(rec).not.toHaveProperty('publicSummary');
    expect(rec.journal).toBe('J');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run amplify/functions/evidence-api/handler.test.ts --exclude '**/.claude/**'`
Expected: FAIL — the new records still carry `slug`, `meta`, and OEM tokens (no projection yet).

- [ ] **Step 3: Add the projection to `handler.ts`** — replace the whole file with:

```ts
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { EVIDENCE_STATUS } from '../../lib/evidence/status';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

interface EvidenceApiEvent {
  arguments?: { productSlug?: string | null };
}

// Public read boundary: anonymous callers must never receive the OEM name,
// the internal instrument/model string, or the OEM-identifying slug. We build
// an explicit whitelist per record and hoist ONLY the safe meta sub-fields.
export interface PublicEvidence {
  id?: unknown;
  type?: unknown;
  status?: unknown;
  title?: unknown;
  sourceUrl?: unknown;
  publishDate?: unknown;
  products?: unknown;
  journal?: unknown;
  year?: unknown;
  doi?: unknown;
  publicSummary?: unknown;
}

function safeMeta(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object') return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try { return JSON.parse(raw) as Record<string, unknown>; } catch { return {}; }
  }
  return {};
}

export function projectPublicEvidence(item: Record<string, unknown>): PublicEvidence {
  const meta = safeMeta(item.meta);
  const out: PublicEvidence = {
    id: item.id,
    type: item.type,
    status: item.status,
    title: item.title,
    sourceUrl: item.sourceUrl,
    publishDate: item.publishDate,
    products: item.products,
    journal: meta.journal,
    year: meta.year,
    doi: meta.doi,
  };
  if (meta.publicSummary != null) out.publicSummary = meta.publicSummary;
  return out;
}

export const handler = async (event: EvidenceApiEvent): Promise<PublicEvidence[]> => {
  const tableName = process.env.EVIDENCE_TABLE;
  if (!tableName) throw new Error('EVIDENCE_TABLE env var is not set');

  const productSlug = event.arguments?.productSlug?.trim();

  const filters = ['#status = :published'];
  const values: Record<string, unknown> = { ':published': EVIDENCE_STATUS.PUBLISHED };
  if (productSlug) {
    filters.push('contains(products, :slug)');
    values[':slug'] = productSlug;
  }

  const items: Record<string, unknown>[] = [];
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
    if (res.Items) items.push(...(res.Items as Record<string, unknown>[]));
    ExclusiveStartKey = res.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (ExclusiveStartKey);

  return items.map(projectPublicEvidence);
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run amplify/functions/evidence-api/handler.test.ts --exclude '**/.claude/**'`
Expected: PASS — all tests, incl. the pre-existing filter/pagination tests (the pagination test's `id` assertions still hold; projected records keep `id`).

- [ ] **Step 5: Typecheck the amplify project**

Run: `npx tsc --noEmit -p amplify/tsconfig.json`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add amplify/functions/evidence-api/handler.ts amplify/functions/evidence-api/handler.test.ts
git commit -m "feat(evidence): whitelist projection on listPublishedEvidence (strip slug + OEM meta)"
```

---

## Task 2: Banned-OEM-token matcher

**Files:**
- Create: `scripts/lib/bannedOem.ts`
- Test: `scripts/lib/bannedOem.test.ts`

- [ ] **Step 1: Write the failing test** — `scripts/lib/bannedOem.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findBannedTokens } from './bannedOem';

describe('findBannedTokens', () => {
  it('flags OEM names and internal model strings, case-insensitively', () => {
    expect(findBannedTokens('Etched on a Tailong ICP-100A system'))
      .toEqual(expect.arrayContaining(['Tailong', 'ICP-100A']));
  });
  it('flags an OEM-identifying slug via the brand token', () => {
    expect(findBannedTokens('pub-tailong-icp100a-nanomaterials-2020')).toContain('Tailong');
  });
  it('passes clean, attribution-safe text', () => {
    expect(findBannedTokens('Silicon-nanopillar metasurfaces dry-etched for flow imaging')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run scripts/lib/bannedOem.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `Cannot find module './bannedOem'`.

- [ ] **Step 3: Implement `scripts/lib/bannedOem.ts`**

```ts
/**
 * Last line of defense: OEM brand names and internal model/series strings that
 * must NEVER appear in an anonymous-facing Evidence payload. Extend as new
 * models are catalogued. Matching is case-insensitive substring — the brand
 * token also catches OEM-identifying slugs (e.g. "pub-tailong-…").
 */
export const BANNED_OEM_TOKENS: string[] = [
  // brand / legal names + abbreviations
  'Tailong', '泰龙', '中科泰龙', 'Zhongke Tailong', 'Beijing Zhongke Tailong',
  'Nano-Promiso', 'Shanghai Peiyuan', '芯微诺达', 'Anxing Tailong',
  // internal model / series strings
  'ICP-100A', 'ICP-100', 'ICP-200', 'ICP-S-150', 'ICP-M-100', 'ICP-PECVD-150',
  'ICP-I', 'ICP-RIE', 'RIE-100M', 'RIE-150A', 'RIE-150', 'RIE-100',
  'STRIPER-100', 'PECVD-150LL', 'Sputter 100', 'HighThroughput100-6A',
];

export function findBannedTokens(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_OEM_TOKENS.filter((token) => lower.includes(token.toLowerCase()));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run scripts/lib/bannedOem.test.ts --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/bannedOem.ts scripts/lib/bannedOem.test.ts
git commit -m "feat(evidence): banned-OEM-token matcher for payload scanning"
```

---

## Task 3: Config helpers (journal badge + platform label)

**Files:**
- Modify: `src/config/evidence.ts`
- Test: `src/config/evidence.test.ts`

- [ ] **Step 1: Write the failing tests** — append to `src/config/evidence.test.ts`:

```ts
import { journalBadge, productPlatformLabel } from './evidence';

describe('journalBadge', () => {
  it('maps curated journals to short badges and returns null otherwise', () => {
    expect(journalBadge('Light: Science & Applications')).toBe('LSA');
    expect(journalBadge('Laser & Photonics Reviews')).toBe('LPR');
    expect(journalBadge('Some Obscure Journal')).toBeNull();
    expect(journalBadge(undefined)).toBeNull();
  });
});

describe('productPlatformLabel', () => {
  it('is represented-platform framed and never names an OEM', () => {
    expect(productPlatformLabel('icp-etcher')).toBe('the ICP etching platform we represent');
    expect(productPlatformLabel('unknown-slug')).toBe('the platform we represent');
  });
});
```

> If `src/config/evidence.test.ts` already has its own `import { … } from './evidence'` line, merge these names into it rather than adding a duplicate import.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/config/evidence.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `journalBadge`/`productPlatformLabel` not exported.

- [ ] **Step 3: Append helpers to `src/config/evidence.ts`** (after the existing `countEvidenceByType` export):

```ts
// --- Phase 2 product-page rendering helpers ---

// Curated short badges for well-known journals. Unmapped journals show their
// full name (no badge). Never fabricate an abbreviation — add entries explicitly.
const JOURNAL_BADGE: Record<string, string> = {
  'Light: Science & Applications': 'LSA',
  'Laser & Photonics Reviews': 'LPR',
  'Nature Communications': 'Nat. Commun.',
  'Science Advances': 'Sci. Adv.',
  'Nano Letters': 'Nano Lett.',
  'Advanced Materials': 'Adv. Mater.',
  'Advanced Functional Materials': 'Adv. Funct. Mater.',
  'Advanced Optical Materials': 'Adv. Opt. Mater.',
  'ACS Applied Nano Materials': 'ACS ANM',
  'ACS Applied Materials & Interfaces': 'ACS AMI',
};
export function journalBadge(journal?: string | null): string | null {
  if (!journal) return null;
  return JOURNAL_BADGE[journal] ?? null;
}

// Represented-platform wording per product line. NEVER names the OEM. Falls back
// to a generic phrase for lines without bespoke wording.
const PLATFORM_LABEL: Record<string, string> = {
  'icp-etcher': 'the ICP etching platform we represent',
  'rie-etcher': 'the RIE etching platform we represent',
  'compact-rie': 'the RIE etching platform we represent',
  'pecvd': 'the PECVD platform we represent',
  'hdp-cvd': 'the CVD platform we represent',
  'sputter': 'the magnetron sputtering platform we represent',
  'ibe-ribe': 'the ion-beam etching platform we represent',
  'striper': 'the plasma-strip platform we represent',
};
export function productPlatformLabel(slug: string): string {
  return PLATFORM_LABEL[slug] ?? 'the platform we represent';
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/config/evidence.test.ts --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/config/evidence.ts src/config/evidence.test.ts
git commit -m "feat(evidence): journalBadge + productPlatformLabel helpers"
```

---

## Task 4: Product module renders publication cards

**Files:**
- Modify: `src/services/evidenceService.ts`
- Modify: `src/components/products/ProductEvidence.tsx`
- Test: `src/components/products/ProductEvidence.test.tsx`

- [ ] **Step 1: Update the public payload type** in `src/services/evidenceService.ts` — replace the `PublishedEvidence` interface (keep the `fetchPublishedEvidence` function body unchanged):

```ts
// Mirrors the Lambda whitelist projection (handler.ts projectPublicEvidence).
// No `slug`, no raw `meta` — those never cross the public boundary.
export interface PublishedEvidence {
  id: string;
  type: string;
  status?: string | null;
  title?: string | null;
  sourceUrl?: string | null;
  publishDate?: string | null;
  products?: string[] | null;
  journal?: string | null;
  year?: number | null;
  doi?: string | null;
  publicSummary?: string | null;
}
```

- [ ] **Step 2: Write the failing tests** — replace the body of `src/components/products/ProductEvidence.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { ProductEvidence } from './ProductEvidence';

const fetchPublishedEvidence = vi.fn();
vi.mock('../../services/evidenceService', () => ({
  fetchPublishedEvidence: (slug: string) => fetchPublishedEvidence(slug),
}));

beforeEach(() => fetchPublishedEvidence.mockReset());

describe('ProductEvidence', () => {
  it('renders nothing when there is no published evidence', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([]);
    const { container } = render(<ProductEvidence productSlug="icp-etcher" />);
    await waitFor(() => expect(fetchPublishedEvidence).toHaveBeenCalledWith('icp-etcher'));
    expect(container.querySelector('section')).toBeNull();
  });

  it('lists publications with represented-platform intro, badge, summary and source link', async () => {
    fetchPublishedEvidence.mockResolvedValueOnce([
      { id: '1', type: 'publication', title: 'Metalens paper', journal: 'Laser & Photonics Reviews', year: 2024, sourceUrl: 'https://doi.org/10.1/lpr', publicSummary: 'Metalens patterned by etching.' },
      { id: '2', type: 'publication', title: 'Flow viz paper', journal: 'Light: Science & Applications', year: 2025, sourceUrl: 'https://doi.org/10.1/lsa' },
    ]);
    render(<ProductEvidence productSlug="icp-etcher" />);
    expect(await screen.findByText('Peer-reviewed research')).toBeInTheDocument();
    expect(screen.getByText(/the ICP etching platform we represent · 2 papers/)).toBeInTheDocument();
    expect(screen.getByText('Metalens paper')).toBeInTheDocument();
    expect(screen.getByText('LPR 2024')).toBeInTheDocument();
    expect(screen.getByText('Metalens patterned by etching.')).toBeInTheDocument();
    expect(screen.getByText('LSA 2025')).toBeInTheDocument();
    const links = screen.getAllByRole('link', { name: /view source/i });
    expect(links[0]).toHaveAttribute('href', 'https://doi.org/10.1/lpr');
  });

  it('ignores non-publication records and shows a Show-all toggle beyond the preview count', async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({
      id: String(i), type: 'publication', title: `P${i}`, journal: 'Obscure J', year: 2020,
      sourceUrl: `https://doi.org/10/${i}`,
    }));
    fetchPublishedEvidence.mockResolvedValueOnce([...many, { id: 'n', type: 'application_note', title: 'a note' }]);
    render(<ProductEvidence productSlug="icp-etcher" />);
    expect(await screen.findByText('Show all 7 →')).toBeInTheDocument();
    expect(screen.queryByText('a note')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/products/ProductEvidence.test.tsx --exclude '**/.claude/**'`
Expected: FAIL — module still renders counts, not the publication list.

- [ ] **Step 4: Rewrite `src/components/products/ProductEvidence.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { fetchPublishedEvidence, type PublishedEvidence } from '../../services/evidenceService';
import { journalBadge, productPlatformLabel } from '../../config/evidence';

interface ProductEvidenceProps {
  productSlug: string;
}

const PREVIEW_COUNT = 5;

/**
 * Phase 2 product-page Evidence module. Lists peer-reviewed publications that
 * used the represented platform. Attribution-safe: intro uses represented-
 * platform wording, never the OEM name. Each card shows a science summary line
 * ONLY when the record carries `publicSummary` (data-driven A→B upgrade).
 * Renders nothing when the product has no published publications.
 */
export function ProductEvidence({ productSlug }: ProductEvidenceProps) {
  const [records, setRecords] = useState<PublishedEvidence[] | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPublishedEvidence(productSlug).then((all) => {
      if (active) setRecords(all.filter((r) => r.type === 'publication'));
    });
    return () => { active = false; };
  }, [productSlug]);

  if (!records || records.length === 0) return null;

  const shown = expanded ? records : records.slice(0, PREVIEW_COUNT);

  return (
    <section data-testid="product-evidence" className="border-y border-slate-200 bg-white px-6 py-20 md:px-10 lg:px-16">
      <div className="mx-auto max-w-screen-2xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-sky-700">Research validation</p>
        <h2 className="mt-1 font-headline text-4xl font-semibold tracking-normal text-slate-950">Peer-reviewed research</h2>
        <p className="mt-3 text-lg text-slate-600">
          Published work using {productPlatformLabel(productSlug)} · {records.length} {records.length === 1 ? 'paper' : 'papers'}
        </p>
        <ul className="mt-8 flex flex-col divide-y divide-slate-200">
          {shown.map((rec) => {
            const badge = journalBadge(rec.journal);
            return (
              <li key={rec.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{rec.title}</p>
                  {rec.publicSummary ? (
                    <p className="mt-1 text-sm text-slate-600">{rec.publicSummary}</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-500">
                    {badge ? (
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">
                        {badge}{rec.year ? ` ${rec.year}` : ''}
                      </span>
                    ) : (
                      <>{rec.journal}{rec.journal && rec.year ? ' · ' : ''}{rec.year}</>
                    )}
                  </p>
                </div>
                {rec.sourceUrl ? (
                  <a
                    href={rec.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-sm font-semibold text-sky-700 hover:underline"
                  >
                    View source ↗
                  </a>
                ) : null}
              </li>
            );
          })}
        </ul>
        {records.length > PREVIEW_COUNT ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-6 text-sm font-semibold text-sky-700 hover:underline"
          >
            {expanded ? 'Show fewer' : `Show all ${records.length} →`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/products/ProductEvidence.test.tsx src/services/evidenceService.test.ts --exclude '**/.claude/**'`
Expected: PASS (the service tests use partial objects and are unaffected by the type change).

- [ ] **Step 6: Typecheck + lint the changed frontend files**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint src/components/products/ProductEvidence.tsx src/services/evidenceService.ts src/config/evidence.ts --ext ts,tsx`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/services/evidenceService.ts src/components/products/ProductEvidence.tsx src/components/products/ProductEvidence.test.tsx
git commit -m "feat(evidence): product module lists publications (data-driven A->B)"
```

---

## Task 5: Publish-launch-eligible operation + script

**Files:**
- Modify: `scripts/lib/evidenceSeedOperations.ts`
- Test: `scripts/evidenceSeedSafety.test.ts`
- Create: `scripts/publish-launch-eligible-evidence.ts`

- [ ] **Step 1: Extend the shared list selection** — in `scripts/lib/evidenceSeedOperations.ts`, add `publishDate` to `EvidenceRecord` and add `products publishDate` to the `LIST` query so the publish op can tally by product and preserve dates. Change the interface:

```ts
export interface EvidenceRecord {
  id: string;
  slug: string;
  type?: string;
  status?: string;
  meta?: string | null;
  summary?: string | null;
  products?: string[] | null;
  publishDate?: string | null;
}
```

and change the `LIST` constant to:

```ts
const LIST = `query ListEvidence($nextToken:String){ listEvidences(limit:200,nextToken:$nextToken){ items{ id slug type status meta products publishDate } nextToken } }`;
```

- [ ] **Step 2: Write the failing tests** — append inside the top-level `describe('evidence seeder safety contracts', …)` block in `scripts/evidenceSeedSafety.test.ts` (and add `publishLaunchEligible` to the existing import from `./lib/evidenceSeedOperations`):

```ts
  it('publishes only launch-eligible drafts, stamps publishDate, and is convergent', async () => {
    const seed = [
      { id: 'a', slug: 'pub-a', type: 'publication', status: 'draft', products: ['icp-etcher'], meta: JSON.stringify({ launchEligible: true }) },
      { id: 'b', slug: 'pub-b', type: 'publication', status: 'draft', products: ['rie-etcher'], meta: JSON.stringify({ launchEligible: false }) },
      { id: 'c', slug: 'pub-c', type: 'publication', status: 'published', products: ['icp-etcher'], publishDate: '2026-01-01', meta: JSON.stringify({ launchEligible: true }) },
    ];
    const store = new Map(seed.map((r) => [r.id, { ...r }]));
    let writes = 0;
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async (request: any) => {
        if (!request.variables.input) {
          return { data: { listEvidences: { items: [...store.values()], nextToken: null } } };
        }
        writes++;
        const cur = store.get(request.variables.input.id)!;
        const next = { ...cur, ...request.variables.input };
        store.set(cur.id, next);
        return { data: { updateEvidence: { id: next.id, slug: next.slug, status: next.status } } };
      }),
    };

    const first = await publishLaunchEligible(client, { apply: true, publishDate: '2026-07-18' });
    expect(first).toMatchObject({ eligible: 2, published: 1, alreadyPublished: 1 });
    expect(store.get('a')!.status).toBe('published');
    expect(store.get('a')!.publishDate).toBe('2026-07-18');
    expect(store.get('c')!.publishDate).toBe('2026-01-01'); // preserved, not overwritten

    const second = await publishLaunchEligible(client, { apply: true, publishDate: '2026-07-19' });
    expect(second).toMatchObject({ eligible: 2, published: 0, alreadyPublished: 2 });
    expect(writes).toBe(1);
  });

  it('dry-run reports eligible + byProduct and writes nothing', async () => {
    const client: EvidenceGraphqlClient = {
      graphql: vi.fn(async (request: any) => {
        if (request.variables.input) throw new Error('dry-run must not write');
        return { data: { listEvidences: { items: [
          { id: 'a', slug: 'pub-a', type: 'publication', status: 'draft', products: ['icp-etcher'], meta: JSON.stringify({ launchEligible: true }) },
        ], nextToken: null } } };
      }),
    };
    const res = await publishLaunchEligible(client, { apply: false, publishDate: '2026-07-18' });
    expect(res).toMatchObject({ eligible: 1, published: 0, byProduct: { 'icp-etcher': 1 } });
  });
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run scripts/evidenceSeedSafety.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `publishLaunchEligible` is not exported.

- [ ] **Step 4: Implement `publishLaunchEligible`** — append to `scripts/lib/evidenceSeedOperations.ts`:

```ts
export async function publishLaunchEligible(
  client: EvidenceGraphqlClient,
  options: { apply: boolean; publishDate: string },
): Promise<{ eligible: number; published: number; alreadyPublished: number; byProduct: Record<string, number> }> {
  const items: EvidenceRecord[] = [];
  let nextToken: string | null = null;
  do {
    const result = await checkedGraphql<ListResponse>(client, {
      query: LIST,
      variables: { nextToken },
      ...AUTH,
    }, 'list evidence for publish');
    const page = result.data.listEvidences;
    if (!Array.isArray(page?.items)) {
      throw new Error('list evidence for publish failed: missing items array');
    }
    items.push(...page.items);
    nextToken = page.nextToken ?? null;
  } while (nextToken);

  const eligible = items.filter(
    (item) => item.type === 'publication' && parseMeta(item).launchEligible === true,
  );

  const byProduct: Record<string, number> = {};
  let published = 0;
  let alreadyPublished = 0;
  for (const record of eligible) {
    for (const product of record.products ?? []) {
      byProduct[product] = (byProduct[product] ?? 0) + 1;
    }
    if (record.status === 'published') {
      alreadyPublished++;
      continue;
    }
    if (!options.apply) continue;

    const input: Record<string, unknown> = { id: record.id, status: 'published' };
    if (!record.publishDate) input.publishDate = options.publishDate;
    const result = await checkedGraphql<UpdateResponse>(client, {
      query: UPDATE,
      variables: { input },
      ...AUTH,
    }, `publish ${record.slug}`);
    if (result.data.updateEvidence?.status !== 'published') {
      throw new Error(`publish ${record.slug} failed: published postcondition not met`);
    }
    published++;
  }
  return { eligible: eligible.length, published, alreadyPublished, byProduct };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run scripts/evidenceSeedSafety.test.ts --exclude '**/.claude/**'`
Expected: PASS (all prior tests + the 2 new ones).

- [ ] **Step 6: Create the script `scripts/publish-launch-eligible-evidence.ts`**

```ts
/**
 * Publish every launch-eligible (meta.launchEligible === true) publication
 * Evidence record: status draft -> published, stamping publishDate when absent.
 * Idempotent + convergent (already-published records are counted, not rewritten).
 * Dry-run by default; pass --apply to write. Tier-B / incidental records are
 * NOT launch-eligible and are never touched.
 *
 * PREREQUISITE: the whitelist-projection Lambda (handler.ts) MUST already be
 * deployed to the target backend, so published records return OEM-free payloads.
 *
 * Usage:
 *   set -a; source .env; set +a
 *   npx tsx scripts/publish-launch-eligible-evidence.ts            # dry-run
 *   npx tsx scripts/publish-launch-eligible-evidence.ts --apply    # write
 */
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authenticate } from './lib/auth';
import { publishLaunchEligible, type EvidenceGraphqlClient } from './lib/evidenceSeedOperations';
import amplifyOutputs from '../amplify_outputs.json';

Amplify.configure(amplifyOutputs as any);
const client = generateClient() as unknown as EvidenceGraphqlClient;

function parseArgs(argv: string[]): { apply: boolean } {
  const unknown = argv.filter((arg) => arg !== '--apply');
  if (unknown.length) {
    throw new Error(`publish-launch-eligible-evidence: unknown argument(s): ${unknown.join(', ')}`);
  }
  return { apply: argv.includes('--apply') };
}

async function main() {
  const { apply } = parseArgs(process.argv.slice(2));
  await authenticate();
  const publishDate = new Date().toISOString().slice(0, 10);
  const res = await publishLaunchEligible(client, { apply, publishDate });
  console.log(
    `${apply ? 'APPLIED' : 'DRY-RUN'} — launchEligible=${res.eligible} published=${res.published} alreadyPublished=${res.alreadyPublished}`,
  );
  console.log('  byProduct:', JSON.stringify(res.byProduct));
  if (!apply) console.log('\nNothing written. Re-run with --apply to publish.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 7: Typecheck + lint**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint scripts/lib/evidenceSeedOperations.ts scripts/publish-launch-eligible-evidence.ts scripts/evidenceSeedSafety.test.ts --ext ts,tsx`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/evidenceSeedOperations.ts scripts/evidenceSeedSafety.test.ts scripts/publish-launch-eligible-evidence.ts
git commit -m "feat(evidence): publish-launch-eligible operation + dry-run/apply script"
```

---

## Task 6: Live acceptance scripts (banned-token scan + boundary by title)

**Files:**
- Create: `scripts/verify-evidence-no-oem.ts`
- Modify: `scripts/verify-evidence-boundary.ts`

- [ ] **Step 1: Create `scripts/verify-evidence-no-oem.ts`** (live apiKey scan of the public payload)

```ts
// scripts/verify-evidence-no-oem.ts
// Live acceptance: fetch the anonymous (apiKey) listPublishedEvidence payload for
// each evidence-bearing product line and FAIL if any banned OEM name/model token
// (or an OEM-identifying slug) appears anywhere in it. Run AFTER deploying the
// whitelist projection and AFTER publishing.
// Usage: npx tsx scripts/verify-evidence-no-oem.ts
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import outputs from '../amplify_outputs.json';
import type { Schema } from '../amplify/data/resource';
import { findBannedTokens } from './lib/bannedOem';

Amplify.configure(outputs);
const client = generateClient<Schema>({ authMode: 'apiKey' });

const PRODUCTS = ['icp-etcher', 'rie-etcher', 'pecvd', 'sputter', 'ibe-ribe', 'striper'];

async function main() {
  let failed = false;
  for (const productSlug of PRODUCTS) {
    const res = await client.queries.listPublishedEvidence({ productSlug });
    if (res.errors?.length) {
      throw new Error(`listPublishedEvidence(${productSlug}) errored: ${res.errors.map((e) => e.message).join(', ')}`);
    }
    const payload = typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? []);
    const hits = [...new Set(findBannedTokens(payload))];
    const count = Array.isArray(JSON.parse(payload)) ? JSON.parse(payload).length : 0;
    if (hits.length) {
      failed = true;
      console.error(`LEAK on ${productSlug}: ${hits.join(', ')}`);
    } else {
      console.log(`OK ${productSlug}: no banned tokens (${count} record(s))`);
    }
  }
  if (failed) {
    console.error('\nSECURITY FAIL: banned OEM tokens present in a public payload.');
    process.exit(1);
  }
  console.log('\nOK: no OEM tokens in any public product payload.');
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Update `scripts/verify-evidence-boundary.ts`** — the projection no longer returns `slug`, so switch seed-identity matching from `slug` to `title`. Make these exact edits:

  Change the usage comment block (lines ~9-11) to reference `EVIDENCE_TEST_TITLE`:

```ts
// Usage:
//   EVIDENCE_TEST_TITLE="Boundary Test 2026-07-04" EVIDENCE_EXPECT=draft \
//   npx tsx scripts/verify-evidence-boundary.ts
```

  Replace the `TEST_SLUG` constant + guard:

```ts
const TEST_TITLE = process.env.EVIDENCE_TEST_TITLE;
const EXPECT = process.env.EVIDENCE_EXPECT; // draft | published | archived
const PRODUCT = process.env.EVIDENCE_TEST_PRODUCT ?? 'ald';
const VALID_EXPECT = new Set(Object.values(EVIDENCE_STATUS));
```

```ts
  if (!TEST_TITLE || !EXPECT || !VALID_EXPECT.has(EXPECT as never)) {
    throw new Error('Set EVIDENCE_TEST_TITLE and EVIDENCE_EXPECT (draft|published|archived).');
  }
```

  Change the payload row type + seed-identity match (the `status` field is still present in the projection, so the published-only check at (b) is unchanged):

```ts
  const items = parsed as { title?: string; status: string }[];
```

```ts
  // (c) seed-identity lifecycle — matched by title (slug is not in the public payload)
  const mine = items.filter((e) => e.title === TEST_TITLE);
  if (EXPECT === EVIDENCE_STATUS.PUBLISHED) {
    if (mine.length !== 1) throw new Error(`FAIL: expected seed "${TEST_TITLE}" exactly once while published, saw ${mine.length}`);
  } else {
    if (mine.length !== 0) throw new Error(`FAIL: seed "${TEST_TITLE}" must be absent while ${EXPECT}, saw ${mine.length}`);
  }
  console.log(`OK: phase=${EXPECT}, seed "${TEST_TITLE}" occurrences=${mine.length}, all ${items.length} returned record(s) published.`);
```

- [ ] **Step 3: Typecheck + lint the two scripts**

Run: `npx tsc --noEmit -p tsconfig.json && npx eslint scripts/verify-evidence-no-oem.ts scripts/verify-evidence-boundary.ts --ext ts,tsx`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add scripts/verify-evidence-no-oem.ts scripts/verify-evidence-boundary.ts
git commit -m "test(evidence): live banned-OEM-token scan + boundary match by title"
```

---

## Task 7: Full verification, deploy, publish, and browser check

This task has no code changes — it ships the change safely, in the order the boundary requires (**projection deploys before anything is published**).

- [ ] **Step 1: Run the full test suite**

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: all files pass (baseline was 2082 tests + the tests added here).

- [ ] **Step 2: Full typecheck + lint (build gates)**

Run: `npx tsc --noEmit -p tsconfig.json && npx tsc --noEmit -p amplify/tsconfig.json && npm run lint`
Expected: no errors.

- [ ] **Step 3: Open a PR and merge to `main`**

```bash
git push -u origin feature/evidence-phase2-product-page-publications
gh pr create --base main --title "feat(evidence): Phase 2 — product-page publications (2a)" --body "Implements the approved Phase 2 spec: whitelist projection, publication list module, publish-launch-eligible script, banned-token scan. Publishing runs post-deploy."
```
Merging triggers the Amplify pipeline, which deploys the updated `evidence-api` Lambda to prod. **Wait for the deploy to finish before Step 4.**

- [ ] **Step 4: Confirm the projection is live and OEM-free BEFORE publishing**

With prod still holding only drafts, the public payload is empty per product — confirm the projection deployed cleanly and errors-free:

Run: `set -a; source .env; set +a; npx tsx scripts/verify-evidence-no-oem.ts`
Expected: `OK …: no banned tokens (0 record(s))` for each product line; final `OK: no OEM tokens …`.

- [ ] **Step 5: Dry-run the publish, review the counts, then apply**

```bash
set -a; source .env; set +a
npx tsx scripts/publish-launch-eligible-evidence.ts            # review launchEligible + byProduct
npx tsx scripts/publish-launch-eligible-evidence.ts --apply    # publish
```
Expected dry-run: `launchEligible=35 published=0 …` with a per-product breakdown. Expected apply: `published=35 alreadyPublished=0` (re-running `--apply` a second time → `published=0 alreadyPublished=35`).

- [ ] **Step 6: Re-verify the boundary + OEM scan against the now-published set**

```bash
set -a; source .env; set +a
npx tsx scripts/verify-evidence-no-oem.ts
EVIDENCE_TEST_TITLE="<a known published title>" EVIDENCE_EXPECT=published EVIDENCE_TEST_PRODUCT=icp-etcher npx tsx scripts/verify-evidence-boundary.ts
```
Expected: no-oem scan passes with non-zero record counts; boundary script confirms base-model apiKey read is still denied and the known title appears exactly once.

- [ ] **Step 7: Browser-verify the ICP Etcher product page**

Use the preview browser: start the dev server, navigate to `/products/icp-etcher`, and confirm the "Peer-reviewed research" section renders the publication list (titles, journal badges, "View source ↗" links), the intro reads "…the ICP etching platform we represent · N papers", and — via the network tab / `read_network_requests` — the `listPublishedEvidence` response contains **no** `Tailong`/model token and **no** `slug`/`meta`. Screenshot for the record.

- [ ] **Step 8: Done — stage 2b (per-record `meta.publicSummary`) is a separate follow-on plan.**

---

## Self-review

**Spec coverage:**
- §1 publish set & mechanism → Task 5 (`publishLaunchEligible` selects `meta.launchEligible === true`, idempotent, dry-run/apply) + Task 7 Step 5. ✓
- §2 Lambda whitelist projection → Task 1 (strips `slug` + raw `meta`, hoists `journal/year/doi/publicSummary`; keeps `status` so the boundary check stays observable). ✓
- §3 product module (data-driven A→B, badge, platform label, expander) → Tasks 3 + 4. ✓
- §4 `publicSummary` (stage 2b) → out of scope here by design; the module already renders it when present (Task 4 conditional + test). ✓
- §5 verification + banned-words scan (incl. OEM brand names AND model/series numbers) → Task 2 (matcher), Task 6 (live scan + boundary-by-title), Task 7 (run order). ✓
- Payload contract (`{ id, type, status, title, sourceUrl, publishDate, products, journal, year, doi, publicSummary? }`, no `slug`/`meta`) → Task 1 projection + Task 4 `PublishedEvidence` type match. ✓
- Rollout order (deploy projection before publishing) → Task 7 Steps 3→5. ✓

**Placeholder scan:** the only `<a known published title>` and `<…>` tokens are runtime operator inputs in shell commands (Task 7), not code placeholders. No TODO/TBD.

**Type consistency:** `projectPublicEvidence`/`PublicEvidence` (handler) ↔ `PublishedEvidence` (service) share the same key set; `publishLaunchEligible` return `{ eligible, published, alreadyPublished, byProduct }` is used identically in the script and tests; `findBannedTokens` signature identical across matcher, tests, and the live scan; `EvidenceRecord.publishDate` added in Task 5 is consumed only after the `LIST` query is extended in the same task.
