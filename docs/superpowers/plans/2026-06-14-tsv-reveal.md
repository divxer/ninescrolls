# TSV Reveal (TSV mini-hub sub-page #1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the TSV mini-hub's first child page — "TSV Reveal: Exposing Through-Silicon Vias from the Wafer Backside" (slug `tsv-reveal`) — owning the reveal PROCESS, with the TSV Reveal Window (the cluster's first Process-Window asset) as the dominant climax (§5), and wire the parent→child forward link that converts the TSV entity page into a real mini-hub.

**Architecture:** The standard 7th-run pipeline (TSV/W2W/TB/Reliability precedent), but SUB-PAGE-tight: sequential subagents draft into provenance HTML with rule-greps between tasks (R1/R3b + Gate-P1/P2/Rx + §5-dominance), Gate-C after §5, Gate-E + Gate-F + Intent + Window Ownership/Direction tests at completion, cover-first single-asset figure gate, llms sync BEFORE publish, one-shot DDB scripts NOT committed, Phase-B1 only with EXACT-slug verification.

**Tech Stack:** HTML article fragments (house style = `scripts/articles/temporary-wafer-bonding-debonding.html`), TypeScript + tsx one-shots against Amplify Data, `upload-insights-image.ts` with `AWS_PROFILE=ninescrolls`.

**Spec:** `docs/superpowers/specs/2026-06-14-tsv-reveal-design.md`
**Branch:** `insights/tsv-reveal` (current; spec committed)
**Env for DDB scripts:** `set -a; . ./.env; set +a` then `npx tsx <script>`

---

## Locked metadata

- **Title:** `TSV Reveal: Exposing Through-Silicon Vias from the Wafer Backside`
- **Slug:** `tsv-reveal`
- **Excerpt:** `TSV reveal — how a buried via becomes a through-silicon via: backside thinning, the silicon-recess reveal etch, passivation, and CMP. The reveal window: why reveal is a stopping problem, not a removal problem.`
- **Category:** `Process Integration` · **readTime:** 9 · **author:** `NineScrolls Engineering` · **publishDate:** date of publish
- **Tags:** `["TSV reveal","via reveal","backside reveal","silicon recess","backside metallization","through-silicon via","advanced packaging","3D integration"]`
- **relatedProducts:** `JSON.stringify([{href:"/products/icp-etcher",label:"ICP Etching Systems",subtitle:"Plasma silicon recess for via reveal"}])` — metadata routes; prose stays in-lane.
- **Schema gotchas:** NO `lastModifiedDate`; `relatedProducts` is `a.json()` → `JSON.stringify`; FAIL-on-existing create with explicit slug.

## Rule → grep table (f = `scripts/articles/tsv-reveal.html`)

| Rule | Check |
|---|---|
| Principle | `grep -c "TSV reveal is a stopping problem, not a removal problem" f` == 1 (pull-quote; figcaption uses short variant) |
| **§5 dominance** | `awk` word counts: **words(§5) ≥ every other section** AND §5 in 480–560 |
| **R3b leak-ban** | `grep -ocE "\\b(Bosch\|scallop\|C4F8\|passivation cycle)\\b" f` == 0; `via-first/via-middle/via-last`, `carrier`, `debond`, `adhesive` only inside `<a>…</a>` (list hits, verify by eye) |
| **Gate-P2 Sequence Ownership** | the full ordered chain (backgrind→reveal→passivation→CMP→…metal) appears as a complete sequence exactly ONCE (in §5); `grep -ic "backgrind" f` and the chain-walk lives in §5 only — §2/§3/§4 mention only their own step |
| **Gate-Rx Failure-only-in-§6** | `awk` §3+§4 region: `grep -icE "\\b(yield\|crack\|reliabilit\|fatigue)\\b"` == 0 (those belong to §6) |
| R-length | total 2,200–2,600 (UPPER HARD LIMIT ~2,600) |
| Hedge | `grep -icE "\\b(always\|never\|completely)\\b" f` near process claims == 0; hedged |
| Figures | exactly 1 `tsv-reveal-window` figure block; NO second inline figure |
| Links | each ≥1 (EXACT slugs): `through-silicon-vias-tsv-guide`, `temporary-wafer-bonding-debonding`, `deep-reactive-ion-etching-bosch-process`, `3d-packaging-reliability`, `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges` |

