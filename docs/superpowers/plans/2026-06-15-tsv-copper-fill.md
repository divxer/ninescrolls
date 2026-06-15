# TSV Copper Fill (TSV mini-hub sub-page #2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the TSV mini-hub's second child page — "TSV Copper Fill: Bottom-Up Electroplating Without Trapping a Void" (slug `tsv-copper-fill`) — owning the fill PROCESS, with the Fill-Front (the cluster's first Growth-Direction asset, family #6) as the dominant climax (§5), and wire the second mini-hub forward edge that makes the parent's "copper filling" hook word a live link.

**Architecture:** The standard 8th-run sub-page pipeline (Reveal precedent): sequential subagents draft into provenance HTML with rule-greps between tasks (R1/R3b + Gate-P1/P2/D1/Q1 + Gate-Rx-Fill + §5-dominance), Gate-C after §5, Gate-E + Gate-F + Intent + Two-Path/Direction-Legibility figure tests at completion, cover-first single-asset figure gate, llms sync BEFORE publish, one-shot DDB scripts NOT committed, Phase-B1 only with EXACT-slug verification.

**Tech Stack:** HTML article fragments (house style = `scripts/articles/tsv-reveal.html`), TypeScript + tsx one-shots against Amplify Data, `upload-insights-image.ts` with `AWS_PROFILE=ninescrolls`.

**Spec:** `docs/superpowers/specs/2026-06-15-tsv-copper-fill-design.md`
**Branch:** `insights/tsv-copper-fill` (current; spec committed)
**Env for DDB scripts:** `set -a; . ./.env; set +a` then `npx tsx <script>`

---

## Locked metadata

- **Title:** `TSV Copper Fill: Bottom-Up Electroplating Without Trapping a Void`
- **Slug:** `tsv-copper-fill`
- **Excerpt:** `TSV copper fill — how bottom-up electroplating fills a high-aspect-ratio via without trapping a void: the seed, superfill additives, anneal, and frontside overburden CMP. Why fill is a direction problem, not a volume problem.`
- **Category:** `Process Integration` · **readTime:** 9 · **author:** `NineScrolls Engineering` · **publishDate:** date of publish
- **Tags:** `["TSV copper fill","via fill","TSV electroplating","superfill","bottom-up fill","through-silicon via","advanced packaging","3D integration"]`
- **relatedProducts:** `JSON.stringify([{href:"/products/ald",label:"ALD Systems",subtitle:"Diffusion barrier and seed deposition for via metallization"}])` — NO ECD product exists; metadata routes to in-lane barrier/seed; BODY/CTA must NOT claim plating/ECD equipment.
- **Schema gotchas:** NO `lastModifiedDate`; `relatedProducts` is `a.json()` → `JSON.stringify`; FAIL-on-existing create with explicit slug.

## Rule → grep table (f = `scripts/articles/tsv-copper-fill.html`)

| Rule | Check |
|---|---|
| Principle (2-part) | `grep -c "grows in the wrong place first" f` == 1 (intuition-breaker) AND `grep -c "Copper via fill is a direction problem, not a volume problem" f` == 1 (pull-quote) |
| **§5 dominance** | `awk` word counts: **words(§5) ≥ every other section** AND §5 in 480–560 |
| **R3b leak-ban** | `grep -ocE "\\b(Bosch\|scallop\|C4F8)\\b" f` == 0; `via-first/via-middle/via-last`, `carrier`, `debond`, `KOZ` only inside `<a>…</a>` |
| **CMP disambiguation** | `grep -ic "frontside overburden" f` ≥1; `grep -ocE "\\b(backside\|recess\|backside metal)\\b" f` == 0 EXCEPT inside the TSV-Reveal defer-link anchor (list hits, verify by eye) |
| **Gate-P2 Sequence Ownership** | full chain (seed→electroplat…→anneal→…CMP) walked as a complete sequence exactly ONCE (in §5); §2/§3/§4 mention only their own step |
| **Gate-Rx-Fill** | `awk` §1–§5 region: `grep -ocE "\\b(electromigration\|stress migration\|Cu pumping\|copper pumping\|thermal cycl\|fatigue\|lifetime)\\b"` == 0 (system reliability → §6/defer); `void`/`seam`/`pinch-off` ALLOWED anywhere |
| R-length | total 2,200–2,600 (UPPER HARD LIMIT ~2,600) |
| Hedge | `grep -icE "\\b(always\|never\|completely)\\b" f` near process claims == 0 |
| Figures | exactly 1 `growth-direction-determines-fill-outcome` figure block; NO second inline figure |
| Links | each ≥1 (EXACT slugs): `through-silicon-vias-tsv-guide`, `deep-reactive-ion-etching-bosch-process`, `tsv-reveal`, `3d-packaging-reliability`, `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges` |

