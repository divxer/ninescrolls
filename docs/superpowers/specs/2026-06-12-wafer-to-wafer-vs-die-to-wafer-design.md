# Wafer-to-Wafer vs Die-to-Wafer — Design Spec (Advanced Packaging spoke #6 / capstone selection page)

**Date:** 2026-06-12
**Status:** Approved design → ready for implementation plan
**Type:** Content — bonding-strategy SELECTION page; the **capstone** of the cluster's decision chain.

---

## Positioning

The decision-chain terminus: `interconnect selection (HB-vs-µbump) → via timing (TSV §4) → BONDING STRATEGY (this page)`. The page's unique question: **"Having committed to 3D integration — when do I lose the choice of format, and when do I keep it?"**

**Boundary vs HB-vs-µbump §5 (the critical overlap):** that page states W2W's known-good-die cost in ONE sentence (a defect writes off die from both wafers) within the *interconnect* decision. This page owns the **complete decision science of that cost** for the *format* decision — and LINKS back to §5 rather than restating its KGD-economics analysis.

**Gate 0.5:** W2W / D2W / C2W / chip-on-wafer — unowned in any title/slug (Create). Body mentions everywhere are context only; the hub owns bonding mechanics + overlay failure modes, not the selection.

**Capstone effect:** after this page, the AP cluster upgrades from "several articles" to "a knowledge system with an explicit decision path."

## Title / slug / meta

- **Title (= H1):** `Wafer-to-Wafer vs Die-to-Wafer: When Does Each Integration Strategy Win?`
- **Slug:** `wafer-to-wafer-vs-die-to-wafer`
- **Excerpt:** "Wafer-to-wafer (W2W) vs die-to-wafer (D2W) bonding — the four-gate selection framework: geometry match, yield economics, throughput, and maximum density. When each integration strategy wins, from CIS to chiplets to HBM."
- **Query capture:** "wafer to wafer vs die to wafer bonding", "W2W vs D2W", "die to wafer hybrid bonding"; "chip on wafer / CoW" captured via a FAQ ("Is D2W the same as chip-on-wafer?").

## The citable principle (§2 top, pull-quote — LOCKED wording, IEEE/IEDM register)

> **"Wafer-to-wafer is not the default. It is a privilege earned by matched geometry and high yield. When either condition breaks, the industry falls back to die-to-wafer."**

## The four gates (NAMED, not numbered — L3-asset naming; future articles cite "fails at Gate A")

- **Gate A — Geometry.** Do die sizes and steppings match? Mismatch → W2W is physically out (the hard constraint comes first; no economics can override it).
- **Gate B — Yield Economics.** Can the product tolerate blind bonding (no die selection)? W2W bonds every die against every die, good or bad. (LINK HB-vs-µbump §5 for the interconnect-level KGD analysis; this page owns only the format-level layer.)
- **Gate C — Throughput.** Is whole-wafer parallelism worth preserving? One bond step vs thousands of pick-and-place operations — each placement adding serial time, particle exposure, and per-die alignment risk.
- **Gate D — Maximum Density.** Are you pursuing the absolute density limit? W2W's wafer-level alignment preserves the finest achievable pitch — **but Gate D is a BONUS criterion, not an entry criterion**: it only matters after surviving Gates A–C. Real products at extreme pitch (HBM-class stacks, high-end logic, heterogeneous chiplets) still commonly land on D2W because they fail Gate A or B first. NEVER write "fine pitch → W2W" as a rule — professional readers will correctly reject it.

## Structure (budget sum ≈ 2,820; R-length **2,700–3,000**, summed first)

