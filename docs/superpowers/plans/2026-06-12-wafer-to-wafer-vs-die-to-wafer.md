# Wafer-to-Wafer vs Die-to-Wafer (Capstone Selection Page) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Advanced Packaging cluster's capstone selection page — "Wafer-to-Wafer vs Die-to-Wafer: When Does Each Integration Strategy Win?" (slug `wafer-to-wafer-vs-die-to-wafer`) — with the named-gates Selection Framework (Gates A–D) as the L3 asset and the canonical AP Decision Chain map (Fig B) closing the cluster's decision path.

**Architecture:** The standard 4-article pipeline: sequential subagents draft into provenance HTML with rule-greps between tasks (R1/R3b), Gate-C after §2, Gate-E + Gate-F (Reversal Test) + Intent-Ownership audit at completion, cover-first figure gate, llms sync BEFORE publish, one-shot DDB scripts NOT committed, Phase-B1 only (no mature-traffic pages touched → no B2).

**Tech Stack:** HTML article fragments (house style = `scripts/articles/through-silicon-vias-tsv-guide.html`), TypeScript + tsx one-shots against Amplify Data, `upload-insights-image.ts` with `AWS_PROFILE=ninescrolls`.

**Spec:** `docs/superpowers/specs/2026-06-12-wafer-to-wafer-vs-die-to-wafer-design.md`
**Branch:** `insights/w2w-vs-d2w` (current; spec committed)
**Env for DDB scripts:** `set -a; . ./.env; set +a` then `npx tsx <script>`

---

## Locked metadata

- **Title:** `Wafer-to-Wafer vs Die-to-Wafer: When Does Each Integration Strategy Win?`
- **Slug:** `wafer-to-wafer-vs-die-to-wafer`
- **Excerpt:** `Wafer-to-wafer (W2W) vs die-to-wafer (D2W) bonding — the four-gate selection framework: geometry match, yield economics, throughput, and maximum density. When each integration strategy wins, from CIS to chiplets to HBM.`
- **Category:** `Process Integration` · **readTime:** 11 · **author:** `NineScrolls Engineering` · **publishDate:** date of publish
- **Tags:** `["wafer-to-wafer","die-to-wafer","W2W","D2W","hybrid bonding","advanced packaging","3D integration","chip-on-wafer","chiplets"]`
- **relatedProducts:** `JSON.stringify([{href:"/products/plasma-cleaner",label:"Plasma Cleaners",subtitle:"Surface activation for wafer bonding flows"}])` — metadata routes to the product; the BODY never says "plasma activation" (R3b stands).
- **Schema gotchas:** NO `lastModifiedDate`; `relatedProducts` is `a.json()` → `JSON.stringify`; FAIL-on-existing create with explicit slug.

## Rule → grep table (f = `scripts/articles/wafer-to-wafer-vs-die-to-wafer.html`)

| Rule | Check |
|---|---|
| R1 | `grep -ic "what is hybrid bonding" f` == 0; no H2 explaining bonding mechanics; KGD interconnect analysis LINKED (`hybrid-bonding-vs-micro-bump` ≥1) never restated |
| R3b | `grep -icE "plasma activation|CMP|dishing|queue time|C-SAM|FIB" f` == 0 article-wide incl. anchors (beware substrings: "CMP" could false-match nothing common, but check hits manually) |
| Principle | `grep -c "It is a privilege earned by matched geometry and high yield" f` == 1 (pull-quote; figcaption uses a short variant, NOT the full sentence — pull-quote count stays 1) |
| Gates | each ≥1: `grep -c "Gate A" f`, `Gate B`, `Gate C`, `Gate D`; and `grep -ic "bonus" f` ≥1 near Gate D (D = bonus criterion) |
| Gate-D guard | `grep -icE "fine(st)? pitch (requires|means|forces|implies) (W2W|wafer-to-wafer)" f` == 0 (the forbidden inference) |
| §5 caps | per-`<h3>` word counts: CIS ≤120, Chiplet ≤120, **HBM ≤100 and the smallest of the three** |
| FAQ locks | CoW answer 70–90w; KGD answer 70–90w and contains "known-good die" + links HB-vs-µbump |
| R-length | total 2,700–3,000 |
| Hedge | `grep -icE "(CIS|HBM|chiplet)s? (use|uses|requires|is built with)" f` == 0 |
| Figures | exactly 1 `w2w-d2w-selection-framework` block + exactly 1 `ap-decision-chain` block |
| Links | each ≥1: wafer-bonding hub, hybrid-bonding-vs-micro-bump, through-silicon-vias-tsv-guide, 16-hi-hbm, surface-preparation-cu-cu, hybrid-bonding-failure-analysis |