**Gate-P1 (each step ONE question):** Seed → starting surface · Electroplating → growth direction · Anneal → grain stability · Overburden CMP → frontside excess removal.
**Gate-D1 (FIRST PRIORITY — every step resolves to growth DIRECTION):** seed = where copper CAN grow · additives = bias direction · anneal = stabilizes the front's structure · CMP = removes the excess that successful bottom-up fill produces. A passage that never resolves to direction = padding.
**Gate-Q1 (each H2 answers part of "Where does copper grow first?"):** §2 "where CAN copper grow?" · §3 "where DOES it grow first?" · §4 "what after successful growth?" · §6 "what when growth starts in the wrong place?".

**Cluster link targets (EXACT slugs):** parent `through-silicon-vias-tsv-guide` · DRIE `deep-reactive-ion-etching-bosch-process` · Reveal `tsv-reveal` · Reliability `3d-packaging-reliability` · HBM4 `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges`.

---

## Task 1: Scaffold + lead + §1 + §2 + §3 + §4 (process steps, each owning ONE question + resolving to direction; NO full-chain walk)

- [ ] **Step 1: Dispatch subagent.** House style: read `scripts/articles/tsv-reveal.html` (the sibling sub-page). Create `scripts/articles/tsv-copper-fill.html`:
  - **Lead (~100w):** the hook — a lined via is an empty well; fill is how copper gets in, but the hard part is not VOLUME, it is DIRECTION: copper must grow from the bottom up, or it seals a void inside. Triple defer: the TSV entity, anatomy, timing, design rules → parent (link `/insights/through-silicon-vias-tsv-guide`); the frontside etch that formed the via → DRIE (link `/insights/deep-reactive-ion-etching-bosch-process`); the BACKSIDE reveal of the filled via → TSV Reveal (link `/insights/tsv-reveal`). State the spine: fill is a direction problem.
  - **§1 `<h2 id="why-hard">1. Why Filling a Via Is Hard</h2>` (~230w):** a high-aspect-ratio via is a deep, narrow hole. Deposit copper *conformally* — evenly on every surface — and the mouth of the hole closes before the bottom is full, sealing a void in the middle. The difficulty is not getting copper into the via; it is getting it in without trapping a void. That reframes the whole problem as one of growth DIRECTION (Gate-D1, Gate-Q1: "why direction, not volume").
  - **§2 `<h2 id="seed">2. The Seed: What Copper Grows On</h2>` (~220w) — owns "starting surface" → resolves to direction:** electroplated copper can only grow from a conductive surface, so a thin copper seed (over the diffusion barrier) is laid down first to give plating something to grow on. Own ONLY the seed-as-starting-surface question, and resolve it to direction: the seed decides WHERE copper can grow at all — a thin spot or discontinuity in the seed is a place copper cannot start, which seeds a void there. (Defer barrier/anatomy detail to the parent; one anchor. Gate-Q1: "where CAN copper grow?")
  - **§3 `<h2 id="electroplating">3. Electroplating and the Bottom-Up Problem</h2>` (~290w) — owns "growth direction":** answers *where does copper grow first?* Plain plating grows copper everywhere at once (conformal) and pinches the top shut. Bottom-up "superfill" instead biases growth so copper rises from the base. The control is a trio of additives — an accelerator (speeds growth where it concentrates, at the via bottom), a suppressor (slows growth on the field and upper sidewalls), and a leveler (tames the overburden) — whose balance makes the deposition front move UP rather than IN. Keep strictly on the direction question (Gate-P1/D1). void/seam allowed (it is the thing direction avoids). NO electromigration/Cu-pumping/lifetime (Gate-Rx-Fill). NO backside/recess (CMP-disambig). Do NOT walk the rest of the chain (Gate-P2).
  - **§4 `<h2 id="anneal-cmp">4. Anneal and Frontside Overburden CMP</h2>` (~250w) — owns "stabilize + frontside excess removal" → resolves to direction:** once the via is filled, two finishing steps. **Anneal:** heating stabilizes the copper grain structure the fill front produced (resolves to direction: it sets the structure that bottom-up growth created). **Frontside overburden CMP:** bottom-up fill necessarily plates excess copper across the wafer surface; chemical-mechanical planarization strips that **frontside overburden** back to a flat surface. Say "frontside overburden" explicitly; do NOT describe backside CMP or recess — that is TSV Reveal's domain (one defer-link to `/insights/tsv-reveal` is fine). (Gate-Q1: "what after successful growth?")
  - Rules: R3b (no Bosch/scallop/C4F8); CMP-disambig (no backside/recess/backside-metal outside the Reveal anchor); Gate-P1/P2/D1/Q1; Gate-Rx-Fill (no system-reliability terms in §1–§4). Never `--no-verify`.