| # | H2 | ~words | Notes |
|---|---|---|---|
| lead | hook + capstone positioning + triple defer (hub mechanics / HB-vs-µbump KGD / TSV timing) | 110 | |
| 1 | The Quick Answer: W2W or D2W? | 180 | three-line verdict: geometry mismatch → D2W by ruling; matched + high-yield + extreme pitch → W2W; everything else → D2W |
| 2 | **The Selection Framework** | **850–950** | **THE THOUGHT CORE — deliberately dominant** (readers searching the query come for exactly this; §3–§5 are evidence). Principle pull-quote at top, then Gates A–D, one argued passage each. L3 asset figure here. |
| 3 | Why W2W Delivers the Highest Density | 300 | wafer-level alignment physics + parallel economics; CIS as living proof (one line, link) |
| 4 | Why D2W Dominates Heterogeneous Integration | 300 | different sizes/nodes/vendors + KGD picking + chiplet reality |
| 5 | Application Snapshots — **order: CIS → Chiplet → HBM** | 300–360 | link out, never upstage the framework. Progression: CIS = purest W2W → Chiplet = purest D2W → **HBM last = the real-world compromise** (synthesis close). **HARD WORD CAPS: CIS ≤120w, Chiplet ≤120w, HBM ≤100w — HBM MUST be the shortest** (the cluster's most common drift = pages mutating into HBM pages; no HBM3/4/5 generational detail, that's the HBM4 article's domain) |
| 6 | **The Complete Decision Chain** (capstone close) | 250 | the cluster's decision path united; **Fig B = the full AP Cluster Map** (see below) |
| 7 | Key Takeaways | 150 | final bullet = the decision-chain hook (three sibling pages cross-linked) |
| — | FAQ (4) + Related + CTA | 300 | FAQ incl. (a) "Is D2W the same as chip-on-wafer (CoW)?" (captures CoW queries) and (b) **"Why doesn't everyone use wafer-to-wafer bonding?" (70–90w — captures the known-good-die / KGD long-tail; engineers searching 'why not wafer to wafer' are really asking about the KGD problem; answer names "known-good die (KGD)" explicitly + links HB-vs-µbump §5)** |

## Boundary rules

- **R1 — selection-only.** No re-explaining bonding mechanics (hub owns); no restating HB-vs-µbump's interconnect KGD analysis (link it; own only the W2W/D2W format layer). No "what is hybrid bonding."
- **R3b (this page's leak-term ban):** `plasma activation`, `CMP`, `dishing`, `queue time` (surface-prep domain), `C-SAM`, `FIB` (FA domain) = 0 article-wide including anchors.
- **Hedge hard rule:** no absolute adoption claims (typically/commonly/often); CIS/HBM/chiplet claims hedged.
- **Figure-numbers rule:** relative labels only in images; any numeric ranges live in guarded prose/tables.
- **Gates at drafting:** Gate-C (collapse test immediately after §2 — if the article survives §2's deletion, §2 failed), Gate-E 4-test, Intent-Ownership audit (reader leaves knowing the DECISION, not a bonding overview), **Gate F — Reversal Test: delete every W2W/D2W term from the article — if it still reads as a coherent piece, the author wrote a generic bonding article (FAIL); if it collapses into nonsense, it genuinely discusses format selection (PASS)**; FAQ word-locks (CoW + KGD answers, 70–90w each).

## Figures (3, cover-first gate; relative labels only)

1. **Cover** — navy hero: split scene — left, two full wafers closing face-to-face (one aligned bond); right, a placement head setting individual dies onto a carrier wafer; glowing seam between.
2. **Fig A — W2W/D2W Selection Framework (L3 primary):** the four-gate sequential elimination flow (Gate A Geometry → Gate B Yield Economics → Gate C Throughput → Gate D Maximum Density), gates A–C with "fails → D2W" exit arrows, Gate D styled visually as a BONUS gate ("survives A–C AND pursues the density limit → W2W"), terminal "otherwise → D2W"; beneath, a two-column outcome strip (W2W: finest pitch · highest parallelism · blind bonding | D2W: KGD picking · heterogeneous freedom · serial placement). Gate-sequence form chosen deliberately: the logic is ordered elimination, not multi-dimension comparison (vs the TSV matrix).
3. **Fig B — The Advanced Packaging Decision Chain. CLUSTER ASSET LEVEL = L3, CANONICAL & SINGLE-SOURCED:** the full cluster map — `Surface Preparation → Via Timing (First/Middle/Last) → Bonding Method (Fusion/Hybrid/TC) → Integration Format (W2W/D2W) → Failure Analysis` — each node labeled with its owning article. **This is the AP cluster's official map, formally declared a cluster-wide reusable asset: future AP pages (TSV sub-pages, Temporary Bonding, HBM Reliability) MUST reuse THIS figure (same CDN asset or its updated successor), never redraw their own variant — preventing version drift across pages.** Record this rule in memory at publish.

## Internal graph / Phase-B

- **Out-links:** hub, HB-vs-µbump (×2: Gate B defer + decision chain), TSV page, HBM4, surface-prep (one line: W2W's surface demands), FA page (chain terminus).
- **Phase-B1 (immediate):** hub, HB-vs-µbump, TSV page → this page. **No B2** (no mature-traffic page touched).

## Metadata

Category `Process Integration` · readTime 12 · author `NineScrolls Engineering` · tags `["wafer-to-wafer","die-to-wafer","W2W","D2W","hybrid bonding","advanced packaging","3D integration","chip-on-wafer","chiplets"]` · relatedProducts → `/products/plasma-cleaner` (metadata may route to the product; the BODY still must not say "plasma activation" — R3b stands; metadata routes, prose stays in-lane). Schema gotchas per standing notes (no lastModifiedDate; JSON.stringify for a.json(); FAIL-on-existing create).
