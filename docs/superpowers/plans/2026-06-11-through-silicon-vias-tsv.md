# Through-Silicon Vias (TSV) Entity Page — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Advanced Packaging cluster's TSV **entity page** (future TSV mini-hub root) — "Through-Silicon Vias (TSV): Integration Flows, Design Rules, and Manufacturing Challenges" (slug `through-silicon-vias-tsv-guide`) — with the two-layer Integration Selection Matrix as primary asset and the Design-Rule Map as secondary, then wire Phase-B backlinks (incl. one DRIE-page sentence without touching its title/H2s).

**Architecture:** The standard 3-article pipeline (HB-vs-µbump precedent): sequential subagents draft sections into provenance HTML with rule-greps between tasks (R1–R6 incl. the §6 requirements-language HARD AUDIT), Gate-E 4-test editorial audit, cover-first figure gate, llms sync BEFORE publish, one-shot DDB scripts NOT committed, Phase-B Link Pass standard module after.

**Tech Stack:** HTML article fragments (house style), TypeScript + tsx one-shots against Amplify Data, `upload-insights-image.ts` with `AWS_PROFILE=ninescrolls`.

**Spec:** `docs/superpowers/specs/2026-06-11-through-silicon-vias-tsv-design.md`
**Branch:** `insights/tsv-entity-page` (current; spec committed)
**Env for DDB scripts:** `set -a; . ./.env; set +a` then `npx tsx <script>`

---

## Locked metadata

- **Title:** `Through-Silicon Vias (TSV): Integration Flows, Design Rules, and Manufacturing Challenges`
- **Slug:** `through-silicon-vias-tsv-guide`
- **Excerpt:** `Through-silicon vias (TSV) from the packaging engineer's view — via-first vs via-middle vs via-last, TSV design rules by application (HBM, interposer, CIS, 3D logic), integration flow, and manufacturing challenges.`
- **Category:** `Process Integration` · **readTime:** 14 · **author:** `NineScrolls Engineering` · **publishDate:** date of publish
- **Tags:** `["TSV","through-silicon via","advanced packaging","3D integration","via-first","via-middle","via-last","interposer","2.5D"]`
- **relatedProducts:** `JSON.stringify([{href:"/products/icp-etcher",label:"ICP Etching Systems",subtitle:"Deep silicon etch capability for via formation"}])`
- **Schema gotchas:** NO `lastModifiedDate`; `relatedProducts` is `a.json()` → `JSON.stringify`; direct create script with explicit slug, **FAIL-on-existing** (never SKIP).

## Rule → grep table (run between drafting tasks; f = `scripts/articles/through-silicon-vias-tsv-guide.html`)

| Rule | Check |
|---|---|
| R1 | `grep -icE "scallop|C4F8|passivation cycle|Bosch cycle" f` == 0 outside link anchors (verify any hits are inside `<a>…</a>`); no H2 matching `etch.*(process|mechanism|principle)` |
| **R3b** | **`grep -icE "ARDE|microloading|notching|scallop" f` == 0 article-wide** — these are the terms engineers write *naturally* when describing etch behavior; any hit means the page has drifted into DRIE territory regardless of R3's phrasing checks |
| R2 | exactly 1 link each: `/insights/deep-reactive-ion-etching-bosch-process` (in §3), `/insights/wafer-bonding-technologies-for-3d-integration`, HBM4 slug |
| R3 | §6 HARD AUDIT (manual + grep): `awk '/Demands of the Etch/,/Manufacturing Challenges/' f \| grep -icE "control(ling)? the etch|tune|tuning|optimi[sz]e the etch|recipe"` == 0; every ¶ answers "what packaging needs", none "how to etch" |
| R4 | HBM/interposer reference blocks ≤150 words each |
| R5 | total 3,100–3,500: `sed 's/<[^>]*>/ /g' f \| tr -s ' ' '\n' \| grep -c .` |
| R6 | exactly 1 `tsv-integration-selection-matrix` figure block + exactly 1 `tsv-design-rule-map` figure block |
| §4 | pull-quote `grep -c "Via timing is not a process decision" f` == 1; decision-order terms each ≥1: `Thermal budget`, `Alignment`, `foundry` (ownership), `yield` |
| §2 | KOZ pre-seed: `grep -ic "keep-out zone" f` ≥2 and §2 contains the density-limiter sentence (approx form) |
| FAQ | the TSV-etching-vs-DRIE answer is 70–90 words (count its block) |