**Gate-P1 Process Ownership map (each step owns ONE question):** Backgrind → proximity · Reveal etch → stopping depth · Passivation → surface protection · CMP → planarity · Backside metal → connectivity. A step written as owning multiple = FAIL.

**Cluster link targets (EXACT slugs):** parent `through-silicon-vias-tsv-guide` · TB `temporary-wafer-bonding-debonding` · DRIE `deep-reactive-ion-etching-bosch-process` · Reliability `3d-packaging-reliability` · HBM4 `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges`.

---

## Task 1: Scaffold + lead + §1 + §2 + §3 + §4 (process steps, each owning ONE question; NO full-chain walk)

- [ ] **Step 1: Dispatch subagent.** House style: read `scripts/articles/temporary-wafer-bonding-debonding.html`. Create `scripts/articles/tsv-reveal.html`:
  - **Lead (~100w):** the hook — a via etched and filled from the front is a dead-end well; it becomes a *through*-silicon via only when the wafer's backside is removed to expose the copper. That exposure is the reveal. Triple defer: the TSV entity, via-timing, and design rules → parent (link `/insights/through-silicon-vias-tsv-guide`); holding the thinned wafer on a carrier → Temporary Bonding (link `/insights/temporary-wafer-bonding-debonding`); the frontside etch that formed the via → DRIE (link `/insights/deep-reactive-ion-etching-bosch-process`). State the spine: reveal is a stopping problem.
  - **§1 `<h2 id="why-reveal">1. Why Reveal Exists</h2>` (~230w):** a frontside-formed, filled via is BLIND — it stops partway through full-thickness silicon. It carries no signal until the back of the wafer is taken down to meet it and the copper tip is exposed and connected. Reveal is the step that turns a buried feature into a functional vertical interconnect. Defer via-formation (etch/fill/anneal) UP to the parent; do not re-derive it.
  - **§2 `<h2 id="thinning-to-plane">2. From Thinning to the Reveal Plane</h2>` (~230w) — owns ONLY "proximity":** backside grinding removes the bulk of the wafer and brings the surface NEAR the buried via tips. The wafer is held on a carrier through this (one clause, defer the handling to Temporary Bonding — do NOT explain carriers/adhesives). The key framing: grinding gets you *close*, but it is coarse; it cannot stop precisely on the via tips without risking them. The remaining gap — from "near the tips" to "exactly at the plane that exposes them" — is what the reveal etch exists to cross. (Do NOT walk the rest of the chain here — Gate-P2.)
  - **§3 `<h2 id="reveal-etch">3. The Reveal Etch (Silicon Recess)</h2>` (~280w) — owns ONLY "stopping depth":** answers *how do I arrive at the plane?* A controlled plasma silicon recess etches the remaining silicon selectively — removing silicon while leaving the copper (and its barrier) standing, so the tips protrude above a recessed silicon surface. The two things that make this hard: **selectivity** (the etch must take silicon far faster than copper or the liner, or it eats the tips it is trying to expose) and **across-wafer uniformity** (the recess must reach the same depth at the edge as at the center, or some vias expose while others stay buried). This is the stopping-depth problem; keep it ON that question (Gate-P1). No yield/reliability framing here (Gate-Rx). Do NOT name DRIE/Bosch/passivation-cycle (R3b) — this is backside silicon recess, a different etch from the frontside via formation.
  - **§4 `<h2 id="passivation-cmp">4. Passivation and CMP</h2>` (~280w) — owns ONLY "surface protection" + "planarity":** answers *how do I preserve the plane?* Once copper tips stand exposed, two things follow. **Passivation:** a backside dielectric is deposited over the revealed surface to protect the exposed copper and isolate it (this "passivation" is the backside dielectric over exposed copper — NOT an etch sidewall cycle). **CMP:** chemical-mechanical polish then planarizes the tips and dielectric to a flat surface ready for backside metallization, which makes the actual connection. Own surface-protection (passivation) and planarity (CMP) as the two distinct sub-questions; backside metal owns connectivity (one sentence). No yield/reliability framing (Gate-Rx). (Do NOT re-walk the whole chain — Gate-P2.)
  - Rules: R3b; Gate-P1 (one question per step); Gate-P2 (no full-chain walk in §2-§4); Gate-Rx (no yield/crack/reliability/fatigue in §3/§4). Never `--no-verify`.

