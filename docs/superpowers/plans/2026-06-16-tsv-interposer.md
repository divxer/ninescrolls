# TSV Interposer (TSV mini-hub sub-page #3 — CLOSES the mini-hub) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the TSV mini-hub's third and final child — "TSV Interposer: The Silicon Routing Layer Between Dies and Package" (slug `tsv-interposer`) — owning the interposer as a TSV-bearing lateral-routing structure, with the Same-TSV-Opposite-Job fork (the cluster's first Role-Contrast asset, family #7) as the dominant climax (§4), and wire the parent→Interposer edge that closes the TSV mini-hub (parent → all 3 children).

**Architecture:** The standard 9th-run sub-page pipeline, but this is an ARCHITECTURE page (not a process page): NO process chain, so Gate-P1/P2/D1 do NOT apply. Governance is Gate-T1/T1b TSV-Anchor (every section must collapse if its TSV references are removed). Sequential subagents draft into provenance HTML with rule-greps between tasks (R1/R3b + Gate-T1/T1b + §4-dominance + §4-ordering), Gate-C after §4, Gate-E + Gate-F + Intent + Two-Job/Direction-Legibility/Family figure tests at completion, cover-first single-asset figure gate, llms sync BEFORE publish, one-shot DDB scripts NOT committed, Phase-B1 only with EXACT-slug verification.

**Tech Stack:** HTML article fragments (house style = `scripts/articles/tsv-copper-fill.html`), TypeScript + tsx one-shots against Amplify Data, `upload-insights-image.ts` with `AWS_PROFILE=ninescrolls`.

**Spec:** `docs/superpowers/specs/2026-06-16-tsv-interposer-design.md`
**Branch:** `insights/tsv-interposer` (current; spec committed)
**Env for DDB scripts:** `set -a; . ./.env; set +a` then `npx tsx <script>`

---

## Locked metadata

- **Title (H1):** `TSV Interposer: The Silicon Routing Layer Between Dies and Package`
- **Slug:** `tsv-interposer`
- **Excerpt:** `A silicon interposer is the routing layer between side-by-side dies and the package — and its TSVs do the opposite job of a 3D stack's. How the same through-silicon via enables both vertical stacking (3D) and lateral routing (2.5D).`
- **Category:** `Process Integration` · **readTime:** 9 · **author:** `NineScrolls Engineering` · **publishDate:** date of publish
- **Tags:** `["silicon interposer","TSV interposer","2.5D packaging","2.5D integration","interposer routing","through-silicon via","advanced packaging","chiplet"]`
- **relatedProducts:** `JSON.stringify([{href:"/products/icp-etcher",label:"ICP Etching Systems",subtitle:"Deep-silicon etch for interposer TSV formation"}])`
- **Schema gotchas:** NO `lastModifiedDate`; `relatedProducts` is `a.json()` → `JSON.stringify`; FAIL-on-existing create with explicit slug.

## Rule → grep table (f = `scripts/articles/tsv-interposer.html`)

