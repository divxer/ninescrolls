# Hybrid Bonding vs Micro-Bump — Design Spec (Advanced Packaging spoke #4)

**Date:** 2026-06-11
**Status:** Approved design → ready for implementation plan
**Type:** Content (cluster expansion) — a technology-crossover *selection* article, not a comparison/spec sheet.

---

## Positioning & Gate 0.5

The Advanced Packaging cluster needs its **selection** page. Gate 0.5 confirms the **Create** path: no live page owns the micro-bump / interconnect-selection comparison in title or slug (micro-bump appears only as *context* in the hub, surface-prep, and HBM4 bodies — never as a selection page).

This page answers a search-intent the cluster doesn't yet serve: **"hybrid bonding vs micro bump"** — but reframed editorially as the **interconnect crossover** (when does the industry switch generations?). That framing is what keeps it distinct from the hub and gives it an original, citable asset.

**The 5-page cluster intent map (one intent each):**
```
Wafer Bonding hub        → technology (what / why hybrid won)
Surface Preparation      → chemistry (Cu-Cu conditioning)
Failure Analysis         → defects (detect / diagnose)
Hybrid Bonding vs µBump  → SELECTION (this page — when to switch)
HBM4                     → application (AI memory)
```

## Title / slug / meta (schema reconciliation)

The `InsightsPost` schema has a **single `title` field** that renders as both the H1 and the `<title>` tag (via `SEO.tsx`, which appends "| NineScrolls LLC"). There is **no separate metaTitle field**. So one title must serve both — chosen keyword-first to capture the query while staying crossover-framed:

