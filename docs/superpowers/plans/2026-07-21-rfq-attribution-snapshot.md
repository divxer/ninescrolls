# RFQ Attribution Snapshot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a first-party last-non-direct UTM/gclid snapshot on RFQ submissions so paid clicks can be tied to conversions, and surface visitorId + attribution on the admin read path (which currently strips both).

**Architecture:** A dependency-free client module captures landing UTM/click-ids into `localStorage` (recency-overwrite, 90-day expiry). The two payload-building entry points (RFQPage, QuoteModal) attach the snapshot. The submit-rfq Lambda validates it (Zod) and stores a nested `attribution` map. The `RfqSubmission` GraphQL type gains `visitorId` (never declared) + `attribution`, and both order-api resolvers project them. The admin RFQ detail page renders a read-only Traffic Source subcard.

**Tech Stack:** Vitest, TypeScript, Zod, AWS Amplify Gen 2 (`a.customType`), DynamoDBDocumentClient, React (admin), shared limits at `amplify/lib/rfq/limits.ts`.

**Worktree:** `.claude/worktrees/rfq-attr`, branch `feature/rfq-attribution-snapshot`. No `node_modules` in the worktree — before running tests: `rm -rf <worktree>/node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules <worktree>/node_modules`; `rm <worktree>/node_modules` before each commit; all git via `git -C <worktree>`. Commit messages end with a blank line then `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`. Run frontend tests with `cd <worktree> && npx vitest run <path>`.

**Reference files (read before starting):**
- Spec: `docs/superpowers/specs/2026-07-21-rfq-attribution-snapshot-design.md`
- Limits SSoT: `amplify/lib/rfq/limits.ts`
- visitorId service (style to mirror): `src/services/analyticsStorageService.ts`
- Entry points: `src/pages/RFQPage.tsx:578-586`, `src/components/common/QuoteModal.tsx:100-116`
- Lambda: `amplify/functions/submit-rfq/handler.ts` (Zod schema ~line 115, docClient line 32, item build ~795-830, tests `handler.test.ts:1011-1058`)
- GraphQL type: `amplify/data/resource.ts:554-586` (RfqSubmission)
- Resolvers: `amplify/functions/order-api/resolvers/listRfqs.ts:96-126`, `getRfq.ts:22-…`
- Admin: `src/pages/admin/RFQDetailPage.tsx`, `src/types/admin.ts:117-146`

---

### Task 1: Shared attribution field limits

**Files:**
- Modify: `amplify/lib/rfq/limits.ts`

- [ ] **Step 1: Add the `attribution` sub-shape** to the `RFQ_FIELD_LIMITS` object, after `referrerSource: { max: 200 },`:

```ts
  attribution: {
    source: { max: 128 },
    medium: { max: 64 },
    campaign: { max: 256 },
    term: { max: 256 },
    content: { max: 256 },
    gclid: { max: 512 },
    gbraid: { max: 512 },
    wbraid: { max: 512 },
    msclkid: { max: 512 },
    capturedAt: { max: 40 },
    landingPath: { max: 512 },
  },
```

- [ ] **Step 2: Typecheck** — Run: `cd <worktree> && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i limits || echo "limits OK"`
Expected: `limits OK` (the `as const` object still compiles; `RfqLimitedField` union widens automatically).

- [ ] **Step 3: Commit**

```bash
git -C <worktree> add amplify/lib/rfq/limits.ts
git -C <worktree> commit -m "feat(rfq): add attribution field limits to shared SSoT"
```

---

### Task 2: Client attribution capture module

**Files:**
- Create: `src/services/attributionSnapshot.ts`
- Create: `src/services/attributionSnapshot.test.ts`

