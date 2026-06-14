# Reliability Challenges in High-Density 3D Packaging (AP spoke #8 / Reliability Hub) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the AP cluster's Reliability Hub — "Reliability Challenges in High-Density 3D Packaging" (slug `3d-packaging-reliability`) — owning failure MECHANISMS (why stacks fail), with the Reliability Trade-Off Matrix ("add X → what worsens") as the dominant climax (§6) and a demoted Stress-Cascade map (§2).

**Architecture:** The standard 6th-run pipeline (TSV/W2W/TB precedent): sequential subagents draft into provenance HTML with rule-greps between tasks (R1 + the six mechanism gates R1-R5 + §6-dominance grep), Gate-C after §6, Gate-E + Gate-F + Intent + the three matrix tests at completion, cover-first figure gate, llms sync BEFORE publish, one-shot DDB scripts NOT committed, Phase-B1 only.

**Tech Stack:** HTML article fragments (house style = `scripts/articles/temporary-wafer-bonding-debonding.html`), TypeScript + tsx one-shots against Amplify Data, `upload-insights-image.ts` with `AWS_PROFILE=ninescrolls`.

**Spec:** `docs/superpowers/specs/2026-06-14-3d-packaging-reliability-design.md`
**Branch:** `insights/3d-packaging-reliability` (current; spec committed)
**Env for DDB scripts:** `set -a; . ./.env; set +a` then `npx tsx <script>`

---

## Locked metadata

- **Title:** `Reliability Challenges in High-Density 3D Packaging`
- **Slug:** `3d-packaging-reliability`
- **Excerpt:** `Reliability in high-density 3D packaging — why stacked dies fail: thermo-mechanical stress and CTE mismatch, warpage, interconnect fatigue, and thermal gradients. Plus the reliability trade-off matrix: every mitigation shifts stress somewhere else.`
- **Category:** `Process Integration` · **readTime:** 13 · **author:** `NineScrolls Engineering` · **publishDate:** date of publish
- **Tags:** `["3D packaging reliability","thermo-mechanical stress","CTE mismatch","package warpage","interconnect fatigue","thermal cycling","advanced packaging","3D integration"]`
- **relatedProducts:** `JSON.stringify([{href:"/products/plasma-cleaner",label:"Plasma Cleaners",subtitle:"Surface preparation for wafer bonding flows"}])` — metadata routes; prose stays in-lane.
- **Schema gotchas:** NO `lastModifiedDate`; `relatedProducts` is `a.json()` → `JSON.stringify`; FAIL-on-existing create with explicit slug.

## Rule → grep table (f = `scripts/articles/3d-packaging-reliability.html`)

| Rule | Check |
|---|---|
| Boundary line | `grep -c "failure analysis explains how to detect" f` == 1 (the "reliability=why / FA=detect" line present) |
| Principle | `grep -c "There is no free reliability improvement" f` == 1 (pull-quote; figcaption uses short variant) |
| **§6 dominance** | `awk` word counts: **words(§6) ≥ words(§2)** AND §6 in 700–800 |
| **Gate-R2 Diagnosis Leakage** | `grep -oiE "\\b(C-?SAM\|X-ray\|XCT\|FIB\|SEM\|EDX)\\b" f` — all hits must sit in ONE place (one sentence/anchor), only as a defer-link to FA. More than one location = FAIL |
| **Gate-R3 Product Leakage** | `grep -oiE "HBM[0-9]\|HBM ?3E\|NVIDIA\|AMD" f \| wc -l` ≤ 6, concentrated in §5/§7 |
| **Gate-R5 Solution Depth** | each non-Reliability-owned mitigation (heat spreader, plasma-activated bonding, temporary carrier, interconnect choice) ≤120w of prose AND carries its defer-link |
| R-length | total 3,100–3,500 |
| Hedge | `grep -icE "(always\|never\|completely eliminates?) " f` near mechanism claims == 0; adoption hedged |
| Figures | exactly 1 `reliability-trade-off-matrix` block + exactly 1 `stress-cascade-mechanism-map` block |
| Links | each ≥1: hybrid-bonding-failure-analysis, through-silicon-vias-tsv-guide, from-ucla...16-hi-hbm, hybrid-bonding-vs-micro-bump, wafer-bonding-technologies, surface-preparation-cu-cu |