- [ ] **Step 2: Rule-grep** (R3b: Bosch/scallop/C4F8/passivation-cycle = 0; defer terms only in anchors; Gate-Rx: §3+§4 yield/crack/reliability/fatigue = 0; Gate-P2: no complete backgrind→…→metal chain yet; parent+TB+DRIE links present; §1-4 ≈ 920w).

- [ ] **Step 3: Commit** — `git add scripts/articles/tsv-reveal.html && git commit -m "feat(insights): TSV Reveal scaffold + §1-4 (process steps, one question each)"`

## Task 2: §5 The TSV Reveal Window (CLIMAX) + Gate-C + the chain owned here

- [ ] **Step 1: Dispatch subagent.** Append §5 `<h2 id="reveal-window">5. The TSV Reveal Window</h2>` (480–560w):
  - OPEN with the LOCKED pull-quote (house blockquote markup):
    *"TSV reveal is a stopping problem, not a removal problem. The challenge is not removing silicon — it is stopping at the correct depth everywhere on the wafer at once."*
  - One bridging paragraph: the previous sections described steps; this one reframes the whole process as a single precision target. There is a narrow band of recess depth that works, and it must be hit across the entire wafer simultaneously.
  - **The Window, as continuity (not three buckets):** describe the depth axis as a continuum — too little recess (under-reveal): the copper tips are still buried or barely exposed, so the connection is open or marginal; the optimal window: every tip stands proud of the silicon by enough to connect, uniformly; too much recess (over-reveal): the tips are over-exposed and the etch/CMP begins to damage them — dishing, smearing, lost copper. Stress the DIRECTION: under and over are opposite failure directions on one axis, with the good window between them.
  - **Across-wafer = the second axis:** even a perfectly chosen depth fails if it is not uniform — at any instant some of the wafer can be under-revealed while elsewhere is over-revealed. The window is narrow in depth AND must hold everywhere at once. That is what makes reveal a stopping problem.
  - **§5 OWNS the full process chain (Gate-P2):** this is the ONE place the complete sequence appears — present it as the spine that the window is read against: `Backgrind → Reveal etch / recess → Passivation → CMP → Backside metal`, noting which step moves you toward which edge of the window (grind = approach from the under side; recess = cross into the window; CMP = can push toward over if it removes too much).
  - Include the Window figure block (prefix `tsv-reveal-window`, base `https://cdn.ninescrolls.com/insights/tsv-reveal/`, standard `<picture>`); figcaption = short variant ("The TSV reveal window: a narrow band of recess depth between under-reveal and over-reveal that must be hit uniformly across the wafer."), NOT the full pull-quote.
  - Plus one how-to-read sentence after the figure.

- [ ] **Step 2: §5-dominance grep + Gate-C (manual).**
  - Word check: §5 480–560 AND `words(§5) ≥ every other section`.
  - **Gate-C:** delete §5 — the page must collapse to a flat process walkthrough (steps with no organizing idea). If it survives as a coherent article, §5 is too weak — the stopping-problem thesis must be what holds the page together.

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): TSV Reveal §5 Window climax (Process-Window asset; Gate-C + owns the full chain)"`

## Task 3: §6 + §7 + FAQ/Related/CTA + FULL audit + Gate-E/F + Intent