- [ ] **Step 1: Write the failing test** — create `src/services/attributionSnapshot.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureLandingAttribution, getAttributionSnapshot } from './attributionSnapshot';

const KEY = 'ns_attribution';

beforeEach(() => {
  localStorage.clear();
});

describe('captureLandingAttribution', () => {
  it('writes a snapshot when any utm/click param is present, lowercasing utm but not click ids', () => {
    captureLandingAttribution('?utm_source=Google&utm_medium=CPC&gclid=AbC123xYz', new Date('2026-07-21T00:00:00Z'));
    const snap = getAttributionSnapshot()!;
    expect(snap.source).toBe('google');   // lowercased
    expect(snap.medium).toBe('cpc');       // lowercased
    expect(snap.gclid).toBe('AbC123xYz');  // verbatim, case preserved
    expect(snap.capturedAt).toBe('2026-07-21T00:00:00.000Z');
  });

  it('treats empty-string params as absent', () => {
    captureLandingAttribution('?utm_source=&utm_medium=cpc', new Date('2026-07-21T00:00:00Z'));
    const snap = getAttributionSnapshot()!;
    expect(snap.source).toBeUndefined();
    expect(snap.medium).toBe('cpc');
  });

  it('does NOT overwrite an in-window snapshot on a param-less landing', () => {
    captureLandingAttribution('?utm_source=google&gclid=g1', new Date('2026-07-21T00:00:00Z'));
    captureLandingAttribution('', new Date('2026-07-25T00:00:00Z')); // direct, 4 days later
    expect(getAttributionSnapshot()!.gclid).toBe('g1'); // preserved
  });

  it('overwrites an existing snapshot when a NEW param landing arrives (recency wins, ignores age)', () => {
    captureLandingAttribution('?utm_source=google&gclid=old', new Date('2026-01-01T00:00:00Z')); // old
    captureLandingAttribution('?utm_source=bing&msclkid=new', new Date('2026-07-21T00:00:00Z'));
    const snap = getAttributionSnapshot()!;
    expect(snap.source).toBe('bing');
    expect(snap.msclkid).toBe('new');
    expect(snap.gclid).toBeUndefined();
  });

  it('clears a >90-day-old snapshot on a param-less landing (reverts to Direct)', () => {
    captureLandingAttribution('?utm_source=google&gclid=g1', new Date('2026-01-01T00:00:00Z'));
    captureLandingAttribution('', new Date('2026-07-21T00:00:00Z')); // >90 days, no params
    expect(getAttributionSnapshot()).toBeUndefined();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('caps each value at the shared limit', () => {
    captureLandingAttribution(`?utm_campaign=${'x'.repeat(400)}`, new Date('2026-07-21T00:00:00Z'));
    expect(getAttributionSnapshot()!.campaign!.length).toBe(256); // RFQ_FIELD_LIMITS.attribution.campaign.max
  });

  it('swallows localStorage failures', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => captureLandingAttribution('?gclid=g1', new Date())).not.toThrow();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails** — Run: `cd <worktree> && rm -rf node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules node_modules && npx vitest run src/services/attributionSnapshot.test.ts`
Expected: FAIL — module `./attributionSnapshot` not found.

- [ ] **Step 3: Implement** — create `src/services/attributionSnapshot.ts`:

```ts
import { RFQ_FIELD_LIMITS } from '../../amplify/lib/rfq/limits';

const KEY = 'ns_attribution';
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;
const L = RFQ_FIELD_LIMITS.attribution;

export interface AttributionSnapshot {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  msclkid?: string;
  capturedAt: string;
  landingPath: string;
}

// utm fields are lowercased for aggregation alignment; click ids are kept
// verbatim (case-sensitive — folding breaks Google Ads offline-conversion match).
const UTM_FIELDS = [
  ['utm_source', 'source'],
  ['utm_medium', 'medium'],
  ['utm_campaign', 'campaign'],
  ['utm_term', 'term'],
  ['utm_content', 'content'],
] as const;
const CLICK_FIELDS = [
  ['gclid', 'gclid'],
  ['gbraid', 'gbraid'],
  ['wbraid', 'wbraid'],
  ['msclkid', 'msclkid'],
] as const;