**Cluster link targets:** FA `hybrid-bonding-failure-analysis` · TSV `through-silicon-vias-tsv-guide` · HBM4 `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges` · HB-vs-µbump `hybrid-bonding-vs-micro-bump` · hub `wafer-bonding-technologies-for-3d-integration` · surface-prep `surface-preparation-cu-cu-hybrid-bonding`.

**Mitigation ownership map (Gate-R4, for §6):** underfill → Reliability (this page, full treatment OK) · heat spreader → HBM4 · TSV pitch/KOZ → TSV · plasma-activated bonding → HBM4 · temporary carrier → Temporary Bonding · interconnect choice (bump vs bond) → HB-vs-µbump.

---

## Task 1: Scaffold + lead + §1 + §2 (Thermo-Mechanical core + Stress-Cascade map) + §3 Warpage

- [ ] **Step 1: Dispatch subagent.** House style: read `scripts/articles/temporary-wafer-bonding-debonding.html`. Create `scripts/articles/3d-packaging-reliability.html`:
  - **Lead (~120w):** the cross-cutting hook — every advanced-packaging choice (which interconnect, which via timing, which bonding format) is ultimately judged by one question: *will the stack survive years of power cycling?* This page owns WHY 3D stacks fail — the mechanisms. Triple defer: how to DETECT a failure → FA page (link `/insights/hybrid-bonding-failure-analysis`); the HBM product story and thermal SOLUTIONS → HBM4 (link); single-feature via reliability → TSV (link `/insights/through-silicon-vias-tsv-guide`). MUST contain the boundary line verbatim-close: "Reliability explains why a stack fails; failure analysis explains how to detect that it has."
  - **§1 `<h2 id="why-harder">1. Why Reliability Gets Harder in 3D Stacks</h2>` (~280w):** stacking multiplies interfaces, dissimilar materials, and trapped heat while shrinking mechanical margin; reliability degrades super-linearly with stack height — each added die adds interfaces that all must survive the same cycling.
  - **§2 `<h2 id="thermo-mechanical">2. Thermo-Mechanical Stress</h2>` (~360w, the CORE — deepen here to reach length):** CTE mismatch as the root driver. Walk the materials: silicon, copper (TSVs/pads), dielectric, underfill, organic substrate — each expands at a different rate, so every temperature change loads the interfaces between them; residual stress is locked in at assembly and never fully relaxes. This is the single source from which warpage, cracking, and fatigue all descend. Include the **Stress-Cascade Mechanism Map** figure (DEMOTED/explanatory — prefix `stress-cascade-mechanism-map`, standard `<picture>`, base `https://cdn.ninescrolls.com/insights/3d-packaging-reliability/`); figcaption frames it as "how one root driver fans out", NOT a decision.
  - **§3 `<h2 id="warpage">3. Warpage and Package Deformation</h2>` (~320w, STANDALONE):** the cluster's cleanest uncontested ownership (warpage = 0 mentions elsewhere). Bow and coplanarity loss; assembly-yield impact (a warped package won't seat or co-planar-bond); how warpage feeds back into local stress concentration. Keep distinct from §2 — warpage is a deformation outcome, not the stress itself.
  - Rules: R1 mechanism-only (no diagnostics, no product architecture); Gate-R2 (no SAM/X-ray/FIB/SEM/XCT/EDX here at all — those belong only in the one FA defer spot, which is §4 or FAQ); hedge. Never `--no-verify`.

- [ ] **Step 2: Rule-grep** (boundary line ==1; Gate-R2 diagnostic terms ==0 so far; stress-cascade figure ==1; FA+TSV+HBM4 links present; §1+§2+§3 ≈ 960w).

- [ ] **Step 3: Commit** — `git add scripts/articles/3d-packaging-reliability.html && git commit -m "feat(insights): reliability scaffold + §1-3 (thermo-mech core + warpage + stress-cascade map)"`

