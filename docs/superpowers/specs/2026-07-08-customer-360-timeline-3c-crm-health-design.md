# Customer 360 Timeline — Plan 3C: CRM Health (post-commit repair + thin health panel)

**Status:** Design approved for planning 2026-07-08. Branch `feature/customer-360-timeline-3c` off `origin/main` `d0e29a68` (includes 3A read view + 3B needs-linking).

**Goal:** Close the post-commit side-effect gap that Plan 3B deliberately left open — automatically, durably, and idempotently — and give admins a thin read-only window to confirm the self-heal machine is working.

## 1. Problem & context

Plan 3B's two link orchestrators treat the entity-resolution write as the **durable commit** (per-event `manualMove` for structured units; the conditional visitor-bridge upsert for analytics). Everything after that — source `matchedOrgId` backfill, the `LinkAuditLog` row, the analytics retro re-resolve — is **best-effort**: wrapped in try/catch, logged as `crm.link.post_commit_error`, surfaced once in the UI banner via `postCommitStatus:'post_commit_failed'`, and then **never retried**. There is no durable, queryable record a job can drain.

3B's round-5 review established the governing rule the hard way: **a repair path must derive its target from committed state (the org the events actually moved to / the committed bridge org), never from the incoming request** — a stale client re-firing a losing link must not be able to corrupt a source record. 3B's interim fix was to *remove* the speculative repair and defer a correct one to 3C. This spec is that correct one.

Two facts from the merged 3B/2C code drive the design:

- **`reResolveVisitorSessions` (retro) and `backfillSource` are already idempotent** — deterministic re-emit ids; first-writer-wins conditional `SET matchedOrgId`. They are safe to re-run any number of times.
- **`writeLinkAuditLog` is NOT idempotent** — `generateAuditId()` returns `audit-<random hex>` and the row is immutable (`attribute_not_exists(PK)`). A naive replay writes a *duplicate* audit row. This forces one required sub-change (§3).

**Scope (repair-first):** the durable self-healing repair mechanism is the deliverable; a thin `/admin/crm-health` readout rides alongside so an admin can see it working.

**Explicit non-goals (deferred):** CloudWatch metric filters/alarms (separate ops task — see the "Deferred ops follow-ups" note in `project_customer_360` memory); rich dashboard/charts/historical trends; live dirty-rollup & unresolved-backlog counts (would require table scans); a symptom-scan fallback for the sub-one-call crash-before-marker window (documented residual, §7); auto-retry of stuck markers; per-item or bulk retry UIs; org auto-create (still P2); Gmail/Twilio.

## 2. Architecture

A durable **repair outbox** on the shared `INTELLIGENCE_TABLE`, drained by a **dedicated** `reconcileRepair` action on its own lease + cron — a consumer of post-commit side-effect markers, kept structurally separate from the 2C existence/dirty-rollup sweep.

```
link mutation (3B)                         reconcileRepair (3C, */15 cron + on-demand)
──────────────────                         ─────────────────────────────────────────
durable commit (moved>0 / bridge upsert)   acquire lease CRM_SWEEP#repair#drain
  ↓                                        Query GSI1 CRM_REPAIR#pending (oldest-first)
putRepairMarker(committed target)  ───────▶  for each marker: replaySideEffects (idempotent)
  ↓                                            ok        → deleteRepairMarker
replaySideEffects (backfill/retro + audit)     hasMore   → keep pending (progress)
  ↓                                            conflict  → mark stuck (source_conflict)
all ok → deleteRepairMarker                    transient → attempt++, ≥MAX → stuck
else   → marker survives, drainer takes over  release lease + crm.repair.summary
```

The marker's `targetOrgId` is written **after** the commit, so it is always the org that actually won; a losing/stale linker hits `moved=0` and never reaches `putRepairMarker` (round-5 rule holds structurally).

## 3. Repair marker (the outbox item)

Sparse; one item per still-failed link. Deterministic PK ⇒ no duplicate markers.