function cap(v: string, max: number): string {
  return v.length > max ? v.slice(0, max) : v;
}

function parse(search: string, now: Date, landingPath: string): AttributionSnapshot | null {
  const params = new URLSearchParams(search);
  const out: Partial<AttributionSnapshot> = {};
  let hasAny = false;
  for (const [param, key] of UTM_FIELDS) {
    const raw = params.get(param);
    if (raw) { out[key] = cap(raw.toLowerCase(), L[key].max); hasAny = true; }
  }
  for (const [param, key] of CLICK_FIELDS) {
    const raw = params.get(param);
    if (raw) { out[key] = cap(raw, L[key].max); hasAny = true; }
  }
  if (!hasAny) return null;
  out.capturedAt = now.toISOString();
  out.landingPath = cap(landingPath, L.landingPath.max);
  return out as AttributionSnapshot;
}

/**
 * Capture last-non-direct attribution. A landing carrying any utm/click param
 * ALWAYS overwrites the stored snapshot (recency wins, ignores age). A param-less
 * landing never overwrites; it only clears a snapshot older than 90 days.
 */
export function captureLandingAttribution(
  search: string = typeof window !== 'undefined' ? window.location.search : '',
  now: Date = new Date(),
  landingPath: string = typeof window !== 'undefined' ? window.location.pathname : '',
): void {
  const fresh = parse(search, now, landingPath);
  try {
    if (fresh) {
      localStorage.setItem(KEY, JSON.stringify(fresh));
      return;
    }
    const existing = getAttributionSnapshot();
    if (existing) {
      const age = now.getTime() - new Date(existing.capturedAt).getTime();
      if (age > MAX_AGE_MS) localStorage.removeItem(KEY);
    }
  } catch { /* localStorage unavailable */ }
}

export function getAttributionSnapshot(): AttributionSnapshot | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const snap = JSON.parse(raw) as AttributionSnapshot;
    if (!snap.capturedAt) return undefined;
    return snap;
  } catch {
    return undefined;
  }
}
```

- [ ] **Step 4: Run to verify it passes** — Run: `cd <worktree> && npx vitest run src/services/attributionSnapshot.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Lint** — Run: `cd <worktree> && npx eslint src/services/attributionSnapshot.ts src/services/attributionSnapshot.test.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
rm <worktree>/node_modules
git -C <worktree> add src/services/attributionSnapshot.ts src/services/attributionSnapshot.test.ts
git -C <worktree> commit -m "feat(rfq): first-party attribution snapshot capture module"
```

---

### Task 3: Wire capture into page-load path

**Files:**
- Modify: `src/components/analytics/PageTimeTracker.tsx` (near the existing `classifyTrafficChannel` block, ~line 521)

- [ ] **Step 1: Add the import** at the top of `PageTimeTracker.tsx` (with the other service imports):

```ts
import { captureLandingAttribution } from '../../services/attributionSnapshot';
```

- [ ] **Step 2: Call capture once on first page load.** In the `if (typeof window !== 'undefined') {` block that reads `urlParams` (~line 509), immediately after `const urlParams = new URLSearchParams(window.location.search);` add:

```ts
      // Persist a first-party last-non-direct attribution snapshot for later RFQ
      // submission (join paid clicks to conversions). Safe to call every load —
      // param-less loads never overwrite an in-window snapshot.
      captureLandingAttribution();
```