**Cluster link targets (all required):** DRIE page · wafer-bonding hub · HBM4 (`from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges`) · `hybrid-bonding-vs-micro-bump`.

---

## Task 1: Scaffold + lead + §1 + §2 (KOZ pre-seed, optional anatomy figure block)

**Files:** Create `scripts/articles/through-silicon-vias-tsv-guide.html`

- [ ] **Step 1: Dispatch subagent.** House style: read `scripts/articles/hybrid-bonding-vs-micro-bump.html` (markup conventions, figure blocks, blockquote style). Write ONLY lead + §1 + §2:
  - **Lead (~110w):** entity hook — every 2.5D/3D package stands on vertical copper; this page covers TSV as a *packaging element* (what it is, when to integrate it, how big to design it) and explicitly defers: deep-silicon etch mechanics → DRIE guide link; stacking/bonding → hub link; HBM application → HBM4 link. (R2 anchors land here or §3 per spec; hub+HBM4 here, DRIE in §3.)
  - **§1 `<h2>1. Why 2.5D/3D Integration Needs TSVs</h2>` (~250w):** vertical signal/power paths; interposers, HBM stacks, 3D logic; what TSVs replace (wire-bond/package-trace detours).
  - **§2 `<h2>2. TSV Anatomy and Design Parameters</h2>` (~350w):** the via structure (oxide liner / barrier / seed / Cu fill), the 5 design parameters (diameter, depth, AR, pitch, KOZ). MUST include (approx): *"In TSV design, density is rarely limited by the hole diameter alone; it is often limited by the keep-out zone created by stress, layout rules, and device sensitivity."* Include the OPTIONAL anatomy figure block (prefix `tsv-anatomy`, standard `<picture>` markup, `https://cdn.ninescrolls.com/insights/through-silicon-vias-tsv-guide/` base) — marked clearly so it can be cut if the user skips that figure.
  - Rules: R1 forbidden terms; no "what is DRIE" content. Never `--no-verify`.

- [ ] **Step 2: Rule-grep** (R1 terms=0; hub+HBM4 links present; KOZ ≥2; word count ~710) **+ the pre-seed sentence lock** — `grep -ic "density is rarely limited by the hole diameter" f` must be ≥1 (protects the sentence from later agents editing it away).

- [ ] **Step 3: Commit** — `git add scripts/articles/through-silicon-vias-tsv-guide.html && git commit -m "feat(insights): TSV scaffold + lead + §1-2"`

## Task 2: §3 Integration Flow (compressed) + §6 + §7

(§3 and §6/§7 batched so the §4–§5 climax tasks stay focused.)

- [ ] **Step 1: Dispatch subagent.** Append:
  - **§3 `<h2>3. From Wafer to Stack: The TSV Integration Flow</h2>` (250–300w):** the step sequence (pattern → via formation → liner/barrier/seed → Cu fill+anneal → CMP → reveal → stack integration) told as *setup for §4*, NOT the story. Via-formation step = ONE sentence + the DRIE defer link: "vias are typically formed by deep reactive ion etching — for how Bosch and cryogenic processes achieve these profiles, see our <a href=/insights/deep-reactive-ion-etching-bosch-process>DRIE guide</a>." End §3: "the real decision is not how each step works — it is WHERE IN THE FLOW the via gets made" → hands to §4.
  - **§6 `<h2>6. What the Packaging Spec Demands of the Etch</h2>` (~300w):** REQUIREMENTS LANGUAGE ONLY (R3 hard audit): depth/AR targets per application class; CD + depth uniformity (plating window); sidewall smoothness & taper (liner/barrier step coverage); bottom profile (reveal). Each stated as "the package requires X because Y-downstream-step needs it." Closes with the DRIE defer (one more anchor allowed). FORBIDDEN: control/tune/optimize-the-etch phrasing.
  - **§7 `<h2>7. Manufacturing Challenges and Cost</h2>` (~300w):** cost-per-via & cost-per-wafer drivers; Cu pumping & stress → KOZ; test access/known-good-die; yield stack-up across the chain.

- [ ] **Step 2: Rule-grep + §6 HARD AUDIT** (read every §6 paragraph; any mechanism-language sentence → rewrite as requirement; grep from rule table **including R3b** — ARDE/microloading/notching/scallop = 0; these leak in §6 most easily).

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): TSV §3 integration flow + §6 etch requirements + §7 challenges"`

## Task 3: §4 Via-First/Middle/Last (THE THOUGHT CORE — manual read required)

