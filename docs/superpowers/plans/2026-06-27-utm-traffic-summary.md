# UTM Traffic Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global "UTM Traffic Summary" card to the admin analytics page that aggregates UTM-bearing traffic by Source/Campaign/Content with Visits/Visitors/Known-Organizations, supports search/sort, and click-to-drill-down that filters the existing visitor list.

**Architecture:** All aggregation lives in pure, unit-tested helpers in `src/services/behaviorAnalytics.ts`. A small self-contained presentational component `src/pages/admin/UtmTrafficSummary.tsx` renders the card from those helpers. `AdminAnalyticsPage.tsx` owns the `utmFilter` state, renders the card over its page-level filtered events, and AND-composes `utmFilter` into the existing `enhancedFilteredOrgs` pipeline. No backend/schema changes; purely client-side over already-loaded events.

**Tech Stack:** React + TypeScript, Vite, vitest (jsdom) + @testing-library/react, Amplify Gen2 schema-derived types.

**Spec:** `docs/superpowers/specs/2026-06-27-utm-traffic-summary-design.md`

---

## File Structure

- `src/services/behaviorAnalytics.ts` — **modify**: add types (`UtmGroupBy`, `UtmFilter`, `UtmEvent`, `UtmSummaryRow`) and pure helpers (`normalizeUtmValue`, `isKnownOrganization`, `matchesUtmFilter`, `summarizeUtmTraffic`). One responsibility: analytics computation. Already holds `resolveTrafficChannel`, `hasCampaignAttribution`, etc.
- `src/services/behaviorAnalytics.test.ts` — **modify**: unit tests for the new helpers.
- `src/pages/admin/UtmTrafficSummary.tsx` — **create**: presentational card (group-by control, search, sort, chips, table). Owns only local search/sort UI state; receives events/filter via props.
- `src/pages/admin/UtmTrafficSummary.test.tsx` — **create**: RTL render + interaction test.
- `src/pages/admin/AdminAnalyticsPage.tsx` — **modify**: `utmFilter` state, render `<UtmTrafficSummary>`, AND-compose `utmFilter` into `enhancedFilteredOrgs`.
- `docs/UTM-Naming-Convention.md` — **modify**: note the new aggregate view.

---

## Task 1: Pure value/org helpers + types

**Files:**
- Modify: `src/services/behaviorAnalytics.ts` (insert after the campaign attribution helpers, i.e. after `formatCampaignAttribution`)
- Test: `src/services/behaviorAnalytics.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/services/behaviorAnalytics.test.ts`:

```ts
import {
  normalizeUtmValue,
  isKnownOrganization,
} from './behaviorAnalytics';

describe('normalizeUtmValue', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizeUtmValue('  mrs  ')).toBe('mrs');
  });
  it('treats null/undefined/empty/whitespace as absent (undefined)', () => {
    expect(normalizeUtmValue(null)).toBeUndefined();
    expect(normalizeUtmValue(undefined)).toBeUndefined();
    expect(normalizeUtmValue('')).toBeUndefined();
    expect(normalizeUtmValue('   ')).toBeUndefined();
  });
});

describe('isKnownOrganization', () => {
  it('is true for a real org with a name', () => {
    expect(isKnownOrganization({ orgName: 'MIT', organizationType: 'education' })).toBe(true);
  });
  it('is false for ISP/telecom/unknown org types', () => {
    expect(isKnownOrganization({ orgName: 'Comcast', organizationType: 'telecom_isp' })).toBe(false);
    expect(isKnownOrganization({ orgName: 'Verizon', organizationType: 'isp' })).toBe(false);
    expect(isKnownOrganization({ orgName: 'Some ISP', organizationType: 'unknown' })).toBe(false);
  });
  it('is false when orgName is missing/blank', () => {
    expect(isKnownOrganization({ orgName: '', organizationType: 'education' })).toBe(false);
    expect(isKnownOrganization({ organizationType: 'education' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts`