## Task 2: §4 Interconnect Fatigue + §5 When Temperature Becomes Stress

- [ ] **Step 1: Dispatch subagent.** Append:
  - **§4 `<h2 id="fatigue">4. Interconnect Fatigue</h2>` (~320w):** the joints that carry signal across die boundaries — micro-bumps, hybrid-bond / Cu-Cu interfaces — accumulate fatigue damage under repeated thermal cycling; crack initiation at the joint, propagation, eventual open. The interconnect CHOICE (bump vs bond) is NOT re-derived here — link `/insights/hybrid-bonding-vs-micro-bump` (the one place a single diagnostic defer to FA may appear, e.g. "how such fatigue opens are localized is the domain of failure analysis" + link `/insights/hybrid-bonding-failure-analysis`). Gate-R2: this is the ONLY subsection allowed a diagnostic-term defer.
  - **§5 `<h2 id="temperature">5. When Temperature Becomes Stress</h2>` (~300w):** thermal as a RELIABILITY DRIVER, not a solutions catalog. The chain: temperature differential across a stack → differential expansion → stress → fatigue. Hotspots and gradients matter because they are stress, not because of cooling hardware. HBM as the lead CASE (1–2 product mentions max, Gate-R3). Thermal SOLUTIONS (heat spreaders, thin-film thermal management) defer to HBM4 (link) — do NOT catalog them here. The title's point: HBM4 owns thermal *management*; this page owns temperature-*differential-as-stress*.

- [ ] **Step 2: Rule-grep** (Gate-R2: diagnostic terms appear in ≤1 location total, only as FA defer; Gate-R3: product terms ≤6 total; FA+HB-vs-µbump+HBM4 links present; hedge).

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): reliability §4 fatigue + §5 temperature-as-stress"`

## Task 3: §6 Reliability Trade-Off Matrix (CLIMAX) + Gate-C + Matrix tests

- [ ] **Step 1: Dispatch subagent.** Append §6 `<h2 id="trade-off-matrix">6. The Reliability Trade-Off Matrix</h2>` (700–800w):
  - OPEN with the LOCKED pull-quote (house blockquote markup):
    *"There is no free reliability improvement. Every mitigation shifts stress somewhere else."*
  - One bridging paragraph: every section so far named a mechanism; the engineer's real question is what to DO — and the catch is that every fix relocates stress. Read the matrix as "if you add X, what gets worse?"
  - **Five mitigations, each 80–120w, argued as: what it targets → why it works → the NEW cost it creates** (each must have a DISTINCT primary cost — Matrix Inversion Test depends on it):
    - **Underfill** (Reliability owns this — full treatment OK): targets interconnect fatigue + CTE stress by coupling the gap; new cost = reworkability loss (permanent) + added thermal resistance.
    - **Thicker die / substrate**: targets warpage by adding stiffness; new cost = package thickness + stronger stress coupling through the stiffer body.
    - **Stronger bonding**: targets interconnect fatigue by a more rigid joint; new cost = higher residual stress at the interface (rigidity trades ductility).
    - **Larger heat spreader** (heat spreader owner = HBM4 — Gate-R5: ≤120w, link out, do NOT explain spreader design): targets thermal gradient; new cost = package size + edge stress from the spreader's own CTE.
    - **More / wider TSVs** (TSV owner = TSV page — Gate-R5: ≤120w, link out): targets current density / electromigration; new cost = routing density loss + KOZ pressure + added stress coupling.
  - An HTML table (`<table class="insights-table">`) summarizing: If you add… | …it targets | …you may worsen. Relative language only.
  - Close (~70w): there is no global optimum — only a stress budget moved from one place to another; which is why reliability is a system problem (hands to §7). Include the **Reliability Trade-Off Matrix** figure block (prefix `reliability-trade-off-matrix`, base CDN path, standard `<picture>`); figcaption = short variant ("Reliability trade-off matrix: every mitigation relocates stress — what each fix targets, and what it worsens."), NOT the full pull-quote sentence.