- [ ] **Step 1: Dispatch subagent.** Append:
  - **§6 `<h2 id="failure-modes">6. Reveal Failure Modes</h2>` (~280w):** the reveal-SPECIFIC defects (this is the ONLY section where failure framing is allowed — Gate-Rx): under-reveal (tips not exposed → open or high-resistance connection); over-reveal (tip dishing, copper smearing, recess past the usable tip); across-wafer non-uniformity (the window held in the center but not the edge); passivation voids / incomplete coverage over the exposed copper. For each, name the reveal cause; do NOT extend into system reliability (CTE, warpage, fatigue) — that is the Reliability hub's domain: one defer-link `/insights/3d-packaging-reliability`.
  - **§7 `<h2 id="why-yield">7. Why Reveal Determines Yield</h2>` (~200w):** the close — reveal is the single plane where every upstream choice (via depth, fill quality, anneal, thinning) is graded at the same instant: a via too short, a fill void, a thinning tilt all surface here as an open or a damaged tip. Restate the stopping principle in fresh words. Link parent (the cost-chain that ends at reveal) and Reliability (what an escaped reveal defect becomes downstream).
  - **FAQ (4):**
    1. "What is TSV reveal?" — the entity-style answer (exposing buried via tips from the thinned backside).
    2. "Is TSV reveal the same as backgrinding?" — NO: backgrind brings the surface NEAR (proximity); reveal is the precise stop that exposes the tips (the plane). 2-3 sentences.
    3. "What is the reveal etch?" — the selective silicon recess that exposes copper without consuming it.
    4. "Why is TSV reveal hard?" — the stopping-problem answer (narrow depth window, uniform across the wafer).
  - **Related Articles** (parent TSV, Temporary Bonding, DRIE, Reliability, HBM4) + CTA (`/contact`, plasma silicon-recess / etch capability for via-reveal flows — relative, no overclaim).

- [ ] **Step 2: FULL AUDIT** — every grep-table row; R-length 2,200–2,600 (if over ~2,600: trim §1/§2/§6, NEVER §5; if under 2,200: deepen §3/§5); §5-dominance; Gate-P1 (each step one question), Gate-P2 (full chain only in §5), Gate-Rx (failure terms only in §6); single figure only; all 5 links by EXACT slug.

- [ ] **Step 3: Gate-E + Gate-F + Intent (human judgment):**
  - Gate-E: (1) cover title → still "exposing vias from the backside / the stopping problem"; (2) remove the figure → the window argument stands in prose; (3) delete §5 → collapses; (4) delete the figure → the stopping-problem framework survives in §5 prose.
  - **Gate-F Reversal:** delete every reveal/recess/expose term → the article must collapse into nonsense (else generic backside-processing).
  - Intent audit: the reader leaves knowing the reveal PROCESS + the stopping problem — NOT a TSV overview (parent) and NOT a reliability story (Reliability hub).

- [ ] **Step 4: Commit** — `git commit -am "feat(insights): TSV Reveal §6-7 + FAQ/CTA + full audit + Gate-E/F"`

## Task 4: Figure prompts + cover-first gate (USER ACTION) — single asset

- [ ] **Step 1: Write `/tmp/tsv-reveal-figure-prompts.md`:**