| Rule | Check |
|---|---|
| Principle (structural, not exact-phrase) | a `<blockquote>` exists inside §4 AND §4 contains all of `vertical`, `lateral`, and `TSV`/`via` — i.e. the role-contrast is stated. (Do NOT CI-gate on the exact sentence; copy edits must not break the build.) For the §4-ordering check, anchor on a stable token: first `<blockquote` offset OR first `lateral` offset < first `GPU`/`HBM`/`chiplet` offset. |
| Intuition-breaker | `grep -c "to do the opposite" f` ≥1 (§4 opener) |
| **§4 dominance** | `awk` word counts: **words(§4) ≥ every other section** (the real rule). Soft band 420–650 (not a hard CI gate — dominance is what matters, not 500±40). |
| **§4 ordering** | first offset of the §4 `<blockquote>` (the principle) < first offset of `GPU`/`HBM`/`chiplet` in the file (principle precedes any application — anchor on the blockquote, not an exact phrase) |
| **Gate-T1 TSV-anchor** | each of §1–§6: `grep -ic "via\|TSV\|vertical conductor"` ≥1 in the section |
| **R3b leak-ban** | `grep -ocE "\\b(HBM3E?\|HBM[45]\|NVIDIA\|AMD)\\b" f` ≤ 2; `wafer-to-wafer`/`die-to-wafer`/`known-good` only inside `<a>…</a>` (W2W defer); parent's design-rule numbers (`10 &micro;m`, `50&ndash;100`, "large, sparse") NOT present |
| **§5 caps** | §5 total ≤200w; per-app (HBM / chiplet / CoWoS) ≤70w each |
| R-length | total 2,200–2,600 (UPPER HARD LIMIT ~2,600) |
| Hedge | `grep -icE "\\b(always\|never\|completely)\\b" f` near claims == 0 |
| Figures | exactly 1 `same-tsv-opposite-job` figure block; NO second inline figure |
| Links | each ≥1 (EXACT slugs): `through-silicon-vias-tsv-guide`, `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges`, `wafer-to-wafer-vs-die-to-wafer`, `3d-packaging-reliability` |

**Cluster link targets (EXACT slugs):** parent `through-silicon-vias-tsv-guide` · HBM4 `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges` · W2W `wafer-to-wafer-vs-die-to-wafer` · Reliability `3d-packaging-reliability` · (siblings `tsv-reveal` / `tsv-copper-fill` if natural).

---

## Task 1: Scaffold + lead + §1 + §2 + §3 (each section TSV-anchored; NO substrate deep-comparison)

- [ ] **Step 1: Dispatch subagent.** House style: read `scripts/articles/tsv-copper-fill.html` (sibling sub-page). Create `scripts/articles/tsv-interposer.html`:
  - **Lead (~100w):** the cognitive hook — you have met the through-silicon via as a way to STACK chips vertically; a silicon interposer uses the very same structure to do the opposite job — to spread chips out and route them sideways. Quadruple defer: the TSV entity, via-timing, and interposer-TSV dimensions → parent (link `/insights/through-silicon-vias-tsv-guide`); the HBM application → HBM4 (link `/insights/from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges`); the chiplet bonding-format choice → W2W (link `/insights/wafer-to-wafer-vs-die-to-wafer`); large-interposer warpage → Reliability (link `/insights/3d-packaging-reliability`). State the spine: same TSV, opposite architectural job.
  - **§1 `<h2 id="what-is">1. What Is a Silicon Interposer?</h2>` (~250w):** a thin silicon layer that sits BETWEEN the dies and the package substrate — a "silicon circuit board" carrying fine redistribution-layer (RDL) routing on its surface, plus its OWN through-silicon vias punching down through it. Frame it as a TSV-bearing routing layer (Gate-T1: the via is what makes it more than a passive board). Do NOT re-derive the parent's interposer-TSV dimensions.
  - **§2 `<h2 id="why-silicon">2. Why 2.5D Needs a Separate Silicon Layer</h2>` (~260w):** chiplets placed side-by-side must exchange enormous numbers of connections at a line/space density an organic package substrate cannot reach; a silicon layer can be patterned at near-on-chip density, so it becomes the high-density bridge between neighbors. **HARD LIMIT (§2 substrate-comparison ban): one or two sentences on the organic-substrate density ceiling → therefore a silicon layer; do NOT build an RDL-pitch table, signal-integrity / power-delivery deep-dive, or platform comparison — that drifts into a "Why CoWoS Exists" page.** Keep TSV-anchored: the silicon layer needs its own vias to get all that routing down to the package (Gate-T1).
  - **§3 `<h2 id="different-job">3. The Interposer's TSVs: A Different Job</h2>` (~280w):** the owned TSV-role core. In a 3D stack, a die's TSVs connect one die UP to the next — vertical integration. In an interposer, the TSVs do something different: the chips do not sit on top of each other, they sit side-by-side and talk through the RDL on the interposer's surface; the interposer's TSVs then carry that lateral routing layer DOWN through the silicon to the package's C4 bumps. Same vertical copper conductor, a lateral-routing purpose. Do NOT re-derive the parent's dimensions (large/sparse). End by handing to §4: same structure, opposite job. (Gate-T1b: this section must collapse if the TSV references are removed.)
  - Rules: R3b (HBM-generational/NVIDIA/AMD ≤2; no parent design-rule numbers; bonding-format terms only as the W2W anchor); Gate-T1 (each section TSV-anchored); §2 substrate-comparison ban. Never `--no-verify`.