- [ ] **Step 3: Typecheck + lint** — Run: `cd <worktree> && rm -rf node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules node_modules && npx eslint src/components/analytics/PageTimeTracker.tsx`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
rm <worktree>/node_modules
git -C <worktree> add src/components/analytics/PageTimeTracker.tsx
git -C <worktree> commit -m "feat(rfq): capture attribution snapshot on page load"
```

---

### Task 4: Attach snapshot to both entry-point payloads

**Files:**
- Modify: `src/pages/RFQPage.tsx` (~line 585, payload build)
- Modify: `src/components/common/QuoteModal.tsx` (~line 109, rfqPayload build)
- Test: `src/pages/RFQPage.test.tsx`, `src/components/common/QuoteModal.test.tsx`

- [ ] **Step 1: Write failing test in `RFQPage.test.tsx`.** Add a test that seeds a snapshot and asserts the submit fetch body carries `attribution`. Locate the existing submit-success test to copy its fetch-mock setup; add:

```ts
it('includes the attribution snapshot in the submit payload when present', async () => {
  const { captureLandingAttribution } = await import('../services/attributionSnapshot');
  captureLandingAttribution('?utm_source=google&utm_medium=cpc&gclid=g-abc', new Date());
  // ...render + fill required fields + submit as the existing success test does...
  const body = JSON.parse((globalThis.fetch as any).mock.calls.at(-1)[1].body);
  expect(body.attribution).toMatchObject({ source: 'google', medium: 'cpc', gclid: 'g-abc' });
});
```

(If the existing test file mocks `fetch` differently, mirror that exact mechanism; the assertion on `body.attribution` is the invariant.)

- [ ] **Step 2: Run to verify it fails** — Run: `cd <worktree> && rm -rf node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules node_modules && npx vitest run src/pages/RFQPage.test.tsx -t attribution`
Expected: FAIL — `body.attribution` is undefined.

- [ ] **Step 3: Implement in `RFQPage.tsx`.** Add the import:

```ts
import { getAttributionSnapshot } from '../services/attributionSnapshot';
```

Then after the `payload` object literal (after line 586, alongside the other `if (...) payload.x = ...` optionals):

```ts
      const attribution = getAttributionSnapshot();
      if (attribution) payload.attribution = attribution;
```

- [ ] **Step 4: Implement in `QuoteModal.tsx`.** Add the import (mirror RFQPage relative path — QuoteModal is in `src/components/common/`, so `../../services/attributionSnapshot`):

```ts
import { getAttributionSnapshot } from '../../services/attributionSnapshot';
```

The `rfqPayload` in QuoteModal is a single object literal (line ~100-116). It has no trailing `if (...)` optional block, so add the field inside the literal, after `visitorId: getVisitorId(),`:

```ts
        visitorId: getVisitorId(),
        ...(getAttributionSnapshot() ? { attribution: getAttributionSnapshot() } : {}),
```

- [ ] **Step 5: Write + run QuoteModal test** — add the analogous test to `QuoteModal.test.tsx` (seed snapshot, submit, assert `body.attribution`), then Run: `cd <worktree> && npx vitest run src/pages/RFQPage.test.tsx src/components/common/QuoteModal.test.tsx`
Expected: PASS (both attribution tests + all pre-existing tests green).

- [ ] **Step 6: Lint + commit**

```bash
cd <worktree> && npx eslint src/pages/RFQPage.tsx src/components/common/QuoteModal.tsx
rm <worktree>/node_modules
git -C <worktree> add src/pages/RFQPage.tsx src/components/common/QuoteModal.tsx src/pages/RFQPage.test.tsx src/components/common/QuoteModal.test.tsx
git -C <worktree> commit -m "feat(rfq): attach attribution snapshot to RFQ + quote payloads"
```

---

### Task 5: Lambda — validate, marshal-safe, store attribution

**Files:**
- Modify: `amplify/functions/submit-rfq/handler.ts` (docClient line 32, Zod schema ~line 120, item build ~805)
- Test: `amplify/functions/submit-rfq/handler.test.ts` (near line 1011)

- [ ] **Step 1: Write failing tests in `handler.test.ts`** inside the existing `describe('visitorId capture …')` sibling — add a new describe:

```ts
    describe('attribution snapshot', () => {
        const ATTR = { source: 'google', medium: 'cpc', gclid: 'g-1', capturedAt: '2026-07-21T00:00:00.000Z', landingPath: '/products/ald' };

        it('stores attribution on the RFQ META when provided', async () => {
            await handler(makeEvent({ ...VALID_RFQ, attribution: ATTR }), {} as never, (() => {}) as never);
            const putParams = mockSend.mock.calls.map((c) => c[0]?.input).find((i) => i?.Item?.SK === 'META' && i?.Item?.rfqId);
            expect(putParams.Item.attribution).toMatchObject({ source: 'google', gclid: 'g-1' });
        });

        it('stores a partial attribution (some utm fields absent) without a marshalling error', async () => {
            const partial = { source: 'google', capturedAt: '2026-07-21T00:00:00.000Z', landingPath: '/x' };
            await expect(handler(makeEvent({ ...VALID_RFQ, attribution: partial }), {} as never, (() => {}) as never)).resolves.toBeDefined();
        });

        it('accepts a missing attribution (optional, old clients)', async () => {
            await expect(handler(makeEvent({ ...VALID_RFQ }), {} as never, (() => {}) as never)).resolves.toBeDefined();
        });
    });