- [ ] **Step 2: Rule-grep** (R3b=0; backside/recess=0 outside Reveal anchor; Gate-Rx-Fill system terms in §1–§4 = 0; "frontside overburden" ≥1; Gate-P2 no full chain yet; parent+DRIE+Reveal links present; §1-4 ≈ 990w).

- [ ] **Step 3: Commit** — `git add scripts/articles/tsv-copper-fill.html && git commit -m "feat(insights): TSV Copper Fill scaffold + §1-4 (each step owns one question + resolves to direction)"`

## Task 2: §5 The Fill-Front (CLIMAX, Growth-Direction asset) + Gate-C + Gate-D1/P3

- [ ] **Step 1: Dispatch subagent.** Append §5 `<h2 id="fill-front">5. The Fill-Front: Growth Direction Determines Fill Outcome</h2>` (480–560w):
  - OPEN with the two-part principle, EXACT wording — first the intuition-breaker as a plain lead sentence, then the pull-quote:
    > A TSV rarely fails because there is too little copper. It fails because the copper grows in the wrong place first.
    ```html
    <blockquote style="border-left:4px solid #2563eb;background:#eff6ff;padding:16px 20px;margin:24px 0;font-size:1.1em;">
      <p style="margin:0;"><strong>Copper via fill is a direction problem, not a volume problem. The copper must grow from the bottom up &mdash; or it seals a void inside.</strong></p>
    </blockquote>
    ```
  - **The two growth fronts as the central contrast (the asset in prose):**
    - **Conformal front:** copper thickens evenly on all walls; because the mouth is narrowest relative to its supply, the top pinches closed first and seals a void/seam in the center. The growth direction is sidewall-INWARD, and that direction is the failure.
    - **Bottom-up superfill front:** the additive balance concentrates growth at the via bottom, so the deposition front rises UP and the via fills solid with no trapped cavity. Same chemistry class, opposite outcome — set by direction.
    - State plainly: the difference between a perfect via and a scrapped one is not how much copper was deposited but WHERE it grew first.
  - **§5 OWNS THE FULL CHAIN (Gate-P2 — the one place the complete sequence appears):** present seed → electroplating/superfill → anneal → frontside overburden CMP as the spine, each step read for how it serves the bottom-up front (seed gives a continuous base to grow FROM; additives aim the front UP; anneal sets the grain of the filled column; CMP clears the overburden the successful front left behind). The other sections deliberately did not walk this chain — it is yours.
  - Include the figure block (prefix `growth-direction-determines-fill-outcome`, base `https://cdn.ninescrolls.com/insights/tsv-copper-fill/`, standard `<picture>`); figcaption short variant ("Growth direction determines fill outcome: a sidewall-inward (conformal) front traps a void; a bottom-up (superfill) front fills solid."), NOT the full pull-quote.
  - One how-to-read sentence after the figure.