- **`title` (= H1 = `<title>` base):** `Hybrid Bonding vs Micro-Bump: Where Each Technology Wins` (~56 chars; keyword-first + answers the searcher's natural "which is better?" question directly)
- **Slug:** `hybrid-bonding-vs-micro-bump` (exact search-term match in URL; strong backlink anchor)
- **Excerpt (= meta description):** "Explore the interconnect crossover between micro-bumps and hybrid bonding — pitch scaling, density, yield, thermal, and which interconnect wins at each pitch."
- **Opening hook line (in body, not the title — the thought-leadership framing):** "The Interconnect Crossover: where micro-bumps stop scaling and hybrid bonding takes over."
- **Early H2 (keyword variation, since the title now uses "Where Each Technology Wins"):** `The Quick Answer: Micro-Bump or Hybrid Bonding?`

## Anti-cannibalization rules (greppable, RULE-7 discipline)

- **R1 (RULE 7 — selection intent only).** This page never becomes "what is hybrid bonding." No full mechanism or process-flow explanation (the hub owns that). The first substantive H2 is the crossover *question/selection*, never "What is hybrid bonding."
- **R2 — dual-defer up top.** The opening defers to the **Wafer Bonding hub** (mechanism + why-hybrid-won) and points lightly to **Surface Preparation** and **Failure Analysis** for their domains.
- **R3 — §3 hard boundary.** "What Hybrid Bonding Changes" covers only the *interconnect-level* change (pad-less direct Cu-Cu, pitch scaling). NO CMP/surface-conditioning detail (surface-prep owns), NO defect/FA detail (FA owns).
- **R4 — applications defer.** §6 examples ≤200 words each and **link out** to the HBM4 article; do not re-explain HBM (HBM4 owns the application narrative).
- **R5 — length.** Target **2,400–2,800 words** (tighter than a guide because it defers mechanism). **[CORRECTED at drafting, 2026-06-11: the section-budget table below sums to ~3,030, so the 2,800 cap was arithmetically inconsistent with the mandated structure. Effective R5 = ~2,900–3,100 with §5 (700–800) and R7 floors protected; the published draft is 3,068.]**
- **R6 — single climax asset.** The Interconnect Selection Decision Map is the one Level-3 asset; the article builds to it.

## Structure (8 sections + budget; ~2,600w target)

The early keyword H2 (§1) gives the **direct answer up front** (serves the "hybrid bonding vs micro bump" searcher immediately + featured-snippet friendly); the narrative then deepens into *why* (the crossover), climaxing in the full Decision Map.

| # | H2 | ~words | Owns / defers |
|---|---|---|---|
| lead | hook line ("The Interconnect Crossover…") + dual-defer | 110 | defer hub/surface/FA |
| 1 | **The Quick Answer: Micro-Bump or Hybrid Bonding?** *(early quick-answer: the 3 pitch zones in brief)* | 190 | satisfies R1 (selection intent, not "what is HB") |
| 2 | The Question — why not just keep shrinking micro-bumps? *(includes the **Interconnect Evolution Ladder** mini-figure)* | 230 | sets the crossover premise |
| 3 | The Micro-Bump Scaling Wall | 420 | bump collapse, solder bridging, current crowding, parasitics/RC, routing congestion, fine-pitch throughput |
| 4 | What Hybrid Bonding Changes (at the interconnect level) | 280 | pad-less direct Cu-Cu, pitch/density step; **link hub for mechanism** (R3) |
| 5 | The Crossover Region | **700–800** | **THE THOUGHT CORE / article climax** — NineScrolls' judgment: pitch zones, yield economics (known-good-die, test cost, rework impossibility of HB), thermal crossover, cost/throughput crossover, why the transition zone is architecture-dependent. This is the original analysis the framework figure visualizes. **MUST include the citable selection principle (see below).** |
| 6 | The Interconnect Selection Framework | 200–250 | **Level-3 asset figure** + how-to-read (graphics of §5's judgment, not new analysis) |
| 7 | Application Examples | 360–450 | HBM / logic-on-logic chiplets / CIS — **120–150w each**, pattern = Example → why chosen → link out (HBM4) (R4); deliberately thin so future dedicated pages (e.g. "Hybrid Bonding for CIS") face no internal competition |
| 8 | Key Takeaways — the selection framework | 190 | decision summary |
| — | FAQ + Further Reading + CTA | ~230 | cluster links |

## Level-3 asset — The Interconnect Selection Framework (2-axis, four technologies)

A pitch-only zoning chart would blend into the many existing industry pitch-roadmaps — not citable. The asset is instead a **two-axis selection framework** that places ALL FOUR interconnect generations:

- **x-axis:** Connection density (interconnects/mm², low → high; correlates inversely with pitch)
- **y-axis:** Manufacturing readiness / cost-economics (mature-cheap → emerging-expensive)
- **Plotted:** **Flip Chip** (low density, highest maturity) · **Cu Pillar** (mid density, high maturity) · **Fine-Pitch Micro-Bump** (high density, moderate maturity) · **Hybrid Bonding** (highest density, lowest maturity/highest cost — but the only option past the wall)
- **Overlaid zones:** A — Micro-Bump Dominant (>~20 µm pitch equivalents) · B — Transition (~10–20 µm; architecture- & yield-economics-dependent) · C — Hybrid Bonding Dominant (<~10 µm)
- The reader's selection logic: find your density requirement on x → the technologies above it on y are your candidates → the zone tells you the default winner and when economics overrides it.

Numbers stated **conservatively and literature-framed** (ranges, "roughly," cited), never hard-coded. Citable as "NineScrolls' interconnect selection framework."

## The citable selection principle (§5, required)

§5 must state an explicit, quotable **selection order** — the sentence outsiders cite when they cite the framework (not just the chart):

> **"Hybrid bonding is not adopted when it becomes possible. It is adopted when density requirements outweigh manufacturing economics."**

Backed by the explicit decision order: **(1) Density requirement → (2) Yield economics → (3) Cost structure → (4) Throughput constraint.** Rendered prominently (e.g. a pull-quote/callout block) so it is visually liftable. This is what elevates the page from "analysis + chart" to "NineScrolls' framework."

## Secondary asset — Interconnect Evolution Ladder (mini-figure, §2)

A small reusable diagram establishing that the four technologies are ONE continuous evolution (most readers don't know this): `Flip Chip → Cu Pillar → Fine-Pitch Micro-Bump → Hybrid Bonding`, annotated with the directional trends (pitch ↓, density ↑, interconnect length ↓). Reusable later by the hub, HBM, and TSV pages.

## Internal graph (Gate 3) & keywords

- **Links (≥3):** Wafer Bonding hub, Surface Preparation, Failure Analysis, HBM4 — all four cluster pages.
- **Back-links (Phase B, separate):** hub §3/§4 and HBM4 add a down-link to this page.
- **Keywords:** hybrid bonding vs micro bump · micro bump vs hybrid bonding · copper pillar vs hybrid bonding · micro-bump scaling limit · bump pitch limit · interconnect crossover · when to use hybrid bonding.

## Figures (3)

1. **Cover** (navy hero, brand) — interconnect crossover theme.
2. **Interconnect Selection Framework** (white-bg flat infographic — the 2-axis Level-3 asset; required; §6).
3. **Interconnect Evolution Ladder** (small white-bg mini-figure; §2; reusable across the cluster).

Cover-first gate (user generates in Gemini; cover approved before inline figures).

## R7 (added at review) — application examples stay thin
Each §7 example is 120–150 words, pattern "Example → why this interconnect → link out" — never a mini-article. This protects future dedicated pages (e.g. "Hybrid Bonding for CIS", "Stacked CMOS Image Sensors") from internal competition. Greppable check: §7 contains exactly 3 `<h3>` examples, each under ~160 words.

## Success criteria

- Ranks for "hybrid bonding vs micro bump" family without cannibalizing the hub's "wafer bonding / hybrid bonding" terms (verify post-index).
- Passes all 6 boundary rules on a grep audit.
- The Decision Map is genuinely original (not a restyled comparison table) and earns the "selection map" citation framing.
- Completes the cluster: five pages, five intents, fully cross-linked.