- [ ] **Step 2: §6-dominance grep + Gate-C + the three matrix tests (manual).**
  - Word check: §6 700–800 AND `words(§6) ≥ words(§2)`.
  - **Gate-C:** delete §6 → the page collapses to a mechanism encyclopedia with no decision. If it survives, §6 is too weak.
  - **Matrix Inversion Test:** mask the "you may worsen" column — the five rows must remain distinguishable by their distinct primary cost (reworkability / thickness-coupling / residual stress / package size / routing-KOZ). If they blur into "everything has trade-offs", FAIL — sharpen each row's unique cost.
  - **Matrix Ownership Test:** read the "Larger heat spreader" and "More TSVs" rows — would a reader mistake either for the HBM4 page or the TSV page? If yes, Gate-R5 is violated (too deep) — cut to ≤120w + defer-link.

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): reliability §6 trade-off matrix climax (Gate-C + inversion/ownership tests)"`

## Task 4: §7 + FAQ/Related/CTA + FULL audit + Gate-E/F + Intent + Climax Test

- [ ] **Step 1: Dispatch subagent.** Append:
  - **§7 `<h2 id="system-problem">7. Reliability Is a System Problem</h2>` (~200w):** reliability is not a step in the chain — it is the cross-cutting dimension that spans the whole of it (surface readiness, via timing, bonding choice, integration format all answer to it). HBM is the lead case where every mechanism converges. Reference the cluster in prose with links; do NOT redraw the decision-chain map. Restate the principle (not verbatim).
  - **FAQ (5) `<h2>Frequently Asked Questions</h2>`:**
    1. "What causes reliability failures in 3D-stacked packages?" — mechanism answer (CTE mismatch → stress → warpage/cracking/fatigue).
    2. **"What is the difference between reliability and failure analysis?" — 70–90w, the boundary defense:** reliability = why it fails (mechanisms); FA = how to detect/diagnose; link `/insights/hybrid-bonding-failure-analysis`.
    3. "What is package warpage and why does it matter?" — the cleanest-ownership mechanism.
    4. "Why does thermal management affect reliability?" — temperature differential → stress → fatigue; thermal solutions link HBM4.
    5. "Can you eliminate reliability trade-offs?" — restate the principle (no free improvement), point to §6.
  - **Related Articles** (FA, TSV, HB-vs-µbump, HBM4, hub) + CTA (`/contact`, surface preparation and cleaning systems for bonding flows — never "plasma activation").

- [ ] **Step 2: FULL AUDIT** — every grep-table row; R-length 3,100–3,500 (if UNDER 3,100: deepen ONLY §2 physics chain + §6 rows, NOT FAQ/CTA/Related/§7/§3); all six gates (R1 mechanism-only; R2 diagnostic ≤1 location; R3 product ≤6; R4 each §6 mitigation has its owner; R5 owned-elsewhere ≤120w + link); §6-dominance; both figures; all 6 links; hedge.

- [ ] **Step 3: Gate-E + Gate-F + Intent + Climax Test (human judgment):**
  - Gate-E: (1) cover title → still "why 3D stacks fail + the trade-offs"; (2) remove figures → argument stands; (3) delete §6 → collapses; (4) delete the matrix figure → the trade-off framework survives in prose.
  - **Gate-F Reversal:** delete every reliability/stress/failure term → must collapse into nonsense.
  - **Climax Test (user-added):** delete §6 → page MUST collapse; delete §3 (Warpage) AND delete §5 (Temperature) → page MUST still stand. If reversed (survives §6 deletion, or collapses without §3/§5), FAIL — §6 is not the true climax.
  - Intent audit: reader leaves knowing WHY stacks fail + that every fix is a trade-off — not how to detect failure (FA) and not a product story (HBM4).

- [ ] **Step 4: Commit** — `git commit -am "feat(insights): reliability §7 + FAQ/CTA + full audit + Gate-E/F + Climax Test"`

## Task 5: Figure prompts + cover-first gate (USER ACTION)