Expected: FAIL — `normalizeUtmValue`/`isKnownOrganization` are not exported.

- [ ] **Step 3: Write the implementation**

Insert into `src/services/behaviorAnalytics.ts` after the `formatCampaignAttribution` function:

```ts
// --- UTM traffic summary (admin aggregation) ---

export type UtmGroupBy = 'source' | 'campaign' | 'content';

/** Active UTM filter. A `null` value means "(not set)" — field absent on the
 *  event. An omitted key is ignored. A string is an exact (normalized) match. */
export interface UtmFilter {
  source?: string | null;
  campaign?: string | null;
  content?: string | null;
}

/** Minimal event shape needed for UTM aggregation. */
export interface UtmEvent {
  eventType?: string | null;
  visitorId?: string | null;
  orgName?: string | null;
  organizationType?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
}

export interface UtmSummaryRow {
  value: string;        // display value, or "(not set)"
  isNotSet: boolean;
  visits: number;
  visitors: number;
  knownOrganizations: number;
}

// Org types that are NOT counted as a "known organization" (matches the admin's
// existing ISP handling in AdminAnalyticsPage.tsx).
const NON_KNOWN_ORG_TYPES = new Set(['telecom_isp', 'isp', 'unknown']);

/** Trim a UTM/string value; null/undefined/empty/whitespace-only → undefined. */
export function normalizeUtmValue(v: string | null | undefined): string | undefined {
  if (v == null) return undefined;
  const trimmed = v.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** True when the event resolves to a real organization (not ISP/telecom/unknown). */
export function isKnownOrganization(e: UtmEvent): boolean {
  if (!normalizeUtmValue(e.orgName)) return false;
  const type = (e.organizationType || 'unknown').toLowerCase();
  return !NON_KNOWN_ORG_TYPES.has(type);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts`
Expected: PASS (all `normalizeUtmValue` + `isKnownOrganization` cases green).

- [ ] **Step 5: Commit**

```bash
git add src/services/behaviorAnalytics.ts src/services/behaviorAnalytics.test.ts
git commit -m "feat(analytics): UTM value normalization + known-org helper"
```

---

## Task 2: `matchesUtmFilter` predicate

**Files:**
- Modify: `src/services/behaviorAnalytics.ts` (after `isKnownOrganization`)
- Test: `src/services/behaviorAnalytics.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/services/behaviorAnalytics.test.ts`:

```ts
import { matchesUtmFilter } from './behaviorAnalytics';

describe('matchesUtmFilter', () => {
  const mrs = { utmSource: 'mrs', utmCampaign: 'mxenes_202610', utmContent: 'qr_video' };

  it('matches when normalized field equals filter value (incl. whitespace variants)', () => {
    expect(matchesUtmFilter({ utmSource: ' mrs ' }, { source: 'mrs' })).toBe(true);
    expect(matchesUtmFilter(mrs, { source: 'mrs', content: 'qr_video' })).toBe(true);
  });

  it('does not match a different value', () => {
    expect(matchesUtmFilter(mrs, { source: 'linkedin' })).toBe(false);
  });

  it('null filter matches an absent field, not a present one', () => {
    expect(matchesUtmFilter({ utmSource: 'mrs' }, { content: null })).toBe(true);
    expect(matchesUtmFilter({ utmSource: 'mrs', utmContent: '   ' }, { content: null })).toBe(true);
    expect(matchesUtmFilter(mrs, { content: null })).toBe(false);
  });

  it('ignores omitted keys; multiple keys AND together', () => {
    expect(matchesUtmFilter(mrs, {})).toBe(true);
    expect(matchesUtmFilter(mrs, { source: 'mrs', campaign: 'other' })).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts`
Expected: FAIL — `matchesUtmFilter` not exported.

- [ ] **Step 3: Write the implementation**

Insert into `src/services/behaviorAnalytics.ts` after `isKnownOrganization`:

```ts
const UTM_FIELD_BY_KEY: Record<keyof UtmFilter, 'utmSource' | 'utmCampaign' | 'utmContent'> = {
  source: 'utmSource',
  campaign: 'utmCampaign',
  content: 'utmContent',
};

/** True when an event satisfies every set key in the filter.
 *  - omitted key → ignored
 *  - null value  → event field must be ABSENT ("(not set)")
 *  - string      → normalized event field must equal it */
export function matchesUtmFilter(e: UtmEvent, filter: UtmFilter): boolean {
  for (const key of Object.keys(filter) as (keyof UtmFilter)[]) {
    const want = filter[key];
    if (want === undefined) continue;
    const got = normalizeUtmValue(e[UTM_FIELD_BY_KEY[key]]);
    if (want === null) {
      if (got !== undefined) return false;
    } else if (got !== want) {
      return false;
    }
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/behaviorAnalytics.ts src/services/behaviorAnalytics.test.ts
git commit -m "feat(analytics): matchesUtmFilter predicate with (not set) semantics"
```

---

## Task 3: `summarizeUtmTraffic` aggregation

**Files:**
- Modify: `src/services/behaviorAnalytics.ts` (after `matchesUtmFilter`)
- Test: `src/services/behaviorAnalytics.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/services/behaviorAnalytics.test.ts`:

```ts
import { summarizeUtmTraffic, type UtmEvent } from './behaviorAnalytics';

const pv = (o: Partial<UtmEvent>): UtmEvent => ({ eventType: 'page_view', ...o });

describe('summarizeUtmTraffic', () => {
  it('counts only page_view events for Visits', () => {
    const events: UtmEvent[] = [
      pv({ utmSource: 'mrs', visitorId: 'v1' }),
      { eventType: 'pdf_download', utmSource: 'mrs', visitorId: 'v1' }, // excluded
    ];
    const rows = summarizeUtmTraffic(events, 'source', {});
    expect(rows).toEqual([
      { value: 'mrs', isNotSet: false, visits: 1, visitors: 1, knownOrganizations: 0 },
    ]);
  });

  it('groups by dimension and collapses whitespace variants', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1' }),
      pv({ utmSource: ' mrs ', visitorId: 'v2' }),
      pv({ utmSource: 'linkedin', visitorId: 'v3' }),
    ];
    const rows = summarizeUtmTraffic(events, 'source', {});
    expect(rows[0]).toEqual({ value: 'mrs', isNotSet: false, visits: 2, visitors: 2, knownOrganizations: 0 });
    expect(rows.find(r => r.value === 'linkedin')!.visits).toBe(1);
  });

  it('counts distinct visitors and known organizations (ISP excluded from org count)', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1', orgName: 'MIT', organizationType: 'education' }),
      pv({ utmSource: 'mrs', visitorId: 'v1', orgName: 'MIT', organizationType: 'education' }),
      pv({ utmSource: 'mrs', visitorId: 'v2', orgName: 'Comcast', organizationType: 'telecom_isp' }),
    ];
    const rows = summarizeUtmTraffic(events, 'source', {});
    expect(rows).toEqual([
      { value: 'mrs', isNotSet: false, visits: 3, visitors: 2, knownOrganizations: 1 },
    ]);
  });

  it('buckets missing dimension as (not set)', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1' }),               // no content
      pv({ utmSource: 'mrs', visitorId: 'v2', utmContent: 'qr_video' }),
    ];
    const rows = summarizeUtmTraffic(events, 'content', {});
    const notSet = rows.find(r => r.isNotSet)!;
    expect(notSet.value).toBe('(not set)');
    expect(notSet.visits).toBe(1);
  });

  it('applies filter before grouping (mrs → content split shows only MRS)', () => {
    const events = [
      pv({ utmSource: 'mrs', visitorId: 'v1', utmContent: 'qr_video' }),
      pv({ utmSource: 'mrs', visitorId: 'v2', utmContent: 'qr_brochure' }),
      pv({ utmSource: 'linkedin', visitorId: 'v3', utmContent: 'qr_video' }),
    ];
    const rows = summarizeUtmTraffic(events, 'content', { source: 'mrs' });
    expect(rows.map(r => r.value).sort()).toEqual(['qr_brochure', 'qr_video']);
    expect(rows.every(r => r.visits === 1)).toBe(true);
  });

  it('sorts by visits desc and returns [] for empty input', () => {
    expect(summarizeUtmTraffic([], 'source', {})).toEqual([]);
    const events = [
      pv({ utmSource: 'a', visitorId: 'v1' }),
      pv({ utmSource: 'b', visitorId: 'v2' }),
      pv({ utmSource: 'b', visitorId: 'v3' }),
    ];
    expect(summarizeUtmTraffic(events, 'source', {}).map(r => r.value)).toEqual(['b', 'a']);
  });

  it('excludes page_views with no UTM at all (organic traffic is not in the table)', () => {
    const events = [
      pv({ visitorId: 'v1' }),                                   // organic, no UTM → excluded
      pv({ utmCampaign: 'mxenes_202610', visitorId: 'v2' }),     // has UTM but no source → (not set) source row
    ];
    const rows = summarizeUtmTraffic(events, 'source', {});
    expect(rows).toEqual([
      { value: '(not set)', isNotSet: true, visits: 1, visitors: 1, knownOrganizations: 0 },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts`