```
PK      CRM_REPAIR#<unitType>#<unitKey>       SK  STATE
GSI1PK  CRM_REPAIR#pending | CRM_REPAIR#stuck  GSI1SK  <createdAt>#<unitKey>   (oldest-first)
entityType  'CRM_REPAIR'
unitType    'structured' | 'analytics'
unitKey     structured → unresolved-<sourceType>-<sourceEntityId> ; analytics → visitorId
targetOrgId <committed target org>            operator  <server-derived, original linker>
createdAt   <link nowIso>
status      'pending' | 'stuck'               stuckReason 'source_conflict' | 'max_attempts' | null
attemptCount 0                                 lastAttemptAt null   lastError null
--- structured only ---
sourceType, sourceEntityId,             ← ALWAYS stored (the durable inputs the drainer re-resolves from)
backfillPk   <CACHED optional: best-effort at link time; null if link-time resolution failed OR no source>
affectedEventIds, movedCount, contactStatus
```

**`backfillPk` is a cached optimization, not a hard dependency.** `backfillTargetPk()` is pure for rfq/lead/order (`SOURCE_PK[type](id)`) and in-memory for quote (`events[0].payload.orderId`), but for **logistics it does a `GetCommand` on `LOGISTICS#<id>/META`** that can throw *after* the durable move but *before* the marker put. The marker MUST still be written in that case (with `backfillPk: null`), so the drainer can re-resolve later — otherwise a logistics link-time Get failure would re-open the exact post-commit window 3C exists to close. Resolution rules: rfq/lead/order → pure, always cached; quote → resolved from the in-memory `events` at link time (cannot fail), always cached; logistics → Get at link time, cached on success, `null` on failure and **re-Got by the drainer from `sourceEntityId`**.

**GSI1PK routes visibility:** the drainer Queries **only** `CRM_REPAIR#pending`; `CRM_REPAIR#stuck` is Health-read-only and never auto-retried.

**Deterministic audit id (required sub-change):**
```ts
// idGenerators.ts
export function deterministicAuditId(reason: string, unitKey: string, targetOrgId: string): string {
  return `audit-${sha256(`${reason}|${unitKey}|${targetOrgId}`).slice(0, 16)}`;
}
```
`writeLinkAuditLog` gains an optional `id?: string`; when provided it is used verbatim (else the existing random id — no other caller changes). With `attribute_not_exists(PK)` already in place, whichever writer (original post-commit **or** drainer) lands first writes the row and the other is a **true no-op**. Including `targetOrgId` means a later *corrective* re-link to a different org still gets its own audit row.

**INVARIANT (spec-level):** the audit id may be derived **only from the committed target** (`unitKey` + committed `targetOrgId`), never from a stale request target. The drainer passes `timestamp: marker.createdAt` so the audit reflects when the link happened, not when repair ran.

## 4. Shared replay contract (`replaySideEffects.ts`)

The DRY hinge: the happy path (link mutations) and the drainer call the **same** functions, so they produce identical audit rows and identical backfill semantics.

```ts
replayStructuredSideEffects({ backfillPk, targetOrgId, unitKey, operator, createdAt,
                              affectedEventIds, movedCount, contactStatus }): Promise<ReplayResult>
replayAnalyticsSideEffects({ visitorId, targetOrgId, operator, createdAt }): Promise<ReplayResult>
```

**`ReplayResult` contract — internal catch, but conflict/progress semantics are NEVER swallowed:**

| situation | result |
|---|---|
| full success (all effects ok; retro not hasMore) | `{ ok: true }` |
| transient exception (throw inside backfill/retro/audit) | `{ ok: false, errorType: 'transient' }` |
| structured source conflict (source META already a *different* real org) | `{ ok: false, errorType: 'source_conflict', conflict: true }` |
| analytics retro `hasMore` (more sessions to resolve — progress) | `{ ok: false, errorType: 'in_progress', hasMore: true }` |

The helper **does not throw out**; the caller decides delete-vs-keep-vs-stuck. Both replay functions internally: run the idempotent effect (conditional backfill / retro), capture its status, then write the deterministic audit. `source_conflict` comes from `backfillSource` returning `conflict` (a real terminal condition), distinct from a thrown transient error.

**`replayStructuredSideEffects` re-resolves `backfillPk` itself** so the happy path and the drainer behave identically: it takes `{ sourceType, sourceEntityId, backfillPk? }`; if `backfillPk` is present it uses it, else it resolves via a drain-safe `resolveBackfillPk(sourceType, sourceEntityId)` — pure for rfq/lead/order, a `LOGISTICS#<sourceEntityId>/META` Get for logistics, and (quote only) requires the cached value since the drainer has no `events`. A resolution Get that throws surfaces as `errorType:'transient'` (retried next pass), never as a lost backfill. A resolved `null` (genuinely no source record) is `no_source`, which counts as success for marker deletion (nothing to backfill).