---

## Task 1: Scaffold + lead + §1 quick answer + §2 Selection Framework (THE THOUGHT CORE) + Gate-C

This page's climax comes EARLY (§2), so unlike prior spokes the thought core is drafted in Task 1's follow-on, with Gate-C immediately after.

- [ ] **Step 1: Dispatch subagent — scaffold + lead + §1.** House style: read `scripts/articles/through-silicon-vias-tsv-guide.html`. Create `scripts/articles/wafer-to-wafer-vs-die-to-wafer.html` with:
  - **Lead (~110w):** capstone hook — having chosen the interconnect (link `hybrid-bonding-vs-micro-bump`) and the via timing (link `through-silicon-vias-tsv-guide`), one decision remains: bond whole wafers, or place dies one at a time? Defer bonding mechanics → hub (link `wafer-bonding-technologies-for-3d-integration`). State the unique question: "when do you lose the choice of format, and when do you keep it?"
  - **§1 `<h2 id="quick-answer">1. The Quick Answer: W2W or D2W?</h2>` (~180w):** three-line verdict — die sizes/steppings don't match → D2W by ruling, before economics enters; matched geometry + high yield + chasing the density limit → W2W; everything else → D2W (the industry default for heterogeneous products). Hedged.
  - End with marker `<!-- SECTION 2 INSERTS HERE -->` then nothing else.
  - Rules: R1/R3b forbidden terms; never `--no-verify`.

- [ ] **Step 2: Dispatch subagent — §2 (850–950w).** Replace the marker with §2 `<h2 id="framework">2. The Selection Framework</h2>` + new marker `<!-- SECTIONS 3+ INSERT HERE -->`:
  - OPENS with the LOCKED pull-quote (styled blockquote, house pattern):
    *"Wafer-to-wafer is not the default. It is a privilege earned by matched geometry and high yield. When either condition breaks, the industry falls back to die-to-wafer."*
  - **Gate A — Geometry** (~200w): W2W bonds entire wafers face-to-face, so the two designs must tile identically — same die size, same stepping. Mismatch is not a disadvantage to weigh; it is physical disqualification. This gate comes first because no economics can override it. (Heterogeneous products — different sizes, nodes, vendors — exit here.)
  - **Gate B — Yield Economics** (~220w): W2W is blind — every die bonds to whatever lands opposite it, good or bad; compound yield multiplies. D2W picks known-good die. ONE link to `hybrid-bonding-vs-micro-bump` for the interconnect-level KGD economics (phrase like "the same known-good-die logic that governs the interconnect choice"); this section owns only the FORMAT layer: the question is whether die yield is high enough that blind pairing loses less than per-die handling costs.
  - **Gate C — Throughput** (~200w): one aligned bond joins every die simultaneously vs thousands of pick-and-place operations, each adding serial time, particle exposure, and its own alignment event. At CIS-like volumes this parallelism is decisive; at chiplet volumes with high-value dies, the serialization is the price of selectivity.
  - **Gate D — Maximum Density** (~180w): the BONUS criterion. W2W's wafer-level alignment preserves the finest achievable pitch — but D only matters AFTER surviving A–C. Explicitly state: products at extreme pitch (HBM-class stacks, high-end logic) still commonly land on D2W because they fail Gate A or B first. NEVER "fine pitch → W2W."
  - Close (~60w): the gates run in order; most products exit at A or B — which is the principle restated as engineering fact.
  - **Fig A block** (prefix `w2w-d2w-selection-framework`, base `https://cdn.ninescrolls.com/insights/wafer-to-wafer-vs-die-to-wafer/`, standard `<picture>`): figcaption = short variant "The W2W/D2W selection framework: four gates in order — geometry, yield economics, throughput, and the density bonus." (NOT the full pull-quote sentence — keeps principle count at 1.)