Expected: FAIL — `summarizeUtmTraffic` not exported.

- [ ] **Step 3: Write the implementation**

Insert into `src/services/behaviorAnalytics.ts` after `matchesUtmFilter`:

```ts
const UTM_FIELD_BY_GROUP: Record<UtmGroupBy, 'utmSource' | 'utmCampaign' | 'utmContent'> = {
  source: 'utmSource',
  campaign: 'utmCampaign',
  content: 'utmContent',
};

// Sentinel key for the "(not set)" group —   cannot appear in a real UTM value.
const NOT_SET_KEY = ' (not set)';

/** Aggregate UTM traffic. Counts only page_view events, applies `filter` first,
 *  groups by the normalized `groupBy` value, and returns rows sorted by visits
 *  desc (ties broken by value asc). */
export function summarizeUtmTraffic(
  events: UtmEvent[],
  groupBy: UtmGroupBy,
  filter: UtmFilter,
): UtmSummaryRow[] {
  const field = UTM_FIELD_BY_GROUP[groupBy];
  const groups = new Map<string, { visits: number; visitors: Set<string>; orgs: Set<string>; isNotSet: boolean }>();
  // Organic traffic (no UTM at all) is excluded from the UTM summary entirely.
  const hasAnyUtm = (ev: UtmEvent) => Boolean(
    normalizeUtmValue(ev.utmSource) || normalizeUtmValue(ev.utmCampaign) || normalizeUtmValue(ev.utmContent),
  );

  for (const e of events) {
    if (e.eventType !== 'page_view') continue;
    if (!hasAnyUtm(e)) continue;
    if (!matchesUtmFilter(e, filter)) continue;

    const val = normalizeUtmValue(e[field]);
    const isNotSet = val === undefined;
    const key = isNotSet ? NOT_SET_KEY : val!;

    let g = groups.get(key);
    if (!g) {
      g = { visits: 0, visitors: new Set(), orgs: new Set(), isNotSet };
      groups.set(key, g);
    }
    g.visits += 1;
    const vid = normalizeUtmValue(e.visitorId);
    if (vid) g.visitors.add(vid);
    if (isKnownOrganization(e)) g.orgs.add(normalizeUtmValue(e.orgName)!);
  }

  return Array.from(groups.entries())
    .map(([key, g]) => ({
      value: g.isNotSet ? '(not set)' : key,
      isNotSet: g.isNotSet,
      visits: g.visits,
      visitors: g.visitors.size,
      knownOrganizations: g.orgs.size,
    }))
    .sort((a, b) => b.visits - a.visits || a.value.localeCompare(b.value));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts`