Replay is **replay-all**, not per-effect pending flags: since every effect is idempotent, re-running the whole set each drain is simpler, carries less state, and cannot wedge in a half-completed workflow.

## 5. Link-mutation changes (`linkStructuredUnit.ts`, `linkVisitor.ts`)

Post-commit block becomes: **putRepairMarker (best-effort, carries committed target) → replaySideEffects → deleteRepairMarker on `ok`**.

```
structured (after moved>0):
  let backfillPk = null
  try { backfillPk = await backfillTargetPk(sourceType, sourceEntityId, events) } catch { /* cache best-effort; logistics Get may throw */ }
  // marker is written REGARDLESS of backfillPk resolution — sourceType/sourceEntityId let the drainer re-resolve
  try { await putRepairMarker({ unitType:'structured', unitKey:syntheticOrgId, targetOrgId, operator, createdAt:nowIso,
                                sourceType, sourceEntityId, backfillPk, affectedEventIds, movedCount:moved, contactStatus }) }
  catch { postCommitStatus = 'post_commit_failed' }        // no marker → falls back to 3B self-heal (see §8)
  const r = await replayStructuredSideEffects({ backfillPk, targetOrgId, unitKey:syntheticOrgId,
                                                operator, createdAt:nowIso, affectedEventIds, movedCount:moved, contactStatus })
  if (r.ok) { try { await deleteRepairMarker(...) } catch { postCommitStatus = 'post_commit_failed' } }
  else      { postCommitStatus = 'post_commit_failed' }    // marker survives; drainer takes over

analytics (after bridge upsert written):
  try { await putRepairMarker({ unitType:'analytics', unitKey:visitorId, targetOrgId, operator, createdAt:nowIso }) }
  catch { postCommitStatus = 'post_commit_failed' }
  const r = await replayAnalyticsSideEffects({ visitorId, targetOrgId, operator, createdAt:nowIso })
  if (r.ok) { try { await deleteRepairMarker(...) } catch { postCommitStatus = 'post_commit_failed' } }
  else      { postCommitStatus = 'post_commit_failed' }
```

**INVARIANTS (spec-level, must have regression tests):**
- `moved === 0` (structured) and the empty-partition `alreadyLinked` early return MUST NOT call `putRepairMarker`. A stale/losing linker never creates a marker.
- The `already-manual` / `alreadyResolved` short-circuits in `linkVisitor` MUST NOT create a marker (they already self-heal via the existing idempotent retro).
- **Marker-cleanup-failure is NOT data corruption.** If side effects succeed but `deleteRepairMarker` throws, the mutation still returns success with `postCommitStatus:'post_commit_failed'`; the drainer replays the marker once more (idempotent — backfill already_set, audit no-op, retro no-op) and deletes it. The only cost is one extra repair pass.

## 6. Drainer (`reconcileRepair.ts`) + handler + cron

Dedicated direct action `reconcileRepair({ limit })`, lease `CRM_SWEEP#repair#drain / STATE` (reuse `sweepState` helpers; widen `SweepMode` with `'repair'` and `SweepPass` with `'drain'`, exactly as 2C-analytics widened them once for `'analytics'/'sessions'`).

