# Logistics Cases — Admin UI Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the internal admin UI for Logistics Cases — list (filter + paginate + stat tiles), detail (milestone progress + legs + log timeline + edit), and create — on top of the deployed Plan 1 backend.

**Architecture:** Mirror the Orders stack exactly: hand-written TS interfaces in `src/types/logistics.ts` (NOT generated `Schema` types — matches the codebase, and `a.json()` stats come back as strings), thin `logisticsAdminService` (done in Plan 1) → hooks in `src/hooks/useLogisticsCases.ts` → pages in `src/pages/admin/`. Reuse the `StatusBadge`/Material-Symbols/Material-3 Tailwind-token idiom.

**Tech Stack:** React + TypeScript, react-router-dom, Amplify Data client (via `logisticsAdminService`), Tailwind (Material-3 tokens), vitest + Testing Library.

**Prereqs (DONE):** Backend deployed; `amplify_outputs.json` contains logistics ops; `src/services/logisticsAdminService.ts` exists with `listLogisticsCases / getLogisticsCase / fetchLogisticsStats / createLogisticsCase / updateLogisticsCase / advanceLogisticsStage / addLeg / updateLeg / removeLeg`.

**Spec:** `docs/superpowers/specs/2026-06-19-logistics-cases-design.md` · **Skeleton:** `docs/superpowers/plans/2026-06-19-logistics-cases-ui-skeleton.md`

**Reference files to mirror (read before starting):**
- `src/types/admin.ts` — interface/label/const-array style
- `src/hooks/useOrders.ts` — `useOrders` / `useOrder` / `useOrderStats` shape
- `src/components/admin/StatusBadge.tsx` — badge idiom
- `src/pages/admin/OrderListPage.tsx` — filters, stat tiles, table, `loadMore`
- `src/pages/admin/OrderDetailPage.tsx` — detail layout
- `src/pages/admin/CreateOrderPage.tsx` — create form
- `src/routes/index.tsx` (lines ~53-54, 139-141) — lazy import + nested routes

---

## File Structure

**New:**
- `src/types/logistics.ts` — `LogisticsCase`, `ShipmentLeg`, `LogisticsLogEntry`, enums, label maps, `ENABLED_STAGES`, `STAGE_STYLES`, helpers
- `src/hooks/useLogisticsCases.ts` — `useLogisticsCases`, `useLogisticsCase`, `useLogisticsStats`
- `src/components/admin/StageBadge.tsx` — stage + customs badges
- `src/components/admin/MilestoneProgress.tsx` — enabled-stage progress bar
- `src/components/admin/LegForm.tsx` — add/edit shipment leg (Task 6B)
- `src/components/admin/CaseEditForm.tsx` — edit case metadata (Task 6C)
- `src/pages/admin/LogisticsCaseListPage.tsx`
- `src/pages/admin/LogisticsCaseDetailPage.tsx` — built across Tasks 6A/6B/6C
- `src/pages/admin/CreateLogisticsCasePage.tsx`

**Modified:**
- `src/routes/index.tsx` — lazy imports + 3 routes
- admin nav (the file rendering the Orders nav link — locate in Task 8)

---

## Task 1: Types (`src/types/logistics.ts`)

**Files:**
- Create: `src/types/logistics.ts`
- Test: `src/types/logistics.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/types/logistics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  LOGISTICS_STAGES, ENABLED_STAGES, CASE_TYPES, STAGE_LABELS,
  enabledStagesFor, isCustomsStage, nextAdvanceableStages,
} from './logistics';

describe('logistics types', () => {
  it('has 22 stages and a label for every one', () => {
    expect(LOGISTICS_STAGES).toHaveLength(22);
    for (const s of LOGISTICS_STAGES) expect(STAGE_LABELS[s]).toBeTruthy();
  });

  it('enabledStagesFor falls back to a caseType subset', () => {
    expect(enabledStagesFor('EQUIPMENT')).toContain('FAT_PASSED');
    expect(enabledStagesFor('SAMPLE')).toContain('TESTING');
    expect(enabledStagesFor('SAMPLE')).not.toContain('FAT_PASSED');
  });

  it('enabledStagesFor prefers a stored override when present', () => {
    expect(enabledStagesFor('EQUIPMENT', ['PRODUCTION', 'CLOSED'])).toEqual(['PRODUCTION', 'CLOSED']);
    // empty/nullish override → fall back to the default subset
    expect(enabledStagesFor('EQUIPMENT', [])).toEqual(enabledStagesFor('EQUIPMENT'));
  });

  it('DEMO mirrors EQUIPMENT', () => {
    expect(ENABLED_STAGES.DEMO).toEqual(ENABLED_STAGES.EQUIPMENT);
  });

  it('isCustomsStage flags the three customs stages', () => {
    expect(isCustomsStage('IMPORT_CUSTOMS')).toBe(true);
    expect(isCustomsStage('CUSTOMS_HOLD')).toBe(true);
    expect(isCustomsStage('TESTING')).toBe(false);
  });

  it('CASE_TYPES has the five Phase 1 types', () => {
    expect(CASE_TYPES).toEqual(['SAMPLE', 'EQUIPMENT', 'SPARE_PART', 'RMA', 'DEMO']);
  });

  it('nextAdvanceableStages: from DRAFT offers the first enabled stage + CANCELLED', () => {
    expect(nextAdvanceableStages('DRAFT', ENABLED_STAGES.EQUIPMENT)).toEqual(['PRODUCTION', 'CANCELLED']);
  });

  it('nextAdvanceableStages: a single forward step, never a far skip', () => {
    const r = nextAdvanceableStages('PRODUCTION', ENABLED_STAGES.EQUIPMENT);
    expect(r).toContain('FAT_SCHEDULED');
    expect(r).not.toContain('CLOSED');
  });

  it('nextAdvanceableStages: on a customs stage, offers the CUSTOMS_HOLD branch and the next happy stage', () => {
    const r = nextAdvanceableStages('IMPORT_CUSTOMS', ENABLED_STAGES.EQUIPMENT);
    expect(r).toContain('CUSTOMS_HOLD'); // can branch to hold
    expect(r).toContain('DELIVERED');    // or skip the exception when not held
  });

  it('nextAdvanceableStages: from CUSTOMS_HOLD resumes the happy path', () => {
    expect(nextAdvanceableStages('CUSTOMS_HOLD', ENABLED_STAGES.EQUIPMENT)).toContain('DELIVERED');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/types/logistics.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/types/logistics.ts`:

```typescript
export const CASE_TYPES = ['SAMPLE', 'EQUIPMENT', 'SPARE_PART', 'RMA', 'DEMO'] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const LEG_DIRECTIONS = ['INBOUND', 'OUTBOUND', 'RETURN', 'DOMESTIC_TRANSFER'] as const;
export type LegDirection = (typeof LEG_DIRECTIONS)[number];

export const CUSTOMS_STATUSES = [
  'NOT_REQUIRED', 'DOCS_READY', 'FILED', 'EXAM', 'HELD', 'RELEASED', 'DUTIES_PAID', 'CLEARED',
] as const;
export type CustomsStatus = (typeof CUSTOMS_STATUSES)[number];

export const RELATED_ENTITY_TYPES = [
  'ORDER', 'LEAD', 'SAMPLE_PROJECT', 'CUSTOMER', 'SERVICE_CASE',
] as const;
export type RelatedEntityType = (typeof RELATED_ENTITY_TYPES)[number];

export const LOGISTICS_STAGES = [
  'DRAFT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS',
  'CUSTOMS_HOLD', 'RECEIVED', 'TESTING', 'REPORT_ISSUED', 'READY_TO_RETURN',
  'RETURN_IN_TRANSIT', 'RETURNED', 'PRODUCTION', 'FAT_SCHEDULED', 'FAT_PASSED',
  'READY_TO_SHIP', 'DELIVERED', 'INSTALLATION_SCHEDULED', 'INSTALLED', 'ACCEPTED',
  'CLOSED', 'CANCELLED',
] as const;
export type LogisticsStage = (typeof LOGISTICS_STAGES)[number];

export interface ShipmentLeg {
  legId: string;
  direction: LegDirection;
  customsRequired?: boolean | null;
  customsStatus?: CustomsStatus | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  freightForwarder?: string | null;
  blOrAwb?: string | null;
  containerNo?: string | null;
  declaredValueUSD?: number | null;
  hsCode?: string | null;
  shippedAt?: string | null;
  clearedAt?: string | null;
  deliveredAt?: string | null;
}

export interface LogisticsLogEntry {
  action: string;
  fromStage?: LogisticsStage | null;
  toStage?: LogisticsStage | null;
  operator: string;
  timestamp: string;
  detail?: string | null;
  internalOnly: boolean;
}

export interface LogisticsCase {
  caseId: string;
  caseNumber: string;
  caseType: CaseType;
  relatedOrderId?: string | null;
  relatedEntityType?: RelatedEntityType | null;
  relatedEntityId?: string | null;
  customerName: string;
  contactName?: string | null;
  customsRequired: boolean;
  currentStage: LogisticsStage;
  enabledStages: LogisticsStage[];
  legs?: ShipmentLeg[] | null;
  milestoneLog?: LogisticsLogEntry[] | null;
  isCustomerVisible: boolean;
  publicToken?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface LogisticsStats {
  totalActive: number;
  byType: string;   // a.json() — JSON-stringified Record<CaseType, number>
  byStage: string;  // a.json() — JSON-stringified Record<LogisticsStage, number>
  customsInProgress: number;
  stalledCases: number;
}

const EQUIPMENT_STAGES: LogisticsStage[] = [
  'PRODUCTION', 'FAT_SCHEDULED', 'FAT_PASSED', 'READY_TO_SHIP', 'EXPORT_CUSTOMS',
  'IN_TRANSIT', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD', 'DELIVERED',
  'INSTALLATION_SCHEDULED', 'INSTALLED', 'ACCEPTED', 'CLOSED',
];

export const ENABLED_STAGES: Record<CaseType, LogisticsStage[]> = {
  SAMPLE: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD',
    'RECEIVED', 'TESTING', 'REPORT_ISSUED', 'READY_TO_RETURN', 'RETURN_IN_TRANSIT',
    'RETURNED', 'CLOSED',
  ],
  EQUIPMENT: EQUIPMENT_STAGES,
  SPARE_PART: ['AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'DELIVERED', 'CLOSED'],
  RMA: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'IMPORT_CUSTOMS', 'RECEIVED', 'TESTING',
    'READY_TO_RETURN', 'RETURN_IN_TRANSIT', 'EXPORT_CUSTOMS', 'DELIVERED', 'CLOSED',
  ],
  DEMO: EQUIPMENT_STAGES,
};

/** Prefer the case's own enabledStages; fall back to the caseType default. */
export function enabledStagesFor(caseType: CaseType, stored?: LogisticsStage[] | null): LogisticsStage[] {
  return stored && stored.length ? stored : ENABLED_STAGES[caseType];
}

const CUSTOMS_STAGES = new Set<LogisticsStage>(['EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD']);
export function isCustomsStage(stage: LogisticsStage): boolean {
  return CUSTOMS_STAGES.has(stage);
}

/** Optional/branch stages that sit inside enabledStages but are NOT mandatory steps. */
export const EXCEPTION_STAGES = new Set<LogisticsStage>(['CUSTOMS_HOLD']);

/**
 * Guided advancement for the detail-page dropdown. Returns the recommended next
 * stage(s): the next happy-path stage (so you can't accidentally jump
 * PRODUCTION → CLOSED), PLUS the CUSTOMS_HOLD branch when sitting on a customs
 * stage, PLUS CANCELLED. The backend still accepts any enabled stage — this only
 * guides the UI; it does not force a rigid single-step machine through exception
 * states like CUSTOMS_HOLD.
 */
export function nextAdvanceableStages(
  currentStage: LogisticsStage,
  enabledStages: LogisticsStage[],
): LogisticsStage[] {
  const happy = enabledStages.filter((s) => !EXCEPTION_STAGES.has(s));
  const out: LogisticsStage[] = [];

  if (currentStage === 'DRAFT') {
    if (happy[0]) out.push(happy[0]);
  } else {
    const hi = happy.indexOf(currentStage);
    if (hi >= 0) {
      if (happy[hi + 1]) out.push(happy[hi + 1]);
    } else {
      // On an exception stage (e.g. CUSTOMS_HOLD): resume at the next happy stage.
      const ei = enabledStages.indexOf(currentStage);
      const resume = enabledStages.slice(ei + 1).find((s) => !EXCEPTION_STAGES.has(s));
      if (resume) out.push(resume);
    }
  }

  if ((currentStage === 'EXPORT_CUSTOMS' || currentStage === 'IMPORT_CUSTOMS')
    && enabledStages.includes('CUSTOMS_HOLD')) {
    out.push('CUSTOMS_HOLD');
  }
  out.push('CANCELLED');
  return Array.from(new Set(out));
}

export const STAGE_LABELS: Record<LogisticsStage, string> = {
  DRAFT: 'Draft', AWAITING_SHIPMENT: 'Awaiting Shipment', IN_TRANSIT: 'In Transit',
  EXPORT_CUSTOMS: 'Export Customs', IMPORT_CUSTOMS: 'Import Customs', CUSTOMS_HOLD: 'Customs Hold',
  RECEIVED: 'Received', TESTING: 'Testing', REPORT_ISSUED: 'Report Issued',
  READY_TO_RETURN: 'Ready to Return', RETURN_IN_TRANSIT: 'Return In Transit', RETURNED: 'Returned',
  PRODUCTION: 'Production', FAT_SCHEDULED: 'FAT Scheduled', FAT_PASSED: 'FAT Passed',
  READY_TO_SHIP: 'Ready to Ship', DELIVERED: 'Delivered', INSTALLATION_SCHEDULED: 'Installation Scheduled',
  INSTALLED: 'Installed', ACCEPTED: 'Accepted', CLOSED: 'Closed', CANCELLED: 'Cancelled',
};

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  SAMPLE: 'Sample', EQUIPMENT: 'Equipment', SPARE_PART: 'Spare Part', RMA: 'RMA', DEMO: 'Demo',
};

export const CUSTOMS_STATUS_LABELS: Record<CustomsStatus, string> = {
  NOT_REQUIRED: 'Not Required', DOCS_READY: 'Docs Ready', FILED: 'Filed', EXAM: 'Exam',
  HELD: 'Held', RELEASED: 'Released', DUTIES_PAID: 'Duties Paid', CLEARED: 'Cleared',
};

export const LEG_DIRECTION_LABELS: Record<LegDirection, string> = {
  INBOUND: 'Inbound', OUTBOUND: 'Outbound', RETURN: 'Return', DOMESTIC_TRANSFER: 'Domestic Transfer',
};

export const TERMINAL_STAGES = new Set<LogisticsStage>(['CLOSED', 'CANCELLED']);

/** Parse the JSON-string stat buckets (a.json() round-trips as a string). Numbers only. */
export function parseStatBucket(raw: string | null | undefined): Record<string, number> {
  let parsed: unknown = raw;
  while (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return {}; }
  }
  if (!parsed || typeof parsed !== 'object') return {};
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'number'),
  ) as Record<string, number>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/types/logistics.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/types/logistics.ts src/types/logistics.test.ts
git commit -m "feat(logistics-ui): shared types, labels, enabled-stage helpers"
```

---

## Task 2: Hooks (`src/hooks/useLogisticsCases.ts`)

**Files:**
- Create: `src/hooks/useLogisticsCases.ts`
- Test: `src/hooks/useLogisticsCases.test.tsx`

Mirror `useOrders` / `useOrder` / `useOrderStats`.

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useLogisticsCases.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const svc = {
  listLogisticsCases: vi.fn(),
  getLogisticsCase: vi.fn(),
  fetchLogisticsStats: vi.fn(),
};
vi.mock('../services/logisticsAdminService', () => svc);

import { useLogisticsCases, useLogisticsCase, useLogisticsStats } from './useLogisticsCases';

beforeEach(() => {
  svc.listLogisticsCases.mockReset();
  svc.getLogisticsCase.mockReset();
  svc.fetchLogisticsStats.mockReset();
});

describe('useLogisticsCases', () => {
  it('loads the first page and exposes cases', async () => {
    svc.listLogisticsCases.mockResolvedValueOnce({ items: [{ caseId: 'lc-1' }], nextToken: null });
    const { result } = renderHook(() => useLogisticsCases({ caseType: 'SAMPLE' }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.cases).toHaveLength(1);
    expect(result.current.hasMore).toBe(false);
    expect(svc.listLogisticsCases).toHaveBeenCalledWith({ caseType: 'SAMPLE', stage: undefined, customsRequired: undefined, search: undefined, limit: 50 });
  });

  it('surfaces errors', async () => {
    svc.listLogisticsCases.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useLogisticsCases());
    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
  });
});