- [ ] **Step 3: Gate-C (immediately) + greps.** Mentally delete §2: the article MUST collapse (lead promises the framework; §1 asserts verdicts §2 justifies). Run: principle==1, four `Gate X` names ≥1, Gate-D guard ==0, R3b ==0, §2 words 850–950 (excl. figure block tokens acceptable).

- [ ] **Step 4: Commit** — `git add scripts/articles/wafer-to-wafer-vs-die-to-wafer.html && git commit -m "feat(insights): W2W-vs-D2W scaffold + §1 + §2 framework (Gate-C pass)"`

## Task 2: §3 + §4 + §5 snapshots (HARD CAPS) + §6 chain + §7 + FAQ/Related/CTA

- [ ] **Step 1: Dispatch subagent.** Replace `<!-- SECTIONS 3+ INSERT HERE -->` with everything remaining:
  - **§3 `<h2 id="why-w2w">3. Why W2W Delivers the Highest Density</h2>` (~300w):** wafer-level alignment physics (one global alignment, lithographic-class registration, no per-die placement error) + parallel economics; CIS as living proof in ONE line with link `surface-preparation-cu-cu-hybrid-bonding` context if natural (or hub). Hedged.
  - **§4 `<h2 id="why-d2w">4. Why D2W Dominates Heterogeneous Integration</h2>` (~300w):** different die sizes/nodes/vendors (Gate A exits), KGD picking (Gate B exits), chiplet reality — the freedom to combine dies is exactly what W2W's geometry privilege forbids. Mention "chip-on-wafer (CoW)" naming once (feeds the FAQ).
  - **§5 `<h2 id="snapshots">5. Application Snapshots</h2>` — THREE `<h3>` in EXACT order CIS → Chiplets → HBM, HARD CAPS:**
    - `<h3>CMOS Image Sensors — the purest W2W case</h3>` ≤120w: identical wafers, enormous uniform volume, mature yields → passes all four gates; link FA page or hub naturally.
    - `<h3>Chiplets — the purest D2W case</h3>` ≤120w: heterogeneous by definition → exits at Gate A; KGD assembly; link `hybrid-bonding-vs-micro-bump`.
    - `<h3>HBM — the engineering compromise</h3>` **≤100w AND shortest of the three**: stacked DRAM typically D2W-style stacking today with W2W-class density pressure; the tension between Gate B (yield across many dies) and Gate D (density) — one sentence + link `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges`. NO HBM3/4/5 generational detail.
  - **§6 `<h2 id="decision-chain">6. The Complete Decision Chain</h2>` (~250w):** the capstone close — the cluster's five decisions united: surface readiness (link surface-prep) → via timing (link TSV) → bonding method (link hub) → integration format (this page) → and when something fails, diagnosis (link `hybrid-bonding-failure-analysis`). **Fig B block** (prefix `ap-decision-chain`): figcaption "The Advanced Packaging decision chain: surface preparation → via timing → bonding method → integration format → failure analysis — each step owned by its own guide."
  - **§7 `<h2 id="takeaways">7. Key Takeaways</h2>` (~150w):** verdict bullets + the principle restated (not verbatim) + final bullet = decision-chain hook naming the two sibling decision pages.
  - **FAQ (4):** (1) "What is the difference between wafer-to-wafer and die-to-wafer bonding?" (definition, this page owns it); (2) **"Why doesn't everyone use wafer-to-wafer bonding?" 70–90w** — names "known-good die (KGD)" explicitly, the blind-bonding cost, links `hybrid-bonding-vs-micro-bump`; (3) **"Is die-to-wafer the same as chip-on-wafer (CoW)?" 70–90w** — yes-essentially answer (CoW/C2W naming, foundry variants), captures CoW queries; (4) "Can one product use both?" — brief (different interfaces in one package may differ).
  - **Related Articles** (hub, HB-vs-µbump, TSV, HBM4, FA) + CTA (`/contact`, surface-activation/cleaning equipment for bonding flows — WITHOUT the words "plasma activation"; say "surface activation and cleaning systems").

- [ ] **Step 2: FULL AUDIT** — every grep-table row, incl. §5 per-h3 caps (awk per-`<h3>` counter; HBM must be smallest), FAQ word-locks, R-length 2,700–3,000 (over → trim §3/§4/FAQ, never §2), hedge check, both figure blocks, all 6 links.