- [ ] **Step 2: §5-dominance grep + Gate-C + Gate-D1 + Gate-P3 (manual).**
  - Word check: §5 480–560 AND `words(§5) ≥ every other section`.
  - **Gate-C:** delete §5 — the page must collapse to a flat plating walkthrough (steps with no organizing idea). If it survives as coherent, §5 is too weak.
  - **Gate-D1 (FIRST PRIORITY):** re-read §1–§5 — does every step resolve to growth DIRECTION? Any passage that explains a step but never returns to "where copper grows first" is padding — flag for refocus.
  - **Gate-P3 Principle Dominance:** delete the principle sentence — do the sections still converge on the direction story? They MUST (direction is the structure, not a slogan).

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): TSV Copper Fill §5 Fill-Front climax (Growth-Direction asset; Gate-C/D1/P3 + owns the chain)"`

## Task 3: §6 + §7 + FAQ/Related/CTA + FULL audit + Gate-E/F + Intent + Gate-Q1

- [ ] **Step 1: Dispatch subagent.** Append:
  - **§6 `<h2 id="failure-modes">6. Fill Failure Modes</h2>` (~270w):** the fill-SPECIFIC defects, each named at its growth cause (Gate-Q1: "what when growth starts in the wrong place?"): center seam (two sidewall fronts meet in the middle); top pinch-off void (mouth closes before the bottom fills); incomplete fill (the front stalls before the via is solid); seed-discontinuity void (a region the seed never covered could not grow). For each, name the GROWTH cause. SYSTEM-level reliability — what a buried void becomes in service (electromigration, copper pumping, fatigue, lifetime) — is deferred here in ONE clause + link `/insights/3d-packaging-reliability`. (This is the ONLY section where system-reliability terms may appear, and only as the deferral.)
  - **§7 `<h2 id="why-carries-forward">7. Why Fill Quality Carries Forward</h2>` (~190w):** the close — a void laid down at fill is invisible at the time; it stays buried until the via is thinned and the backside exposed (link `/insights/tsv-reveal` — the sibling step where a trapped void can surface) or until the part is in service (link `/insights/3d-packaging-reliability`). Fill is where via integrity is decided, silently. Restate the direction principle in fresh words. Link the parent (`/insights/through-silicon-vias-tsv-guide`) as the source of the via this fills.
  - **FAQ (4):**
    1. "What is TSV copper fill?" — filling the etched, lined via with copper (by electroplating) so it can carry signal. 2-3 sentences.
    2. "What is superfill / bottom-up fill?" — additive-driven plating that grows copper from the via bottom up, filling solid instead of pinching the top shut.
    3. "Why do TSV vias get voids?" — when copper grows conformally (sidewall-inward) the mouth closes before the bottom fills, trapping a void; the direction answer.
    4. "What is the difference between TSV fill and TSV reveal?" — fill is the FRONTSIDE step that puts copper into the via; reveal is the BACKSIDE step that later exposes the copper tip; link `/insights/tsv-reveal`.
  - **Related Articles** (parent TSV, TSV Reveal, DRIE, 3D packaging reliability, 16-Hi HBM) + CTA (`/contact`, ALD barrier/seed deposition capability for via-metallization flows — do NOT claim plating/ECD).