```

(Match the exact `mockSend`/`makeEvent`/`VALID_RFQ` helpers already used by the `visitorId capture` describe — read `handler.test.ts:1002-1058` and mirror them precisely.)

- [ ] **Step 2: Run to verify it fails** — Run: `cd <worktree> && rm -rf node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules node_modules && npx vitest run amplify/functions/submit-rfq/handler.test.ts -t attribution`
Expected: FAIL — `Item.attribution` undefined (and/or a marshalling throw on the partial test).

- [ ] **Step 3: Fix the docClient marshalling** at `handler.ts:32`:

```ts
const docClient = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true },
});
```

- [ ] **Step 4: Add the Zod `attribution` schema.** In the RFQ input schema, after the `visitorId: z.string().max(L.visitorId.max).optional(),` line (~120):

```ts
    attribution: z.object({
        source: z.string().max(L.attribution.source.max).optional(),
        medium: z.string().max(L.attribution.medium.max).optional(),
        campaign: z.string().max(L.attribution.campaign.max).optional(),
        term: z.string().max(L.attribution.term.max).optional(),
        content: z.string().max(L.attribution.content.max).optional(),
        gclid: z.string().max(L.attribution.gclid.max).optional(),
        gbraid: z.string().max(L.attribution.gbraid.max).optional(),
        wbraid: z.string().max(L.attribution.wbraid.max).optional(),
        msclkid: z.string().max(L.attribution.msclkid.max).optional(),
        capturedAt: z.string().max(L.attribution.capturedAt.max).optional(),
        landingPath: z.string().max(L.attribution.landingPath.max).optional(),
    }).optional(),
```

- [ ] **Step 5: Store it on the item.** In the full-RFQ item literal (~805, right after `visitorId: data.visitorId,`):

```ts
            attribution: data.attribution,
