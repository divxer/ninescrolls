# Through-Silicon Vias (TSV) — Design Spec (Advanced Packaging spoke #5 / TSV entity root)

**Date:** 2026-06-11
**Status:** Approved design → ready for implementation plan
**Type:** Content — packaging-first **entity page** (future TSV mini-hub root), NOT a second DRIE guide.

---

## Positioning & entity architecture

**TSV is a first-class Advanced Packaging entity, not an application appendix of DRIE.** This page OWNS "what is a TSV" (entity pages own definitions — the opposite of selection pages). It does NOT own deep-silicon-etch mechanics (the DRIE page's domain), bonding (hub's domain), or the HBM narrative (HBM4's domain).

**Knowledge-graph principle (architectural, outlives this page):** `Packaging Entity → Process Technology`, never the reverse. Future TSV sub-pages (TSV Reveal, Cu Filling, TSV Reliability, Interposer) hang off this page; the DRIE/Bosch/Cryo pages remain a separate Process hub. This direction is more SEO-stable: entities accumulate authority; process pages serve them.

**Gate 0.5 result:** "through-silicon via", "via-first/middle/last", "interposer" — unowned (Create). The token "TSV" exists in the DRIE page's title ("…for MEMS & TSV") as an *application token*; this page must take the TSV entity WITHOUT contesting that token (no "TSV Etching" H1; see Title). News slugs with tsv are Industry items, not evergreen owners.

## Title / slug / meta

- **Title (= H1 = `<title>` base):** `Through-Silicon Vias (TSV): Integration Flows, Design Rules, and Manufacturing Challenges`
  - **"Integration Flows", not "Process Flows"** — the page's core asset is via-timing (via-first/middle/last), which is an *integration* decision; "Process Flow" would drift the page's semantics back toward DRIE/etch.
  - No "Etching" in the H1 (protects the DRIE page's RIE-cluster R5 title ownership).
  - ~90 chars; SERP truncates the tail — acceptable, all head keywords in the first 60.
- **Slug:** `through-silicon-vias-tsv-guide`
- **Excerpt (= meta description):** "Through-silicon vias (TSV) from the packaging engineer's view — via-first vs via-middle vs via-last, TSV design rules by application (HBM, interposer, CIS, 3D logic), integration flow, and manufacturing challenges."
- **"tsv etching" query capture:** NOT via the H1. Captured by §6 (requirements language) + a FAQ ("Is TSV etching the same as DRIE?" answered defer-style). The DRIE page keeps the etch-process intent.

## Boundary rules (greppable)

- **R1 — entity boundary.** Page owns the TSV definition. FORBIDDEN: etch-mechanism terms `scallop`, `C4F8`, `passivation cycle`, `Bosch cycle` (allowed only inside link anchor text); no H2 about etch process mechanics.
- **R2 — triple defer.** §3's etch step → DRIE page (`/insights/deep-reactive-ion-etching-bosch-process`); stacking/bonding → wafer-bonding hub; application narrative → HBM4 article.
- **R3 — §6 requirements-language boundary.** §6 states only what the packaging spec DEMANDS of the etch (depth, AR, CD uniformity, sidewall quality for liner/plating, taper) — never HOW an etch achieves it. **HARD AUDIT (the page's biggest drafting risk): no paragraph in §6 may answer "how to etch it"; every paragraph must answer only "what packaging needs from the via profile." Any sentence in mechanism language (control/tune/optimize-the-etch phrasing) fails the audit and must be rewritten as a requirement.**
- **R4 — thin application references.** HBM/interposer specifics ≤150 words each, link out.
- **R5 — length 3,100–3,500** (budget table below sums to ~3,235 — summed BEFORE setting the cap, per the standing lesson).
- **R6 — two-asset hierarchy.** Primary = §4 Integration Selection Framework (climax); Secondary = §5 Design-Rule Map. Exactly these two inline assets (plus cover; §2 anatomy mini-figure optional).

## Structure (budget sum ≈ 3,235)

| # | H2 | ~words | Notes |
|---|---|---|---|
| lead | hook + entity positioning + defers | 110 | |
| 1 | Why 2.5D/3D Integration Needs TSVs | 250 | entity intro: interposers, HBM, 3D stacks need vertical signal/power paths |
| 2 | TSV Anatomy and Design Parameters | 350 | diameter / depth / AR / pitch / **KOZ** + liner/barrier/seed/fill structure. **MUST pre-seed KOZ as the density limiter** with (近似) this sentence: "In TSV design, density is rarely limited by the hole diameter alone; it is often limited by the keep-out zone created by stress, layout rules, and device sensitivity." — so §5's KOZ column lands naturally. |
| 3 | From Wafer to Stack: The TSV Integration Flow | **250–300** | compressed (was 450): the steps exist to set up §4, not to be the story; etch step = one sentence + **defer DRIE** (R2). The climax must not arrive late. |
| 4 | **Via-First vs Via-Middle vs Via-Last** | **800–900** | **THE THOUGHT CORE / climax** (absorbed §3's savings). Opens with the **Key Insight** (below). The three timings: what each means for thermal budget, alignment, FEOL/foundry compatibility & ownership, cost, yield risk; who uses which (HBM→via-middle, CIS→via-last, etc., hedged). Primary asset figure here. |
| 5 | TSV Design Rules by Application | 400 | CIS / Interposer / HBM / 3D Logic design space — diameter, depth, AR, pitch, **KOZ** (typical/relative values, literature-framed); secondary asset figure |
| 6 | What the Packaging Spec Demands of the Etch | 300 | the packaging→process bridge; pure requirements language (R3); closes with the DRIE defer |
| 7 | Manufacturing Challenges and Cost | 300 | cost-per-via, Cu pumping & **KOZ/stress**, test access, yield stack-up |
| 8 | Key Takeaways | 150 | |
| — | FAQ (4) + Related + CTA | 300 | FAQ includes "Is TSV etching the same as DRIE?" — **70–90 words, fixed structure** (must not become a mini DRIE page): "TSV etching is the packaging requirement; DRIE is one common silicon-etching technology used to form high-aspect-ratio vias. This article covers the TSV integration and packaging requirements. For etch mechanisms, Bosch/cryo trade-offs, and profile control, see the DRIE guide." |

## The Key Insight (§4 opening, required — also the boundary statement)

Rendered as a styled pull-quote at the TOP of §4 (and reusable as Figure 1's caption line):

> **"Via timing is not a process decision. It is a thermal-budget and ownership decision — who makes the via, and what has already been built when they do."**

Backed by the decision order: **(1) Thermal budget → (2) Alignment requirement → (3) FEOL/foundry compatibility & ownership → (4) Cost & yield risk.** This sentence IS the page's boundary declaration: TSV is a packaging problem, not an etching problem.

## Primary asset — TSV Integration Selection Framework (§4 figure)

**A two-layer selection MATRIX, not a decision tree** (matrices read as industry reference figures; trees read as flowcharts):
- **Columns (upper layer):** Via-First · Via-Middle · Via-Last
- **Rows (lower layer):** Best for · Thermal budget · Alignment requirement · Foundry ownership · Cost · Yield risk · **Typical use cases** (CIS / HBM / interposer / 3D logic mapped to their column — so the reader leaves knowing which class lands where, not just the trade-offs)
- Each cell a short verdict (e.g. Via-Middle / Thermal: "made after FEOL, before BEOL — survives no further high-temp steps").
- Decision-order strip beneath (the 4 steps), tying the matrix to the Key Insight.
- Citable as "the TSV integration framework."

## Secondary asset — TSV Design-Rule Map (§5 figure)

By application class, **including KOZ** (the real density limiter — packaging engineers ultimately care about TSV density, and density is bounded by keep-out zone more often than by via diameter):
- Table layer: Application × {Diameter, Depth, AR, Pitch, **KOZ**} — header values phrased as **"Typical range / relative tendency"**, hedged and literature-framed; NEVER absolute specs. Figure caption MUST include: "Ranges are application-dependent and should be treated as design-space anchors, not universal specifications." (This figure is the page's largest factual risk — the hedging is mandatory.)
- Map layer: a 2-axis design space (diameter × density) placing CIS (smallest, densest), HBM, 3D Logic, Interposer (largest, sparsest).

## Figures (4, cover-first gate)

1. **Cover** — navy hero: TSVs passing vertically through a stacked-die cross-section.
2. **§4 primary:** TSV Integration Selection Framework (two-layer matrix).
3. **§5 secondary:** TSV Design-Rule Map (table + design-space).
4. *(Optional, cuttable)* §2 TSV anatomy mini-figure (cross-section: liner/barrier/seed/Cu/KOZ) — reusable by future TSV sub-pages.

## Internal graph (Gate 3)

- **Out-links:** DRIE page (mechanism defer), wafer-bonding hub, HBM4, hybrid-bonding-vs-micro-bump (the sibling decision page — TSV timing + interconnect selection form the cluster's decision pair).
- **Phase-B backlinks (after publish, standard Link Pass module):** hub → this page; HBM4 → this page; HB-vs-µbump §7 → this page; **DRIE §4 Applications** adds one sentence ("for TSV as a packaging element, see…") — without touching the DRIE title or H2s (RIE-cluster R5/R6 safe).

## Keywords

tsv · through silicon via · through-silicon via · tsv process flow (captured via body/§3 even though H1 says Integration) · via first vs via last · via middle · tsv design rules · tsv dimensions · keep-out zone · tsv etching (secondary, via §6+FAQ only).

## Quality gates at drafting

Same machinery as HB-vs-µbump: R1–R6 grep audit between drafting tasks, per-section word checks, **Gate-E 4-test editorial audit** (title-cover / figure-removal / §4-deletion must gut the piece / framework-survives-figure-removal), cover-first figure gate, llms sync BEFORE publish, Phase-B Link Pass after.