- [ ] **Step 2: FULL AUDIT** — every grep-table row; R-length 2,200–2,600 (over ~2,600 → trim §1/§2/§6, NEVER §5; under 2,200 → deepen §3/§5); §5-dominance; Gate-P1/P2/D1/Q1; Gate-Rx-Fill (system terms only in §6); CMP-disambig (backside/recess only in Reveal anchor); single figure; all 5 links by EXACT slug.

- [ ] **Step 3: Gate-E + Gate-F + Intent (human judgment):**
  - Gate-E: (1) cover title → still "bottom-up fill / the direction problem"; (2) remove figure → the direction argument stands in §5 prose; (3) delete §5 → collapses; (4) delete figure → the two-front contrast survives in §5 prose.
  - **Gate-F Reversal:** delete every fill/plating/superfill/direction term → the article must collapse into nonsense.
  - Intent audit: the reader leaves knowing fill is a DIRECTION problem (where copper grows first) — NOT a TSV overview (parent) and NOT a reliability story (Reliability hub).

- [ ] **Step 4: Commit** — `git commit -am "feat(insights): TSV Copper Fill §6-7 + FAQ/CTA + full audit + Gate-E/F"`

## Task 4: Figure prompts + cover-first gate (USER ACTION) — single asset

- [ ] **Step 1: Write `/tmp/tsv-copper-fill-figure-prompts.md`:**

