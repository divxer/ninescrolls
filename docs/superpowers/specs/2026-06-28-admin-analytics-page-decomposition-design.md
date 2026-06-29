# AdminAnalyticsPage Decomposition — Design

**Date:** 2026-06-28
**Status:** Approved (Phases 1–3)
**Author:** harvey + Claude

## Problem

`src/pages/admin/AdminAnalyticsPage.tsx` is **4716 lines** — the single largest
maintainability liability in the repo. It is a God component: ~970 lines of pure
aggregation logic, a 1394-line `OrgDetail` sub-component, and a ~2020-line main
component with 84 hooks / ~48 `useState`. It has **zero tests**.

## Goals / Non-goals

- **Goal:** reduce file size and isolate concerns via behavior-preserving
  mechanical extraction, with characterization tests locking pure-logic behavior.
- **Non-goal (this round):** Phase 4 — decomposing the main component's JSX
  sections / 84 hooks / data flow. Explicitly deferred.

## Hard constraints

- `src/pages/admin/AdminAnalyticsPage.tsx` **path and named export
  `AdminAnalyticsPage` must not change** — it is lazy-imported by
  `src/routes/index.tsx:52` and referenced by `amplifyClient.lazy.test.ts`.
- Behavior preserved exactly. No logic changes during extraction.
- Each phase = its own commit, each verified independently with
  `npm test` + `npx tsc --noEmit` + `npm run build`.

## Target structure

New sibling directory `src/pages/admin/analytics/`. The page file stays in place
and imports from it.

```
src/pages/admin/
  AdminAnalyticsPage.tsx          (shell — keeps path + named export)
  analytics/
    types.ts          OrganizationRecord, DateRange, SortColumn, KpiFilter,
                      KeywordSourceFilter, KeywordEntry, PageAnalyticsTab,
                      PageStats, ProductPageStats, LandingPageStats,
                      PageViewFlushInfo, BotRecord
    constants.ts      GEO_URL, DATE_RANGES, SEARCH_ENGINE_NAMES,
                      KNOWN_BOT_SIGNATURES
    format.ts         tierRank, tierColor, formatDuration, engagementLevel,
                      engagementRank, getDateBounds, formatRelativeTime,
                      isPrivateIP, maskIP, normalizePath
    keywords.ts       getSearchQuery, extractSearchEngineName, aggregateKeywords
    pageStats.ts      aggregatePageStats, aggregateProductStats,
                      aggregateLandingPages
    flush.ts          selectBestFlush, computePerPageDuration
    orgAggregation.ts computeOrgLifecycleStage, aggregateByOrg
    bots.ts           detectBotName, aggregateBots
    keywords.test.ts  pageStats.test.ts  orgAggregation.test.ts
    bots.test.ts      flush.test.ts      format.test.ts
    components/
      VisitorMap.tsx
      ChannelSummaryChart.tsx
    OrgDetail/        (Phase 3)
      index.tsx       OrgDetail shell
      <panels>.tsx    extracted sub-sections of the 1394-line component
```

## Phases

### Phase 1 — Pure logic + types + constants (LOW risk) + tests
Move all non-JSX functions, types, and constants listed above into the
`analytics/` modules. Re-import them into `AdminAnalyticsPage.tsx`. Add
characterization tests **before/alongside** the move, focused on the logic most
likely to be broken by a careless extraction:
- `aggregateByOrg`: visitorId grouping, ISP split-by-visitor, unknown/ISP
  classification, lead-tier sorting, counts.
- `aggregateKeywords`: external vs internal source split, search-engine name
  extraction, counting/sorting.
- `pageStats`: path normalization, product/landing aggregation, bounce/sort.
- `bots`: bot signature detection, aggregation/counting.
Tests aim for coverage of sorting / filtering / counting / unknown+ISP paths —
not exhaustive perfection.
File after Phase 1: ~3600 lines.

### Phase 2 — Standalone sub-components (LOW–MED risk)
Move `VisitorMap` and `ChannelSummaryChart` to `analytics/components/`. These are
self-contained presentational components with explicit props — straight moves.

### Phase 3 — OrgDetail extraction + split (MED risk)
Move the 1394-line `OrgDetail` to `analytics/OrgDetail/`, then split its internal
panels into focused sub-components under the same folder. Props-only interfaces;
no shared-state changes. File after Phase 3: ~2000 lines (main component only).

## Verification protocol (every phase)
1. `npm test` — full suite green (plus new tests in Phase 1).
2. `npx tsc --noEmit` — clean.
3. `npm run build` — succeeds.
4. Commit with a phase-scoped message. Do not bundle phases.

## Out of scope
- Phase 4 (main component hooks/JSX/data-flow decomposition) — separate future
  effort once Phases 1–3 land.
- The repo-wide 615 ESLint `no-explicit-any` backlog.
