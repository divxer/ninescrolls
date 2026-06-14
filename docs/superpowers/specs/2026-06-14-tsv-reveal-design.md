# TSV Reveal — Design Spec (TSV mini-hub sub-page #1 / first Process-Window asset)

**Date:** 2026-06-14
**Status:** Approved design → ready for implementation plan
**Type:** Content — **sub-page** of the TSV entity page; owns the reveal PROCESS. The cluster's first **Process-Window** asset (not a Matrix).

---

## Positioning

The FIRST child of the TSV entity page (`through-silicon-vias-tsv-guide`), beginning the TSV mini-hub (Reveal → Cu Fill → Interposer). A SUB-PAGE, deliberately tighter than its parent: it defers the TSV entity/timing/design-rules UP and owns ONLY the reveal step.

**This page fulfills promises the cluster already made.** Gate 0.5 found the whole cluster pre-defers reveal to a treatment that did not exist:
- **Parent Future Hub Hook (verbatim):** "The next design decisions — **TSV reveal**, copper filling, and bonding strategy — each deserve their own treatment." (the planted hook)
- **Parent §6 (verbatim):** "The via bottom must support a clean reveal. After thinning, the copper must emerge at a predictable depth with a profile the backside process can cap reliably; a ragged or uneven bottom turns the reveal into a yield event." → parent owns the REQUIREMENT, child owns the PROCESS.
- **Temporary Bonding (verbatim):** "the via itself and how its tip is revealed belong to our TSV guide … not re-derived here." (explicit defer)
- **HBM4 (verbatim):** "TSV reveal — exposing the copper via tips on the thinned backside — requires controlled silicon recess by plasma etch, then PECVD passivation of the exposed copper, then chemical-mechanical polish." → HBM4 uses this one sentence as evidence for its "packaging is front-end-grade" thesis; the full process belongs here.

**Gate 0.5 Level A (clean CREATE, EXACT-slug checked):** no live page owns reveal / backside / via-tip in any title or slug (148 live pages).

## Ownership & boundaries (the page owns the reveal PROCESS, nothing else)

- **Owns:** the reveal process — backside thinning-to-plane, the silicon-recess reveal etch, backside passivation of exposed copper, CMP, backside metallization — plus reveal-specific defects and the stopping-precision problem.
- **Defers UP/OUT:** TSV entity / via-timing (first/middle/last) / design rules → parent TSV page; carrier and thinning HANDLING → Temporary Bonding; the frontside etch that FORMS the via → DRIE page; system-level reliability → Reliability hub; the HBM application → HBM4.
- **"Passivation" disambiguation (critical):** DRIE's passivation = the sidewall passivation of the frontside etch CYCLE; this page's passivation = the BACKSIDE dielectric over newly exposed copper. They share a word, not a meaning. The page must mean backside passivation only and must NOT describe an etch passivation cycle.

## Title / slug / meta

- **Title (= H1):** `TSV Reveal: Exposing Through-Silicon Vias from the Wafer Backside`  (TSV + sub-entity format — builds the `TSV Reveal / TSV Cu Fill / TSV Interposer` visual family; "TSV reveal / via reveal / backside reveal" are the real search terms, not "through-via".)
- **Slug:** `tsv-reveal`
- **Excerpt:** "TSV reveal — how a buried via becomes a through-silicon via: backside thinning, the silicon-recess reveal etch, passivation, and CMP. The reveal window: why reveal is a stopping problem, not a removal problem."
- **Category:** `Process Integration` · **readTime:** 9 (sub-page, deliberately short) · author `NineScrolls Engineering`
- **Query capture:** tsv reveal · via reveal · backside reveal · silicon recess · via tip exposure · backside metallization.

## The citable principle (§5 climax, pull-quote — LOCKED)

> **"TSV reveal is a stopping problem, not a removal problem. The challenge is not removing silicon — it is stopping at the correct depth everywhere on the wafer at once."**

## Structure (budget sum ≈ 2,400; R-length **2,200–2,600** — deliberately tighter than the parent's 3,499 to preserve the parent→child hierarchy; do NOT chase 3,000+)

| # | H2 | ~words | Owns the question… |
|---|---|---|---|
| lead | hook (buried via → through-via via stopping) + triple defer (parent=entity/timing, TB=carrier/handling, DRIE=frontside etch) | 100 | |
| 1 | Why Reveal Exists | 230 | A frontside-formed via is BLIND (dead-ends in silicon); it becomes a through-via only when the backside is removed to expose the copper. Defer via-formation UP. |
| 2 | From Thinning to the Reveal Plane | 230 | Backgrind brings the wafer NEAR the via tips (carrier handling → defer TB); reveal brings it EXACTLY to the plane. Sets up the precision problem. |
| 3 | The Reveal Etch (Silicon Recess) | 280 | **"How do I arrive at the plane?"** — the controlled silicon recess that exposes copper tips above the silicon; selectivity (etch Si not Cu), across-wafer uniformity. The stopping-depth section. |
| 4 | Passivation and CMP | 280 | **"How do I preserve the plane?"** — passivate the newly exposed copper, then CMP to planarize tips for backside metal. Owns the recess→passivation→CMP→metal sequence HBM4 only summarized. |
| 5 | **The TSV Reveal Window** | **520** | **THE CLIMAX.** Principle pull-quote. The stopping-problem thesis + the Reveal Window figure. The largest single section. |
| 6 | Reveal Failure Modes | 280 | under-reveal (copper not exposed → open), over-reveal (tip damage / dishing / copper smearing), across-wafer non-uniformity, passivation voids. Reveal-SPECIFIC only. |
| 7 | Why Reveal Determines Yield | 200 | close: reveal is the single plane where every upstream choice (depth, fill, anneal, thinning) is graded at once. Link parent + Reliability (downstream). |
| — | FAQ (4) + Related + CTA | 280 | incl. "What is TSV reveal?" / "Is TSV reveal the same as backgrinding?" (no — backgrind = proximity, reveal = the plane). |