**① COVER (approve first; 3:2 navy hero):** Ultra-high-res editorial cover, deep navy (#1e3a5f) gradient. Subject: a single through-silicon via cross-section, mid-fill, with bright copper rising from the BOTTOM upward as a clean, solid, void-free column (warm copper glow, upward motion). Beside or behind it, faint/ghosted, the rejected alternative: a conformal fill whose top has pinched shut around a dark trapped void in the center (desaturated, clearly the "wrong" path). A subtle upward arrow conveys growth direction. Convey "copper growing in the right direction." Cool blue silicon, warm copper, one ghosted failure. No people, no clutter. Text: header "NINESCROLLS · INSIGHTS", title "TSV Copper Fill", subtitle "Bottom-Up Electroplating Without Trapping a Void", footer "ninescrolls.com". Perfect spelling.

**② Fig A — Growth Direction Determines Fill Outcome (`growth-direction-determines-fill-outcome`, ~1100×850, white bg, brand palette) — THE climax, cluster asset family #6 (Growth-Direction):** TWO side-by-side via cross-sections sharing one title, contrasting GROWTH DIRECTION (the legible point — make the arrows the hero, not the labels):
  - LEFT — "CONFORMAL" (red/FAIL): copper thickening evenly on both sidewalls, ARROWS pointing INWARD from the walls toward the center; at the top, the mouth pinched closed; in the center, a dark trapped VOID / seam. Label "sidewall-inward → top pinch-off → trapped void".
  - RIGHT — "BOTTOM-UP SUPERFILL" (green/GOOD): copper rising from the base, ARROWS pointing UPWARD from the bottom; the via filled solid, no cavity. Label "bottom-up → void-free solid".
  Show 2–3 time-progression frames per side if it helps legibility (early → mid → filled), so the DIRECTION of the moving front is unmistakable. NO numbers. The figure must pass BOTH: (Two-Path Test) labels masked → reader still sees which traps a void; (Direction Legibility Test) the arrows make growth DIRECTION the point, not merely void-vs-no-void. Footer "ninescrolls.com · Growth Direction Determines Fill Outcome".

- [ ] **Step 2: GATE — user generates ① → approve → ②.** Then run BOTH figure tests on Fig A before accepting: **Two-Path Test** (mask CONFORMAL/SUPERFILL labels → reader still tells which traps a void) AND **Direction Legibility Test** (mask labels → the inward vs upward ARROWS still make growth direction the message; if only "void vs solid" reads, regenerate with stronger direction arrows). Cross-check the spine/labels against the article.

## Task 5: Import draft → upload → llms BEFORE publish → publish → verify

- [ ] **Step 1: One-shot `scripts/create-tsv-copper-fill-article.ts`** (NOT committed; FAIL-on-existing):

```typescript
/** One-shot: create TSV Copper Fill sub-page as draft. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });
const SLUG = 'tsv-copper-fill';
(async () => {
  await authenticate();
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  if (existing?.length) { console.error(`FAIL: slug exists, id=${(existing[0] as any).id}. Use an update one-shot.`); process.exit(1); }
  const { data, errors } = await client.models.InsightsPost.create({
    title: 'TSV Copper Fill: Bottom-Up Electroplating Without Trapping a Void',
    slug: SLUG,
    content: readFileSync('scripts/articles/tsv-copper-fill.html', 'utf-8'),
    excerpt: 'TSV copper fill — how bottom-up electroplating fills a high-aspect-ratio via without trapping a void: the seed, superfill additives, anneal, and frontside overburden CMP. Why fill is a direction problem, not a volume problem.',
    author: 'NineScrolls Engineering',
    publishDate: new Date().toISOString().slice(0, 10),
    category: 'Process Integration',
    readTime: 9,
    imageUrl: 'https://cdn.ninescrolls.com/insights/tsv-copper-fill/cover-lg',
    tags: ['TSV copper fill','via fill','TSV electroplating','superfill','bottom-up fill','through-silicon via','advanced packaging','3D integration'],
    relatedProducts: JSON.stringify([{ href: '/products/ald', label: 'ALD Systems', subtitle: 'Diffusion barrier and seed deposition for via metallization' }]) as any,
    isStandaloneComponent: false,
    isDraft: true,
  } as any);
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : `CREATED draft id=${(data as any).id}`);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Upload figures** (user paths): `--name cover` / `--name growth-direction-determines-fill-outcome --no-update-cover`, each via `AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts tsv-copper-fill <file> …`.

- [ ] **Step 3: PRE-PUBLISH internal-link slug check (MANDATORY, proactive).** Extract every `href="/insights/..."` from the article and verify each resolves to a REAL slug via `listInsightsPostBySlug` — especially the long HBM4 slug (truncated to broken `/insights/16-hi-hbm` in two prior Related sections). Fix any miss before publish.

- [ ] **Step 4: llms sync BEFORE publish.** `public/llms.txt` (AP section, after the TSV Reveal entry):

```markdown
- [TSV Copper Fill](https://ninescrolls.com/insights/tsv-copper-fill): How bottom-up electroplating fills a high-aspect-ratio via without trapping a void — the seed, superfill additives (accelerator/suppressor/leveler), anneal, and frontside overburden CMP. Why fill is a direction problem, not a volume problem: the copper must grow from the bottom up
```

`public/llms-full.txt` (after the TSV Reveal block):

```markdown
**TSV Copper Fill: Bottom-Up Electroplating Without Trapping a Void**
URL: https://ninescrolls.com/insights/tsv-copper-fill
Summary: The second sub-page of the TSV mini-hub — owns the copper-fill process by which an etched, lined via is filled with copper. Covers why filling is hard (a high-aspect-ratio via filled conformally pinches its mouth shut and traps a void), the seed (the conductive surface copper grows on), electroplating and the bottom-up problem (accelerator/suppressor/leveler additives bias growth so copper rises from the via bottom — superfill — instead of growing sidewall-inward), the anneal, and frontside overburden CMP. Climax: the Fill-Front — growth direction determines fill outcome; a sidewall-inward conformal front traps a void, a bottom-up superfill front fills solid. Principle: copper via fill is a direction problem, not a volume problem; the copper must grow from the bottom up or it seals a void inside. The mini-hub dual to TSV Reveal (Reveal = where do I stop?; Cu Fill = where does copper grow first?). Defers the TSV entity, anatomy, timing, and design rules to the TSV guide; the frontside via-formation etch to the DRIE guide; the backside reveal to TSV Reveal; system-level reliability (electromigration, copper pumping) to the 3D packaging reliability guide.
```

- [ ] **Step 5: Publish** (`update({id, isDraft:false})`) → verify DDB (title/slug/figure/principle) → CDN 200s (cover + figure lg.webp) → live render → `rm scripts/create-tsv-copper-fill-article.ts`.

## Task 6: Provenance + PR

- [ ] **Step 1:**

```bash
git add scripts/articles/tsv-copper-fill.html public/llms.txt public/llms-full.txt docs/superpowers/plans/2026-06-15-tsv-copper-fill.md
git commit -m "feat(insights): TSV Copper Fill (TSV mini-hub sub-page #2) + llms sync"
git push -u origin insights/tsv-copper-fill
gh pr create --title "feat(insights): TSV Copper Fill (TSV mini-hub sub-page #2, asset family #6 Growth-Direction)" --body "Second child of the TSV entity page — continues the TSV mini-hub (Reveal -> Cu Fill -> Interposer). Live at /insights/tsv-copper-fill; this PR carries provenance HTML, spec, plan, llms sync.

- **Owns the fill PROCESS only:** defers entity/anatomy/timing to the parent, the frontside etch to DRIE, the BACKSIDE reveal to TSV Reveal, system reliability to the Reliability hub. CMP disambiguated as FRONTSIDE overburden (vs Reveal's backside).
- **Climax = the Fill-Front** — the cluster's first **Growth-Direction asset (family #6)**: growth direction determines fill outcome (conformal -> trapped void vs bottom-up superfill -> solid). The direction-problem DUAL to Reveal's stopping-problem Window. Principle: 'fill is a direction problem, not a volume problem.'
- **New governance:** Gate-D1 Direction Dominance (every step resolves to growth direction) · Gate-Q1 Question Consistency · Gate-Rx-Fill (void is the subject; system reliability confined to S6) · Gate-P1/P2/P3 · Two-Path + Direction-Legibility figure tests · Gate-C/E/F.
- **Sub-page discipline:** ~2,400 words (tighter than the parent's 3,499), single asset.
- Phase-B1 makes the parent's SECOND hook word ('copper filling') a live link, and adds the Reveal<->Cu-Fill sibling edge.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Task 7: Phase-B1 Link Pass — mini-hub edges (one-shot NOT committed; EXACT-slug; NO B2)

- [ ] **Step 1: Fetch verbatim anchors** (read-only tsx): parent Future Hub Hook (the "copper filling" word in "The next design decisions — <a>TSV reveal</a>, copper filling, and bonding strategy — each deserve their own treatment." — note "TSV reveal" is already a link from the Reveal Phase-B; target the bare "copper filling"); parent §3 fill summary sentence ("Electroplated copper then fills the via from the bottom up, and an anneal stabilizes…"); TSV Reveal's mention of the via having been filled (a sentence in Reveal §1/§2 referencing the filled via — find a clean one).
- [ ] **Step 2: One-shot `scripts/tsv-fill-backlinks.ts`** — standard module (rx() tolerant find, exactly-one-match guard, **idempotency that tests for the NEW link `/insights/tsv-copper-fill` presence — NOT a prefix that overlaps the unchanged original**, --dry-run). THREE edits:
  1. **parent Future Hub Hook → make "copper filling" a live link** (the SECOND hook word; extends the mini-hub root). Replace the bare `copper filling` inside the hook sentence with `<a href="/insights/tsv-copper-fill">copper filling</a>` (match the hook sentence; the "TSV reveal" link already present must be preserved).
  2. **parent §3 fill summary** → append a link: "…CMP strips the copper overburden back to a flat surface (the fill process itself is covered in <a href=\"/insights/tsv-copper-fill\">TSV Copper Fill</a>)."
  3. **TSV Reveal → Cu Fill sibling link** at Reveal's filled-via mention: append "(how that copper got in is covered in <a href=\"/insights/tsv-copper-fill\">TSV Copper Fill</a>)".
- [ ] **Step 3: dry-run → apply → verify with EXACT-slug checks** (parent → tsv-copper-fill exactly 2; Reveal → tsv-copper-fill exactly 1; Cu Fill page → all 5 targets by EXACT slug) → `rm scripts/tsv-fill-backlinks.ts`. **NO B2.**

## Task 8: Memory + wrap

- [ ] **Step 1: Update `memory/seo_strategy.md`:** TSV Copper Fill PUBLISHED (slug/id/PR#); **TSV mini-hub = 2 children (Reveal + Cu Fill); AP cluster = 11 pages.** **NEW ASSET FAMILY #6: Growth-Direction** (two-front contrast: conformal sidewall-inward → trapped void vs bottom-up superfill → solid; principle "fill is a direction problem, not a volume problem"; figure title "Growth Direction Determines Fill Outcome"). **The Reveal↔Cu-Fill DUAL is now live:** Reveal = "where do I stop?" (Process-Window) · Cu Fill = "where does copper grow first?" (Growth-Direction) — two different cognitive frames, two different asset shapes, the mini-hub's signature. **The parent's BOTH Future-Hub-Hook words are now live links** (TSV reveal + copper filling) — the mini-hub root is real. **New governance added to the template: Gate-D1 Direction Dominance (every step resolves to growth direction — FIRST priority for Growth-Direction pages) · Gate-Q1 Question Consistency (every H2 answers part of the page's core question; orthogonal to D1) · Gate-Rx-Fill (when the defect IS the subject — void allowed in body, SYSTEM reliability confined to §6) · Two-Path + Direction-Legibility figure tests.** CMP disambiguation pattern (frontside overburden vs backside reveal — grep `backside`/`recess` = 0 outside the sibling anchor) reusable wherever sibling pages share a process word. Sub-page discipline held: single asset, ~2,400w. relatedProducts=ald (no ECD product; prose in-lane). Phase-B1 done (parent hook + parent §3 + Reveal sibling → Cu Fill; EXACT-slug). Next TSV sub-page: **Interposer (mini-hub #3, the architecture-layer one — Gate 0.5 must be careful vs HBM4 + W2W; likely a DIFFERENT asset shape again, not a process page).** **⏳ STILL PENDING: TSV Phase-B2 DRIE edit ~2026-06-18** + **~early-July GSC remeasure** (RIE Phase-2 persistence + new AP pages indexing + DRIE-rose-after-TSV signal — the mini-hub internal density is now higher, signal should sharpen).
- [ ] **Step 2: Report** with live URL + PR + verification evidence.

---

## Self-review

- **Spec coverage:** metadata + ald relatedProducts ✓ (T5); lead + triple defer ✓ (T1); §1 direction-not-volume ✓; §2 seed→starting-surface→direction ✓; §3 growth-direction core ✓; §4 anneal + FRONTSIDE overburden CMP + disambig ✓ (T1); §5 Fill-Front climax + 2-part principle + owns-chain ✓ (T2); §6 fill-modes + system-reliability deferral ✓; §7 close ✓ (T3); Gate-P1/P2/D1/Q1 + Gate-Rx-Fill ✓ (grep table + per-task checks); §5-dominance ✓; Two-Path + Direction-Legibility tests ✓ (T4); single asset ✓; llms-before-publish + PRE-PUBLISH slug check ✓ (T5); Phase-B1 mini-hub edges + EXACT-slug + corrected idempotency ✓ (T7); memory incl. asset-family-#6 + dual + Interposer-next + TSV-B2/GSC reminders ✓ (T8).
- **Marker mechanics:** tasks append to EOF in section order. Final H2 order: 1–7 + FAQ — T3 audit verifies.
- **Consistency:** slug + figure prefix (`cover`, `growth-direction-determines-fill-outcome`) identical across blocks (T2), prompts (T4), uploads (T5).
- **Placeholder scan:** image paths user-provided at gate time; all else concrete.