**No durable cursor.** Unlike the existence/rollup passes, the repair queue self-shrinks — a drained marker is *deleted* — so there is nothing to resume from. Each run Queries `#pending` oldest-first up to `limit`; `hasMore` is simply "were there more pending markers than this run drained" (the Query's `LastEvaluatedKey` is present, or pending count exceeded `limit`). The next `*/15` fire drains the remainder. The lease exists only to keep the cron and an on-demand `runCrmRepair` from overlapping.

**Lease-release helper change (required):** both `releaseLease` and `releaseLeaseKeepCursor` currently hardcode `hasMore=false`, which would make the repair STATE row misreport progress. Add an optional `hasMore` param to `releaseLeaseKeepCursor` (`SET hasMore = :h …`), **defaulting to `false`** so the existing analytics-rollup caller is unaffected; the repair drainer passes the computed `hasMore`. (`releaseLeaseKeepCursor` is correct here — repair has no cursor, so "keep cursor" is a no-op preserve of the absent cursor.) A regression test asserts the repair STATE row stays `hasMore:true` when more pending markers remain.

```
acquireLease → null ? return { skippedLeaseHeld: true }
Query GSI1 CRM_REPAIR#pending, oldest-first, up to limit (default 100 — backlog is tiny)
for each marker (replay-all by unitType):
```

| replay result | marker transition | counter |
|---|---|---|
| `ok` | **delete** | `repaired` |
| `in_progress` (retro hasMore) | stay pending, bump `lastAttemptAt` only (not an error) | `inProgress` |
| `source_conflict` | → **stuck** / `source_conflict`, move to `#stuck` **immediately** (no attempt budget) | `blocked` |
| `transient`, `attemptCount+1 < MAX` (MAX=5) | stay pending, `attemptCount++`, `lastError` | `retrying` |
| `transient`, `attemptCount+1 ≥ MAX` | → **stuck** / `max_attempts`, move to `#stuck` | `stuck` |

```
releaseLeaseKeepCursor('repair','drain', lease, { lastSummary: counters, hasMore })   // single-pass; hasMore from the Query
log crm.repair.summary { examined, repaired, inProgress, blocked, retrying, stuck, hasMore }
```

- **Stuck is terminal** until a human acts. A corrective re-link overwrites the marker back to `pending` with the new committed target (self-clears) — no infinite retry of an unfixable state.
- **Audit attribution during a drain** uses the marker's stored `operator` (the original linker), NOT whoever triggered the drain.

**Handler / schema:**
- Direct action `reconcileRepair` (cron) + AppSync mutation `runCrmRepair` ("Run repair now") → both call `reconcileRepair`. `runCrmRepair` returns `{ skippedLeaseHeld: true }` when the lease is held (UI shows "already running") — the on-demand path does **not** bypass the lease.
- AppSync query `crmHealth` (§7). New `data/resource.ts` customTypes `CrmHealthResult` / `RepairSummary`, `allow.authenticated()`.
- `backend.ts`: one `*/15` EventBridge cron → `crm-api { action:'reconcileRepair' }`, created in `Stack.of(backend.crmApi.resources.lambda)` (intra-stack, zero cross-stack edges — avoids the nested-stack cycle class), guarded `if (!isSandbox)`, target via `RuleTargetInput.fromObject`.

## 7. Thin Health read (`crmHealth.ts`) + panel

Read-only, **zero scans** — reads 4 `STATE` rows (`GetCommand`) + Queries 2 tiny GSI1 partitions with bounded page size. The exact sweep-state keys (verified against merged 2C code — `stateKey(mode,pass)` ⇒ `CRM_SWEEP#<mode>#<pass>`): existence runs for both hot and cold; the dirty-rollup pass is cold-only and lives under its own `dirty-rollups` pass key.

```ts
crmHealth(): {
  repairPending: { count, sample: [{ unitType, unitKey, targetOrgId, attemptCount, lastError, createdAt }] },
  repairStuck:   { count, sample: [{ unitType, unitKey, targetOrgId, stuckReason, lastError, createdAt }] },
  lastRepairSummary:   CRM_SWEEP#repair#drain.lastSummary      | null,
  lastHotSweep:        CRM_SWEEP#hot#existence.lastSummary  (+ hasMore) | null,
  lastColdSweep:       CRM_SWEEP#cold#existence.lastSummary (+ hasMore) | null,
  lastDirtyRollupSweep: CRM_SWEEP#cold#dirty-rollups.lastSummary | null,
}
```

- **Bounded samples:** each `sample` capped at ≤25 items; `count` is a limited/paginated count (Query with a modest cap), never a full-backlog scan. If the partition exceeds the cap, `count` is reported as a floor (e.g. `25+`).
- **No** live dirty-rollup / unresolved-backlog counts (those would need table scans). The dirty-rollup *summary* is surfaced from its cold-sweep STATE row (cheap `Get`, no scan); unresolved backlog is already visible on the Needs-Linking page.

**Panel — new `/admin/crm-health` page** (mirrors how 3B added `/admin/needs-linking`): nav item `CRM Health`; cards for pending/stuck repair lists (with samples), last repair summary, last hot/cold sweep summaries, and a single **"Run repair now"** button (calls `runCrmRepair`; on `skippedLeaseHeld` shows "already running — the scheduled repair is in progress"). No per-item retry, no Needs-Linking banner (fast-follow if pending/stuck ever becomes a real operational pain).

## 8. Residual & failure semantics (documented, accepted)

- **Crash-before-marker window:** a crash between the last successful move and `putRepairMarker` leaves no marker (window ≈ one DynamoDB call). Strictly smaller than 3B's gap. The existing moved>0 self-heal still recovers the *backfill* on re-queue; only the *audit* stays best-effort. No symptom-scan fallback in 3C (a missing audit leaves no symptom to scan for; backfill symptom-recovery is deferred).
- **Marker-put failure:** `putRepairMarker` is best-effort. If the marker write itself fails AND the subsequent replay also fails (e.g. one correlated DynamoDB brownout kills both), there is no durable marker and we fall back to exactly the old 3B behavior — `postCommitStatus:'post_commit_failed'` + the moved>0 self-heal-on-re-queue for backfill, audit best-effort. This is the same acceptable residual as crash-before-marker, just triggered a step later; writing the marker *before* the fragile side effects (not in the catch) is precisely what keeps this case rare rather than routine.
- **Marker-cleanup failure:** not corruption — one extra idempotent repair pass (§5). Side effects already succeeded; the drainer re-runs replay (backfill `already_set`, audit no-op, retro no-op) and deletes the marker.
- **Stuck markers:** never auto-retried; cleared only by a human corrective re-link (overwrites to pending) or manual DB action. Surfaced in the panel.

## 9. Testing (TDD)

**Backend:** `deterministicAuditId` stability + collision-avoidance across orgs; `auditStore` optional-id path + second-write no-op (not a duplicate row); `replaySideEffects` both types return the exact `ReplayResult` for each situation (ok / transient / source_conflict / in_progress) + idempotency (backfill already_set, audit no-op, retro re-run) + **`backfillPk` re-resolution when the marker cached `null` (logistics re-Get; Get-throws ⇒ `transient`; `null` ⇒ `no_source`⇒ok)**; `repairMarker` put idempotent (deterministic PK), delete, markStuck transitions + GSI1PK move; `reconcileRepair` full matrix (success→delete, in_progress→keep, conflict→stuck-immediate, transient→attempt++, ≥MAX→stuck, lease-held→skip, empty→noop, oldest-first order) + **STATE row stays `hasMore:true` when more pending markers remain than `limit`**; `sweepState` — **`releaseLeaseKeepCursor` new optional `hasMore` param (defaults false; analytics caller unaffected)** + union widening; `crmHealth` reads STATE + bounded samples with **no Scan** asserted; `linkStructuredUnit`/`linkVisitor` — marker written after commit / deleted on `ok` / kept on failure, **marker written even when link-time `backfillTargetPk` throws (logistics) with `backfillPk:null`**, **`moved===0` and short-circuits do NOT put a marker**, deleteMarker-failure ⇒ success + `postCommitStatus:'post_commit_failed'`.

**Frontend:** `CrmHealthPage` renders pending/stuck/summaries; "Run repair now" success path + `skippedLeaseHeld` → "already running"; `useCrmHealth` hook; service methods `getCrmHealth`/`runCrmRepair`.

## 10. Infra guardrails (from `project_amplify_envs` / `project_customer_360` memory)

- **No new GSI** (reuse GSI1; `CRM_REPAIR#pending`/`#stuck` won't collide with `TLEVENT_STATUS#unresolved`).
- **No new table grant** — crm-api owns `INTELLIGENCE_TABLE` (`grantReadWriteData`, includes `/index/*`); AnalyticsEvent index grant already shipped (#237); retro was already wired in 3B.
- **Cron Rule intra-stack** via `Stack.of(crmApi.lambda)` + `!isSandbox` (both nested-stack-cycle classes avoided; crm-api already `resourceGroupName:'data'`).
- **Post-deploy:** confirm the first `crm.repair.summary` fire (expected `examined:0` on a healthy system), then exercise once by forcing a post-commit failure in a test link (or just verify the panel renders live). No backfill job needed — the outbox only fills on real failures going forward.
