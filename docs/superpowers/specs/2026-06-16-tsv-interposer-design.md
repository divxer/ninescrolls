# TSV Interposer — Design Spec (TSV mini-hub sub-page #3, CLOSES the mini-hub / cluster asset family #7: Role-Contrast)

**Date:** 2026-06-16
**Status:** Approved design → ready for implementation plan
**Type:** Content — **sub-page** of the TSV entity page; the ARCHITECTURE-layer child (the prior two were process steps). Owns the interposer as a TSV-bearing lateral-routing structure. The cluster's first **Role-Contrast** asset (asset family #7: "one component, two jobs").

---

## Positioning

The THIRD and LAST child of the TSV entity page (`through-silicon-vias-tsv-guide`), closing the TSV mini-hub (Reveal ✅ → Cu Fill ✅ → **Interposer**). The mini-hub triad of cognitive frames:
| Page | The TSV question | Asset family |
|---|---|---|
| TSV Copper Fill | Where does copper grow first? (direction) | Growth-Direction (#6) |
| TSV Reveal | Where do I stop? (depth) | Process-Window (#5) |
| **TSV Interposer** | **Where do the chips sit? (space — vertical vs lateral)** | **Role-Contrast (#7)** |

**The highest-overlap sub-page of the three** (interposer touches HBM4, W2W/D2W, and the parent) — but defensible because its owned core is a TSV cognitive conflict, not an architecture catalog: **the same TSV does the opposite job in an interposer.** That anchor keeps the page a TSV sub-feature, not a 2.5D-architecture rehash.

**Gate 0.5 — measured boundaries (EXACT-slug verified, 150 live pages):**
- **Level A (clean CREATE):** no live page owns interposer / 2.5D / chiplet / silicon-bridge in any title or slug.
- **vs PARENT (interposer×17, 2.5D×5):** the parent OWNS interposer-TSV **DIMENSIONS** (its §5 Design-Rule Map: "Interposer vias ~10 µm or more, 50–100 µm deep, the large/sparse extreme, area cheaper, density matters less than robustness") and names 2.5D in ONE undeveloped sentence ("an interposer routes thousands of connections between chiplets sitting side by side"). This child must NOT re-derive the parent's dimensions; it owns the interposer's **FUNCTION/ROLE** (lateral routing) and develops the 2.5D the parent only gestured at.
- **vs HBM4 (interposer×7):** HBM4 owns the interposer as the substrate the HBM stack + GPU sit on (application + figure callouts). This child keeps HBM as a brief application only; the HBM product narrative stays HBM4's.
- **vs W2W/D2W (chiplet×8):** W2W owns **chiplet** as a bonding-format (D2W) case. This child must NOT contest chiplet-as-format-selection — it defers the format choice to W2W.
- **vs Reliability:** large-interposer warpage/CTE mechanisms defer UP.

## Ownership & boundaries

- **Owns:** the interposer as a TSV-bearing lateral-routing layer — what it is (silicon routing layer between dies and package), why 2.5D needs a separate silicon layer, the interposer's TSVs doing the OPPOSITE job of a 3D stack's, and why the industry pays for a large piece of silicon.
- **Defers UP/OUT:** TSV entity / via-timing / interposer-TSV **dimensions** (large/sparse design rules) → parent; the HBM product/architecture narrative → HBM4; the chiplet bonding-FORMAT decision → W2W; system-level reliability (warpage/CTE mechanisms) → Reliability hub; the frontside via-formation etch → DRIE.

## Title / slug / meta

- **Title (= H1):** `TSV Interposer: The Silicon Routing Layer Between Dies and Package`  (LOCKED — keeps the `tsv-*` mini-hub family for knowledge-graph cleanliness; "silicon routing layer" + body capture the "silicon interposer" query. NOT "Silicon Interposer" — that breaks the family and reads as a standalone, un-anchored architecture page.)
- **`<title>` tag:** `TSV Interposer vs 3D TSVs: How Silicon Interposers Enable 2.5D Routing` (captures the comparison + "silicon interposer" + 2.5D).
- **Slug:** `tsv-interposer`  (family: `tsv-reveal` / `tsv-copper-fill` / `tsv-interposer`)
- **Excerpt:** "A silicon interposer is the routing layer between side-by-side dies and the package — and its TSVs do the opposite job of a 3D stack's. How the same through-silicon via enables both vertical stacking (3D) and lateral routing (2.5D)."
- **Category:** `Process Integration` · **readTime:** 9 · author `NineScrolls Engineering`
- **Query capture:** silicon interposer · TSV interposer · 2.5D packaging · 2.5D vs 3D · interposer routing · what is an interposer.

## The citable principle (§4 climax — LOCKED)

> **"Same vertical conductor, opposite architectural job: in 3D the TSV stacks dies upward; in 2.5D the interposer's TSVs carry a lateral routing layer down to the package."**

Intuition-breaker to open §4: **"You have met the TSV as a way to stack chips. The interposer uses the very same structure to do the opposite — to spread chips out."**

## Structure (budget sum ≈ 2,250; R-length **2,200–2,600**, UPPER HARD LIMIT ~2,600 — tighter than the parent's 3,499)

| # | H2 | ~words | Owns (and stays TSV-anchored — Gate-T1) |
|---|---|---|---|
| lead | the cognitive hook (you've met TSV as a stacking tool; the interposer uses it for the opposite job) + quadruple defer (parent=entity/dimensions, HBM4=HBM app, W2W=chiplet format, Reliability=warpage) | 100 | |
| 1 | What Is a Silicon Interposer? | 250 | "what it is": a silicon routing layer that sits BETWEEN the dies and the package — fine RDL routing plus its own TSVs. (TSV-anchor: a TSV-bearing routing layer.) |
| 2 | Why 2.5D Needs a Separate Silicon Layer | 260 | "why it exists": chiplets side-by-side need line/space density an organic substrate can't reach; silicon provides it. (Develops the 2.5D the parent only gestured at.) **HARD LIMIT: state the need for higher routing density → therefore a silicon layer; NO substrate-vs-interposer deep comparison (RDL pitch tables, signal-integrity, power-delivery deep-dive) — that drifts into a 'Why CoWoS Exists' platform-comparison page. One or two sentences on the density ceiling, then move on.** |
| 3 | The Interposer's TSVs: A Different Job | 280 | **the TSV-role owned core**: die TSVs connect stacked dies vertically; the interposer's TSVs carry the horizontal RDL surface DOWN to the package C4s — same vertical conductor, lateral-routing purpose. Do NOT re-derive the parent's dimensions (large/sparse). Leads into §4. |
| 4 | **Same TSV, Opposite Job: 2.5D vs 3D** | **500** | **THE CLIMAX.** Intuition-breaker + principle pull-quote. The Role-Contrast figure (TSV forks into vertical-stacking 3D vs lateral-routing 2.5D). Largest section. |
| 5 | Where the Interposer Fits | **≤200** | a POSITIONING section, not an application catalog: the interposer sits between dies and package. Three brief applications, **each ≤70w, ≤200w total**: HBM-next-to-GPU (link HBM4), chiplet routing (link W2W), CoWoS-style 2.5D. Prove it is used; do NOT explain WHY HBM/chiplet/CoWoS (that crosses into HBM4/W2W). |
| 6 | Why Not Route Directly in the Package? | 240 | **the missing logic — why pay for a giant piece of silicon.** Organic substrate hits a line-density ceiling; silicon routes finer. Under that one question, gather the costs the industry tolerates: cost, reticle-size stitching limit, large-area warpage (defer warpage MECHANISMS to Reliability; cost-chain to parent). |
| 7 | The Interposer Completes the Picture | 180 | close: the TSV is not only a stacking tool — in the interposer it is the routing backbone of a whole 2.5D system. Tie the mini-hub triad (direction / depth / space). |
| — | FAQ (4) + Related + CTA | 280 | incl. "What is a silicon interposer?" / "What is the difference between 2.5D and 3D?" / "Why use a silicon interposer instead of the package substrate?" |

**§4 dominance is a HARD RULE: words(§4) ≥ every other section.**

**§4 ORDERING RULE (LOCKED): the principle sentence MUST appear before any application example, anywhere in the article.** Fixed order: Role Principle (§4) → Role-Contrast Figure (§4) → Applications (§5). If a GPU/HBM/chiplet application example appears before the principle is stated, the reader files the page as an "interposer application page" rather than a "TSV cognitive page" — FAIL. Greppable proxy: the first occurrence of the principle phrase precedes the first occurrence of `GPU`/`HBM`/`chiplet` in the document.

## Climax asset — Same TSV, Opposite Job (§4, cluster asset family #7: Role-Contrast)

A NEW asset shape (not a Window, not a Growth-Direction two-front). A FORK: one TSV at the top splitting into two architectural jobs, with the DIRECTION of integration as the legible contrast:
- **LEFT — 3D IC (vertical stacking):** dies stacked vertically, the TSV the vertical spine threading through them; UP arrows. Label "TSV stacks dies — vertical."
- **RIGHT — 2.5D interposer (lateral routing):** dies sitting side-by-side on the interposer, RDL routing them laterally, the interposer's TSVs carrying that routing DOWN to the package; SIDEWAYS + DOWN arrows. Label "interposer TSVs route a lateral layer down — horizontal."
- Title (reusable standalone): **"Same TSV, Opposite Job."**
- Relative labels only — NO numbers. The DIRECTION contrast (vertical spine vs lateral bridge) is the figure's legible message.

## Boundary & architecture rules (greppable) — this is an ARCHITECTURE page, NOT a process page (Gate-P1/P2/D1 do NOT apply; no process chain)

- **R1 — interposer-structure only.** Does NOT re-explain the TSV entity/timing (parent), the HBM product narrative (HBM4), the chiplet bonding-format choice (W2W), or system-reliability mechanisms (Reliability hub).
- **R3b — leak-term ban.** HBM-generational terms (`HBM3`, `HBM3E`, `HBM4`, `HBM5`), `NVIDIA`, `AMD` ≤2 total (HBM only as a brief application, no roadmap). `chiplet` allowed as a noun but the bonding-FORMAT decision (`wafer-to-wafer`/`die-to-wafer`/`known-good-die`) only as a defer-link to W2W. Parent's design-rule numbers (`~10 µm`, `50–100 µm`, `large/sparse`) NOT re-derived — defer to parent.
- **Gate-T1 — TSV-Anchor (NEW; the architecture-page analog of Cu Fill's Gate-D1 — protects against drift into HBM4/architecture territory).** Every major section must connect back to the TSV / the vertical-conductor role. A section that discusses 2.5D architecture with NO TSV anchor has drifted into HBM4/architecture territory = FAIL. Greppable proxy: each H2's body mentions the via/TSV/vertical-conductor role at least once and ties its point to it.
- **Gate-T1b — Remove-TSV Test (NEW; the SUFFICIENT condition Gate-T1 lacks).** Gate-T1 (a TSV mention exists) is necessary but not sufficient — a section could be three HBM paragraphs with one token TSV mention and still pass. Stricter: remove ALL TSV/via/vertical-conductor references from a section — if it still reads coherently, it does not belong here (it is really about HBM / chiplet / CoWoS, not the TSV interposer). Deleting the TSV must make the section collapse. Apply per-section to §1–§6.
- **§5 hard caps:** application section ≤200w total, each app ≤70w, link out, no "why HBM/chiplet/CoWoS" development.
- **Hedge hard rule** + **figure-numbers-relative-only** + **Gate-C** (delete §4 → the page collapses to a generic "what is an interposer" explainer with no owned insight) + **Gate-E 4-test** + **Gate-F Reversal** (delete interposer/2.5D/lateral/vertical terms → collapse) + **Intent audit** (reader leaves understanding the SAME-TSV-OPPOSITE-JOB insight, not a 2.5D architecture survey).
- **Figure tests (Role-Contrast family):**
  - **Two-Job Test:** mask the LEFT/RIGHT labels — can a reader still tell that ONE TSV is doing TWO different jobs (stacking vs routing) from the graphic?
  - **Direction Legibility Test:** the figure must make the VERTICAL-vs-LATERAL contrast (up-spine vs sideways-bridge) the legible point, not merely "two packages."
  - **Family Test:** mask the title and body — does it read as a Process-Window (under/optimal/over band) or a Growth-Direction two-front? It MUST NOT. It must read as "one component → two jobs" (a fork). If it reads as either prior family, regenerate.

## Figures (cover-first gate; single asset — sub-page discipline)

1. **Cover** — navy hero: a single luminous through-silicon via at the center, morphing left into a vertical stacking spine (dies stacked, up-glow) and right into a lateral routing bridge (dies side-by-side on an interposer, sideways-glow). Convey "one conductor, two jobs." No people.
2. **Fig A — Same TSV, Opposite Job** (primary / climax) — the fork diagram (3D vertical vs 2.5D lateral), direction arrows the hero. Relative labels only.
   (No second figure — sub-page stays single-asset.)

## Internal graph / Phase-B (CLOSES the mini-hub — EXACT-slug verified; PRE-verify every Related link against DDB)

- **Out-links:** parent TSV page (entity/dimensions), HBM4 (the HBM application), W2W (the chiplet format), Reliability hub (large-interposer warpage), DRIE/hub light.
- **Phase-B1 (immediate, all cluster pages — NO B2):**
  1. **Parent → Interposer edge** — the parent's §1 "2.5D integration, an interposer routes thousands of connections between chiplets sitting side by side" sentence (or its §5 Design-Rule Map "Interposer" row) → link this page. **This completes parent → all THREE children, closing the mini-hub.**
  2. **HBM4 → Interposer** — an HBM4 interposer mention → link this page.
  3. **Sibling edge (if natural):** the interposer's own TSVs are filled and revealed too — a light Cu-Fill or Reveal ⇄ Interposer cross-link only where it reads naturally (do not force).
- **MANDATORY pre-publish:** extract every `href="/insights/..."` and verify each against DDB by EXACT slug (the long HBM4 slug has been truncated to broken `/insights/16-hi-hbm` before — verify proactively).

## Canonical map

The interposer is a sub-feature, not a chain step — it does NOT enter the AP Decision Chain map (`ap-decision-chain` stays single-sourced).

## Metadata

relatedProducts → `/products/icp-etcher` (interposer TSV formation is deep-silicon etch; in-lane). Schema gotchas per standing notes (no lastModifiedDate; JSON.stringify for a.json(); FAIL-on-existing create). Tags `["silicon interposer","TSV interposer","2.5D packaging","2.5D integration","interposer routing","through-silicon via","advanced packaging","chiplet"]`.

## Strategic note

This is the LAST structural piece. After it, the TSV mini-hub is complete (3 children) and the AP cluster's phase-2 (entity → mini-hub) build-out is DONE. The right next move is the **early-July GSC remeasure** (RIE Phase-2 persistence + new AP pages indexing + the DRIE-rose-after-TSV signal — now with maximum mini-hub internal-link density), NOT more articles.