- [ ] **Step 2: Rule-grep** (Gate-T1: §1/§2/§3 each have via/TSV ≥1; R3b HBM-gen ≤2; no "10 µm"/"50–100"/"large, sparse" design-rule numbers; §2 has no RDL-pitch table; parent+HBM4+W2W links present; §1-3 ≈ 790w).

- [ ] **Step 3: Commit** — `git add scripts/articles/tsv-interposer.html && git commit -m "feat(insights): TSV Interposer scaffold + §1-3 (TSV-anchored; no substrate deep-comparison)"`

## Task 2: §4 Same TSV, Opposite Job (CLIMAX, Role-Contrast asset) + Gate-C + ordering

- [ ] **Step 1: Dispatch subagent.** Append §4 `<h2 id="opposite-job">4. Same TSV, Opposite Job: 2.5D vs 3D</h2>` (460–540w):
  - OPEN with the intuition-breaker (plain `<p>`): **You have met the TSV as a way to stack chips. The interposer uses the very same structure to do the opposite — to spread chips out.**
  - Then the principle pull-quote (house blockquote markup):
    ```html
    <blockquote style="border-left:4px solid #2563eb;background:#eff6ff;padding:16px 20px;margin:24px 0;font-size:1.1em;">
      <p style="margin:0;"><strong>Same vertical conductor, opposite architectural job: in 3D the TSV stacks dies upward; in 2.5D the interposer's TSVs carry a lateral routing layer down to the package.</strong></p>
    </blockquote>
    ```
  - The two architectural jobs as the central contrast (the asset in prose):
    - **3D — vertical stacking:** dies sit on top of one another; each die's TSVs are the vertical spine threading the signal and power straight up through the stack. The direction is UP.
    - **2.5D — lateral routing:** dies sit side-by-side on the interposer; they talk horizontally across its RDL, and the interposer's TSVs carry that horizontal layer straight DOWN to the package. The direction is SIDEWAYS-then-DOWN.
    - State plainly: it is the SAME through-silicon via — a vertical copper conductor through thinned silicon — doing two opposite architectural jobs depending on whether the silicon it threads is a die in a stack or a routing layer under a row of chips.
  - **ORDERING RULE:** the principle and this contrast MUST be fully stated BEFORE any GPU/HBM/chiplet application example (those belong to §5). Do not name a product application in §4.
  - Include the figure block (prefix `same-tsv-opposite-job`, base `https://cdn.ninescrolls.com/insights/tsv-interposer/`, standard `<picture>`); figcaption short variant ("Same TSV, opposite job: a vertical spine that stacks dies in 3D, or a lateral bridge whose vias route a routing layer down to the package in 2.5D."), NOT the full pull-quote.
  - One how-to-read sentence after the figure (about reading the vertical-vs-lateral direction).

- [ ] **Step 2: §4-dominance grep + §4-ordering grep + Gate-C (manual).**
  - Word check: §4 in the soft band 420–650 AND (the hard rule) `words(§4) ≥ every other section`.
  - **§4 principle present (structural):** §4 contains a `<blockquote>` AND the words `vertical` + `lateral` + (`TSV` or `via`) — do not gate on the exact sentence.
  - **§4-ordering:** first offset of the §4 `<blockquote>` < first offset of `GPU`/`HBM`/`chiplet` in the file.
  - **Gate-C:** delete §4 — the page must collapse to a generic "what is an interposer" explainer with no owned insight. If it survives as coherent, §4 is too weak — the same-TSV-opposite-job thesis must be what makes the page worth existing.

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): TSV Interposer §4 Same-TSV-Opposite-Job climax (Role-Contrast asset; Gate-C + ordering)"`

