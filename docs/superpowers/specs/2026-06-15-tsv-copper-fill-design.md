# TSV Copper Fill — Design Spec (TSV mini-hub sub-page #2 / cluster asset family #6: Growth-Direction)

**Date:** 2026-06-15
**Status:** Approved design → ready for implementation plan
**Type:** Content — **sub-page** of the TSV entity page; owns the copper-fill PROCESS. The cluster's first **Growth-Direction** asset (asset family #6 — distinct from Matrix / Decision-Gates / Rule-Map / Anatomy / Process-Window).

---

## Positioning

The SECOND child of the TSV entity page (`through-silicon-vias-tsv-guide`), continuing the TSV mini-hub (Reveal ✅ → **Cu Fill** → Interposer). Process-chain position: the via is etched (DRIE), lined (barrier/seed), then **FILLED** with copper, then later **revealed** (TSV Reveal). So Cu Fill sits between lining and reveal in the frontside flow. A SUB-PAGE: deliberately tighter than the parent (~2,200–2,600w, single asset), defers UP.

**The mini-hub dual (deliberate):** Reveal and Cu Fill form a matched pair of cognitive frames —
| Page | Fundamental question | Asset shape |
|---|---|---|
| TSV Reveal | Where do I **stop**? | Process Window |
| TSV Copper Fill | Where does copper **grow first**? | **Growth-Direction** |
Reveal = a stopping problem; Cu Fill = a direction problem. Two different "the obvious framing is wrong" insights, two different asset shapes — better than two Window variants.

**This page fulfills a promise the cluster already made.** Gate 0.5 (EXACT-slug verified): the parent's Future Hub Hook already names "copper filling" as deserving its own treatment, and the parent §3 gives the fill only a 3-sentence summary ("Electroplated copper then fills the via from the bottom up, and an anneal stabilizes the copper's grain structure… CMP strips the copper overburden"). Parent owns the SUMMARY; child owns the PROCESS.

**Gate 0.5 Level A (clean CREATE, EXACT-slug checked, 149 live pages):** no live evergreen page owns copper-fill / electroplating / superfill / via-fill in any title or slug. (Unrelated hits: a damascene NEWS item, an HDP-CVD guide that says "void" in a CVD context.)

## Ownership & boundaries

- **Owns:** the copper-fill process — the seed surface, electroplating/superfill (bottom-up growth via additives), anneal, and **frontside overburden CMP** — plus fill-specific defects (voids, seams, pinch-off, incomplete fill) and the growth-direction problem.
- **Defers UP/OUT:** TSV entity / anatomy / via-timing / design-rules → parent; the via-FORMATION etch (frontside) → DRIE; the BACKSIDE reveal (recess→passivation→backside CMP→backside metal) → TSV Reveal; SYSTEM-level reliability (electromigration lifetime, Cu pumping as stress, CTE) → Reliability hub; the HBM application → HBM4.
- **CMP disambiguation (critical):** this page's CMP = **FRONTSIDE overburden removal** (strips the excess copper above the filled via). TSV Reveal's CMP = backside tip planarization ("clean, flat, copper-accessible backside"). They share a word, not a meaning. The page must say "frontside overburden" explicitly and never describe backside CMP.

## Title / slug / meta

- **Title (= H1):** `TSV Copper Fill: Bottom-Up Electroplating Without Trapping a Void`  (TSV-family format `Process name + how to avoid the dominant failure`, matching `TSV Reveal: …`. NOT "…and the Void Problem" — that reads academic and makes the void the subject; the subject is growth DIRECTION, the void only its outcome.)
- **Slug:** `tsv-copper-fill`  (family: `tsv-reveal` / `tsv-copper-fill`)
- **Excerpt:** "TSV copper fill — how bottom-up electroplating fills a high-aspect-ratio via without trapping a void: the seed, superfill additives, anneal, and frontside overburden CMP. Why fill is a direction problem, not a volume problem."
- **Category:** `Process Integration` · **readTime:** 9 (sub-page, deliberately short) · author `NineScrolls Engineering`
- **Query capture:** tsv copper fill · via fill · tsv electroplating · superfill · bottom-up fill · void-free fill.

## The citable principle (§5 climax — LOCKED, two-part: break the intuition, then name the rule)

Opening line of §5 (breaks the intuition):
> **"A TSV rarely fails because there is too little copper. It fails because the copper grows in the wrong place first."**

Immediately followed by the principle pull-quote (names the rule):
> **"Copper via fill is a direction problem, not a volume problem. The copper must grow from the bottom up — or it seals a void inside."**