```

(With `removeUndefinedValues: true` now set, an absent `attribution` or absent sub-fields serialize cleanly.)

- [ ] **Step 6: Run to verify it passes** — Run: `cd <worktree> && npx vitest run amplify/functions/submit-rfq/handler.test.ts`
Expected: PASS (new attribution tests + all pre-existing handler tests green).

- [ ] **Step 7: Lint + commit**

```bash
cd <worktree> && npx eslint amplify/functions/submit-rfq/handler.ts amplify/functions/submit-rfq/handler.test.ts
rm <worktree>/node_modules
git -C <worktree> add amplify/functions/submit-rfq/handler.ts amplify/functions/submit-rfq/handler.test.ts
git -C <worktree> commit -m "feat(rfq): validate + store attribution snapshot on submission"
```

---

### Task 6: GraphQL type — declare visitorId + AttributionSnapshot

**Files:**
- Modify: `amplify/data/resource.ts` (RfqSubmission `554-586`; add a new `AttributionSnapshot` customType)

- [ ] **Step 1: Add a reusable `AttributionSnapshot` customType.** Immediately before `RfqSubmission: a.customType({` (line 554), add:

```ts
  AttributionSnapshot: a.customType({
    source: a.string(),
    medium: a.string(),
    campaign: a.string(),
    term: a.string(),
    content: a.string(),
    gclid: a.string(),
    gbraid: a.string(),
    wbraid: a.string(),
    msclkid: a.string(),
    capturedAt: a.string(),
    landingPath: a.string(),
  }),
```

- [ ] **Step 2: Declare `visitorId` + `attribution` on `RfqSubmission`.** Inside the `RfqSubmission` customType, after `referrerSource: a.string(),` (line 584):

```ts
    visitorId: a.string(),
    attribution: a.ref('AttributionSnapshot'),
```

- [ ] **Step 3: Typecheck** — Run: `cd <worktree> && rm -rf node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules node_modules && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -i 'resource.ts' || echo "resource OK"`
Expected: `resource OK`.

- [ ] **Step 4: Commit**

```bash
rm <worktree>/node_modules
git -C <worktree> add amplify/data/resource.ts
git -C <worktree> commit -m "feat(rfq): declare visitorId + AttributionSnapshot on RfqSubmission type"
```

---

### Task 7: Resolvers — project visitorId + attribution

**Files:**
- Modify: `amplify/functions/order-api/resolvers/listRfqs.ts` (return block, ~96-126)
- Modify: `amplify/functions/order-api/resolvers/getRfq.ts` (return block, ~22-…)

- [ ] **Step 1: Add a shared attribution mapper.** At the top of BOTH resolver files (after imports), add the same helper (duplicated intentionally — resolvers are bundled independently and must stay import-light; keep the two copies byte-identical):

```ts
function mapAttribution(a: any) {
  if (!a) return null;
  return {
    source: a.source || null,
    medium: a.medium || null,
    campaign: a.campaign || null,
    term: a.term || null,
    content: a.content || null,
    gclid: a.gclid || null,
    gbraid: a.gbraid || null,
    wbraid: a.wbraid || null,
    msclkid: a.msclkid || null,
    capturedAt: a.capturedAt || null,
    landingPath: a.landingPath || null,
  };
}
```

- [ ] **Step 2: Project the fields.** In each resolver's returned object, alongside `attachmentKeys` / `linkedOrderId`, add:

```ts
        visitorId: item.visitorId || null,
        attribution: mapAttribution(item.attribution),
```

- [ ] **Step 3: Typecheck** — Run: `cd <worktree> && rm -rf node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules node_modules && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -iE 'listRfqs|getRfq' || echo "resolvers OK"`
Expected: `resolvers OK`.

- [ ] **Step 4: Commit**

```bash
rm <worktree>/node_modules
git -C <worktree> add amplify/functions/order-api/resolvers/listRfqs.ts amplify/functions/order-api/resolvers/getRfq.ts
git -C <worktree> commit -m "fix(rfq): project visitorId + attribution in list/get resolvers"
```

---

### Task 8: Admin type + Traffic Source subcard

**Files:**
- Modify: `src/types/admin.ts` (RfqSubmission interface ~117-146)
- Modify: `src/pages/admin/RFQDetailPage.tsx` (add a section after Equipment Requirements)
- Test: `src/pages/admin/RFQDetailPage.test.tsx` (create if absent, else extend)

- [ ] **Step 1: Extend the admin type.** In `src/types/admin.ts`, add to the `RfqSubmission` interface (after `visitorId?: string | null;` at line 175, or add both if absent):

```ts
  attribution?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
    gclid?: string | null;
    gbraid?: string | null;
    wbraid?: string | null;
    msclkid?: string | null;
    capturedAt?: string | null;
    landingPath?: string | null;
  } | null;
```

- [ ] **Step 2: Write the failing test** — `src/pages/admin/RFQDetailPage.test.tsx`. Assert the three-tier fallback renders correctly. Mirror the existing admin-page test render harness (mock the RFQ-fetch hook). Minimum three cases:

```ts
it('shows Paid — Google + gclid when attribution has a gclid', () => {
  renderWithRfq({ attribution: { source: 'google', medium: 'cpc', gclid: 'g-xyz', capturedAt: '2026-07-21T00:00:00Z', landingPath: '/products/ald' } });
  expect(screen.getByText(/Paid — Google/i)).toBeInTheDocument();
  expect(screen.getByText('google')).toBeInTheDocument();
});
it('shows Started from when no attribution but referrerSource present', () => {
  renderWithRfq({ attribution: null, referrerSource: 'insights/types-of-wafer-probe-stations' });
  expect(screen.getByText(/Started from/i)).toBeInTheDocument();
  expect(screen.getByText(/insights\/types-of-wafer-probe-stations/)).toBeInTheDocument();
});
it('shows Direct / not captured when neither present', () => {
  renderWithRfq({ attribution: null, referrerSource: null });
  expect(screen.getByText(/Direct \/ not captured/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run to verify it fails** — Run: `cd <worktree> && rm -rf node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules node_modules && npx vitest run src/pages/admin/RFQDetailPage.test.tsx`
Expected: FAIL — the Traffic Source section doesn't exist yet.

- [ ] **Step 4: Add the Traffic Source subcard** to `RFQDetailPage.tsx`, after the Equipment Requirements card (mirror the existing card markup style — `bg-surface-container-lowest rounded-xl p-4 md:p-6 shadow-card mb-6`):

```tsx
      {/* Traffic Source */}
      <div className="bg-surface-container-lowest rounded-xl p-4 md:p-6 shadow-card mb-6">
        <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-lg">ads_click</span>
          Traffic Source
        </h3>
        {rfq.attribution ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {(rfq.attribution.gclid || rfq.attribution.medium === 'cpc' || rfq.attribution.medium === 'ppc') && (
              <div className="md:col-span-2">
                <span
                  className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full bg-primary-container text-on-primary-container"
                  title="GCLID present (paid Google traffic)"
                >
                  Paid — Google
                </span>
                {rfq.attribution.gclid && (
                  <button
                    type="button"
                    className="ml-2 text-xs text-primary underline"
                    onClick={() => navigator.clipboard?.writeText(rfq.attribution!.gclid!)}
                  >
                    Copy GCLID
                  </button>
                )}
              </div>
            )}
            <div><p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Source</p><p className="text-sm font-medium text-on-surface">{rfq.attribution.source || '-'}</p></div>
            <div><p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Medium</p><p className="text-sm font-medium text-on-surface">{rfq.attribution.medium || '-'}</p></div>
            <div><p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Campaign</p><p className="text-sm font-medium text-on-surface">{rfq.attribution.campaign || '-'}</p></div>
            <div><p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Term</p><p className="text-sm font-medium text-on-surface">{rfq.attribution.term || '-'}</p></div>
            <div><p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Landing Page</p><p className="text-sm font-medium text-on-surface">{rfq.attribution.landingPath || '-'}</p></div>
            <div><p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Captured</p><p className="text-sm font-medium text-on-surface">{rfq.attribution.capturedAt ? formatDateTime(rfq.attribution.capturedAt) : '-'}</p></div>
          </div>
        ) : rfq.referrerSource ? (
          <p className="text-sm text-on-surface-variant">Started from: <span className="font-medium text-on-surface">{rfq.referrerSource}</span></p>
        ) : (
          <p className="text-sm text-on-surface-variant">Direct / not captured</p>
        )}
      </div>
```

- [ ] **Step 5: Run to verify it passes** — Run: `cd <worktree> && npx vitest run src/pages/admin/RFQDetailPage.test.tsx`
Expected: PASS (3 tiers).

- [ ] **Step 6: Lint + commit**

```bash
cd <worktree> && npx eslint src/types/admin.ts src/pages/admin/RFQDetailPage.tsx src/pages/admin/RFQDetailPage.test.tsx
rm <worktree>/node_modules
git -C <worktree> add src/types/admin.ts src/pages/admin/RFQDetailPage.tsx src/pages/admin/RFQDetailPage.test.tsx
git -C <worktree> commit -m "feat(rfq): admin RFQ detail Traffic Source subcard"
```

---

### Task 9: Full verification + PR

- [ ] **Step 1: Full suite + lint + typecheck** (symlink node_modules first):

```bash
cd <worktree> && rm -rf node_modules && ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules node_modules
npx vitest run --exclude '**/.claude/**'
npx eslint src/services/attributionSnapshot.ts src/pages/RFQPage.tsx src/components/common/QuoteModal.tsx amplify/functions/submit-rfq/handler.ts src/pages/admin/RFQDetailPage.tsx
npx tsc --noEmit -p tsconfig.json
```

Expected: all green. Any failure in a file this branch did not touch → check whether it reproduces on `origin/main` (pre-existing) before treating it as ours; watch for `no-irregular-whitespace` if any literal typographic char slipped in.

- [ ] **Step 2: Remove symlink; push; open PR**

```bash
rm <worktree>/node_modules
git -C <worktree> push -u origin feature/rfq-attribution-snapshot
gh pr create --base main --head feature/rfq-attribution-snapshot \
  --title "RFQ attribution: last-non-direct UTM/gclid snapshot + resolver visitorId fix" \
  --body "<summary: client snapshot module (recency-overwrite, 90d expiry, utm-lowercased/click-ids-verbatim), two entry points, Lambda validate+store (removeUndefinedValues fix), RfqSubmission type gains visitorId+AttributionSnapshot, list/get resolvers project them (closes the pre-existing visitorId-null blind spot), admin Traffic Source subcard. Offline-conversion upload explicitly out of scope. 🤖 Generated with [Claude Code](https://claude.com/claude-code)>"
```

- [ ] **Step 3: Gated merge** — `gh pr checks <n> --watch && gh pr merge <n> --merge` (merge ONLY chained on the CI exit code — PR #327 lesson).

- [ ] **Step 4: Post-deploy verification (after Amplify pipeline deploys main).** Re-run the raw-RFQ probe from the spec: query `getRfq` for a recent real RFQ (2026-07-13…-20) and confirm `visitorId` now returns non-null (proves the resolver+type fix end-to-end). Then, ~1 day after a fresh ad click + RFQ, confirm the new RFQ carries a populated `attribution` with `utmSource=google`.

---

## Self-review (completed)

- **Spec coverage:** §1 client module → Task 2; normalize/empty-string/verbatim-click-ids/limits-from-SSoT → Task 2 tests; wire on load → Task 3; §2 two entry points → Task 4; §3 limits → Task 1, Zod + removeUndefinedValues + store + partial test → Task 5; §4 type visitorId+AttributionSnapshot → Task 6, resolver field-by-field `|| null` → Task 7; §5 three-tier admin subcard + Paid badge + copy-gclid → Task 8; §6 tests distributed per task; §7 out-of-scope respected (no offline upload). No gaps.
- **Placeholder scan:** every code step shows complete code; test steps that say "mirror the existing harness" name the exact file+lines to copy and state the invariant assertion. No TBD/TODO.
- **Type consistency:** `AttributionSnapshot` shape identical across client interface (Task 2), Zod (Task 5), GraphQL customType (Task 6), resolver mapper (Task 7), admin type (Task 8) — 11 fields (5 utm + 4 click + capturedAt + landingPath); `captureLandingAttribution`/`getAttributionSnapshot` names stable across Tasks 2–4.