Expected: PASS (all summarize cases green).

- [ ] **Step 5: Commit**

```bash
git add src/services/behaviorAnalytics.ts src/services/behaviorAnalytics.test.ts
git commit -m "feat(analytics): summarizeUtmTraffic aggregation (page_view-only, filter-aware)"
```

---

## Task 4: `UtmTrafficSummary` presentational component

**Files:**
- Create: `src/pages/admin/UtmTrafficSummary.tsx`
- Test: `src/pages/admin/UtmTrafficSummary.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/admin/UtmTrafficSummary.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UtmTrafficSummary } from './UtmTrafficSummary';
import type { UtmEvent } from '../../services/behaviorAnalytics';

const events: UtmEvent[] = [
  { eventType: 'page_view', utmSource: 'mrs', visitorId: 'v1', utmContent: 'qr_video' },
  { eventType: 'page_view', utmSource: 'mrs', visitorId: 'v2', utmContent: 'qr_brochure' },
  { eventType: 'page_view', utmSource: 'linkedin', visitorId: 'v3' },
];

describe('UtmTrafficSummary', () => {
  it('renders a row per source and calls onFilterChange on row click', () => {
    const onFilterChange = vi.fn();
    render(
      <UtmTrafficSummary
        events={events}
        groupBy="source"
        onGroupByChange={() => {}}
        filter={{}}
        onFilterChange={onFilterChange}
      />
    );
    expect(screen.getByText('mrs')).toBeInTheDocument();
    expect(screen.getByText('linkedin')).toBeInTheDocument();
    fireEvent.click(screen.getByText('mrs'));
    expect(onFilterChange).toHaveBeenCalledWith({ source: 'mrs' });
  });

  it('shows an empty state when there is no UTM traffic', () => {
    render(
      <UtmTrafficSummary
        events={[{ eventType: 'page_view', visitorId: 'v1' }]}
        groupBy="source"
        onGroupByChange={() => {}}
        filter={{}}
        onFilterChange={() => {}}
      />
    );
    expect(screen.getByText(/暂无 UTM 流量/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/UtmTrafficSummary.test.tsx`
Expected: FAIL — module `./UtmTrafficSummary` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/pages/admin/UtmTrafficSummary.tsx`:

```tsx
import { useMemo, useState } from 'react';
import {
  summarizeUtmTraffic,
  type UtmEvent,
  type UtmFilter,
  type UtmGroupBy,
  type UtmSummaryRow,
} from '../../services/behaviorAnalytics';

type SortCol = 'value' | 'visits' | 'visitors' | 'knownOrganizations';

interface Props {
  events: UtmEvent[];
  groupBy: UtmGroupBy;
  onGroupByChange: (g: UtmGroupBy) => void;
  filter: UtmFilter;
  onFilterChange: (f: UtmFilter) => void;
}

const GROUP_OPTIONS: { key: UtmGroupBy; label: string }[] = [
  { key: 'source', label: 'Source' },
  { key: 'campaign', label: 'Campaign' },
  { key: 'content', label: 'Content' },
];