- [ ] **Step 1: Write `/tmp/reliability-figure-prompts.md`:**

**① COVER (approve first; 3:2 navy hero):** Ultra-high-res editorial cover, deep navy (#1e3a5f) gradient. Subject: a high-density 3D die stack on an interposer under thermal load — the stack subtly bowed/warped (exaggerated slightly for legibility), a translucent stress-field glow (warm reds/oranges concentrated at the die edges and interfaces) overlaid on the cool-blue silicon, and a few faint hairline interface cracks catching light. Convey "the stack is fighting to survive." No people. Text: header "NINESCROLLS · INSIGHTS", title "Reliability Challenges in 3D Packaging", subtitle "Why Stacked Dies Fail — and the Trade-Offs", footer "ninescrolls.com". Perfect spelling.

**② Fig A — Reliability Trade-Off Matrix (`reliability-trade-off-matrix`, ~1200×850, white bg, brand palette) — THE climax:** an Inversion table/diagram with three columns: **If you add…** | **…it targets** | **…you may worsen**. Five rows: Underfill → interconnect fatigue / CTE stress → reworkability, thermal resistance; Thicker die or substrate → warpage → package thickness, stress coupling; Stronger bonding → interconnect fatigue → residual stress; Larger heat spreader → thermal gradient → package size, edge stress; More / wider TSVs → current density → routing density, KOZ pressure. Use a small "targets" green accent and a "worsens" amber/red accent per row to make the relocation visible. Bottom band with the principle: "There is no free reliability improvement — every mitigation moves stress." NO numbers. Footer "ninescrolls.com · Reliability Trade-Off Matrix".

**③ Fig B — Stress-Cascade Mechanism Map (`stress-cascade-mechanism-map`, ~1000×620, white bg) — DEMOTED/explanatory, visually LIGHT:** a simple top-down cascade: "CTE mismatch (Si · Cu · dielectric · underfill · substrate)" → "Residual stress" → three branches "Warpage", "Cracking", "Fatigue". Thin connectors, muted palette, clearly a supporting diagram, not a hero. Footer "ninescrolls.com · Stress Cascade". (Smaller/lighter than Fig A by design.)

- [ ] **Step 2: GATE — user generates ① → approve → ② ③.** Cross-check microtext against the article (five matrix rows; cascade branches). **Fig-B anti-promotion: cover and Fig A are the only page representers; Fig B never goes in excerpt/lead/social card.**

## Task 6: Import draft → upload → llms BEFORE publish → publish → verify

- [ ] **Step 1: One-shot `scripts/create-reliability-article.ts`** (NOT committed; FAIL-on-existing):

```typescript
/** One-shot: create 3D Packaging Reliability hub as draft. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });
const SLUG = '3d-packaging-reliability';
(async () => {
  await authenticate();
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  if (existing?.length) { console.error(`FAIL: slug exists, id=${(existing[0] as any).id}. Use an update one-shot.`); process.exit(1); }
  const { data, errors } = await client.models.InsightsPost.create({
    title: 'Reliability Challenges in High-Density 3D Packaging',
    slug: SLUG,
    content: readFileSync('scripts/articles/3d-packaging-reliability.html', 'utf-8'),
    excerpt: 'Reliability in high-density 3D packaging — why stacked dies fail: thermo-mechanical stress and CTE mismatch, warpage, interconnect fatigue, and thermal gradients. Plus the reliability trade-off matrix: every mitigation shifts stress somewhere else.',
    author: 'NineScrolls Engineering',
    publishDate: '2026-06-14',
    category: 'Process Integration',
    readTime: 13,
    imageUrl: 'https://cdn.ninescrolls.com/insights/3d-packaging-reliability/cover-lg',
    tags: ['3D packaging reliability','thermo-mechanical stress','CTE mismatch','package warpage','interconnect fatigue','thermal cycling','advanced packaging','3D integration'],
    relatedProducts: JSON.stringify([{ href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface preparation for wafer bonding flows' }]) as any,
    isStandaloneComponent: false,
    isDraft: true,
  } as any);
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : `CREATED draft id=${(data as any).id}`);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Upload figures** (user paths): `--name cover` / `--name reliability-trade-off-matrix --no-update-cover` / `--name stress-cascade-mechanism-map --no-update-cover`, each via `AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts 3d-packaging-reliability <file> …`.

- [ ] **Step 3: llms sync BEFORE publish.** `public/llms.txt` (AP section, after the Temporary Bonding entry):

```markdown
- [Reliability Challenges in High-Density 3D Packaging](https://ninescrolls.com/insights/3d-packaging-reliability): Why 3D stacks fail — thermo-mechanical stress and CTE mismatch, package warpage, interconnect fatigue, and thermal gradients as stress — plus the reliability trade-off matrix: every mitigation shifts stress somewhere else
```

`public/llms-full.txt` (after the Temporary Bonding block):

```markdown
**Reliability Challenges in High-Density 3D Packaging**
URL: https://ninescrolls.com/insights/3d-packaging-reliability
Summary: The Advanced Packaging cluster's reliability hub — owns the failure MECHANISMS (why 3D stacks fail), distinct from failure analysis (how to detect failure) and from the HBM product story. Covers why reliability degrades super-linearly with stacking, thermo-mechanical stress from CTE mismatch (silicon, copper, dielectric, underfill, substrate) as the root driver, package warpage and deformation, interconnect fatigue at micro-bump and hybrid-bond joints, and temperature differential as a stress source. Climax: the Reliability Trade-Off Matrix — an inversion view (if you add X, what gets worse), built on the principle that there is no free reliability improvement: every mitigation (underfill, thicker die, stronger bonding, heat spreader, more TSVs) relocates stress somewhere else. Reliability is framed as the cross-cutting dimension spanning the whole packaging chain. Defers detection/diagnostics to the failure-analysis guide, thermal solutions and the HBM case to the 16-Hi HBM article, single-feature via reliability to the TSV guide.
```

- [ ] **Step 4: Publish** (`update({id, isDraft:false})`) → verify DDB (title/slug/figures/principle/boundary-line) → CDN 200s (3 lg.webp) → live render → `rm scripts/create-reliability-article.ts`.

## Task 7: Provenance + PR

- [ ] **Step 1:**

```bash
git add scripts/articles/3d-packaging-reliability.html public/llms.txt public/llms-full.txt docs/superpowers/plans/2026-06-14-3d-packaging-reliability.md
git commit -m "feat(insights): Reliability Challenges in High-Density 3D Packaging (AP Reliability Hub) + llms sync"
git push -u origin insights/3d-packaging-reliability
gh pr create --title "feat(insights): Reliability Challenges in High-Density 3D Packaging (AP Reliability Hub, spoke #8)" --body "The cluster's reliability hub — owns failure MECHANISMS (Gate 0.5 Create; convergence-point topology, one level above HBM4). Boundaries measured & enforced: vs FA (mechanism vs detection), vs HBM4 (driver vs solutions), vs TSV (system vs single-feature). Climax = Reliability Trade-Off Matrix (inversion: add X -> what worsens; principle 'no free reliability improvement'). Six mechanism gates (R1 ownership / R2 diagnosis-leakage / R3 product-leakage / R4 mitigation-ownership / R5 solution-depth) + Matrix Inversion/Ownership/Climax tests + Gate-C/E/F + Intent. Stress-Cascade map demoted (no dual climax). Live in DDB; provenance + llms here.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Task 8: Phase-B1 Link Pass (one-shot NOT committed; NO B2)

- [ ] **Step 1: Fetch verbatim anchors** (read-only tsx): **FA §8 "Failure Evolution Under Reliability Stress"** (the KEY seam — a sentence there about reliability stress); HBM4 (a thermal/CTE region sentence); TSV §7 (its Cu-pumping/stress/cost-chain region); HB-vs-µbump (an electromigration/fatigue mention).
- [ ] **Step 2: One-shot `scripts/reliability-backlinks.ts`** — standard module (rx() tolerant find, exactly-one-match guard, idempotency on `/insights/3d-packaging-reliability`, --dry-run). FOUR edits:
  1. **FA §8** → "For the underlying failure mechanisms — why these signatures arise — see <a>Reliability Challenges in High-Density 3D Packaging</a>." (the why/how-to-detect seam).
  2. **HBM4** → at its thermal/CTE region: "the general reliability mechanisms behind this are covered in <a>Reliability Challenges in High-Density 3D Packaging</a>".
  3. **TSV §7** → "for system-level (whole-stack) reliability beyond the single via, see <a>Reliability Challenges in High-Density 3D Packaging</a>".
  4. **HB-vs-µbump** → at the electromigration/fatigue mention: "(interconnect fatigue as a system reliability mechanism is covered in <a>Reliability Challenges in High-Density 3D Packaging</a>)".
- [ ] **Step 3: dry-run → apply → verify** (each of the 4 pages → this page ×1; this page → all cluster links) → `rm scripts/reliability-backlinks.ts`. **NO B2** (all four are cluster pages).

## Task 9: Memory + wrap

- [ ] **Step 1: Update `memory/seo_strategy.md`:** Reliability Hub PUBLISHED (slug/id/PR#); **AP cluster = 9 pages**; **Reliability = the cross-cutting CONVERGENCE dimension, NOT a sequential chain node** (does not enter the ap-decision-chain map; one abstraction level above HBM4 — title omits "HBM" deliberately); **mechanism-governance added to the template: Gate-R1 Mechanism Ownership / R2 Diagnosis Leakage / R3 Product Leakage / R4 Mitigation Ownership / R5 Solution Depth** (R4=who owns, R5=how deep before deferring) + Matrix Inversion / Matrix Ownership / Climax tests; climax = Reliability Trade-Off Matrix (inversion "add X → what worsens"; principle "no free reliability improvement"); Stress-Cascade demoted to explanatory (Fig-B anti-promotion rule: never in excerpt/lead/social). FA↔Reliability seam = the why/how-to-detect boundary (FA §8 links here). Phase-B1 done (FA §8, HBM4, TSV §7, HB-vs-µbump → Reliability); no B2. Next: **TSV sub-pages** (Reveal, Cu Fill, Interposer — hang off the TSV mini-hub). **⏳ STILL PENDING: TSV Phase-B2 DRIE edit ~2026-06-18** (`scripts/tsv-backlinks.ts --b2`; verify DRIE title/H2 byte-identical). **~early-July GSC remeasure** — RIE Phase-2 persistence + new AP pages indexing + the DRIE-impressions-rose-after-TSV signal (weight bleeding along the process graph?).
- [ ] **Step 2: Report** with live URL + PR + verification evidence.

---

## Self-review

- **Spec coverage:** metadata ✓ (T6 code); boundary line + triple defer ✓ (T1); §2 core + Stress-Cascade demoted ✓ (T1); §3 standalone ✓ (T1); §4 fatigue + the single FA diagnostic defer ✓ (T2); §5 temperature-as-stress + HBM4 thermal-solutions defer ✓ (T2); §6 climax 700–800 + principle + inversion table + dominance grep ✓ (T3); §7 cross-cutting close ✓ (T4); Gate-R1..R5 ✓ (grep table + T2/T3/T4 checks); Matrix Inversion/Ownership/Climax tests ✓ (T3/T4); figures relative-only + Fig-B demotion/anti-promotion ✓ (T5); llms-before-publish ✓ (T6); Phase-B1 incl. FA §8 key seam ✓ (T8); memory incl. TSV B2 + GSC remeasure reminders ✓ (T9).
- **Marker mechanics:** tasks append to EOF in section order (no markers needed). Final H2 order: 1–7 + FAQ — T4 audit verifies.
- **Consistency:** slug + figure prefixes (`cover`, `reliability-trade-off-matrix`, `stress-cascade-mechanism-map`) identical across blocks (T1/T3), prompts (T5), uploads (T6).
- **Placeholder scan:** image paths user-provided at gate time; all else concrete.