describe('useLogisticsCase', () => {
  it('loads one case', async () => {
    svc.getLogisticsCase.mockResolvedValueOnce({ caseId: 'lc-1', currentStage: 'DRAFT' });
    const { result } = renderHook(() => useLogisticsCase('lc-1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.logisticsCase?.caseId).toBe('lc-1');
  });
});

describe('useLogisticsStats', () => {
  it('loads stats', async () => {
    svc.fetchLogisticsStats.mockResolvedValueOnce({ totalActive: 3, byType: '{}', byStage: '{}', customsInProgress: 1, stalledCases: 0 });
    const { result } = renderHook(() => useLogisticsStats());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.stats?.totalActive).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useLogisticsCases.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/hooks/useLogisticsCases.ts`:

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { LogisticsCase, LogisticsStats } from '../types/logistics';
import * as svc from '../services/logisticsAdminService';

interface UseLogisticsCasesOptions {
  stage?: string;
  caseType?: string;
  customsRequired?: boolean;
  search?: string;
  pageSize?: number;
}

export function useLogisticsCases(options: UseLogisticsCasesOptions = {}) {
  const { stage, caseType, customsRequired, search, pageSize = 50 } = options;

  const [cases, setCases] = useState<LogisticsCase[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFirstPage = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    svc.listLogisticsCases({ stage, caseType, customsRequired, search, limit: pageSize })
      .then((data) => {
        if (cancelled) return;
        setCases((data?.items as LogisticsCase[]) || []);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoading(false);
      })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [stage, caseType, customsRequired, search, pageSize]);

  // Public refresh wrapper — does NOT leak the effect-cleanup function to callers.
  const refresh = useCallback(() => { fetchFirstPage(); }, [fetchFirstPage]);

  const loadMore = useCallback(() => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    svc.listLogisticsCases({ stage, caseType, customsRequired, search, limit: pageSize, nextToken })
      .then((data) => {
        setCases((prev) => [...prev, ...((data?.items as LogisticsCase[]) || [])]);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoadingMore(false);
      })
      .catch((err) => { setError(err); setLoadingMore(false); });
  }, [nextToken, loadingMore, stage, caseType, customsRequired, search, pageSize]);

  useEffect(() => fetchFirstPage(), [fetchFirstPage]);

  return { cases, loading, loadingMore, hasMore: nextToken !== null, error, refresh, loadMore };
}

export function useLogisticsCase(caseId: string | undefined) {
  const [logisticsCase, setLogisticsCase] = useState<LogisticsCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Single loader shared by the initial effect and refresh(). `isActive` lets the
  // effect ignore a resolved fetch after unmount; refresh() passes the default.
  const load = useCallback((isActive: () => boolean = () => true) => {
    if (!caseId) { setLoading(false); return; }
    setLoading(true);
    svc.getLogisticsCase(caseId)
      .then((data) => { if (isActive()) { setLogisticsCase(data as LogisticsCase | null); setLoading(false); } })
      .catch((err) => { if (isActive()) { setError(err); setLoading(false); } });
  }, [caseId]);

  const refresh = useCallback(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    load(() => !cancelled);
    return () => { cancelled = true; };
  }, [load]);

  return { logisticsCase, loading, error, refresh };
}

export function useLogisticsStats() {
  const [stats, setStats] = useState<LogisticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    svc.fetchLogisticsStats()
      .then((data) => { if (!cancelled) { setStats(data as unknown as LogisticsStats); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading, error };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useLogisticsCases.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useLogisticsCases.ts src/hooks/useLogisticsCases.test.tsx
git commit -m "feat(logistics-ui): data hooks (list/one/stats)"
```

---

## Task 3: Badges (`src/components/admin/StageBadge.tsx`)

**Files:**
- Create: `src/components/admin/StageBadge.tsx`
- Test: `src/components/admin/StageBadge.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/StageBadge.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StageBadge, CustomsBadge } from './StageBadge';

describe('StageBadge', () => {
  it('renders the stage label', () => {
    render(<StageBadge stage="IMPORT_CUSTOMS" />);
    expect(screen.getByText('Import Customs')).toBeInTheDocument();
  });
});

describe('CustomsBadge', () => {
  it('renders the customs status label', () => {
    render(<CustomsBadge status="RELEASED" />);
    expect(screen.getByText('Released')).toBeInTheDocument();
  });

  it('renders nothing for nullish status', () => {
    const { container } = render(<CustomsBadge status={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/StageBadge.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/admin/StageBadge.tsx`:

```tsx
import {
  STAGE_LABELS, CUSTOMS_STATUS_LABELS, isCustomsStage,
  type LogisticsStage, type CustomsStatus,
} from '../../types/logistics';

const TERMINAL = new Set<LogisticsStage>(['CLOSED', 'CANCELLED']);

function stageStyle(stage: LogisticsStage): string {
  if (stage === 'CANCELLED') return 'bg-error-container text-on-error-container';
  if (stage === 'CLOSED' || TERMINAL.has(stage)) return 'bg-surface-container-high text-on-surface-variant';
  if (isCustomsStage(stage)) return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
  if (stage === 'DRAFT') return 'bg-surface-container-high text-on-surface-variant';
  return 'bg-secondary-fixed text-secondary';
}

export function StageBadge({ stage, size = 'sm' }: { stage: LogisticsStage; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = size === 'lg' ? 'text-xs px-4 py-1.5' : size === 'md' ? 'text-[11px] px-3 py-1' : 'text-[10px] px-3 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-tighter ${sizeClasses} ${stageStyle(stage)}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

const CUSTOMS_STYLE: Record<CustomsStatus, string> = {
  NOT_REQUIRED: 'bg-surface-container-high text-on-surface-variant',
  DOCS_READY: 'bg-cyan-100 text-cyan-800',
  FILED: 'bg-secondary-fixed text-secondary',
  EXAM: 'bg-amber-100 text-amber-800',
  HELD: 'bg-error-container text-on-error-container',
  RELEASED: 'bg-emerald-100 text-emerald-800',
  DUTIES_PAID: 'bg-emerald-100 text-emerald-800',
  CLEARED: 'bg-green-100 text-green-800',
};

export function CustomsBadge({ status }: { status?: CustomsStatus | null }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CUSTOMS_STYLE[status]}`}>
      {CUSTOMS_STATUS_LABELS[status]}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/StageBadge.test.tsx`
Expected: PASS (3 tests).

> Color note: the literal `bg-cyan-100`/`bg-emerald-100`/`bg-green-100`/`bg-amber-100` classes
> are intentional — they match the existing `StatusBadge.tsx`, which already mixes raw Tailwind
> palette classes with Material-3 tokens. Keep them for visual consistency; do not "tokenize".

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/StageBadge.tsx src/components/admin/StageBadge.test.tsx
git commit -m "feat(logistics-ui): stage + customs badges"
```

---

## Task 4: Milestone progress (`src/components/admin/MilestoneProgress.tsx`)

**Files:**
- Create: `src/components/admin/MilestoneProgress.tsx`
- Test: `src/components/admin/MilestoneProgress.test.tsx`

Renders **only `enabledStages`** in order; marks stages before `currentStage` as done, the current one active.

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/MilestoneProgress.test.tsx`:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MilestoneProgress } from './MilestoneProgress';

describe('MilestoneProgress', () => {
  const enabled = ['PRODUCTION', 'FAT_PASSED', 'DELIVERED', 'CLOSED'] as const;

  it('renders only the enabled stages', () => {
    render(<MilestoneProgress enabledStages={[...enabled]} currentStage="FAT_PASSED" />);
    expect(screen.getByText('Production')).toBeInTheDocument();
    expect(screen.getByText('FAT Passed')).toBeInTheDocument();
    expect(screen.queryByText('Testing')).not.toBeInTheDocument();
  });

  it('marks the current stage active via aria-current', () => {
    render(<MilestoneProgress enabledStages={[...enabled]} currentStage="FAT_PASSED" />);
    expect(screen.getByText('FAT Passed').closest('[aria-current]')).toHaveAttribute('aria-current', 'step');
  });

  it('shows DRAFT as the active leading pip when the case is at DRAFT', () => {
    render(<MilestoneProgress enabledStages={[...enabled]} currentStage="DRAFT" />);
    expect(screen.getByText('Draft').closest('[aria-current]')).toHaveAttribute('aria-current', 'step');
    expect(screen.getByText('Production')).toBeInTheDocument();
  });

  it('renders a standalone Cancelled state', () => {
    render(<MilestoneProgress enabledStages={[...enabled]} currentStage="CANCELLED" />);
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
    expect(screen.queryByText('Production')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/MilestoneProgress.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/components/admin/MilestoneProgress.tsx`:

```tsx
import { STAGE_LABELS, type LogisticsStage } from '../../types/logistics';

export function MilestoneProgress({
  enabledStages, currentStage,
}: { enabledStages: LogisticsStage[]; currentStage: LogisticsStage }) {
  // CANCELLED is a terminal exception, not a ladder position — show it on its own.
  if (currentStage === 'CANCELLED') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-error-container px-3 py-1 text-[11px] font-bold uppercase tracking-tight text-on-error-container">
        <span className="material-symbols-rounded text-[14px]">cancel</span>Cancelled
      </div>
    );
  }

  // Always lead with DRAFT (cases open at DRAFT, which is never inside enabledStages);
  // drop any DRAFT/CANCELLED that might appear inside the stored set.
  const display: LogisticsStage[] = [
    'DRAFT',
    ...enabledStages.filter((s) => s !== 'DRAFT' && s !== 'CANCELLED'),
  ];
  const currentIdx = display.indexOf(currentStage);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {display.map((stage, i) => {
        const done = currentIdx >= 0 && i < currentIdx;
        const active = stage === currentStage;
        const cls = active
          ? 'bg-primary text-on-primary'
          : done
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-surface-container-high text-on-surface-variant';
        return (
          <li
            key={stage}
            aria-current={active ? 'step' : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${cls}`}
          >
            <span className="material-symbols-rounded text-[14px]">
              {done ? 'check_circle' : active ? 'radio_button_checked' : 'radio_button_unchecked'}
            </span>
            {STAGE_LABELS[stage]}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/MilestoneProgress.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/MilestoneProgress.tsx src/components/admin/MilestoneProgress.test.tsx
git commit -m "feat(logistics-ui): milestone progress bar over enabledStages"
```

---

## Task 5: List page (`src/pages/admin/LogisticsCaseListPage.tsx`)

**Files:**
- Create: `src/pages/admin/LogisticsCaseListPage.tsx`
- Test: `src/pages/admin/LogisticsCaseListPage.test.tsx`

Mirror `OrderListPage`: debounced search, caseType/stage/customs filters, stat tiles from `useLogisticsStats` (parse `byType`/`byStage` with `parseStatBucket`), table, `loadMore`.

- [ ] **Step 1: Write the failing test**

Create `src/pages/admin/LogisticsCaseListPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const hooks = { useLogisticsCases: vi.fn(), useLogisticsStats: vi.fn() };
vi.mock('../../hooks/useLogisticsCases', () => hooks);

import { LogisticsCaseListPage } from './LogisticsCaseListPage';

beforeEach(() => {
  hooks.useLogisticsCases.mockReturnValue({
    cases: [{
      caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0001', caseType: 'EQUIPMENT',
      customerName: 'HORIBA', currentStage: 'IN_TRANSIT', customsRequired: true,
      legs: [{ legId: 'l1' }], updatedAt: '2026-06-19T00:00:00Z',
    }],
    loading: false, loadingMore: false, hasMore: false, error: null, loadMore: vi.fn(),
  });
  hooks.useLogisticsStats.mockReturnValue({
    stats: { totalActive: 1, byType: '{"EQUIPMENT":1}', byStage: '{"IN_TRANSIT":1}', customsInProgress: 1, stalledCases: 0 },
    loading: false, error: null,
  });
});

describe('LogisticsCaseListPage', () => {
  it('renders cases with caseNumber link and stage badge', async () => {
    render(<MemoryRouter><LogisticsCaseListPage /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('NS-LOG-2026-0001')).toBeInTheDocument());
    expect(screen.getByText('HORIBA')).toBeInTheDocument();
    expect(screen.getByText('In Transit')).toBeInTheDocument();
    expect(screen.getByText('NS-LOG-2026-0001').closest('a')).toHaveAttribute('href', '/admin/logistics/lc-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/LogisticsCaseListPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/pages/admin/LogisticsCaseListPage.tsx`. Mirror `OrderListPage`'s page chrome (header, search input, filter chips row, stat-tile grid, table wrapper classes, infinite-scroll "load more" button). Concrete content:

```tsx
import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useLogisticsCases, useLogisticsStats } from '../../hooks/useLogisticsCases';
import { StageBadge, CustomsBadge } from '../../components/admin/StageBadge';
import {
  CASE_TYPES, CASE_TYPE_LABELS, LOGISTICS_STAGES, STAGE_LABELS,
  parseStatBucket, type CustomsStatus,
} from '../../types/logistics';

const SEARCH_DEBOUNCE_MS = 300;

function worstLegCustoms(legs?: { customsStatus?: CustomsStatus | null }[] | null): CustomsStatus | null {
  if (!legs?.length) return null;
  const order: CustomsStatus[] = ['HELD', 'EXAM', 'FILED', 'DOCS_READY', 'DUTIES_PAID', 'RELEASED', 'CLEARED', 'NOT_REQUIRED'];
  for (const s of order) if (legs.some((l) => l.customsStatus === s)) return s;
  return null;
}

export function LogisticsCaseListPage() {
  const [caseTypeFilter, setCaseTypeFilter] = useState<string>('All');
  const [stageFilter, setStageFilter] = useState<string>('All');
  const [customsFilter, setCustomsFilter] = useState<string>('All'); // All | Customs | None
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { cases, loading, loadingMore, hasMore, error, loadMore } = useLogisticsCases({
    caseType: caseTypeFilter === 'All' ? undefined : caseTypeFilter,
    stage: stageFilter === 'All' ? undefined : stageFilter,
    customsRequired: customsFilter === 'All' ? undefined : customsFilter === 'Customs',
    search: debouncedSearch || undefined,
  });
  const { stats } = useLogisticsStats();

  const byType = useMemo(() => parseStatBucket(stats?.byType), [stats]);

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-on-surface">Logistics Cases</h1>
        <Link to="/admin/logistics/new" className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
          <span className="material-symbols-rounded text-[18px]">add</span> New Case
        </Link>
      </header>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Active" value={stats?.totalActive ?? 0} />
        <StatTile label="In Customs" value={stats?.customsInProgress ?? 0} />
        <StatTile label="Stalled >14d" value={stats?.stalledCases ?? 0} />
        <StatTile label="Total cases" value={Object.values(byType).reduce((a, b) => a + b, 0)} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <FilterChips
          value={caseTypeFilter} onChange={setCaseTypeFilter}
          options={['All', ...CASE_TYPES]} labelFor={(o) => (o === 'All' ? 'All' : CASE_TYPE_LABELS[o as keyof typeof CASE_TYPE_LABELS])}
        />
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm">
          <option value="All">All stages</option>
          {LOGISTICS_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
        <select value={customsFilter} onChange={(e) => setCustomsFilter(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm">
          <option value="All">All</option><option value="Customs">Customs</option><option value="None">No customs</option>
        </select>
        <input
          value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search case #, customer, contact, order…"
          className="flex-1 min-w-[220px] rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm"
        />
      </div>

      {error && <p className="text-error">Failed to load: {error.message}</p>}
      {loading ? <p className="text-on-surface-variant">Loading…</p> : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="min-w-full text-sm">
            <thead className="bg-surface-container text-left text-xs uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-4 py-3">Case #</th><th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Customer</th><th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Customs</th><th className="px-4 py-3">Legs</th>
                <th className="px-4 py-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {cases.map((c) => {
                const customs = worstLegCustoms(c.legs);
                return (
                <tr key={c.caseId} className="hover:bg-surface-container-low">
                  <td className="px-4 py-3 font-semibold">
                    <Link to={`/admin/logistics/${c.caseId}`} className="text-primary hover:underline">{c.caseNumber}</Link>
                  </td>
                  <td className="px-4 py-3">{CASE_TYPE_LABELS[c.caseType]}</td>
                  <td className="px-4 py-3">
                    <div>{c.customerName}</div>
                    {c.contactName && <div className="text-xs text-on-surface-variant">{c.contactName}</div>}
                  </td>
                  <td className="px-4 py-3"><StageBadge stage={c.currentStage} /></td>
                  <td className="px-4 py-3">
                    {c.customsRequired
                      ? (customs
                          ? <CustomsBadge status={customs} />
                          : <span className="text-xs text-on-surface-variant">required</span>)
                      : <span className="text-xs text-on-surface-variant">—</span>}
                  </td>
                  <td className="px-4 py-3">{c.legs?.length ?? 0}</td>
                  <td className="px-4 py-3 text-xs text-on-surface-variant">{new Date(c.updatedAt).toLocaleDateString('en-US')}</td>
                </tr>
                );
              })}
              {!cases.length && <tr><td colSpan={7} className="px-4 py-8 text-center text-on-surface-variant">No logistics cases.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <button onClick={loadMore} disabled={loadingMore} className="mx-auto block rounded-full border border-outline-variant px-4 py-2 text-sm">
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4">
      <div className="text-2xl font-bold text-on-surface">{value}</div>
      <div className="text-xs uppercase tracking-wider text-on-surface-variant">{label}</div>
    </div>
  );
}

function FilterChips({ value, onChange, options, labelFor }: {
  value: string; onChange: (v: string) => void; options: string[]; labelFor: (o: string) => string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${value === o ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
          {labelFor(o)}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/admin/LogisticsCaseListPage.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/LogisticsCaseListPage.tsx src/pages/admin/LogisticsCaseListPage.test.tsx
git commit -m "feat(logistics-ui): case list page (filters, stats, table)"
```

---

## Task 6A: Detail page — read view + advance + history (`src/pages/admin/LogisticsCaseDetailPage.tsx`)

**Files:**
- Create: `src/pages/admin/LogisticsCaseDetailPage.tsx`
- Test: `src/pages/admin/LogisticsCaseDetailPage.test.tsx`

Mirror `OrderDetailPage` chrome. This task builds: header + related link; `MilestoneProgress` over `enabledStagesFor(caseType, enabledStages)`; advance-stage control (options = enabled subset + `CANCELLED`, **deduped**, calls `advanceLogisticsStage` then `refresh`); soft customs warning; **read-only** legs list; milestone-log timeline (reverse-chron, `internalOnly` marked). Leg add/edit/remove forms come in **Task 6B**; the case-metadata edit form in **Task 6C**.

- [ ] **Step 1: Write the failing test**

Create `src/pages/admin/LogisticsCaseDetailPage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const hooks = { useLogisticsCase: vi.fn() };
vi.mock('../../hooks/useLogisticsCases', () => hooks);
const svc = {
  advanceLogisticsStage: vi.fn(), addLeg: vi.fn(), updateLeg: vi.fn(),
  removeLeg: vi.fn(), updateLogisticsCase: vi.fn(),
};
vi.mock('../../services/logisticsAdminService', () => svc);

import { LogisticsCaseDetailPage } from './LogisticsCaseDetailPage';

const sampleCase = {
  caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0001', caseType: 'EQUIPMENT',
  customerName: 'HORIBA', contactName: 'Dr. X', customsRequired: true,
  currentStage: 'PRODUCTION', enabledStages: ['PRODUCTION', 'FAT_PASSED', 'DELIVERED', 'CLOSED'],
  legs: [{ legId: 'l1', direction: 'OUTBOUND', carrier: 'DHL', trackingNumber: 'T1', customsStatus: 'DOCS_READY' }],
  milestoneLog: [{ action: 'CASE_CREATED', toStage: 'DRAFT', operator: 'harvey', timestamp: '2026-06-19T00:00:00Z', internalOnly: false }],
  isCustomerVisible: false, createdAt: '2026-06-19T00:00:00Z', updatedAt: '2026-06-19T00:00:00Z', createdBy: 'u',
};

beforeEach(() => {
  Object.values(svc).forEach((f) => f.mockReset());
  hooks.useLogisticsCase.mockReturnValue({ logisticsCase: sampleCase, loading: false, error: null, refresh: vi.fn() });
});

function renderAt() {
  return render(
    <MemoryRouter initialEntries={['/admin/logistics/lc-1']}>
      <Routes><Route path="/admin/logistics/:caseId" element={<LogisticsCaseDetailPage />} /></Routes>
    </MemoryRouter>,
  );
}

describe('LogisticsCaseDetailPage', () => {
  it('shows header, milestone progress, and legs', async () => {
    renderAt();
    await waitFor(() => expect(screen.getByText('NS-LOG-2026-0001')).toBeInTheDocument());
    expect(screen.getByText('HORIBA')).toBeInTheDocument();
    // 'FAT Passed' appears in both the progress bar and the advance dropdown.
    expect(screen.getAllByText('FAT Passed').length).toBeGreaterThan(0);
    expect(screen.queryByText('Testing')).not.toBeInTheDocument(); // not enabled for EQUIPMENT
    expect(screen.getByText('DHL')).toBeInTheDocument();
  });

  it('advances stage via the service', async () => {
    svc.advanceLogisticsStage.mockResolvedValueOnce({ ...sampleCase, currentStage: 'FAT_PASSED' });
    renderAt();
    fireEvent.change(screen.getByLabelText('Advance to stage'), { target: { value: 'FAT_PASSED' } });
    fireEvent.click(screen.getByText('Advance'));
    await waitFor(() => expect(svc.advanceLogisticsStage).toHaveBeenCalledWith('lc-1', 'FAT_PASSED', undefined, false));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/LogisticsCaseDetailPage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/pages/admin/LogisticsCaseDetailPage.tsx`. Mirror `OrderDetailPage` chrome (back link, card sections with `rounded-xl border border-outline-variant` wrappers, section headings). Concrete logic-bearing parts:

```tsx
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useLogisticsCase } from '../../hooks/useLogisticsCases';
import * as svc from '../../services/logisticsAdminService';
import { StageBadge, CustomsBadge } from '../../components/admin/StageBadge';
import { MilestoneProgress } from '../../components/admin/MilestoneProgress';
import {
  enabledStagesFor, isCustomsStage, nextAdvanceableStages,
  CASE_TYPE_LABELS, LEG_DIRECTION_LABELS, STAGE_LABELS,
} from '../../types/logistics';

export function LogisticsCaseDetailPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const { logisticsCase: c, loading, error, refresh } = useLogisticsCase(caseId);
  const [target, setTarget] = useState<string>('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="p-6 text-on-surface-variant">Loading…</div>;
  if (error || !c) return <div className="p-6 text-error">{error?.message || 'Case not found'}</div>;

  const enabled = enabledStagesFor(c.caseType, c.enabledStages);
  // Guided next-step options (next happy stage + CUSTOMS_HOLD branch + CANCELLED) —
  // prevents accidental far jumps like PRODUCTION → CLOSED while still allowing
  // exception states to be skipped. The backend remains the hard floor.
  const advanceOptions = nextAdvanceableStages(c.currentStage, enabled);
  const customsLegMissing = c.customsRequired && (c.legs || []).some((l) => l.customsRequired && !l.customsStatus);

  async function advance() {
    if (!caseId || !target) return;
    setBusy(true);
    try {
      await svc.advanceLogisticsStage(caseId, target, detail || undefined, false);
      setTarget(''); setDetail(''); refresh();
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 space-y-6">
      <Link to="/admin/logistics" className="text-sm text-primary hover:underline">← All cases</Link>

      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold text-on-surface">{c.caseNumber}</h1>
        <StageBadge stage={c.currentStage} size="md" />
        <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-semibold uppercase">{CASE_TYPE_LABELS[c.caseType]}</span>
      </header>
      <div className="text-sm text-on-surface-variant">
        {c.customerName}{c.contactName ? ` · ${c.contactName}` : ''}
        {c.relatedOrderId && <> · <Link className="text-primary hover:underline" to={`/admin/orders/${c.relatedOrderId}`}>Order {c.relatedOrderId}</Link></>}
        {!c.relatedOrderId && c.relatedEntityType && <> · {c.relatedEntityType}: {c.relatedEntityId}</>}
      </div>

      {customsLegMissing && (
        <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          ⚠ A customs-bearing leg has no customs status set.
        </div>
      )}

      {/* Milestone progress */}
      <section className="rounded-xl border border-outline-variant p-4 space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Progress</h2>
        <MilestoneProgress enabledStages={enabled} currentStage={c.currentStage} />
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-on-surface-variant">
            Advance to stage
            <select aria-label="Advance to stage" value={target} onChange={(e) => setTarget(e.target.value)}
              className="mt-1 block rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm">
              <option value="">Select…</option>
              {advanceOptions.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </label>
          <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="Note (optional)"
            className="rounded-lg border border-outline-variant bg-surface px-3 py-1.5 text-sm" />
          <button onClick={advance} disabled={!target || busy}
            className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">Advance</button>
        </div>
      </section>

      {/* Legs */}
      <section className="rounded-xl border border-outline-variant p-4 space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Shipment Legs</h2>
        {(c.legs || []).map((l) => (
          <div key={l.legId} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-container-low p-3 text-sm">
            <span className="font-semibold">{LEG_DIRECTION_LABELS[l.direction]}</span>
            {l.carrier && <span>{l.carrier}</span>}
            {l.trackingNumber && (l.trackingUrl
              ? <a href={l.trackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{l.trackingNumber}</a>
              : <span>{l.trackingNumber}</span>)}
            {l.freightForwarder && <span className="text-on-surface-variant">{l.freightForwarder}</span>}
            {l.blOrAwb && <span className="text-on-surface-variant">{l.blOrAwb}</span>}
            <CustomsBadge status={l.customsStatus} />
          </div>
        ))}
        {!(c.legs || []).length && <p className="text-sm text-on-surface-variant">No legs yet.</p>}
        {/* Task 6B wires the add / edit / remove leg forms into this section. */}
      </section>

      {/* Milestone log */}
      <section className="rounded-xl border border-outline-variant p-4 space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">History</h2>
        <ol className="space-y-2">
          {[...(c.milestoneLog || [])].reverse().map((e, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <span className="material-symbols-rounded text-[16px] text-on-surface-variant">
                {e.internalOnly ? 'lock' : 'history'}
              </span>
              <div>
                <div className="font-medium">
                  {e.fromStage ? `${STAGE_LABELS[e.fromStage]} → ` : ''}{e.toStage ? STAGE_LABELS[e.toStage] : e.action}
                  {e.toStage && isCustomsStage(e.toStage) && <span className="ml-1 text-tertiary">(customs)</span>}
                </div>
                <div className="text-xs text-on-surface-variant">{e.operator} · {new Date(e.timestamp).toLocaleString('en-US')}{e.detail ? ` · ${e.detail}` : ''}</div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/admin/LogisticsCaseDetailPage.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/LogisticsCaseDetailPage.tsx src/pages/admin/LogisticsCaseDetailPage.test.tsx
git commit -m "feat(logistics-ui): case detail read view + advance + history"
```

---

## Task 6B: Leg management — add / edit / remove (`src/components/admin/LegForm.tsx`)

**Files:**
- Create: `src/components/admin/LegForm.tsx`
- Modify: `src/pages/admin/LogisticsCaseDetailPage.tsx` (wire add/edit/remove into the legs section)
- Test: `src/components/admin/LegForm.test.tsx`
- Test: extend `src/pages/admin/LogisticsCaseDetailPage.test.tsx` (remove-leg integration)

- [ ] **Step 1: Write the failing LegForm test**

Create `src/components/admin/LegForm.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LegForm } from './LegForm';

beforeEach(() => vi.clearAllMocks());

describe('LegForm', () => {
  it('submits a new leg with direction + entered fields', () => {
    const onSubmit = vi.fn();
    render(<LegForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Direction'), { target: { value: 'INBOUND' } });
    fireEvent.change(screen.getByLabelText('Carrier'), { target: { value: 'FedEx' } });
    fireEvent.change(screen.getByLabelText('Tracking #'), { target: { value: 'T9' } });
    fireEvent.click(screen.getByText('Save leg'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    const input = onSubmit.mock.calls[0][0];
    expect(input).toMatchObject({ direction: 'INBOUND', carrier: 'FedEx', trackingNumber: 'T9' });
  });

  it('prefills when editing an existing leg', () => {
    const onSubmit = vi.fn();
    render(<LegForm onSubmit={onSubmit} onCancel={() => {}} initial={{ legId: 'l1', direction: 'RETURN', carrier: 'DHL' }} />);
    expect((screen.getByLabelText('Carrier') as HTMLInputElement).value).toBe('DHL');
    fireEvent.click(screen.getByText('Save leg'));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ direction: 'RETURN', carrier: 'DHL' });
  });

  it('blocks submit on an invalid tracking URL', () => {
    const onSubmit = vi.fn();
    render(<LegForm onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Tracking URL'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByText('Save leg'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/http/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/admin/LegForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `LegForm`**

Create `src/components/admin/LegForm.tsx`:

```tsx
import { useState } from 'react';
import {
  LEG_DIRECTIONS, LEG_DIRECTION_LABELS, CUSTOMS_STATUSES, CUSTOMS_STATUS_LABELS,
  type ShipmentLeg,
} from '../../types/logistics';

const FIELD = 'mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm';

export function LegForm({
  initial, onSubmit, onCancel,
}: {
  initial?: Partial<ShipmentLeg>;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    direction: initial?.direction ?? LEG_DIRECTIONS[0],
    carrier: initial?.carrier ?? '',
    trackingNumber: initial?.trackingNumber ?? '',
    trackingUrl: initial?.trackingUrl ?? '',
    freightForwarder: initial?.freightForwarder ?? '',
    blOrAwb: initial?.blOrAwb ?? '',
    containerNo: initial?.containerNo ?? '',
    customsRequired: initial?.customsRequired ?? false,
    customsStatus: initial?.customsStatus ?? '',
    declaredValueUSD: initial?.declaredValueUSD != null ? String(initial.declaredValueUSD) : '',
    hsCode: initial?.hsCode ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((p) => ({ ...p, [k]: v })); }

  function submit() {
    if (f.trackingUrl) {
      let ok = false;
      try { const u = new URL(f.trackingUrl); ok = u.protocol === 'http:' || u.protocol === 'https:'; } catch { ok = false; }
      if (!ok) { setErr('Tracking URL must start with http:// or https://'); return; }
    }
    setErr(null);
    const input: Record<string, unknown> = { direction: f.direction, customsRequired: f.customsRequired };
    if (f.carrier) input.carrier = f.carrier;
    if (f.trackingNumber) input.trackingNumber = f.trackingNumber;
    if (f.trackingUrl) input.trackingUrl = f.trackingUrl;
    if (f.freightForwarder) input.freightForwarder = f.freightForwarder;
    if (f.blOrAwb) input.blOrAwb = f.blOrAwb;
    if (f.containerNo) input.containerNo = f.containerNo;
    if (f.customsStatus) input.customsStatus = f.customsStatus;
    if (f.hsCode) input.hsCode = f.hsCode;
    if (f.declaredValueUSD) input.declaredValueUSD = Number(f.declaredValueUSD);
    onSubmit(input);
  }

  return (
    <div className="rounded-lg border border-outline-variant p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">Direction
          <select aria-label="Direction" value={f.direction} onChange={(e) => set('direction', e.target.value as typeof f.direction)} className={FIELD}>
            {LEG_DIRECTIONS.map((d) => <option key={d} value={d}>{LEG_DIRECTION_LABELS[d]}</option>)}
          </select>
        </label>
        <label className="text-xs">Carrier
          <input aria-label="Carrier" value={f.carrier} onChange={(e) => set('carrier', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Tracking #
          <input aria-label="Tracking #" value={f.trackingNumber} onChange={(e) => set('trackingNumber', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Tracking URL
          <input aria-label="Tracking URL" value={f.trackingUrl} onChange={(e) => set('trackingUrl', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Freight forwarder
          <input aria-label="Freight forwarder" value={f.freightForwarder} onChange={(e) => set('freightForwarder', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">B/L or AWB
          <input aria-label="B/L or AWB" value={f.blOrAwb} onChange={(e) => set('blOrAwb', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Container #
          <input aria-label="Container #" value={f.containerNo} onChange={(e) => set('containerNo', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">HS code
          <input aria-label="HS code" value={f.hsCode} onChange={(e) => set('hsCode', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Declared value (USD)
          <input aria-label="Declared value (USD)" type="number" value={f.declaredValueUSD} onChange={(e) => set('declaredValueUSD', e.target.value)} className={FIELD} />
        </label>
        <label className="text-xs">Customs status
          <select aria-label="Customs status" value={f.customsStatus} onChange={(e) => set('customsStatus', e.target.value as typeof f.customsStatus)} className={FIELD}>
            <option value="">—</option>
            {CUSTOMS_STATUSES.map((s) => <option key={s} value={s}>{CUSTOMS_STATUS_LABELS[s]}</option>)}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={f.customsRequired} onChange={(e) => set('customsRequired', e.target.checked)} /> Customs required (this leg)
      </label>
      {err && <p className="text-error text-sm">{err}</p>}
      <div className="flex gap-2">
        <button onClick={submit} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary">Save leg</button>
        <button onClick={onCancel} className="rounded-full border border-outline-variant px-4 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire LegForm into the detail page**

In `src/pages/admin/LogisticsCaseDetailPage.tsx`, import `LegForm` and add leg state + handlers. Inside the legs `<section>`, replace the read-only rows with editable rows + an add toggle:

```tsx
// add near other useState:
const [addingLeg, setAddingLeg] = useState(false);
const [editingLegId, setEditingLegId] = useState<string | null>(null);

async function saveNewLeg(input: Record<string, unknown>) {
  if (!caseId) return;
  await svc.addLeg(caseId, input); setAddingLeg(false); refresh();
}
async function saveEditLeg(legId: string, input: Record<string, unknown>) {
  if (!caseId) return;
  await svc.updateLeg(caseId, legId, input); setEditingLegId(null); refresh();
}
async function deleteLeg(legId: string) {
  if (!caseId) return;
  if (!window.confirm('Remove this shipment leg? This cannot be undone.')) return;
  await svc.removeLeg(caseId, legId); refresh();
}
```

Legs section body (replaces the read-only list from 6A):

```tsx
{(c.legs || []).map((l) => (
  editingLegId === l.legId
    ? <LegForm key={l.legId} initial={l} onSubmit={(input) => saveEditLeg(l.legId, input)} onCancel={() => setEditingLegId(null)} />
    : (
      <div key={l.legId} className="flex flex-wrap items-center gap-3 rounded-lg bg-surface-container-low p-3 text-sm">
        <span className="font-semibold">{LEG_DIRECTION_LABELS[l.direction]}</span>
        {l.carrier && <span>{l.carrier}</span>}
        {l.trackingNumber && (l.trackingUrl
          ? <a href={l.trackingUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">{l.trackingNumber}</a>
          : <span>{l.trackingNumber}</span>)}
        {l.freightForwarder && <span className="text-on-surface-variant">{l.freightForwarder}</span>}
        {l.blOrAwb && <span className="text-on-surface-variant">{l.blOrAwb}</span>}
        <CustomsBadge status={l.customsStatus} />
        <span className="ml-auto flex gap-3">
          <button onClick={() => setEditingLegId(l.legId)} className="text-xs text-primary hover:underline">Edit</button>
          <button onClick={() => deleteLeg(l.legId)} className="text-xs text-error hover:underline">Remove</button>
        </span>
      </div>
    )
))}
{!(c.legs || []).length && !addingLeg && <p className="text-sm text-on-surface-variant">No legs yet.</p>}
{addingLeg
  ? <LegForm onSubmit={saveNewLeg} onCancel={() => setAddingLeg(false)} />
  : <button onClick={() => setAddingLeg(true)} className="text-sm text-primary hover:underline">+ Add leg</button>}
```

- [ ] **Step 5: Extend the detail page test (remove integration) + run**

Append to `src/pages/admin/LogisticsCaseDetailPage.test.tsx`:

```typescript
it('removes a leg via the service after confirmation', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  svc.removeLeg.mockResolvedValueOnce({ ...sampleCase, legs: [] });
  renderAt();
  fireEvent.click(screen.getByText('Remove'));
  await waitFor(() => expect(svc.removeLeg).toHaveBeenCalledWith('lc-1', 'l1'));
});
```

Run: `npx vitest run src/components/admin/LegForm.test.tsx src/pages/admin/LogisticsCaseDetailPage.test.tsx`
Expected: PASS (LegForm 3 + detail 3).

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/LegForm.tsx src/components/admin/LegForm.test.tsx src/pages/admin/LogisticsCaseDetailPage.tsx src/pages/admin/LogisticsCaseDetailPage.test.tsx
git commit -m "feat(logistics-ui): shipment leg add/edit/remove on case detail"
```

---

## Task 6C: Case metadata edit (`src/components/admin/CaseEditForm.tsx`)

**Files:**
- Create: `src/components/admin/CaseEditForm.tsx`
- Modify: `src/pages/admin/LogisticsCaseDetailPage.tsx` (wire the edit panel)
- Test: `src/components/admin/CaseEditForm.test.tsx`

Editable whitelist (matches the backend `updateLogisticsCase` resolver): `customerName`, `contactName`, `customsRequired`, `relatedOrderId`, `relatedEntityType`, `relatedEntityId`, `notes`. NOT `caseType` / `currentStage` / `enabledStages` / `isCustomerVisible` / `publicToken`.

- [ ] **Step 1: Write the failing test**

Create `src/components/admin/CaseEditForm.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseEditForm } from './CaseEditForm';

const base = {
  caseId: 'lc-1', caseNumber: 'NS-LOG-2026-0001', caseType: 'EQUIPMENT',
  customerName: 'HORIBA', customsRequired: true, currentStage: 'DRAFT',
  enabledStages: [], isCustomerVisible: false, createdAt: 'x', updatedAt: 'x', createdBy: 'u',
} as any;

describe('CaseEditForm', () => {
  it('submits only edited whitelisted fields', () => {
    const onSubmit = vi.fn();
    render(<CaseEditForm logisticsCase={base} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Customer'), { target: { value: 'BAE Systems' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSubmit.mock.calls[0][0]).toMatchObject({ customerName: 'BAE Systems' });
    // never includes frozen fields
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('caseType');
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('isCustomerVisible');
  });

  it('rejects relatedEntityType set without an ID', () => {
    const onSubmit = vi.fn();
    render(<CaseEditForm logisticsCase={base} onSubmit={onSubmit} onCancel={() => {}} />);
    fireEvent.change(screen.getByLabelText('Related entity type'), { target: { value: 'LEAD' } });
    fireEvent.click(screen.getByText('Save'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/both/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/admin/CaseEditForm.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `CaseEditForm`**

Create `src/components/admin/CaseEditForm.tsx`:

```tsx
import { useState } from 'react';
import { RELATED_ENTITY_TYPES, type LogisticsCase } from '../../types/logistics';

const FIELD = 'mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm';

export function CaseEditForm({
  logisticsCase: c, onSubmit, onCancel,
}: {
  logisticsCase: LogisticsCase;
  onSubmit: (input: Record<string, unknown>) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    customerName: c.customerName,
    contactName: c.contactName ?? '',
    customsRequired: c.customsRequired,
    relatedOrderId: c.relatedOrderId ?? '',
    relatedEntityType: c.relatedEntityType ?? '',
    relatedEntityId: c.relatedEntityId ?? '',
    notes: c.notes ?? '',
  });
  const [err, setErr] = useState<string | null>(null);
  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) { setF((p) => ({ ...p, [k]: v })); }

  function submit() {
    if (!f.customerName.trim()) { setErr('Customer name is required'); return; }
    // relatedEntityType and relatedEntityId must both be empty or both set
    if (Boolean(f.relatedEntityType) !== Boolean(f.relatedEntityId.trim())) {
      setErr('Related entity type and ID must both be set or both empty'); return;
    }
    setErr(null);
    onSubmit({
      customerName: f.customerName.trim(),
      contactName: f.contactName,
      customsRequired: f.customsRequired,
      relatedOrderId: f.relatedOrderId,
      relatedEntityType: f.relatedEntityType || null,
      relatedEntityId: f.relatedEntityId || null,
      notes: f.notes,
    });
  }

  return (
    <div className="rounded-xl border border-outline-variant p-4 space-y-3">
      <h2 className="text-sm font-bold uppercase tracking-wider text-on-surface-variant">Edit case</h2>
      {err && <p className="text-error text-sm">{err}</p>}
      <label className="block text-xs">Customer
        <input aria-label="Customer" value={f.customerName} onChange={(e) => set('customerName', e.target.value)} className={FIELD} />
      </label>
      <label className="block text-xs">Contact
        <input aria-label="Contact" value={f.contactName} onChange={(e) => set('contactName', e.target.value)} className={FIELD} />
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={f.customsRequired} onChange={(e) => set('customsRequired', e.target.checked)} /> Customs required
      </label>
      <label className="block text-xs">Related order ID
        <input aria-label="Related order ID" value={f.relatedOrderId} onChange={(e) => set('relatedOrderId', e.target.value)} className={FIELD} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">Related entity type
          <select aria-label="Related entity type" value={f.relatedEntityType} onChange={(e) => set('relatedEntityType', e.target.value)} className={FIELD}>
            <option value="">—</option>
            {RELATED_ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-xs">Related entity ID
          <input aria-label="Related entity ID" value={f.relatedEntityId} onChange={(e) => set('relatedEntityId', e.target.value)} className={FIELD} />
        </label>
      </div>
      <label className="block text-xs">Notes
        <textarea aria-label="Notes" value={f.notes} onChange={(e) => set('notes', e.target.value)} rows={3} className={FIELD} />
      </label>
      <div className="flex gap-2">
        <button onClick={submit} className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary">Save</button>
        <button onClick={onCancel} className="rounded-full border border-outline-variant px-4 py-1.5 text-sm">Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire into the detail page**

In `LogisticsCaseDetailPage.tsx`, import `CaseEditForm`, add `const [editing, setEditing] = useState(false);`, a handler:

```tsx
async function saveCase(input: Record<string, unknown>) {
  if (!caseId) return;
  await svc.updateLogisticsCase(caseId, input); setEditing(false); refresh();
}
```

Add an "Edit case" button in the header and render the form when `editing`:

```tsx
{editing
  ? <CaseEditForm logisticsCase={c} onSubmit={saveCase} onCancel={() => setEditing(false)} />
  : <button onClick={() => setEditing(true)} className="text-sm text-primary hover:underline">Edit case details</button>}
```

- [ ] **Step 5: Run + commit**

Run: `npx vitest run src/components/admin/CaseEditForm.test.tsx src/pages/admin/LogisticsCaseDetailPage.test.tsx`
Expected: PASS.

```bash
git add src/components/admin/CaseEditForm.tsx src/components/admin/CaseEditForm.test.tsx src/pages/admin/LogisticsCaseDetailPage.tsx
git commit -m "feat(logistics-ui): edit case metadata (whitelisted fields + linked-entity validation)"
```

---

## Task 7: Create page (`src/pages/admin/CreateLogisticsCasePage.tsx`)

**Files:**
- Create: `src/pages/admin/CreateLogisticsCasePage.tsx`
- Test: `src/pages/admin/CreateLogisticsCasePage.test.tsx`

Mirror `CreateOrderPage`. Fields: caseType (required), customerName (required), contactName, customsRequired toggle, relatedOrderId, relatedEntityType + relatedEntityId, notes. Submit → `createLogisticsCase(input)` → `navigate('/admin/logistics/<caseId>')`.

- [ ] **Step 1: Write the failing test**

Create `src/pages/admin/CreateLogisticsCasePage.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const navigate = vi.fn();
vi.mock('react-router-dom', async (orig) => ({ ...(await orig() as object), useNavigate: () => navigate }));
const svc = { createLogisticsCase: vi.fn() };
vi.mock('../../services/logisticsAdminService', () => svc);

import { CreateLogisticsCasePage } from './CreateLogisticsCasePage';

beforeEach(() => { svc.createLogisticsCase.mockReset(); navigate.mockReset(); });

describe('CreateLogisticsCasePage', () => {
  it('submits and redirects to the new case', async () => {
    svc.createLogisticsCase.mockResolvedValueOnce({ caseId: 'lc-9' });
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'BAE' } });
    fireEvent.click(screen.getByText('Create Case'));
    await waitFor(() => expect(svc.createLogisticsCase).toHaveBeenCalled());
    const input = svc.createLogisticsCase.mock.calls[0][0];
    expect(input.customerName).toBe('BAE');
    expect(input.caseType).toBe('SAMPLE'); // default first option
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin/logistics/lc-9'));
  });

  it('blocks submit without a customer name', async () => {
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.click(screen.getByText('Create Case'));
    expect(svc.createLogisticsCase).not.toHaveBeenCalled();
  });

  it('blocks submit when related entity type is set without an ID', async () => {
    render(<MemoryRouter><CreateLogisticsCasePage /></MemoryRouter>);
    fireEvent.change(screen.getByLabelText(/Customer/i), { target: { value: 'BAE' } });
    fireEvent.change(screen.getByLabelText(/Related entity type/i), { target: { value: 'LEAD' } });
    fireEvent.click(screen.getByText('Create Case'));
    expect(svc.createLogisticsCase).not.toHaveBeenCalled();
    expect(screen.getByText(/both/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/admin/CreateLogisticsCasePage.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `src/pages/admin/CreateLogisticsCasePage.tsx`:

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as svc from '../../services/logisticsAdminService';
import {
  CASE_TYPES, CASE_TYPE_LABELS, RELATED_ENTITY_TYPES,
} from '../../types/logistics';

export function CreateLogisticsCasePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    caseType: CASE_TYPES[0] as string,
    customerName: '', contactName: '', customsRequired: false,
    relatedOrderId: '', relatedEntityType: '', relatedEntityId: '', notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.customerName.trim()) { setErr('Customer name is required'); return; }
    // relatedEntityType and relatedEntityId must both be empty or both set
    if (Boolean(form.relatedEntityType) !== Boolean(form.relatedEntityId.trim())) {
      setErr('Related entity type and ID must both be set or both empty'); return;
    }
    setBusy(true); setErr(null);
    try {
      const input: Record<string, unknown> = {
        caseType: form.caseType, customerName: form.customerName.trim(),
        customsRequired: form.customsRequired,
      };
      if (form.contactName) input.contactName = form.contactName;
      if (form.relatedOrderId) input.relatedOrderId = form.relatedOrderId;
      if (form.relatedEntityType) { input.relatedEntityType = form.relatedEntityType; input.relatedEntityId = form.relatedEntityId; }
      if (form.notes) input.notes = form.notes;
      const created = await svc.createLogisticsCase(input) as { caseId?: string } | null;
      if (created?.caseId) navigate(`/admin/logistics/${created.caseId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create case');
    } finally { setBusy(false); }
  }

  return (
    <div className="p-6 max-w-xl space-y-4">
      <h1 className="text-2xl font-bold text-on-surface">New Logistics Case</h1>
      {err && <p className="text-error text-sm">{err}</p>}

      <label className="block text-sm">Case type
        <select value={form.caseType} onChange={(e) => set('caseType', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2">
          {CASE_TYPES.map((t) => <option key={t} value={t}>{CASE_TYPE_LABELS[t]}</option>)}
        </select>
      </label>

      <label className="block text-sm">Customer *
        <input value={form.customerName} onChange={(e) => set('customerName', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
      </label>

      <label className="block text-sm">Contact
        <input value={form.contactName} onChange={(e) => set('contactName', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.customsRequired} onChange={(e) => set('customsRequired', e.target.checked)} />
        Customs required
      </label>

      <label className="block text-sm">Related order ID
        <input value={form.relatedOrderId} onChange={(e) => set('relatedOrderId', e.target.value)}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm">Related entity type
          <select value={form.relatedEntityType} onChange={(e) => set('relatedEntityType', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2">
            <option value="">—</option>
            {RELATED_ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block text-sm">Related entity ID
          <input value={form.relatedEntityId} onChange={(e) => set('relatedEntityId', e.target.value)}
            className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
        </label>
      </div>

      <label className="block text-sm">Notes
        <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3}
          className="mt-1 block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2" />
      </label>

      <button onClick={submit} disabled={busy}
        className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-on-primary disabled:opacity-50">
        {busy ? 'Creating…' : 'Create Case'}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/admin/CreateLogisticsCasePage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/CreateLogisticsCasePage.tsx src/pages/admin/CreateLogisticsCasePage.test.tsx
git commit -m "feat(logistics-ui): create case form"
```

---

## Task 8: Routes + admin nav

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/components/admin/AdminLayout.tsx` (the `navItems` array, ~line 11)

- [ ] **Step 1: Confirm the nav location**

The admin sidebar renders from a `navItems` array in `src/components/admin/AdminLayout.tsx`
(e.g. `{ path: '/admin/orders', label: 'Orders', icon: 'shopping_cart' }`). The Logistics
entry is added there in Step 3.

- [ ] **Step 2: Add lazy imports + routes**

In `src/routes/index.tsx`, after the Order lazy imports (~line 54) add:

```typescript
const LogisticsCaseListPage = lazy(() => import('../pages/admin/LogisticsCaseListPage').then(m => ({ default: m.LogisticsCaseListPage })));
const LogisticsCaseDetailPage = lazy(() => import('../pages/admin/LogisticsCaseDetailPage').then(m => ({ default: m.LogisticsCaseDetailPage })));
const CreateLogisticsCasePage = lazy(() => import('../pages/admin/CreateLogisticsCasePage').then(m => ({ default: m.CreateLogisticsCasePage })));
```

After the Order routes (~line 141) add:

```tsx
          <Route path="logistics" element={<LogisticsCaseListPage />} />
          <Route path="logistics/new" element={<CreateLogisticsCasePage />} />
          <Route path="logistics/:caseId" element={<LogisticsCaseDetailPage />} />
```

- [ ] **Step 3: Add the nav link**

In `src/components/admin/AdminLayout.tsx`, add to the `navItems` array (after the Orders entry):

```typescript
  { path: '/admin/logistics', label: 'Logistics', icon: 'local_shipping' },
```

- [ ] **Step 4: Typecheck + full UI test sweep**

Run: `npx tsc --noEmit 2>&1 | grep -iE "logistic" ; echo "(none above = clean)"`
Run: `npx vitest run src/types/logistics.test.ts src/hooks/useLogisticsCases.test.tsx src/components/admin/StageBadge.test.tsx src/components/admin/MilestoneProgress.test.tsx src/components/admin/LegForm.test.tsx src/components/admin/CaseEditForm.test.tsx src/pages/admin/LogisticsCaseListPage.test.tsx src/pages/admin/LogisticsCaseDetailPage.test.tsx src/pages/admin/CreateLogisticsCasePage.test.tsx`
Expected: all PASS; no logistics typecheck errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/index.tsx src/components/admin/AdminLayout.tsx
git commit -m "feat(logistics-ui): register routes + admin nav"
```

---

## Task 9: Manual verification against the running app

**Files:** none (manual)

- [ ] **Step 1: Start the dev server** — `npm run dev` (port 5173). Requires `amplify_outputs.json` present (it is).
- [ ] **Step 2:** Sign in to `/admin`, navigate to `/admin/logistics`.
- [ ] **Step 3:** Create a case (Equipment, a test customer) → lands on detail at DRAFT; confirm the progress bar shows **Draft** as the active leading pip (not a broken/empty bar).
- [ ] **Step 4:** Advance DRAFT → PRODUCTION; confirm progress bar + history update; confirm the advance dropdown offers only the **next** stage (PRODUCTION from DRAFT, then FAT_SCHEDULED, etc.) plus Cancelled — not a far jump like CLOSED.
- [ ] **Step 5:** Add a leg with carrier + tracking + customsStatus; confirm it renders and the list "Customs" column reflects it.
- [ ] **Step 6:** Back to list; confirm the case appears, filters by caseType/stage/customs work, search by caseNumber works.
- [ ] **Step 7:** Advance to CANCELLED to retire the test case (keeps lists clean).

---

## Done — UI Complete

The Logistics Cases module (Plan 1 backend + Plan 2 UI) is fully implemented and internally usable. Phase 2 (customer read-only share link via `isCustomerVisible` + `publicToken`, and optional carrier/AfterShip API polling) remains future work — the data model already reserves the fields.

## Self-Review checklist (run after writing all tasks)

- Spec coverage: list/detail/create all present; milestone bar renders only `enabledStages`; advance constrained to enabled+CANCELLED; legs CRUD; soft customs warning; log timeline with `internalOnly` marker; edit whitelist. ✓
- No carrier API (Phase 1) — UI only stores/links `trackingUrl`. ✓
- Types match the deployed schema field names + enums (verified against `src/types/logistics.ts` mirroring spec §3). ✓
- `a.json()` stats parsed via `parseStatBucket`. ✓