- [ ] **Step 1: Dispatch subagent.** Insert §4 between §3 and §6 (file order: …§3, §4, §5 placeholder comment, §6…— instruct the agent to insert at the marked position; simplest: Task 2's agent leaves `<!-- §4 §5 here -->` after §3, this task replaces it).
  **§4 `<h2>4. Via-First vs Via-Middle vs Via-Last</h2>` (800–900w):**
  - OPENS with the Key Insight pull-quote (styled blockquote, same CSS as HB-vs-µbump):
    *"Via timing is not a process decision. It is a thermal-budget and ownership decision — who makes the via, and what has already been built when they do."*
  - The three timings, each ~180–220w: **Via-first** (before FEOL: via survives all thermal steps → conservative materials, foundry rarely offers it); **Via-middle** (after FEOL, before BEOL: the mainstream for HBM/3D logic — fine vias, foundry owns it, alignment to transistors native); **Via-last** (after BEOL, often from the backside: OSAT-ownable, coarser vias, protects finished wafers — CIS heritage).
  - The 4-step decision order as an `<ol>` with EXACT bolded terms: **Thermal budget** → **Alignment requirement** → **FEOL/foundry compatibility & ownership** → **Cost & yield risk**.
  - Primary asset figure block (prefix `tsv-integration-selection-matrix`) + how-to-read sentence. Hedged claims ("typically", "commonly").
- [ ] **Step 2: Greps** (pull-quote=1; 4 terms present; §4 words 800–900) **+ full manual read** (this section carries the page).

- [ ] **Step 2b: Gate-C — early collapse test (do NOT wait for Gate-E).** Mentally delete §4: the article MUST collapse into a generic "TSV overview." If the remaining sections still feel like a complete article, §4 is too weak — the via-timing analysis is the ONLY thing this page owns that nothing else on the web does. Rewrite §4 until its removal guts the piece. Gate-E re-runs this test later as confirmation; Gate-C catches it while rewriting is cheap.
- [ ] **Step 3: Commit** — `git commit -am "feat(insights): TSV §4 via-timing thought core + Key Insight + selection matrix block"`

## Task 4: §5 Design Rules + §8 + FAQ/Related/CTA + FULL AUDIT + Gate-E

- [ ] **Step 1: Dispatch subagent.** Append after §4:
  - **§5 `<h2>5. TSV Design Rules by Application</h2>` (~400w):** the four application classes (CIS smallest/densest → 3D logic → HBM → interposer largest/sparsest); an HTML table Application × {Diameter, Depth, AR, Pitch, KOZ} with header "Typical range / relative tendency" and hedged range values (e.g. CIS "~1–5 µm" class; interposer "~10 µm+" class — conservative, literature-framed, no absolutes); the secondary asset figure block (prefix `tsv-design-rule-map`) whose `<figcaption>` MUST end with: *"Ranges are application-dependent and should be treated as design-space anchors, not universal specifications."* HBM/interposer prose ≤150w each with HBM4/hub link-outs (R4).
  - **§8 `<h2>8. Key Takeaways</h2>` (~150w):** entity recap + the timing principle + density-is-KOZ-bound + design-space anchors.
  - **FAQ (4):** What is a TSV? (entity page owns this) · Via-first vs via-middle vs via-last in one paragraph · How dense can TSVs be? (KOZ answer) · **Is TSV etching the same as DRIE? — EXACTLY the locked 70–90w structure:** "TSV etching is the packaging requirement; DRIE is one common silicon-etching technology used to form high-aspect-ratio vias. This article covers the TSV integration and packaging requirements. For etch mechanisms, Bosch/cryo trade-offs, and profile control, see the <a href=/insights/deep-reactive-ion-etching-bosch-process>DRIE guide</a>." (pad to 70–90w with one context sentence).
  - **Related Articles** (4 cluster links incl. `hybrid-bonding-vs-micro-bump`) + CTA (`/contact`, etch/deposition capability for via formation flows).

- [ ] **Step 2: FULL AUDIT** — every row of the rule→grep table, incl. per-block word counts (R4 ≤150, FAQ 70–90), R5 total 3,100–3,500. Over → trim §1/§7/FAQ, never §4. Under → deepen §4/§5.

- [ ] **Step 3: Gate-E (4 tests, human judgment):** (1) cover the title — still obviously "TSV as packaging entity"? (2) remove figures — argument stands in prose? (3) **delete §4 — article must collapse** (if it survives, §4 fails); (4) delete §4's figure — the via-timing framework must survive in prose. Fix and re-run until 4/4.

- [ ] **Step 4: Commit** — `git commit -am "feat(insights): TSV §5+§8+FAQ/CTA + full audit + Gate-E"`

## Task 5: Figure prompts + cover-first gate (USER ACTION)

- [ ] **Step 1: Write `/tmp/tsv-figure-prompts.md`:**

**① COVER (approve first; 3:2 navy hero):** Ultra-high-res editorial cover, deep navy (#1e3a5f) gradient. Subject: a glowing cross-section of a 3D die stack on an interposer, with bright copper through-silicon vias passing vertically through the silicon layers like pillars of light, connecting stacked dies top to bottom; one via shown enlarged in cutaway revealing liner/barrier/copper core. Electric-blue + copper palette, premium material realism, no people. Text: header "NINESCROLLS · INSIGHTS", title "Through-Silicon Vias (TSV)", subtitle "Integration Flows · Design Rules · Manufacturing", footer "ninescrolls.com". Perfect spelling.

**② §4 PRIMARY — TSV Integration Selection Matrix (`tsv-integration-selection-matrix`, ~1200×900, white bg, brand palette):** A two-layer reference MATRIX (not a flowchart). Three columns: VIA-FIRST · VIA-MIDDLE · VIA-LAST (column headers with small timeline icons: before FEOL / between FEOL and BEOL / after BEOL). Seven rows: Best for · Thermal budget · Alignment requirement · Foundry ownership · Cost · Yield risk · Typical use cases (cells: Via-middle → "HBM, 3D logic"; Via-last → "CIS, backside power/coarse vias"; Via-first → "rare — specialty"). Short verdict text per cell, green/amber/red tint accents. Add a **Technology Ownership icon layer**: each column carries a small ownership badge — Via-First/Via-Middle: "FOUNDRY", Via-Last: "OSAT / Foundry" — visually expressing the Key Insight's "ownership decision". Beneath the matrix a horizontal decision-order strip: "1 Thermal budget → 2 Alignment → 3 Foundry ownership → 4 Cost & yield". Footer "ninescrolls.com · TSV Integration Selection Framework". All text exactly as written, perfectly spelled.

**③ §5 SECONDARY — TSV Design-Rule Map (`tsv-design-rule-map`, ~1200×900, white bg):** Top: compact table Application (CIS / 3D Logic / HBM / Interposer) × (Diameter · Depth · Aspect Ratio · Pitch · Keep-Out Zone), **figure values are RELATIVE ONLY — "Very small / Small / Medium / Large" + trend arrows, NO absolute µm numbers in the image** (figures get screenshotted and travel without their disclaimers; the hedged numeric ranges live only in the article's HTML table where the caption guards them) — header note "Typical range / relative tendency". Bottom: a 2-axis design space, x = Via diameter (small→large), y = TSV density (high→low), with four labeled ellipses: CIS (top-left, smallest/densest), 3D Logic, HBM, Interposer (bottom-right, largest/sparsest). Footer "ninescrolls.com · TSV Design Rules by Application". Caption space noting design-space anchors.

**④ OPTIONAL — TSV anatomy mini (`tsv-anatomy`, compact):** cross-section of one via: silicon, oxide liner, barrier, Cu fill, surrounding KOZ ring annotated "keep-out zone (stress)". Cuttable if skipped — then remove the §2 figure block.

- [ ] **Step 2: GATE — user generates ① → approve → ② ③ (④ optional).** Verify microtext/numbers match the article before accepting.

## Task 6: Import draft → upload figures → llms sync → publish → verify

- [ ] **Step 1: One-shot `scripts/create-tsv-article.ts`** (NOT committed; FAIL-on-existing):

```typescript
/** One-shot: create TSV entity page as draft with explicit slug. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });
const SLUG = 'through-silicon-vias-tsv-guide';
(async () => {
  await authenticate();
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  if (existing?.length) { console.error(`FAIL: slug exists, id=${(existing[0] as any).id}. Use an update one-shot.`); process.exit(1); }
  const { data, errors } = await client.models.InsightsPost.create({
    title: 'Through-Silicon Vias (TSV): Integration Flows, Design Rules, and Manufacturing Challenges',
    slug: SLUG,
    content: readFileSync('scripts/articles/through-silicon-vias-tsv-guide.html', 'utf-8'),
    excerpt: "Through-silicon vias (TSV) from the packaging engineer's view — via-first vs via-middle vs via-last, TSV design rules by application (HBM, interposer, CIS, 3D logic), integration flow, and manufacturing challenges.",
    author: 'NineScrolls Engineering',
    publishDate: new Date().toISOString().slice(0, 10),
    category: 'Process Integration',
    readTime: 14,
    imageUrl: 'https://cdn.ninescrolls.com/insights/through-silicon-vias-tsv-guide/cover-lg',
    tags: ['TSV','through-silicon via','advanced packaging','3D integration','via-first','via-middle','via-last','interposer','2.5D'],
    relatedProducts: JSON.stringify([{ href: '/products/icp-etcher', label: 'ICP Etching Systems', subtitle: 'Deep silicon etch capability for via formation' }]) as any,
    isStandaloneComponent: false,
    isDraft: true,
  } as any);
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : `CREATED draft id=${(data as any).id}`);
})().catch((e) => { console.error(e); process.exit(1); });
```

Run; expect `CREATED draft id=…`.

- [ ] **Step 2: Upload figures** (user-provided paths):

```bash
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts through-silicon-vias-tsv-guide <cover> --name cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts through-silicon-vias-tsv-guide <matrix> --name tsv-integration-selection-matrix --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts through-silicon-vias-tsv-guide <map> --name tsv-design-rule-map --no-update-cover
# optional: ... <anatomy> --name tsv-anatomy --no-update-cover   (else strip the §2 figure block + re-push content)
```

- [ ] **Step 3: llms sync BEFORE publish.** `public/llms.txt` (AP section, before the HBM entry):

```markdown
- [Through-Silicon Vias (TSV) Guide](https://ninescrolls.com/insights/through-silicon-vias-tsv-guide): TSV as a packaging element — via-first vs via-middle vs via-last integration, TSV design rules by application (CIS, HBM, interposer, 3D logic), keep-out zones, what the packaging spec demands of the etch, and manufacturing cost drivers
```

`public/llms-full.txt` (before the 16-Hi HBM block):

```markdown
**Through-Silicon Vias (TSV): Integration Flows, Design Rules, and Manufacturing Challenges**
URL: https://ninescrolls.com/insights/through-silicon-vias-tsv-guide
Summary: Entity guide to TSVs from the packaging engineer's view. Covers TSV anatomy and design parameters (diameter, depth, aspect ratio, pitch, and the keep-out zone as the real density limiter), the wafer-to-stack integration flow, and the central decision: via-first vs via-middle vs via-last — framed by the principle that via timing is a thermal-budget and ownership decision, applied through a four-step order (thermal budget → alignment → foundry ownership → cost & yield). Includes the TSV Integration Selection Matrix and a Design-Rule Map by application (CIS, 3D logic, HBM, interposer; ranges as design-space anchors). States packaging requirements on the etch (depth, uniformity, sidewall for liner and plating) and defers etch mechanisms to the DRIE guide; bonding to the Wafer Bonding hub; application narrative to the 16-Hi HBM article.
```

- [ ] **Step 4: Entity Ownership Audit (pre-publish, human judgment).** Read the article as a stranger who searched "what is a TSV". After reading, do they clearly know: (a) what a TSV *is*, (b) *when* to use one, (c) *why* via-first/middle/last? If the honest answer is "they know the TSV *process*" rather than "they know the TSV *entity*", the page has failed its charter — fix before publishing (usually: strengthen §1/§2 definition framing, not add process detail).

- [ ] **Step 5: Publish** (`update({id, isDraft:false})`), verify in DDB (title/slug/figures/pull-quote), CDN 200s, live render check (Chrome: title, H2s, pull-quote, matrix figure).

- [ ] **Step 6: Delete one-shot** — `rm scripts/create-tsv-article.ts`

## Task 7: Commit provenance + llms + PR

- [ ] **Step 1:**

```bash
git add scripts/articles/through-silicon-vias-tsv-guide.html public/llms.txt public/llms-full.txt docs/superpowers/plans/2026-06-11-through-silicon-vias-tsv.md
git commit -m "feat(insights): Through-Silicon Vias (TSV) entity page + llms sync"
git push -u origin insights/tsv-entity-page
gh pr create --title "feat(insights): Through-Silicon Vias (TSV) entity page (Advanced Packaging spoke #5)" --body "TSV as a first-class packaging entity (Gate 0.5 Create; packaging-first, defers etch mechanics to DRIE). Two-asset hierarchy: Integration Selection Matrix (primary) + Design-Rule Map with KOZ (secondary). Key Insight: via timing = thermal-budget + ownership decision. R1-R6 + §6 requirements-language hard audit + Gate-E 4/4. Live in DDB; provenance + llms in this diff.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Task 8: Phase-B Link Pass (standard module; one-shot NOT committed)

- [ ] **Step 1: Fetch verbatim anchors** (read-only tsx): hub (a TSV/interposer mention region), HBM4 (TSV mention), `hybrid-bonding-vs-micro-bump` (§7 or takeaways tail), DRIE page §4 Applications (its TSV application sentence).
- [ ] **Step 2: One-shot `scripts/tsv-backlinks.ts`** — standard module (rx() tolerant find, exactly-one-match guard, idempotency on `/insights/through-silicon-vias-tsv-guide`, --dry-run). FOUR edits:
  1. **hub** → "For TSVs as a packaging element — integration timing and design rules — see <a>Through-Silicon Vias (TSV)</a>."
  2. **HBM4** → similar one sentence at its TSV/packaging-implications region.
  3. **hybrid-bonding-vs-micro-bump** → one sentence near takeaways/related ("the other half of the vertical interconnect story — the via that carries signals through silicon — see…").
  4. **DRIE §4 Applications** → one sentence after its TSV application mention: "For TSV as a packaging element — via-first/middle/last and design rules — see <a>Through-Silicon Vias (TSV)</a>." **Touch ONLY that body sentence; the DRIE title and H2s must remain byte-identical** (RIE-cluster R5/R6) — verify with a before/after grep of its title + H2 list.
- [ ] **Step 3: Phase-B1 (immediate) — dry-run → apply edits 1–3 only** (hub, HBM4, hybrid-bonding-vs-micro-bump); verify each links the TSV page exactly once and the TSV page links back → keep the one-shot for B2.

- [ ] **Step 4: Phase-B2 (deferred ~1 week) — the DRIE edit.** DRIE is a mature traffic page (page-1 positions on its own terms); its edit cost is higher than the other three. After ~1 week with no anomalies on the TSV page, apply edit 4 (DRIE §4 Applications sentence), verify the DRIE **title and full H2 list are byte-identical** before/after, then `rm scripts/tsv-backlinks.ts`. Record the pending B2 in memory so it isn't lost.

## Task 9: Memory + wrap

- [ ] **Step 1: Update `memory/seo_strategy.md`:** TSV entity page published (slug/id/PR#, two assets, Key Insight, entity-architecture principle "Packaging Entity → Process Technology"); Advanced Packaging cluster = **6 pages** (hub, surface-prep, FA, HB-vs-µbump, TSV, HBM4); TSV = future mini-hub root (sub-page candidates: TSV Reveal, Cu Filling, TSV Reliability, Interposer); next spoke = **Wafer-to-Wafer vs Die-to-Wafer** (selection pair) → Temporary Bonding → HBM Reliability.
- [ ] **Step 2: Report** with live URL + PR + verification evidence.

---

## Self-review

- **Spec coverage:** title/slug/meta ✓ (T6); R1–R6 each in the grep table + per-task checks; §2 KOZ pre-seed ✓ (T1); §3 compressed + handoff line ✓ (T2); §4 thought core + Key Insight + decision order ✓ (T3, manual read); §5 hedged table + caption disclaimer ✓ (T4); §6 hard audit ✓ (T2 Step 2); FAQ locked structure ✓ (T4); two-asset hierarchy + optional anatomy ✓ (T5); Gate-E 4 tests ✓ (T4); llms-before-publish ✓ (T6); Phase-B incl. DRIE-protection check ✓ (T8); memory ✓ (T9).
- **Section-order note:** Task 2 writes §3+§6+§7 and leaves a `<!-- §4 §5 here -->` marker; T3 inserts §4 at the marker; T4 inserts §5 between §4 and §6 (replace the remaining marker). The final file order must be lead, §1, §2, §3, §4, §5, §6, §7, §8, FAQ, Related, CTA — T4's audit verifies H2 order.
- **Placeholders:** figure paths intentionally user-provided at gate time; all else concrete.
- **Consistency:** slug + figure prefixes (`cover`, `tsv-integration-selection-matrix`, `tsv-design-rule-map`, `tsv-anatomy`) identical across article blocks (T1/T3/T4), prompts (T5), and upload commands (T6).