## Task 3: §5 + §6 + §7 + FAQ/Related/CTA + FULL audit + Gate-E/F/T1b + Intent

- [ ] **Step 1: Dispatch subagent.** Append:
  - **§5 `<h2 id="where-fits">5. Where the Interposer Fits</h2>` (≤200w TOTAL):** a POSITIONING section, not an application catalog. One framing sentence: the interposer sits between the dies and the package, wherever side-by-side chips need to talk faster than a substrate allows. Then three brief applications, **each ≤70w, link out, do NOT explain WHY**: HBM placed next to a logic die (link HBM4); chiplet designs routed across one interposer (link W2W for how those chiplets are assembled); CoWoS-style 2.5D as the productized form. Prove it is used; nothing more. (Gate-T1: each application names the interposer's routing/TSV role.)
  - **§6 `<h2 id="why-not-substrate">6. Why Not Route Directly in the Package?</h2>` (~240w):** the missing why-pay-for-silicon logic. The honest question: a silicon interposer is a large, expensive piece of silicon with its own TSVs — why not just route in the package substrate? Because the organic substrate hits a line-density ceiling that side-by-side high-bandwidth dies blow straight past; silicon can be patterned far finer. Under that one question, gather the costs the industry tolerates to get that density: the added cost of a silicon layer and its TSVs (cost-chain → parent link), the reticle-size limit that caps interposer area (and stitching to exceed it), and large-area warpage (defer the warpage MECHANISM to Reliability — link `/insights/3d-packaging-reliability`). The point: the density is worth the silicon. (Gate-T1: tie to the TSVs the interposer must add.)
  - **§7 `<h2 id="completes">7. The Interposer Completes the Picture</h2>` (~180w):** the close — the through-silicon via is not only a tool for stacking; in the interposer it becomes the routing backbone of a whole 2.5D system. Restate the same-TSV-opposite-job insight in fresh words. Tie the mini-hub triad: the via's depth (how far to reveal it — link `/insights/tsv-reveal`), its fill (which way the copper grows — link `/insights/tsv-copper-fill`), and now its architectural role (where the chips sit). Link the parent (`/insights/through-silicon-vias-tsv-guide`).
  - **FAQ (4):**
    1. "What is a silicon interposer?" — a silicon routing layer between side-by-side dies and the package, with its own TSVs. 2-3 sentences.
    2. "What is the difference between 2.5D and 3D packaging?" — 3D stacks dies vertically (die TSVs go up); 2.5D places dies side-by-side on an interposer that routes them laterally (interposer TSVs go down). The same-TSV-opposite-job answer.
    3. "Why use a silicon interposer instead of the package substrate?" — the organic substrate can't reach the routing density side-by-side high-bandwidth dies need; silicon can.
    4. "Does an interposer have TSVs?" — yes; the interposer's TSVs carry its surface routing down to the package — a different job from a 3D stack's die TSVs; link parent.
  - **Related Articles** (parent TSV, TSV Reveal, TSV Copper Fill, 16-Hi HBM [FULL slug], W2W) + CTA (`/contact`, deep-silicon etch capability for interposer TSV formation — in-lane).

- [ ] **Step 2: FULL AUDIT** — every grep-table row; R-length 2,200–2,600 (over → trim §1/§2/§5, NEVER §4; under → deepen §3/§4); §4-dominance; §4-ordering (principle before any GPU/HBM/chiplet); Gate-T1 (each §1–§6 TSV-anchored); §5 caps (≤200 total, ≤70 each); R3b (HBM-gen ≤2, no parent design-rule numbers); single figure; all links EXACT slug.

- [ ] **Step 3: Gate-E + Gate-F + Gate-T1b + Intent (human judgment):**
  - Gate-E: (1) cover title → still "interposer / same-TSV-opposite-job"; (2) remove figure → the contrast stands in §4 prose; (3) delete §4 → collapses; (4) delete figure → the two-job contrast survives in §4 prose.
  - **Gate-F Reversal:** delete every interposer/2.5D/lateral/vertical term → the article must collapse into nonsense.
  - **Gate-T1b Remove-TSV Test (per §1–§6):** mentally strip ALL via/TSV/vertical-conductor references from each section — if any section still reads coherently (i.e. it's really about HBM/chiplet/CoWoS architecture, not the TSV interposer), it has drifted: rewrite to re-anchor on the TSV, so removing the TSV collapses it.
  - Intent audit: the reader leaves understanding the SAME-TSV-OPPOSITE-JOB insight (a TSV cognitive page), NOT a 2.5D architecture survey.

- [ ] **Step 4: Commit** — `git commit -am "feat(insights): TSV Interposer §5-7 + FAQ/CTA + full audit + Gate-E/F/T1b"`

## Task 4: Figure prompts + cover-first gate (USER ACTION) — single asset

- [ ] **Step 1: Write `/tmp/tsv-interposer-figure-prompts.md`:**

**① COVER (approve first; 3:2 navy hero):** Ultra-high-res editorial cover, deep navy (#1e3a5f) gradient. Subject: a single luminous copper through-silicon via at the CENTER, glowing, that morphs to the LEFT into a vertical stacking spine (a short tower of dies threaded by the via, an UP glow) and to the RIGHT into a lateral routing bridge (two dies sitting side-by-side on a silicon interposer, a sideways routing glow with the via carrying it down). Convey "one conductor, two jobs." Cool electric-blue silicon, warm copper via, directional light (up on the left, sideways on the right). No people, no clutter. Text: header "NINESCROLLS · INSIGHTS", title "TSV Interposer", subtitle "The Silicon Routing Layer Between Dies and Package", footer "ninescrolls.com". Perfect spelling.

**② Fig A — Same TSV, Opposite Job (`same-tsv-opposite-job`, ~1150×850, white bg, brand palette) — THE climax, cluster asset family #7 (Role-Contrast):** a FORK. At the TOP-CENTER, ONE labeled copper through-silicon via (a vertical copper conductor through silicon). An arrow/branch splits it into TWO panels showing the same via doing opposite jobs — the DIRECTION arrows are the hero:
  - LEFT panel — "3D IC — VERTICAL STACKING": dies stacked on top of one another, the TSV the vertical spine threading straight up through them; bold UP arrows. Caption: "the TSV stacks dies upward".
  - RIGHT panel — "2.5D INTERPOSER — LATERAL ROUTING": two dies sitting side-by-side on a silicon interposer, an RDL routing line connecting them across the top (sideways arrow), and the interposer's TSVs carrying that routing straight DOWN to the package below (down arrows). Caption: "the interposer's TSVs route a lateral layer down".
  Title across the top: "Same TSV, Opposite Job". The shared origin (one via at top) MUST be visually obvious — it is one component forking into two jobs. NO numbers. Footer "ninescrolls.com · Same TSV, Opposite Job".

  THREE tests after generation (regenerate if any fails): **Two-Job Test** (mask LEFT/RIGHT labels → reader still sees ONE via doing TWO jobs); **Direction Legibility Test** (mask labels → the up-spine vs sideways-then-down arrows make the vertical-vs-lateral contrast the point, not "two packages"); **Family Test** (mask title+body → it reads as a FORK "one component → two jobs", NOT a Process-Window band or a Growth-Direction two-front; if it reads as either, regenerate).

- [ ] **Step 2: GATE — user generates ① → approve → ②.** Run the three figure tests before accepting. Cross-check the panel labels against §4.

## Task 5: Import draft → upload → PRE-PUBLISH slug check → llms BEFORE publish → publish → verify

- [ ] **Step 1: One-shot `scripts/create-tsv-interposer-article.ts`** (NOT committed; FAIL-on-existing):

```typescript
/** One-shot: create TSV Interposer sub-page as draft. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });
const SLUG = 'tsv-interposer';
(async () => {
  await authenticate();
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  if (existing?.length) { console.error(`FAIL: slug exists, id=${(existing[0] as any).id}. This create one-shot is first-publish only.`); process.exit(1); }
  const { data, errors } = await client.models.InsightsPost.create({
    title: 'TSV Interposer: The Silicon Routing Layer Between Dies and Package',
    slug: SLUG,
    content: readFileSync('scripts/articles/tsv-interposer.html', 'utf-8'),
    excerpt: "A silicon interposer is the routing layer between side-by-side dies and the package — and its TSVs do the opposite job of a 3D stack's. How the same through-silicon via enables both vertical stacking (3D) and lateral routing (2.5D).",
    author: 'NineScrolls Engineering',
    publishDate: new Date().toISOString().slice(0, 10),
    category: 'Process Integration',
    readTime: 9,
    imageUrl: 'https://cdn.ninescrolls.com/insights/tsv-interposer/cover-lg',
    tags: ['silicon interposer','TSV interposer','2.5D packaging','2.5D integration','interposer routing','through-silicon via','advanced packaging','chiplet'],
    relatedProducts: JSON.stringify([{ href: '/products/icp-etcher', label: 'ICP Etching Systems', subtitle: 'Deep-silicon etch for interposer TSV formation' }]) as any,
    isStandaloneComponent: false,
    isDraft: true,
  } as any);
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : `CREATED draft id=${(data as any).id}`);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Upload figures** (user paths): `--name cover` / `--name same-tsv-opposite-job --no-update-cover`, each via `AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts tsv-interposer <file> …`.

- [ ] **Step 3: PRE-PUBLISH internal-link slug check (MANDATORY, proactive).** Extract every `href="/insights/..."` from the article and verify each resolves to a REAL slug via `listInsightsPostBySlug` — especially the long HBM4 slug (truncated to broken `/insights/16-hi-hbm` in prior Related sections). Fix any miss before publish.

- [ ] **Step 4: llms sync BEFORE publish.** `public/llms.txt` (AP section, after the TSV Copper Fill entry):

```markdown
- [TSV Interposer](https://ninescrolls.com/insights/tsv-interposer): The silicon routing layer between side-by-side dies and the package — what a silicon interposer is, why 2.5D needs a separate silicon layer, and how the same through-silicon via does the opposite job in 3D (vertical stacking) versus 2.5D (lateral routing)
```

`public/llms-full.txt` (after the TSV Copper Fill block):

```markdown
**TSV Interposer: The Silicon Routing Layer Between Dies and Package**
URL: https://ninescrolls.com/insights/tsv-interposer
Summary: The third sub-page of the TSV mini-hub (closing it) — owns the interposer as a TSV-bearing lateral-routing structure. Covers what a silicon interposer is (a silicon routing layer between side-by-side dies and the package, carrying fine RDL routing plus its own TSVs), why 2.5D needs a separate silicon layer (chiplets side-by-side need a line/space density organic substrates cannot reach), and the owned insight — the interposer's TSVs do the OPPOSITE job of a 3D stack's. Climax: Same TSV, Opposite Job — same vertical conductor, opposite architectural job; in 3D the TSV stacks dies upward, in 2.5D the interposer's TSVs carry a lateral routing layer down to the package. Also: where the interposer fits (HBM-next-to-GPU, chiplet routing, CoWoS-style 2.5D) and why route in silicon rather than the package substrate (the density ceiling worth the silicon). The mini-hub triad with TSV Reveal (depth) and TSV Copper Fill (direction): the interposer owns space — vertical vs lateral. Defers the TSV entity, timing, and dimensions to the TSV guide; the HBM product narrative to the 16-Hi HBM article; the chiplet bonding-format choice to Wafer-to-Wafer vs Die-to-Wafer; system-level reliability to the 3D packaging reliability guide.
```

- [ ] **Step 5: Publish** (`update({id, isDraft:false})`) → verify DDB (title/slug/figure/principle) → CDN 200s (cover + figure lg.webp) → live render → `rm scripts/create-tsv-interposer-article.ts`.

**Post-publish edits / corrections (typo, content, added figure):** the create one-shot FAILS-on-existing by design. To edit a LIVE article, write a small `update`-by-slug one-shot (look up the id via `listInsightsPostBySlug`, then `client.models.InsightsPost.update({ id, content: readFileSync(...) })`); NOT committed; same EXACT-slug + pre-publish-link-check discipline. This is the standard path for the review-polish round that follows every publish.

## Task 6: Provenance + PR

- [ ] **Step 1:**

```bash
git add scripts/articles/tsv-interposer.html public/llms.txt public/llms-full.txt docs/superpowers/plans/2026-06-16-tsv-interposer.md
git commit -m "feat(insights): TSV Interposer (TSV mini-hub sub-page #3, closes the mini-hub) + llms sync"
git push -u origin insights/tsv-interposer
gh pr create --title "feat(insights): TSV Interposer (TSV mini-hub sub-page #3, asset family #7 Role-Contrast — closes the mini-hub)" --body "Third and final child of the TSV entity page — CLOSES the TSV mini-hub (parent now links all three children: Reveal, Cu Fill, Interposer). Live at /insights/tsv-interposer; provenance HTML, spec, plan, llms sync in this diff.

- **Owns** the interposer as a TSV-bearing lateral-routing structure; defers entity/dimensions to the parent, the HBM narrative to HBM4, the chiplet bonding-format to W2W, system reliability to the Reliability hub.
- **Climax = Same TSV, Opposite Job** — the cluster's first **Role-Contrast asset (family #7)**: one through-silicon via forking into vertical stacking (3D) vs lateral routing (2.5D). Principle: 'Same vertical conductor, opposite architectural job.'
- **Architecture-page governance (new):** Gate-T1 TSV-Anchor + Gate-T1b Remove-TSV Test (delete the TSV → each section must collapse) — the guard against drift into HBM4/CoWoS territory. Plus §4-dominance, §4-ordering (principle before any application), §2 substrate-comparison ban, §5 hard caps, Two-Job + Direction-Legibility + Family figure tests, Gate-C/E/F. All internal links DDB-verified by exact slug.
- **Mini-hub triad complete:** Reveal (depth) · Cu Fill (direction) · Interposer (space).
- **Closes AP cluster phase-2** (entity → mini-hub). Next move: the early-July GSC remeasure.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Task 7: Phase-B1 Link Pass — CLOSE the mini-hub (one-shot NOT committed; EXACT-slug; NO B2)

- [ ] **Step 1: Fetch verbatim anchors** (read-only tsx): parent §1 interposer sentence ("In 2.5D integration, an interposer routes thousands of connections between chiplets sitting side by side"); an HBM4 interposer mention (a clean sentence naming the silicon interposer).
- [ ] **Step 2: One-shot `scripts/tsv-interposer-backlinks.ts`** — standard module (rx() tolerant find, exactly-one-match guard, **idempotency that tests for the NEW link `/insights/tsv-interposer` presence — NOT a prefix overlapping the unchanged original**, --dry-run). TWO edits (+ optional 3rd):
  1. **parent §1 → Interposer edge (CLOSES the mini-hub):** after the "chiplets sitting side by side" clause, add `(the interposer itself is covered in <a href="/insights/tsv-interposer">TSV Interposer</a>)`. This completes parent → all three children.
  2. **HBM4 → Interposer:** at an HBM4 silicon-interposer mention, append a link to `/insights/tsv-interposer`.
  3. *(optional, only if a clean anchor exists)* a light Reveal or Cu-Fill → Interposer sibling note.
- [ ] **Step 3: dry-run → apply → verify EXACT-slug** — (a) parent → tsv-interposer ≥1; (b) HBM4 → tsv-interposer 1; (c) parent now links all 3 children: grep parent for `/insights/tsv-reveal`, `/insights/tsv-copper-fill`, `/insights/tsv-interposer` — each ≥1; (d) **child→parent backlink: the Interposer page links back to `/insights/through-silicon-vias-tsv-guide` ≥1** (guards against a child that links out to HBM/W2W/Reliability but forgets its own parent). → `rm scripts/tsv-interposer-backlinks.ts`. **NO B2.**

## Task 8: Memory + wrap

- [ ] **Step 1: Update `memory/seo_strategy.md`:** TSV Interposer PUBLISHED (slug/id/PR#); **TSV mini-hub COMPLETE — 3 children (Reveal/depth · Cu Fill/direction · Interposer/space); the parent now forward-links all three.** **AP cluster = 12 pages.** **NEW ASSET FAMILY #7: Role-Contrast** ("one component, two jobs" — a fork; here: the same TSV doing vertical stacking in 3D vs lateral routing in 2.5D; principle "Same vertical conductor, opposite architectural job"). The cluster now has SEVEN distinct climax-asset families. **Architecture-page governance added to the template (for non-process sub-pages): Gate-T1 TSV-Anchor (each section connects to the page's central component) + Gate-T1b Remove-TSV Test (delete the central component's references → the section must collapse, else it belongs to a neighbor page) + §4-ordering rule (the owned principle must precede any application example, so the page is filed as a cognitive page not an application page) + the §2 substrate-comparison ban + Family figure test.** This Gate-T1/T1b pattern generalizes: for ANY sub-page at risk of being absorbed by a higher-traffic neighbor, anchor every section on the owned component and test by deletion. **AP cluster PHASE-2 (entity → mini-hub) BUILD-OUT IS DONE.** The right next move is the **early-July GSC remeasure** (RIE Phase-2 persistence + all new AP/mini-hub pages indexing + the DRIE-rose-after-TSV signal — now at maximum internal-link density), NOT more articles. **⏳ STILL PENDING: TSV Phase-B2 DRIE edit ~2026-06-18** (`scripts/tsv-backlinks.ts --b2`; verify DRIE title/H2 byte-identical).
- [ ] **Step 2: Report** with live URL + PR + verification evidence + the mini-hub-complete milestone.

---

## Self-review

- **Spec coverage:** metadata + icp-etcher ✓ (T5); lead + quadruple defer ✓ (T1); §1 what-is + TSV-anchor ✓; §2 why-silicon + substrate-ban ✓; §3 TSV-role core ✓ (T1); §4 climax 460–540 + intuition-breaker + principle + ordering + Role-Contrast asset ✓ (T2); §5 ≤200 caps ✓; §6 why-not-substrate ✓; §7 mini-hub-triad close ✓ (T3); Gate-T1/T1b + §4-dominance + §4-ordering ✓ (grep table + per-task); Two-Job/Direction/Family figure tests ✓ (T4); single asset ✓; PRE-PUBLISH slug check + llms-before-publish ✓ (T5); Phase-B1 closes-mini-hub + EXACT-slug + corrected idempotency ✓ (T7); memory incl. family-#7 + Gate-T1/T1b + phase-2-done + GSC-next + TSV-B2 ✓ (T8).
- **Marker mechanics:** tasks append to EOF in section order. Final H2 order: 1–7 + FAQ — T3 audit verifies.
- **Consistency:** slug + figure prefix (`cover`, `same-tsv-opposite-job`) identical across blocks (T2), prompts (T4), uploads (T5).
- **Placeholder scan:** image paths user-provided at gate time; the create-script excerpt apostrophe-escape flagged in T5; all else concrete.