**① COVER (approve first; 3:2 navy hero):** Ultra-high-res editorial cover, deep navy (#1e3a5f) gradient. Subject: a wafer-backside cross-section, viewed close. The silicon has been thinned and recessed so a row of bright copper through-silicon via tips just emerge above the recessed silicon surface; a luminous horizontal plane-line marks the exact reveal depth where the copper is correctly exposed. Convey "stopping at exactly the right plane." Cool blue silicon, warm copper tips, a crisp glowing reference plane. No people. Text: header "NINESCROLLS · INSIGHTS", title "TSV Reveal", subtitle "Exposing Through-Silicon Vias from the Wafer Backside", footer "ninescrolls.com". Perfect spelling.

**② Fig A — The TSV Reveal Window (`tsv-reveal-window`, ~1100×850, white bg, brand palette) — THE climax, the cluster's first Process-Window asset:** a VERTICAL precision band read as a CONTINUUM along a "recess depth" axis (label the axis "Recess depth →" running top to bottom). Three contiguous zones, drawn as a smooth gradient band so the direction is unmistakable even with labels hidden:
  - TOP zone (too little): "UNDER-REVEAL — copper tips still buried; open / high-resistance" — show via tips below or flush with the silicon surface (amber/red tint).
  - CENTER zone (just right): "OPTIMAL WINDOW — tips uniformly exposed and connectable" — tips standing proud, even (green tint).
  - BOTTOM zone (too much): "OVER-REVEAL — tips over-exposed, dishing / smearing / copper loss" — tips damaged/dished (red tint).
  Alongside the band, as a vertical SPINE, the process flow with small arrows showing which step moves you down the depth axis: Backgrind (approaches from the under side) → Reveal etch / recess (crosses into the window) → Passivation → CMP (can push toward over) → Backside metal. A small note: "must hold across the whole wafer at once." NO micron numbers. The graphic must communicate too-little → just-right → too-much DIRECTIONALLY even if the zone labels are hidden (Window Direction Test). Footer "ninescrolls.com · The TSV Reveal Window".

- [ ] **Step 2: GATE — user generates ① → approve → ②.** Then run BOTH figure tests on Fig A before accepting: **Window Ownership Test** (mask zone names → reader still reads too-little/just-right/too-much from the graphic) AND **Window Direction Test** (mask Under/Optimal/Over labels → reader can still tell which end is too-little vs too-much; if only "three regions" reads, regenerate). Cross-check the spine steps + axis against the article.

## Task 5: Import draft → upload → llms BEFORE publish → publish → verify

- [ ] **Step 1: One-shot `scripts/create-tsv-reveal-article.ts`** (NOT committed; FAIL-on-existing):

```typescript
/** One-shot: create TSV Reveal sub-page as draft. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });
const SLUG = 'tsv-reveal';
(async () => {
  await authenticate();
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  if (existing?.length) { console.error(`FAIL: slug exists, id=${(existing[0] as any).id}. Use an update one-shot.`); process.exit(1); }
  const { data, errors } = await client.models.InsightsPost.create({
    title: 'TSV Reveal: Exposing Through-Silicon Vias from the Wafer Backside',
    slug: SLUG,
    content: readFileSync('scripts/articles/tsv-reveal.html', 'utf-8'),
    excerpt: 'TSV reveal — how a buried via becomes a through-silicon via: backside thinning, the silicon-recess reveal etch, passivation, and CMP. The reveal window: why reveal is a stopping problem, not a removal problem.',
    author: 'NineScrolls Engineering',
    publishDate: new Date().toISOString().slice(0, 10),
    category: 'Process Integration',
    readTime: 9,
    imageUrl: 'https://cdn.ninescrolls.com/insights/tsv-reveal/cover-lg',
    tags: ['TSV reveal','via reveal','backside reveal','silicon recess','backside metallization','through-silicon via','advanced packaging','3D integration'],
    relatedProducts: JSON.stringify([{ href: '/products/icp-etcher', label: 'ICP Etching Systems', subtitle: 'Plasma silicon recess for via reveal' }]) as any,
    isStandaloneComponent: false,
    isDraft: true,
  } as any);
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : `CREATED draft id=${(data as any).id}`);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Upload figures** (user paths): `--name cover` / `--name tsv-reveal-window --no-update-cover`, each via `AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts tsv-reveal <file> …`.

- [ ] **Step 3: llms sync BEFORE publish.** `public/llms.txt` (AP section, after the Reliability entry):

```markdown
- [TSV Reveal](https://ninescrolls.com/insights/tsv-reveal): How a buried via becomes a through-silicon via — backside thinning to the reveal plane, the selective silicon-recess reveal etch, backside passivation and CMP, and the reveal window: why reveal is a stopping problem, not a removal problem
```

`public/llms-full.txt` (after the Reliability block):

```markdown
**TSV Reveal: Exposing Through-Silicon Vias from the Wafer Backside**
URL: https://ninescrolls.com/insights/tsv-reveal
Summary: The first sub-page of the TSV mini-hub — owns the reveal process by which a buried, frontside-formed via becomes a functional through-silicon via. Covers why reveal exists (a filled via is blind until the backside is removed), thinning to the reveal plane (backgrind brings the surface near; the reveal etch arrives exactly), the selective silicon-recess reveal etch (etch silicon, spare copper; uniform across the wafer), and backside passivation and CMP to ready the tips for backside metallization. Climax: the TSV Reveal Window — a narrow band of recess depth between under-reveal (tips buried, open) and over-reveal (tips dished, copper lost) that must be hit uniformly across the whole wafer at once. Principle: TSV reveal is a stopping problem, not a removal problem. Defers the TSV entity, via-timing, and design rules to the TSV guide; carrier and thinning handling to Temporary Wafer Bonding and Debonding; the frontside via-formation etch to the DRIE guide; system-level reliability to the 3D packaging reliability guide.
```

- [ ] **Step 4: Publish** (`update({id, isDraft:false})`) → verify DDB (title/slug/figure/principle) → CDN 200s (cover + window lg.webp) → live render → `rm scripts/create-tsv-reveal-article.ts`.

## Task 6: Provenance + PR

- [ ] **Step 1:**

```bash
git add scripts/articles/tsv-reveal.html public/llms.txt public/llms-full.txt docs/superpowers/plans/2026-06-14-tsv-reveal.md
git commit -m "feat(insights): TSV Reveal (TSV mini-hub sub-page #1) + llms sync"
git push -u origin insights/tsv-reveal
gh pr create --title "feat(insights): TSV Reveal (TSV mini-hub sub-page #1, first Process-Window asset)" --body "First child of the TSV entity page — begins the TSV mini-hub (Reveal -> Cu Fill -> Interposer). Fulfills promises the cluster already made (parent Future Hub Hook, TB defer, HBM4 process sentence all pointed here). Owns the reveal PROCESS only; defers entity/timing to parent, carrier to Temporary Bonding, frontside etch to DRIE, system reliability to the Reliability hub. Climax = the TSV Reveal Window (the cluster's first Process-Window asset, not a Matrix): a stopping problem, not a removal problem. New gates: Gate-P1 Process Ownership, Gate-P2 Sequence Ownership, Gate-Rx Failure-only-in-§6 + Window Ownership/Direction figure tests + Gate-C/E/F. Sub-page length (2,200-2,600, tighter than the parent). Phase-B turns the parent into a real mini-hub.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Task 7: Phase-B1 Link Pass — THE MINI-HUB EDGES (one-shot NOT committed; EXACT-slug; NO B2)

- [ ] **Step 1: Fetch verbatim anchors** (read-only tsx): parent Future Hub Hook ("The next design decisions — TSV reveal, copper filling, and bonding strategy — each deserve their own treatment."); parent §6 "clean reveal" requirement sentence; HBM4 reveal sentence ("TSV reveal — exposing the copper via tips on the thinned backside — requires controlled silicon recess by plasma etch, then PECVD passivation…"); TB reveal defer ("the reveal itself is covered in our TSV guide and is not re-derived here").
- [ ] **Step 2: One-shot `scripts/tsv-reveal-backlinks.ts`** — standard module (rx() tolerant find, exactly-one-match guard, idempotency on `/insights/tsv-reveal`, --dry-run). FOUR edits:
  1. **parent → reveal FORWARD link (THE mini-hub move):** in the Future Hub Hook, turn the bare phrase "TSV reveal" into `<a href="/insights/tsv-reveal">TSV reveal</a>` (this is what converts the parent entity page into a mini-hub root). Match the exact hook sentence; replace only the first "TSV reveal" occurrence in it.
  2. **parent §6 "clean reveal"** requirement sentence → append "(the reveal process itself is covered in <a href=\"/insights/tsv-reveal\">TSV Reveal</a>)".
  3. **HBM4** reveal sentence → append a link to `/insights/tsv-reveal` ("…— covered in full in <a>TSV Reveal</a>").
  4. **Temporary Bonding** reveal defer → re-point: change "covered in our TSV guide and is not re-derived here" region to point at `<a href="/insights/tsv-reveal">TSV Reveal</a>` (more precise than the parent).
- [ ] **Step 3: dry-run → apply → verify with EXACT-slug checks** (each of the 4 pages contains `/insights/tsv-reveal"` exactly once; the reveal page links back to all targets by EXACT slug — query listInsightsPostBySlug, do NOT substring-match) → `rm scripts/tsv-reveal-backlinks.ts`. **NO B2.**

## Task 8: Memory + wrap

- [ ] **Step 1: Update `memory/seo_strategy.md`:** TSV Reveal PUBLISHED (slug/id/PR#); **TSV mini-hub STARTED — the parent TSV entity page is now a mini-hub root** (the Future Hub Hook's "TSV reveal" is now a live link). **AP cluster = 10 pages.** **NEW ASSET FAMILY: Process-Window** (Under/Optimal/Over continuum band + process-flow spine; principle "reveal is a stopping problem, not a removal problem") — distinct from the Matrix family (TSV selection / Debond / W2W gates / Reliability trade-off). The cluster now has multiple climax-asset families, not one cloned template. **Process-Window governance added to the template (reusable for Cu Fill / Interposer): Gate-P1 Process Ownership (each step owns one question — Backgrind→proximity / Reveal etch→stopping depth / Passivation→protection / CMP→planarity / Backside metal→connectivity) · Gate-P2 Sequence Ownership (the full chain is described EXACTLY ONCE, in the climax) · Gate-Rx Failure-Modes-Only-in-§6 (drift risk for process pages is the Reliability hub) + Window Ownership Test + Window Direction Test (the figure must read too-little→just-right→too-much directionally with labels masked).** Sub-page discipline confirmed: single asset, ~2,400w (tighter than the parent's 3,499 — preserves parent→child hierarchy). Phase-B1 done (parent forward-link + parent §6 + HBM4 + TB re-point → Reveal; EXACT-slug verified). Next TSV sub-pages: **Cu Fill → Interposer**. **⏳ STILL PENDING: TSV Phase-B2 DRIE edit ~2026-06-18** (`scripts/tsv-backlinks.ts --b2`; verify DRIE title/H2 byte-identical). **~early-July GSC remeasure** — RIE Phase-2 persistence + new AP pages indexing + the DRIE-impressions-rose-after-TSV signal.
- [ ] **Step 2: Report** with live URL + PR + verification evidence.

---

## Self-review

- **Spec coverage:** metadata ✓ (T5 code); lead + triple defer ✓ (T1); §1 blind-via ✓; §2 proximity-only ✓; §3 stopping-depth-only ✓; §4 protection+planarity ✓ (T1); §5 Window climax + principle + owns-the-chain ✓ (T2); §6 failure-modes-only ✓; §7 close ✓ (T3); Gate-P1/P2/Rx ✓ (grep table + per-task checks); §5-dominance ✓; Window Ownership + Direction tests ✓ (T4); single-asset ✓; llms-before-publish ✓ (T5); Phase-B1 mini-hub edges + EXACT-slug ✓ (T7); memory incl. Process-Window family + TSV-B2 + GSC reminders ✓ (T8).
- **Marker mechanics:** tasks append to EOF in section order. Final H2 order: 1–7 + FAQ — T3 audit verifies.
- **Consistency:** slug + figure prefixes (`cover`, `tsv-reveal-window`) identical across blocks (T2), prompts (T4), uploads (T5).
- **Placeholder scan:** image paths user-provided at gate time; all else concrete.