## Structure (budget sum ≈ 2,350; R-length **2,200–2,600**, UPPER HARD LIMIT ~2,600 — tighter than the parent's 3,499 to preserve hierarchy)

| # | H2 | ~words | Owns the question… (and resolves to growth direction — Gate-D1) |
|---|---|---|---|
| lead | hook (a lined via is an empty well; the hard part is direction, not volume) + triple defer (parent=entity/anatomy, DRIE=via formation, Reveal=backside) | 100 | |
| 1 | Why Filling a Via Is Hard | 230 | A high-aspect-ratio via is a deep narrow hole; deposit copper conformally (evenly on all surfaces) and the top closes before the bottom → a trapped void. The challenge is not getting copper in; it is getting it in without sealing a void. Sets up DIRECTION. |
| 2 | The Seed: What Copper Grows On | 220 | **starting surface** → *direction: the seed decides WHERE copper can grow at all; a discontinuous seed leaves a region that cannot grow, seeding a void.* |
| 3 | Electroplating and the Bottom-Up Problem | 290 | **growth direction** → conformal growth vs bottom-up superfill; the three additives (accelerator / suppressor / leveler) as the control that BIASES growth from the bottom up. The owned core that leads into §5. |
| 4 | Anneal and Frontside Overburden CMP | 250 | **stabilize + remove excess** → *anneal stabilizes the structure the fill front created; frontside overburden CMP removes the excess that successful bottom-up fill necessarily produces.* (Explicitly FRONTSIDE — disambiguate from Reveal's backside CMP.) |
| 5 | **The Fill-Front: Growth Direction Determines Fill Outcome** | **520** | **THE CLIMAX.** Two-part principle. The Growth-Direction asset. Owns the full chain (Gate-P2). Largest section. |
| 6 | Fill Failure Modes | 270 | center seam / top-pinch-off void / incomplete fill / seed-discontinuity void. Fill-specific. SYSTEM reliability (electromigration, Cu pumping, fatigue, lifetime) deferred here + to the Reliability hub. |
| 7 | Why Fill Quality Carries Forward | 190 | close: a void laid down at fill is invisible until it surfaces at reveal or in service; fill is where via integrity is decided. Link parent + Reveal (the void trapped here surfaces there) + Reliability. |
| — | FAQ (4) + Related + CTA | 280 | incl. "What is TSV copper fill?" / "What is superfill / bottom-up fill?" / "Why do TSV vias get voids?" |

**§5 dominance is a HARD RULE: words(§5) ≥ every other section.**

## Climax asset — The Fill-Front: Growth Direction Determines Fill Outcome (§5, cluster asset family #6)

A NEW asset shape (not a Window). Two side-by-side growth paths on a single via cross-section, with growth-DIRECTION arrows as the legible point:
- **Conformal growth** (FAIL, red): copper thickens evenly on all walls → the top pinches closed before the bottom fills → a **trapped void / seam** sealed in the center. Direction arrows: inward from the sidewalls.
- **Bottom-up superfill** (GOOD, green): additives bias growth so copper rises from the base → a **void-free solid** fill. Direction arrows: upward from the bottom.
- The figure's title (reusable when cited standalone): **"Growth Direction Determines Fill Outcome."**
- Relative labels only — NO numbers. The DIRECTION (where copper grows first) must be the figure's legible message, not merely "void vs no-void."

## Boundary & process rules (greppable)

- **R1 — fill-process only.** Does NOT re-explain the TSV entity/anatomy/timing/design-rules (parent), the frontside via-formation etch (DRIE), the backside reveal (Reveal), or system reliability (Reliability hub).
- **R3b — leak-term ban.** `via-first` / `via-middle` / `via-last`, design-rule terms (`KOZ`, `aspect-ratio` design rules), `carrier` / `debond` appear ONLY as defer-link anchors. `Bosch` / `scallop` / `C4F8` = 0 (frontside-etch terms). Backside CMP / `recess` / `backside metal` = 0 (Reveal's domain).
- **Gate-P1 — Process Ownership.** Each major step owns EXACTLY ONE question: Seed → starting surface · Electroplating → growth direction · Anneal → grain stability · Overburden CMP → frontside excess removal. A step owning multiple = FAIL.
- **Gate-P2 — Sequence Ownership.** The full fill chain (seed → electroplate/superfill → anneal → frontside overburden CMP) is walked as a complete sequence EXACTLY ONCE, in the climax §5. §2/§3/§4 each own ONLY their own step.
- **Gate-D1 — Direction Dominance (NEW; protects the new asset family).** Every process step must eventually resolve back to GROWTH DIRECTION. Seed matters because it decides where copper can grow; additives matter because they bias growth direction; anneal matters because it stabilizes the structure the fill front created; CMP matters because it removes the excess that successful bottom-up fill produces. If a passage explains a step at length but never resolves to growth direction, it is padding — cut or refocus. The whole page is one argument about direction.
- **Gate-Rx-Fill — scoped failure boundary (REPLACES Reveal's Gate-Rx; the void is this page's SUBJECT, not a quarantined failure mode).** ALLOWED in §3 and §5 (and anywhere): `void`, `seam`, `pinch-off`, `trapped cavity` — these are fill OUTCOMES and you cannot explain bottom-up fill without the void it avoids. CONFINED to §6 + deferred to the Reliability hub: SYSTEM-level reliability framing — `electromigration`, `stress migration`, `Cu pumping`, `thermal cycling`, `fatigue`, `lifetime`. Greppable: those six system-reliability terms = 0 in §1–§5.
- **Hedge hard rule** + **figure-numbers-relative-only** + **Gate-C** (delete §5 → page collapses to a flat plating walkthrough) + **Gate-E 4-test** + **Gate-F Reversal** (delete fill/plating/superfill/direction terms → collapse) + **Intent audit** (reader leaves knowing fill is a DIRECTION problem, not a TSV overview or a reliability story).
- **Figure tests (new, replace Window Ownership/Direction for the Growth-Direction family):**
  - **Two-Path Test:** mask the path labels (conformal / superfill) — can a reader still tell which path TRAPS a void (fails) and which fills solid (succeeds) from the graphic alone?
  - **Direction Legibility Test:** the figure must make the GROWTH DIRECTION (where copper grows first — sidewall-inward vs bottom-up) visibly the point. If the reader sees only "void vs no-void" but not WHY (the direction), it is a defect comparison, not a Growth-Direction asset — redesign.

## Figures (cover-first gate; single asset — sub-page discipline)

1. **Cover** — navy hero: a single through-silicon via mid-fill, bright copper rising from the BOTTOM upward as a clean solid front, the void-trapping conformal fate shown faintly/ghosted as the rejected alternative beside it. Convey "copper growing in the right direction."
2. **Fig A — The Fill-Front: Growth Direction Determines Fill Outcome** (primary / climax) — the two-path growth diagram with direction arrows. Relative labels only.
   (No second figure — sub-page stays single-asset.)

## Internal graph / Phase-B (mini-hub edges — EXACT-slug verified; PRE-verify every Related link against DDB)

- **Out-links:** parent TSV page (entity/anatomy/timing/design-rules defer + its 3-sentence fill summary), DRIE (via formation), TSV Reveal (the void trapped at fill surfaces at reveal — sibling edge), Reliability hub (what a void becomes in service), HBM4 (application).
- **Phase-B1 (immediate, all cluster pages — NO B2):**
  1. **Parent Future Hub Hook "copper filling" → forward link** to this page (the SECOND hook word becomes live, exactly as Reveal converted "TSV reveal" — extends the mini-hub root).
  2. **Parent §3 fill summary sentence** → link to this page (the "how").
  3. **TSV Reveal ⇄ Cu Fill cross-link** — Reveal's relevant mention (e.g. where it notes the via was filled) → link Cu Fill; and Cu Fill §7 → Reveal. The sibling edge within the mini-hub.
- **MANDATORY pre-publish:** extract every `href="/insights/..."` in the article and verify each against DDB by EXACT slug (listInsightsPostBySlug). The long HBM4 slug `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges` has been truncated to a broken `/insights/16-hi-hbm` in two prior Related sections — do this proactively.

## Canonical map

Cu Fill is a sub-feature, not a chain step — it does NOT enter the AP Decision Chain map (`ap-decision-chain` stays single-sourced).

## Metadata

relatedProducts → `/products/ald` (barrier/seed deposition for via metallization — verified: NineScrolls has NO electroplating/ECD product, so the metadata routes to the in-lane barrier/seed deposition capability that PRECEDES the fill; the BODY/CTA must NOT claim plating/ECD equipment — prose stays in-lane, the page is editorial on the fill process). Schema gotchas per standing notes (no lastModifiedDate; JSON.stringify for a.json(); FAIL-on-existing create). Tags `["TSV copper fill","via fill","TSV electroplating","superfill","bottom-up fill","through-silicon via","advanced packaging","3D integration"]`.
