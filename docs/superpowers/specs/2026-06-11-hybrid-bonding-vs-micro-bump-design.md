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

- **`title` (= H1 = `<title>` base):** `Hybrid Bonding vs Micro-Bump: Where the Interconnect Crossover Occurs` (~58 chars; keyword-first + crossover framing)
- **Slug:** `hybrid-bonding-vs-micro-bump` (exact search-term match in URL; strong backlink anchor)
- **Excerpt (= meta description):** "Explore the interconnect crossover between micro-bumps and hybrid bonding — pitch scaling, density, yield, thermal, and which interconnect wins at each pitch."
- **Opening hook line (in body, not the title):** "The Interconnect Crossover: where micro-bumps stop scaling and hybrid bonding takes over."
- **Early H2 (keyword reinforcement):** `Hybrid Bonding vs Micro-Bump: Where Each Technology Wins`

## Anti-cannibalization rules (greppable, RULE-7 discipline)

- **R1 (RULE 7 — selection intent only).** This page never becomes "what is hybrid bonding." No full mechanism or process-flow explanation (the hub owns that). The first substantive H2 is the crossover *question/selection*, never "What is hybrid bonding."
- **R2 — dual-defer up top.** The opening defers to the **Wafer Bonding hub** (mechanism + why-hybrid-won) and points lightly to **Surface Preparation** and **Failure Analysis** for their domains.
- **R3 — §3 hard boundary.** "What Hybrid Bonding Changes" covers only the *interconnect-level* change (pad-less direct Cu-Cu, pitch scaling). NO CMP/surface-conditioning detail (surface-prep owns), NO defect/FA detail (FA owns).
- **R4 — applications defer.** §6 examples ≤200 words each and **link out** to the HBM4 article; do not re-explain HBM (HBM4 owns the application narrative).
- **R5 — length.** Target **2,400–2,800 words** (tighter than a guide because it defers mechanism).
- **R6 — single climax asset.** The Interconnect Selection Decision Map is the one Level-3 asset; the article builds to it.

## Structure (8 sections + budget; ~2,600w target)

The early keyword H2 (§1) gives the **direct answer up front** (serves the "hybrid bonding vs micro bump" searcher immediately + featured-snippet friendly); the narrative then deepens into *why* (the crossover), climaxing in the full Decision Map.

| # | H2 | ~words | Owns / defers |
|---|---|---|---|
| lead | hook line + dual-defer | 110 | defer hub/surface/FA |
| 1 | **Hybrid Bonding vs Micro-Bump: Where Each Technology Wins** *(early keyword H2 = quick answer: the 3 pitch zones in brief)* | 190 | satisfies R1 (selection intent, not "what is HB") |
| 2 | The Question — why not just keep shrinking micro-bumps? | 230 | sets the crossover premise |
| 3 | The Micro-Bump Scaling Wall | 420 | bump collapse, solder bridging, current crowding, parasitics/RC, routing congestion, fine-pitch throughput |
| 4 | What Hybrid Bonding Changes (at the interconnect level) | 280 | pad-less direct Cu-Cu, pitch/density step; **link hub for mechanism** (R3) |
| 5 | The Crossover Region | 470 | **core**: pitch zones, yield economics, thermal, cost/throughput crossover |
| 6 | The Interconnect Selection Decision Map | 330 | **Level-3 asset** (figure + how-to-read) |
| 7 | Application Examples | 430 | HBM / logic-on-logic chiplets / CIS — ≤200w each, link out (HBM4) (R4) |
| 8 | Key Takeaways — the selection framework | 190 | decision summary |
| — | FAQ + Further Reading + CTA | ~230 | cluster links |

## Level-3 asset — Interconnect Selection Decision Map

A pitch-axis decision map, the article's climax and most-citable artifact:
- **x-axis:** interconnect pitch (and/or connection density)
- **Zone A — Micro-Bump Dominant** (>~20 µm): mature, low cost, high throughput
- **Zone B — Transition** (~10–20 µm): architecture- and yield-economics-dependent
- **Zone C — Hybrid Bonding Dominant** (<~10 µm): highest density, shortest interconnect, advanced AI packages

Numbers stated **conservatively and literature-framed** (ranges, "roughly," cite sources), never hard-coded as fact. Citable as "NineScrolls' interconnect selection map."

## Internal graph (Gate 3) & keywords

- **Links (≥3):** Wafer Bonding hub, Surface Preparation, Failure Analysis, HBM4 — all four cluster pages.
- **Back-links (Phase B, separate):** hub §3/§4 and HBM4 add a down-link to this page.
- **Keywords:** hybrid bonding vs micro bump · micro bump vs hybrid bonding · copper pillar vs hybrid bonding · micro-bump scaling limit · bump pitch limit · interconnect crossover · when to use hybrid bonding.

## Figures

- **Cover** (navy hero, brand) — interconnect crossover theme.
- **Interconnect Selection Decision Map** (white-bg flat infographic — the Level-3 asset; required).
- *(Optional)* small "interconnect scaling timeline" (flip-chip → Cu-pillar → fine-pitch µbump → hybrid bonding) supporting §1–2.

Cover-first gate (user generates in Gemini; cover approved before inline figures).

## Success criteria

- Ranks for "hybrid bonding vs micro bump" family without cannibalizing the hub's "wafer bonding / hybrid bonding" terms (verify post-index).
- Passes all 6 boundary rules on a grep audit.
- The Decision Map is genuinely original (not a restyled comparison table) and earns the "selection map" citation framing.
- Completes the cluster: five pages, five intents, fully cross-linked.