export function UtmTrafficSummary({ events, groupBy, onGroupByChange, filter, onFilterChange }: Props) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<{ col: SortCol; dir: 'asc' | 'desc' }>({ col: 'visits', dir: 'desc' });

  const rows = useMemo(() => summarizeUtmTraffic(events, groupBy, filter), [events, groupBy, filter]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? rows.filter((r) => r.value.toLowerCase().includes(q)) : rows;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.col === 'value') return a.value.localeCompare(b.value) * dir;
      return (a[sort.col] - b[sort.col]) * dir;
    });
  }, [rows, search, sort]);

  const toggleSort = (col: SortCol) =>
    setSort((s) => (s.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'desc' }));

  const rowClick = (r: UtmSummaryRow) =>
    onFilterChange({ ...filter, [groupBy]: r.isNotSet ? null : r.value });

  const removeChip = (key: keyof UtmFilter) => {
    const next = { ...filter };
    delete next[key];
    onFilterChange(next);
  };

  const chips = (Object.keys(filter) as (keyof UtmFilter)[]).filter((k) => filter[k] !== undefined);

  const header = (col: SortCol, label: string, align: 'left' | 'right') => (
    <th
      className={`px-3 py-2 text-xs font-bold text-on-surface-variant cursor-pointer select-none ${align === 'right' ? 'text-right' : 'text-left'}`}
      onClick={() => toggleSort(col)}
    >
      {label}{sort.col === col ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
    </th>
  );

  return (
    <div className="bg-surface rounded-xl border border-outline-variant p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-on-surface flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">sell</span> UTM Traffic Summary
        </h3>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-outline-variant overflow-hidden">
            {GROUP_OPTIONS.map((o) => (
              <button
                key={o.key}
                onClick={() => onGroupByChange(o.key)}
                className={`px-3 py-1 text-xs font-medium ${groupBy === o.key ? 'bg-primary-fixed text-primary' : 'text-on-surface-variant'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="text-xs px-2 py-1 rounded border border-outline-variant bg-surface-container"
          />
        </div>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {chips.map((k) => (
            <span key={k} className="inline-flex items-center gap-1 text-[11px] rounded px-2 py-0.5" style={{ background: '#ede7f6', color: '#5e35b1' }}>
              {k} = {filter[k] === null ? '(not set)' : filter[k]}
              <button onClick={() => removeChip(k)} aria-label={`remove ${k} filter`} className="material-symbols-outlined text-[12px]">close</button>
            </span>
          ))}
          <button onClick={() => onFilterChange({})} className="text-[11px] text-primary underline">Clear</button>
        </div>
      )}

      {visible.length === 0 ? (
        <p className="text-xs text-on-surface-variant py-6 text-center">暂无 UTM 流量，部署后带 UTM 的新流量才会出现。</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              {header('value', GROUP_OPTIONS.find((o) => o.key === groupBy)!.label, 'left')}
              {header('visits', 'Visits', 'right')}
              {header('visitors', 'Visitors', 'right')}
              {header('knownOrganizations', 'Known Orgs', 'right')}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.value}
                onClick={() => rowClick(r)}
                className="border-b border-outline-variant/50 hover:bg-surface-container cursor-pointer"
              >
                <td className={`px-3 py-2 text-sm ${r.isNotSet ? 'text-on-surface-variant italic' : 'text-on-surface font-medium'}`}>{r.value}</td>
                <td className="px-3 py-2 text-sm text-right">{r.visits}</td>
                <td className="px-3 py-2 text-sm text-right">{r.visitors}</td>
                <td className="px-3 py-2 text-sm text-right">{r.knownOrganizations}</td>
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

Run: `npx vitest run src/pages/admin/UtmTrafficSummary.test.tsx`
Expected: PASS (both render + click and empty-state cases).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/UtmTrafficSummary.tsx src/pages/admin/UtmTrafficSummary.test.tsx
git commit -m "feat(admin): UtmTrafficSummary card component"
```

---

## Task 5: Wire the card + filter into AdminAnalyticsPage

**Files:**
- Modify: `src/pages/admin/AdminAnalyticsPage.tsx`

- [ ] **Step 1: Add the import**

At the top import from behaviorAnalytics, extend the existing import (currently `resolveTrafficChannel, extractSearchQuery, hasCampaignAttribution, formatCampaignAttribution, type TrafficChannel, type LifecycleStage`) to also include `matchesUtmFilter, type UtmFilter, type UtmGroupBy`. Add a new import line for the component:

```tsx
import { UtmTrafficSummary } from './UtmTrafficSummary';
```

- [ ] **Step 2: Add state**

Next to the other filter `useState` hooks (near `const [channelFilter, setChannelFilter] = useState<string>('all');`, ~line 2729):

```tsx
const [utmFilter, setUtmFilter] = useState<UtmFilter>({});
const [utmGroupBy, setUtmGroupBy] = useState<UtmGroupBy>('source');
```

- [ ] **Step 3: AND-compose utmFilter into the org list**

In the `enhancedFilteredOrgs` useMemo (~line 3386), add a block alongside the existing `channelFilter` block, and add `utmFilter` to the dependency array:

```tsx
    if (utmFilter.source !== undefined || utmFilter.campaign !== undefined || utmFilter.content !== undefined) {
      result = result.filter((o) => o.events.some((e) => matchesUtmFilter(e, utmFilter)));
    }
```

Update the dependency array of that `useMemo` to include `utmFilter`:

```tsx
  }, [searchedOrgs, channelFilter, regionFilter, scoreMin, scoreMax, lifecycleFilter, typeFilter, utmFilter]);
```

- [ ] **Step 4: Render the card**

Render the component where the analytics sections are laid out (near the existing traffic-source / keyword UI). Pass the page-level filtered events (`filteredEvents`, defined ~line 3197):

```tsx
<UtmTrafficSummary
  events={filteredEvents}
  groupBy={utmGroupBy}
  onGroupByChange={setUtmGroupBy}
  filter={utmFilter}
  onFilterChange={setUtmFilter}
/>
```

Note: `filteredEvents` items are `AnalyticsEvent` (schema-derived) and structurally satisfy the `UtmEvent` prop shape (all UtmEvent fields exist on `AnalyticsEvent` after PR #199). If TypeScript complains about excess/optional mismatch, pass `events={filteredEvents as UtmEvent[]}`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/pages/admin/AdminAnalyticsPage.tsx
git commit -m "feat(admin): render UTM Traffic Summary and AND-compose utmFilter into org list"
```

---

## Task 6: Update the UTM convention doc

**Files:**
- Modify: `docs/UTM-Naming-Convention.md`

- [ ] **Step 1: Update the "报表去哪看" admin row**

Change the admin row note (line ~100) from the per-event-badge-only description to mention the aggregate view. Replace the admin row's middle cell text with:

```
✅ 访客时间线显示来源徽章 + 全局「UTM Traffic Summary」卡片（按 Source/Campaign/Content 聚合 Visits/Visitors/Known Orgs，点行钻取）
```

And append to the note paragraph below the table:

```
聚合视图（UTM Traffic Summary，本次新增）：按 Source/Campaign/Content 分组统计，点行可下钻并筛选下方访客列表；仅统计 page_view 落地事件，仅含部署后新流量。
```

- [ ] **Step 2: Commit**

```bash
git add docs/UTM-Naming-Convention.md
git commit -m "docs: note admin UTM Traffic Summary aggregate view"
```

---

## Task 7: Full verification

- [ ] **Step 1: Run the full unit suite for touched modules**

Run: `npx vitest run src/services/behaviorAnalytics.test.ts src/pages/admin/UtmTrafficSummary.test.tsx`
Expected: PASS — all UTM helper + component tests green.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Lint the changed files**

Run: `npx eslint src/services/behaviorAnalytics.ts src/pages/admin/UtmTrafficSummary.tsx src/pages/admin/AdminAnalyticsPage.tsx --ext ts,tsx`
Expected: No NEW errors. (Pre-existing `any` errors in `AdminAnalyticsPage.tsx` may remain — do not introduce new ones in the lines you added.)

- [ ] **Step 4: Final commit (if any lint autofix applied)**

```bash
git add -A && git commit -m "chore: lint pass for UTM Traffic Summary" || echo "nothing to commit"
```

---

## Out of Scope (do not implement here)

- Conversion attribution (RFQ / downloads / conversion rate) — separate v2 card.
- ROI metrics — v3.
- Any backend/schema/DynamoDB changes — this feature is purely client-side over already-loaded events.