**§5 dominance is a HARD RULE: words(§5) ≥ every other section** (the Window must be the largest; the climax outweighs each process step).

## Climax asset — The TSV Reveal Window (§5, the cluster's FIRST Process-Window asset)

A NEW asset family for the cluster (vs the Matrix family: TSV selection-matrix, Debond matrix, W2W gates, Reliability trade-off matrix). A vertical precision band:
- **Under-reveal** (top or bottom): copper tips not fully exposed → opens.
- **Optimal window** (center): uniform copper exposure across the wafer.
- **Over-reveal** (opposite end): tip damage, dishing, copper smearing.
- The process flow runs as the SPINE alongside the band: `Backgrind → Reveal etch / recess → Passivation → CMP → Backside metal`, marking which step pushes you toward which side of the window.
- Relative labels only — NO micron numbers in the figure.

## Boundary & process rules (greppable)

- **R1 — reveal-process only.** Does NOT re-explain TSV entity/timing/design-rules (parent), carrier/debond (TB), frontside DRIE etch (DRIE), or system reliability (Reliability hub).
- **R3b — leak-term ban.** `via-first` / `via-middle` / `via-last` / `carrier` / `debond` / `adhesive` appear ONLY as defer-link anchors. `Bosch` / `scallop` / `C4F8` / `passivation cycle` = 0 (frontside-etch terms; the "passivation" here is backside dielectric only).
- **Gate-P1 — Process Ownership (NEW, Process-Window family).** Every major flow step owns EXACTLY ONE question. The map: Backgrind → proximity · Reveal etch → stopping depth · Passivation → surface protection · CMP → planarity · Backside metal → connectivity. If any one step is written as owning multiple (e.g. reveal etch also = surface protection + reliability + metallization), FAIL — the process ownership is blurred. Greppable proxy: each step's prose stays on its one question; cross-concern sentences get moved to their owning step.
- **Gate-Rx — Failure-Modes-Only-in-§6 (NEW; the real drift risk is RELIABILITY, not DRIE/TB).** Reveal slides easily into a failure narrative (under-reveal→open, over-reveal→damage, non-uniform→yield loss). Hard rule: yield-loss / crack / reliability / fatigue framing appears ONLY in §6. If `yield`, `crack`, `reliability`, `fatigue` cluster in §3/§4, FAIL — §3/§4 own the PROCESS, not its reliability consequences; consequences live in §6 and defer system reliability to the Reliability hub.
- **Hedge hard rule** + **figure-numbers-relative-only** + **Gate-C** (delete §5 → page collapses to a process walkthrough) + **Gate-E 4-test** + **Gate-F Reversal** (delete reveal/recess/expose terms → collapse) + **Intent audit** (reader leaves knowing the reveal PROCESS + the stopping problem, not a TSV overview or a reliability story).
- **Window Ownership Test (reinforced).** (1) Mask the three band labels — does the page still make the stopping-problem argument in prose? (2) Mask the three band NAMES on the FIGURE — can a reader still read too-little / just-right / too-much from the graphic alone? If not, the figure is a Failure Taxonomy, not a Process Window — redesign until the graphic itself communicates the window.

## Figures (cover-first gate; single asset — sub-page discipline)

1. **Cover** — navy hero: a wafer-backside cross-section, copper via tips just emerging above a recessed silicon surface, a bright plane-line marking the exact reveal depth; convey "stopping at the right plane."
2. **Fig A — The TSV Reveal Window** (primary / climax) — the vertical precision band (under / optimal / over) with the process flow as the spine. Relative labels only.
   (No second figure — sub-pages stay single-asset to preserve the parent's dual-asset hierarchy.)

## Internal graph / Phase-B (the mini-hub edges — the strategic core)

- **Out-links:** parent TSV page (entity/timing/design-rules defer + the "clean reveal requirement" it set), Temporary Bonding (carrier/thinning handling), DRIE (frontside via formation), Reliability hub (downstream system reliability), HBM4 (the application).
- **Phase-B1 (immediate, all cluster pages — NO B2):**
  1. **Parent → Reveal FORWARD link (the key mini-hub move):** turn the Future Hub Hook's bare words "TSV reveal" into a link to this page — converting the parent entity page into a real mini-hub.
  2. **HBM4** reveal sentence → link to this page.
  3. **Temporary Bonding** reveal defer ("covered in our TSV guide and is not re-derived here") → re-point to this page specifically (more precise than the parent).
  4. **Parent §6** "clean reveal" requirement sentence → link to this page (the "how").

## Canonical map

Reveal is a sub-feature, not a chain step — it does NOT enter the AP Decision Chain map (`ap-decision-chain` stays single-sourced, unchanged).

## Metadata

relatedProducts → `/products/icp-etcher` (the reveal etch is a plasma/ICP silicon recess; metadata routes, prose stays in-lane). Schema gotchas per standing notes (no lastModifiedDate; JSON.stringify for a.json(); FAIL-on-existing create). Tags `["TSV reveal","via reveal","backside reveal","silicon recess","backside metallization","through-silicon via","advanced packaging","3D integration"]`.