- [ ] **Step 3: Gate-E + Gate-F + Intent audit (human judgment):**
  - Gate-E: (1) cover title → still obviously "which format?"; (2) remove figures → argument stands; (3) delete §2 → collapses; (4) delete Fig A → framework survives in prose.
  - **Gate-F Reversal Test: delete every W2W/D2W/wafer-to-wafer/die-to-wafer term — the article must collapse into nonsense.** If it reads as a coherent generic-bonding piece → FAIL, rewrite toward format-selection specificity.
  - Intent audit: the reader leaves knowing the DECISION (which format, why, in what order), not a bonding overview.

- [ ] **Step 4: Commit** — `git commit -am "feat(insights): W2W-vs-D2W §3-7 + FAQ/CTA + full audit + Gate-E/F"`

## Task 3: Figure prompts + cover-first gate (USER ACTION)

- [ ] **Step 1: Write `/tmp/w2w-figure-prompts.md`:**

**① COVER (approve first; 3:2 navy hero):** Ultra-high-res editorial cover, deep navy (#1e3a5f) gradient. Split scene: LEFT — two complete silicon wafers closing face-to-face in perfect alignment (one luminous bonding plane between them, cool blue/violet); RIGHT — a precision placement head setting individual small dies one at a time onto a carrier wafer (warm copper accents, a few dies placed, one in mid-placement). A glowing thin vertical seam separates the halves. Text: header "NINESCROLLS · INSIGHTS", title "Wafer-to-Wafer vs Die-to-Wafer", subtitle "When Does Each Integration Strategy Win?", footer "ninescrolls.com". Premium, no people, perfect spelling.

**② Fig A — W2W/D2W Selection Framework (`w2w-d2w-selection-framework`, ~1200×900, white bg, brand palette):** A vertical four-gate elimination flow. Entry at top: "3D integration committed — which format?" Then four gate bars in order: "GATE A — GEOMETRY · Do die sizes and steppings match?" (fail arrow right → red-tinted "D2W" exit), "GATE B — YIELD ECONOMICS · Can you afford blind bonding?" (fail arrow → D2W exit), "GATE C — THROUGHPUT · Is whole-wafer parallelism worth preserving?" (fail arrow → D2W exit), then "GATE D — MAXIMUM DENSITY (BONUS) · Pursuing the absolute density limit?" styled visually differently (dashed border / star badge, labeled BONUS) with "yes → W2W" (blue terminal) and "no → either; D2W typical" outcome. Beneath: two-column outcome strip — W2W: "Finest pitch · Highest parallelism · Blind bonding" | D2W: "Known-good die · Heterogeneous freedom · Serial placement". NO absolute numbers anywhere. Footer "ninescrolls.com · W2W / D2W Selection Framework".

**③ Fig B — The Advanced Packaging Decision Chain (`ap-decision-chain`, ~1200×700, white bg) — CANONICAL CLUSTER MAP (will be reused by future AP pages):** A horizontal five-node chain, each node a rounded card with a small icon + the decision + its owning guide name underneath in smaller text: "SURFACE PREPARATION (Surface Prep guide)" → "VIA TIMING · first/middle/last (TSV guide)" → "BONDING METHOD · fusion/hybrid/TC (Wafer Bonding hub)" → "INTEGRATION FORMAT · W2W/D2W (this guide)" → "FAILURE ANALYSIS (FA guide)". Clean arrows, navy/blue/copper accents, generous spacing. Footer "ninescrolls.com · The Advanced Packaging Decision Chain". Perfect spelling — this figure is the cluster's official map.

- [ ] **Step 2: GATE — user generates ① → approve → ② ③.** Cross-check all microtext against the article (gate names, BONUS label, chain node names).

## Task 4: Import draft → upload → llms BEFORE publish → publish → verify

- [ ] **Step 1: One-shot `scripts/create-w2w-article.ts`** (NOT committed; FAIL-on-existing):

```typescript
/** One-shot: create W2W-vs-D2W capstone page as draft. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });
const SLUG = 'wafer-to-wafer-vs-die-to-wafer';
(async () => {
  await authenticate();
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  if (existing?.length) { console.error(`FAIL: slug exists, id=${(existing[0] as any).id}. Use an update one-shot.`); process.exit(1); }
  const { data, errors } = await client.models.InsightsPost.create({
    title: 'Wafer-to-Wafer vs Die-to-Wafer: When Does Each Integration Strategy Win?',
    slug: SLUG,
    content: readFileSync('scripts/articles/wafer-to-wafer-vs-die-to-wafer.html', 'utf-8'),
    excerpt: 'Wafer-to-wafer (W2W) vs die-to-wafer (D2W) bonding — the four-gate selection framework: geometry match, yield economics, throughput, and maximum density. When each integration strategy wins, from CIS to chiplets to HBM.',
    author: 'NineScrolls Engineering',
    publishDate: '2026-06-12',
    category: 'Process Integration',
    readTime: 11,
    imageUrl: 'https://cdn.ninescrolls.com/insights/wafer-to-wafer-vs-die-to-wafer/cover-lg',
    tags: ['wafer-to-wafer','die-to-wafer','W2W','D2W','hybrid bonding','advanced packaging','3D integration','chip-on-wafer','chiplets'],
    relatedProducts: JSON.stringify([{ href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface activation for wafer bonding flows' }]) as any,
    isStandaloneComponent: false,
    isDraft: true,
  } as any);
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : `CREATED draft id=${(data as any).id}`);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Upload figures** (user paths): `--name cover` / `--name w2w-d2w-selection-framework --no-update-cover` / `--name ap-decision-chain --no-update-cover`, each via `AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts wafer-to-wafer-vs-die-to-wafer <file> …`.

- [ ] **Step 3: llms sync BEFORE publish.** `public/llms.txt` (AP section, after the TSV entry):

```markdown
- [Wafer-to-Wafer vs Die-to-Wafer](https://ninescrolls.com/insights/wafer-to-wafer-vs-die-to-wafer): Bonding-format selection guide — the four-gate framework (geometry match, yield economics, throughput, maximum density), why W2W is a privilege and D2W the heterogeneous default, and the complete Advanced Packaging decision chain
```

`public/llms-full.txt` (after the TSV block):

```markdown
**Wafer-to-Wafer vs Die-to-Wafer: When Does Each Integration Strategy Win?**
URL: https://ninescrolls.com/insights/wafer-to-wafer-vs-die-to-wafer
Summary: Capstone selection guide for the bonding-format decision. Centers on a four-gate elimination framework: Gate A geometry (die-size/stepping match is a physical prerequisite for W2W), Gate B yield economics (W2W bonds blind — no known-good-die selection; D2W picks KGD), Gate C throughput (one whole-wafer bond vs thousands of serial placements), Gate D maximum density (a bonus criterion — W2W's wafer-level alignment preserves the finest pitch, but only after surviving A–C). Principle: wafer-to-wafer is a privilege earned by matched geometry and high yield; when either breaks, the industry falls back to die-to-wafer. Application snapshots (CIS purest W2W, chiplets purest D2W, HBM the compromise) and the complete Advanced Packaging decision chain (surface preparation → via timing → bonding method → integration format → failure analysis). Defers bonding mechanics to the Wafer Bonding hub and interconnect KGD economics to Hybrid Bonding vs Micro-Bump.
```

- [ ] **Step 4: Publish** (`update({id, isDraft:false})`) → verify DDB (title/slug/figures/pull-quote) → CDN 200s (3 lg.webp) → live render check → `rm scripts/create-w2w-article.ts`.

## Task 5: Provenance + PR

- [ ] **Step 1:**

```bash
git add scripts/articles/wafer-to-wafer-vs-die-to-wafer.html public/llms.txt public/llms-full.txt docs/superpowers/plans/2026-06-12-wafer-to-wafer-vs-die-to-wafer.md
git commit -m "feat(insights): Wafer-to-Wafer vs Die-to-Wafer — capstone selection page + llms sync"
git push -u origin insights/w2w-vs-d2w
gh pr create --title "feat(insights): Wafer-to-Wafer vs Die-to-Wafer (AP capstone selection page)" --body "Capstone of the AP decision chain (Gate 0.5 Create). Four named gates (A Geometry / B Yield Economics / C Throughput / D Maximum Density-as-bonus), locked principle sentence, HBM word-cap discipline, Fig B = canonical AP Decision Chain cluster map. Gates: R1/R3b, Gate-C, Gate-E 4/4, Gate-F Reversal Test, Intent audit. Live in DDB; provenance + llms here.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Task 6: Phase-B1 Link Pass (one-shot NOT committed; NO B2)

- [ ] **Step 1: Fetch verbatim anchors** (read-only tsx): hub (the chiplet/W2W-D2W mention region), `hybrid-bonding-vs-micro-bump` (§5's "wafer-to-wafer configurations" sentence region OR the takeaways), `through-silicon-vias-tsv-guide` (§8 Future Hub Hook bullet — "bonding strategy" phrase is the natural seam).
- [ ] **Step 2: One-shot `scripts/w2w-backlinks.ts`** — standard module (rx() tolerant, exactly-one-match, idempotent on `/insights/wafer-to-wafer-vs-die-to-wafer`, --dry-run). Three edits:
  1. **hub** — after its "wafer-to-wafer and die-to-wafer hybrid bonding a default assembly step" sentence: "For when to choose which format, see <a>Wafer-to-Wafer vs Die-to-Wafer</a>."
  2. **HB-vs-µbump** — at the §5 W2W sentence: append "(for the full format-selection framework, see <a>Wafer-to-Wafer vs Die-to-Wafer</a>)" or a following sentence.
  3. **TSV page** — at the §8 Future Hub Hook ("…and bonding strategy — each deserve their own treatment."): append "The bonding-strategy decision now has its own guide: <a>Wafer-to-Wafer vs Die-to-Wafer</a>."
- [ ] **Step 3: dry-run → apply → verify** (each page → new page ×1; new page → all cluster links) → `rm scripts/w2w-backlinks.ts`. **NO B2** — none of the three is a mature-traffic page outside the cluster.

## Task 7: Memory + wrap

- [ ] **Step 1: Update `memory/seo_strategy.md`:** capstone PUBLISHED (slug/id/PR#); **AP cluster = 7 pages, decision chain COMPLETE** (SurfacePrep → TSV → BondingMethod → W2W/D2W → FA); **Fig B (`ap-decision-chain`) = CANONICAL cluster map — single-sourced, future AP pages must reuse the same CDN asset, never redraw** ; named-gates convention (Gate A–D citable); Gate-F Reversal Test added to the standard template; next spokes: Temporary Bonding/Debonding → HBM Reliability (+ TSV sub-pages: Reveal, Cu Fill, Reliability, Interposer); **reminder: TSV Phase-B2 (DRIE edit) still pending ~2026-06-18** (`scripts/tsv-backlinks.ts --b2`).
- [ ] **Step 2: Report** with live URL + PR + verification evidence.

---

## Self-review

- **Spec coverage:** locked metadata ✓ (T4 code); §2 dominant 850–950 + pull-quote + Gates A–D with D-as-bonus + Gate-D guard grep ✓ (T1); §5 order + HARD CAPS with HBM-shortest check ✓ (T2); §6 chain + Fig B canonical declaration ✓ (T2/T3/T7); FAQ CoW + KGD word-locks ✓ (T2); R-length 2,700–3,000 ✓; R1 link-not-restate HB-vs-µbump ✓ (T1 Gate B instruction); R3b incl. CTA wording workaround ("surface activation and cleaning systems") ✓; Gate-C/E/F + Intent audit ✓; figures relative-labels-only ✓ (T3); llms-before-publish ✓ (T4); Phase-B1-only ✓ (T6); memory incl. TSV B2 reminder ✓ (T7).
- **Marker mechanics:** T1 Step 1 leaves `<!-- SECTION 2 INSERTS HERE -->`; T1 Step 2 consumes it and leaves `<!-- SECTIONS 3+ INSERT HERE -->`; T2 consumes that. Final H2 order: 1,2,3,4,5,6,7,FAQ — T2 audit verifies.
- **Consistency:** slug + figure prefixes (`cover`, `w2w-d2w-selection-framework`, `ap-decision-chain`) identical across blocks (T1/T2), prompts (T3), uploads (T4).
- **Placeholder scan:** image paths user-provided at gate time; all else concrete.
