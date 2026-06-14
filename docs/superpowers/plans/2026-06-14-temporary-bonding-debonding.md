# Temporary Wafer Bonding & Debonding (AP spoke #7) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the AP cluster's Temporary Bonding entity page — "Temporary Wafer Bonding and Debonding: Thin-Wafer Processing for Advanced Packaging" (slug `temporary-wafer-bonding-debonding`) — owning the reversible carrier system, with the Debonding Method Selection matrix as the dominant climax (§5) and the Thin-Wafer Processing Flow Map as the page-canonical primary asset (§3).

**Architecture:** The standard 5th-run pipeline (TSV/W2W precedent): sequential subagents draft into provenance HTML with rule-greps between tasks (R1/R3b + §5-dominance grep), Gate-C after §5, Gate-E + Gate-F + Intent audit + the Debond-Matrix-Ownership Test at completion, cover-first figure gate, llms sync BEFORE publish, one-shot DDB scripts NOT committed, Phase-B1 only.

**Tech Stack:** HTML article fragments (house style = `scripts/articles/wafer-to-wafer-vs-die-to-wafer.html`), TypeScript + tsx one-shots against Amplify Data, `upload-insights-image.ts` with `AWS_PROFILE=ninescrolls`.

**Spec:** `docs/superpowers/specs/2026-06-14-temporary-bonding-debonding-design.md`
**Branch:** `insights/temporary-bonding-debonding` (current; spec committed)
**Env for DDB scripts:** `set -a; . ./.env; set +a` then `npx tsx <script>`

---

## Locked metadata

- **Title:** `Temporary Wafer Bonding and Debonding: Thin-Wafer Processing for Advanced Packaging`
- **Slug:** `temporary-wafer-bonding-debonding`
- **Excerpt:** `Temporary wafer bonding and debonding for advanced packaging — why thinned device wafers need a carrier, the thin-wafer processing flow, and how to choose a debonding method (laser, thermal-slide, mechanical, chemical) by thermal budget and device sensitivity.`
- **Category:** `Process Integration` · **readTime:** 13 · **author:** `NineScrolls Engineering` · **publishDate:** date of publish
- **Tags:** `["temporary wafer bonding","wafer debonding","carrier wafer","thin wafer handling","laser debonding","advanced packaging","3D integration","wafer thinning"]`
- **relatedProducts:** `JSON.stringify([{href:"/products/plasma-cleaner",label:"Plasma Cleaners",subtitle:"Surface preparation for wafer bonding flows"}])` — metadata routes; BODY never says "plasma activation".
- **Schema gotchas:** NO `lastModifiedDate`; `relatedProducts` is `a.json()` → `JSON.stringify`; FAIL-on-existing create with explicit slug.

## Rule → grep table (f = `scripts/articles/temporary-wafer-bonding-debonding.html`)

| Rule | Check |
|---|---|
| R1 | `grep -ic "what is hybrid bonding" f` == 0; no H2 explaining permanent-bonding or TSV-reveal mechanics |
| R3b | permanent-bonding terms only inside anchors: `grep -oE "(hybrid bond|fusion bond|Cu-Cu|Cu–Cu|dielectric bond)" f` — every hit must sit inside an `<a>…</a>`; verify by eye. TSV-reveal internals (via-tip CMP, backside metallization) absent as prose mechanics. |
| Principle | `grep -c "Thin-wafer processing is a coupled system" f` == 1 (pull-quote; figcaption uses a short variant) |
| Role sentence | `grep -c "rarely appears in the final package" f` == 1 (§7) |
| **§5 dominance** | `awk` word counts: **words(§5) ≥ words(§1)+words(§2)** AND §5 in 800–900 |
| Flow-map last step | `grep -c "Carrier Removal" f` ≥1; `grep -icE "permanent bond(ing)? *(&[a-z]+;\| )*(→\|->\|then) *debond" f` == 0 (no fixed permanent→debond chain) |
| §6 caps | per-`<h3>` ≤120 words each |
| FAQ5 lock | the temp+hybrid answer 70–90w, contains "outside" (scope) + links hybrid/hub |
| R-length | total 3,100–3,500 |
| Hedge | `grep -icE "(laser|thermal-slide|mechanical|chemical) debond(ing)? (is the|is always|must be) " f` == 0; adoption claims hedged |
| Figures | exactly 1 `thin-wafer-processing-flow-map` block + exactly 1 `debonding-method-selection-matrix` block |
| Links | each ≥1: wafer-bonding hub, through-silicon-vias-tsv-guide, 16-hi-hbm, hybrid-bonding-vs-micro-bump, wafer-to-wafer-vs-die-to-wafer, surface-preparation-cu-cu |

**Cluster link targets:** hub `wafer-bonding-technologies-for-3d-integration` · TSV `through-silicon-vias-tsv-guide` · HBM4 `from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges` · HB-vs-µbump `hybrid-bonding-vs-micro-bump` · W2W `wafer-to-wafer-vs-die-to-wafer` · surface-prep `surface-preparation-cu-cu-hybrid-bonding`.

---

## Task 1: Scaffold + lead + §1 + §2 + §3 (Flow Map, primary asset)

- [ ] **Step 1: Dispatch subagent.** House style: read `scripts/articles/wafer-to-wafer-vs-die-to-wafer.html`. Create `scripts/articles/temporary-wafer-bonding-debonding.html`:
  - **Lead (~110w):** counterintuitive hook — temporary bonding is bonding done *in order to un-bond*: a device wafer is glued to a carrier so it can be thinned and processed, then released. Defer: permanent-bonding mechanics → hub (link `/insights/wafer-bonding-technologies-for-3d-integration`); the via and its reveal → TSV (link `/insights/through-silicon-vias-tsv-guide`); the HBM story → HBM4 (link, optional here or §6). State the page's spine: what the carrier system is, the flow it enables, and — the hard part — how to get the carrier back off.
  - **§1 `<h2 id="what-is">1. What Is Temporary Wafer Bonding?</h2>` (~220w):** the reversible three-part system (adhesive + carrier + debond method); exists because silicon thinned below ~100 µm cannot be handled, chucked, or thermally cycled on its own.
  - **§2 `<h2 id="why-carrier">2. Why Thin Wafers Need a Carrier</h2>` (~280w):** the handling problem — thinned device wafers warp, crack, and cannot survive automated handling or downstream thermal steps; the carrier is a temporary stiffener. Pre-seed the coupling: the adhesive must survive every downstream step (temperature, grinding stress, chemicals) AND still release cleanly — a contradiction that §5 resolves.
  - **§3 `<h2 id="flow">3. The Thin-Wafer Processing Flow</h2>` (~460w):** OPENS with the LOCKED principle pull-quote (house blockquote markup):
    *"Thin-wafer processing is a coupled system. Carrier selection, temporary bonding, wafer thinning, TSV reveal, and debonding must be engineered together rather than optimized independently."*
    Then the step sequence with per-step handling/stress/yield risk: Device Wafer → Temporary Bond → Carrier Wafer → Back Grinding → Stress Relief → TSV Reveal (one sentence, defer reveal mechanics to TSV) → Downstream Integration → **Carrier Removal (Debond)**. Explicitly note the last two are NOT a fixed series: in some flows the carrier comes off before permanent integration, in others after — temporary and permanent bonding are not a replace-in-sequence pair. End §3 by handing to §4: the one step the flow makes look trivial — getting the carrier back off — is the hardest. Include the Flow-Map figure block:

```html
<figure class="post-figure">
  <picture>
    <source srcset="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/thin-wafer-processing-flow-map-xl.webp" media="(min-width: 1280px)" type="image/webp" />
    <source srcset="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/thin-wafer-processing-flow-map-lg.webp" media="(min-width: 1024px)" type="image/webp" />
    <source srcset="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/thin-wafer-processing-flow-map-md.webp" media="(min-width: 768px)" type="image/webp" />
    <source srcset="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/thin-wafer-processing-flow-map-sm.webp" media="(max-width: 767px)" type="image/webp" />
    <img src="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/thin-wafer-processing-flow-map-lg.png" alt="Thin-wafer processing flow: device wafer, temporary bond, carrier, back grinding, stress relief, TSV reveal, downstream integration, and carrier removal (debond), each step tagged with handling, stress, and yield risk" loading="lazy" decoding="async" style="width:100%;border-radius:8px;margin:16px 0" />
  </picture>
  <figcaption>The thin-wafer processing flow &mdash; from temporary bond to carrier removal &mdash; with each step's handling, stress, and yield risk. The flow is a coupled system: the adhesive chosen at the start must survive every step and still release cleanly at the end.</figcaption>
</figure>
```
  - Rules: R1/R3b forbidden mechanics; never `--no-verify`.

- [ ] **Step 2: Rule-grep** (R3b permanent-bond terms = 0 in prose; principle ==1; "Carrier Removal" present; no permanent→debond chain; hub+TSV links present; §1+§2+§3 ≈ 960w).

- [ ] **Step 3: Commit** — `git add scripts/articles/temporary-wafer-bonding-debonding.html && git commit -m "feat(insights): temp-bonding scaffold + §1-3 + Flow Map (coupling principle)"`

## Task 2: §4 bridge + §5 Debonding Method Selection (CLIMAX) + Gate-C + Debond-Matrix Ownership Test

- [ ] **Step 1: Dispatch subagent.** Append:
  - **§4 `<h2 id="why-hard">4. Why Debonding Is the Hard Part</h2>` (~280w):** the asymmetry — bonding a full-thickness device wafer to a carrier is the easy half; releasing a now-fragile, thinned, possibly through-via'd device wafer without cracking it, contaminating it, or stressing its devices is the real engineering problem. The adhesive that had to survive grinding and heat now has to let go on command. This is why debonding, not bonding, decides the process. Hand to §5.
  - **§5 `<h2 id="debond-selection">5. Debonding Method Selection</h2>` (800–900w) — THE CLIMAX:** four methods, each its own `<h3>`, argued (NOT just described) across thermal budget, throughput, device/mechanical sensitivity, residue & cleanup, cost:
    - `<h3>Laser Debonding</h3>` — a release layer absorbs laser energy through a transparent carrier; room-temperature release, low mechanical stress, high device-sensitivity tolerance; needs a transparent carrier + laser tool; residue/cleanup considerations.
    - `<h3>Thermal-Slide Debonding</h3>` — adhesive softened by heat, carrier slid off; simple and high-throughput, but spends thermal budget and applies shear — wrong for thermally or mechanically fragile stacks.
    - `<h3>Mechanical (Peel) Debonding</h3>` — room-temperature peel/lift; fast and tool-light, but the most mechanically aggressive — fit depends on how much force the thinned device can take.
    - `<h3>Chemical (Solvent) Debonding</h3>` — solvent dissolves/releases the adhesive; gentle thermally and mechanically but slow, with edge-access and solvent-compatibility constraints.
    - Closing synthesis (~80w): the choice resolves on two axes — how much thermal budget remains, and how mechanically sensitive the thinned device is — which is exactly what the matrix maps. Hedged throughout (typically/commonly/often). Include the matrix figure block:

```html
<figure class="post-figure">
  <picture>
    <source srcset="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/debonding-method-selection-matrix-xl.webp" media="(min-width: 1280px)" type="image/webp" />
    <source srcset="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/debonding-method-selection-matrix-lg.webp" media="(min-width: 1024px)" type="image/webp" />
    <source srcset="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/debonding-method-selection-matrix-md.webp" media="(min-width: 768px)" type="image/webp" />
    <source srcset="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/debonding-method-selection-matrix-sm.webp" media="(max-width: 767px)" type="image/webp" />
    <img src="https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/debonding-method-selection-matrix-lg.png" alt="Debonding method selection matrix: laser, thermal-slide, mechanical, and chemical debonding placed by thermal budget and mechanical sensitivity" loading="lazy" decoding="async" style="width:100%;border-radius:8px;margin:16px 0" />
  </picture>
  <figcaption>The debonding method selection matrix: laser, thermal-slide, mechanical, and chemical debonding mapped by thermal budget and device sensitivity. The method follows the two constraints the thinned device imposes.</figcaption>
</figure>
```

- [ ] **Step 2: §5-dominance grep + Gate-C + Debond-Matrix Ownership Test.**
  - Word check: `words(§5)` 800–900 AND `≥ words(§1)+words(§2)`.
  - **Gate-C:** delete §5 mentally — the article must collapse to a generic temporary-bonding overview. If it survives, §5 is too weak.
  - **Debond-Matrix Ownership Test (user-added, stricter):** delete the four method `<h3>` blocks — if the remaining article still stands as a coherent piece, it regressed to a temporary-bonding overview = FAIL. §5's argument must hang on the four methods' *differences*, not on surrounding scaffolding. Rewrite until removal of the four methods guts the page.

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): temp-bonding §4 + §5 debond selection climax (Gate-C + matrix-ownership pass)"`

## Task 3: §6 + §7 + §8 + FAQ/Related/CTA + FULL audit + Gate-E/F + Intent

- [ ] **Step 1: Dispatch subagent.** Append:
  - **§6 `<h2 id="applications">6. Where Thin-Wafer Handling Shows Up</h2>` (~300w):** three `<h3>` snapshots, **≤120w each**, hedged, link out: TSV-enabled 3D stacks (link TSV); HBM stacks (link HBM4 — NO generational detail); power & compound-semiconductor thinning (GaN/SiC devices thinned for thermal/electrical performance). Each ties back to "the carrier made this possible."
  - **§7 `<h2 id="enablement-layer">7. The Enablement Layer</h2>` (~240w):** the role framing — temporary bonding is the AP **enablement layer**, a distinct role from TSV (vertical-interconnect layer) and hybrid bonding (connection layer; link `/insights/hybrid-bonding-vs-micro-bump`). Contains the LOCKED role sentence: *"Temporary bonding rarely appears in the final package, yet it enables many of the manufacturing steps that make advanced packaging possible."* Link the decision-chain context in prose (W2W `/insights/wafer-to-wafer-vs-die-to-wafer`, surface-prep `/insights/surface-preparation-cu-cu-hybrid-bonding`). Do NOT redraw the AP Decision Chain map — reference it in words.
  - **§8 `<h2 id="takeaways">8. Key Takeaways</h2>` (~150w):** coupling principle restated (not verbatim); debond is the hard part; method choice = thermal budget × device sensitivity; final bullet = decision-chain hook (names TSV + the bonding decisions).
  - **FAQ (5) `<h2>Frequently Asked Questions</h2>`:**
    1. "What is temporary wafer bonding?" — entity answer.
    2. "What is wafer debonding?" — the release step + names the four method families.
    3. "Why use a carrier wafer?" — thin-wafer handling answer.
    4. "What is the difference between laser and thermal-slide debonding?" — one tight paragraph (room-temp/low-stress vs heat/throughput).
    5. **"Can temporary bonding be used with hybrid bonding?" — 70–90w, defer-style:** "Yes. Temporary bonding is commonly used to support thin wafers before downstream bonding operations. The bonding mechanism itself — how the permanent interface forms — is outside this article's scope; see our <a href=\"/insights/hybrid-bonding-vs-micro-bump\">hybrid bonding comparison</a> and the <a href=\"/insights/wafer-bonding-technologies-for-3d-integration\">wafer bonding hub</a>." (pad to 70–90w with one bridging sentence.)
  - **Related Articles** (hub, TSV, HB-vs-µbump, W2W, HBM4) + CTA (`/contact`, surface preparation and cleaning systems for wafer bonding flows — never "plasma activation").

- [ ] **Step 2: FULL AUDIT** — every grep-table row; §6 per-h3 ≤120; FAQ5 70–90w; R-length 3,100–3,500 (over → trim §1/§2/§6/FAQ, NEVER §5); hedge; both figures; all 6 links; §5-dominance still holds.

- [ ] **Step 3: Gate-E + Gate-F + Intent (human judgment):**
  - Gate-E: (1) cover title → still obviously "temporary bonding + which debond method"; (2) remove figures → argument stands; (3) delete §5 → collapses; (4) delete the matrix figure → the four-method framework survives in prose.
  - **Gate-F Reversal Test:** delete every temporary-bonding / carrier / debond term — must collapse into nonsense (else generic wafer-processing article = FAIL).
  - Intent-Ownership audit: reader leaves knowing the DEBOND DECISION + the carrier's enabling role, not a bonding overview.

- [ ] **Step 4: Commit** — `git commit -am "feat(insights): temp-bonding §6-8 + FAQ/CTA + full audit + Gate-E/F"`

## Task 4: Figure prompts + cover-first gate (USER ACTION)

- [ ] **Step 1: Write `/tmp/tempbond-figure-prompts.md`:**

**① COVER (approve first; 3:2 navy hero):** Ultra-high-res editorial cover, deep navy (#1e3a5f) gradient. Subject: a thin device wafer bonded by a glowing adhesive layer onto a thick carrier wafer beneath it; the pair flipped so the device wafer's back is being thinned (a grinding/representation of material removal); on one side, a laser beam passes through the carrier to release the bond (bright release line). Convey "bonded to be processed, then released." Cool blue/violet + warm laser accent. Text: header "NINESCROLLS · INSIGHTS", title "Temporary Wafer Bonding & Debonding", subtitle "Thin-Wafer Processing for Advanced Packaging", footer "ninescrolls.com". No people, perfect spelling.

**② Fig A — Thin-Wafer Processing Flow Map (`thin-wafer-processing-flow-map`, ~1200×800, white bg, brand palette):** a left-to-right (or top-down) process flow, eight nodes as rounded cards: Device Wafer → Temporary Bond → Carrier Wafer → Back Grinding → Stress Relief → TSV Reveal → Downstream Integration → Carrier Removal (Debond). Under each node, three small relative risk badges: Handling / Stress / Yield, each Low/Med/High (color dot — green/amber/red). NO numbers. Visually separate the final node "Carrier Removal (Debond)" so it doesn't read as a strict cause of "Downstream Integration" (e.g. a dashed bracket grouping the back-end, or a note "order varies by flow"). Footer "ninescrolls.com · Thin-Wafer Processing Flow".

**③ Fig B — Debonding Method Selection Matrix (`debonding-method-selection-matrix`, ~1100×900, white bg):** a 2×2 conceptual map. X-axis "Thermal Budget" (Low → High). Y-axis "Mechanical / Device Sensitivity" (Low → High). Place four labeled method regions: Laser (high sensitivity tolerance / low thermal need — room-temp, gentle), Chemical (gentle both axes / slow), Thermal-Slide (needs thermal budget / moderate stress), Mechanical (low cost / high mechanical stress). Each method box carries 2-3 relative tags (e.g. Laser: "Room-temp · Low stress · Transparent carrier"). NO absolute temperatures or times. Footer "ninescrolls.com · Debonding Method Selection".

- [ ] **Step 2: GATE — user generates ① → approve → ② ③.** Cross-check microtext against the article (eight flow nodes incl. "Carrier Removal (Debond)"; four method names; axis labels).

## Task 5: Import draft → upload → llms BEFORE publish → publish → verify

- [ ] **Step 1: One-shot `scripts/create-tempbond-article.ts`** (NOT committed; FAIL-on-existing):

```typescript
/** One-shot: create Temporary Bonding page as draft. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });
const SLUG = 'temporary-wafer-bonding-debonding';
(async () => {
  await authenticate();
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  if (existing?.length) { console.error(`FAIL: slug exists, id=${(existing[0] as any).id}. Use an update one-shot.`); process.exit(1); }
  const { data, errors } = await client.models.InsightsPost.create({
    title: 'Temporary Wafer Bonding and Debonding: Thin-Wafer Processing for Advanced Packaging',
    slug: SLUG,
    content: readFileSync('scripts/articles/temporary-wafer-bonding-debonding.html', 'utf-8'),
    excerpt: 'Temporary wafer bonding and debonding for advanced packaging — why thinned device wafers need a carrier, the thin-wafer processing flow, and how to choose a debonding method (laser, thermal-slide, mechanical, chemical) by thermal budget and device sensitivity.',
    author: 'NineScrolls Engineering',
    publishDate: '2026-06-14',
    category: 'Process Integration',
    readTime: 13,
    imageUrl: 'https://cdn.ninescrolls.com/insights/temporary-wafer-bonding-debonding/cover-lg',
    tags: ['temporary wafer bonding','wafer debonding','carrier wafer','thin wafer handling','laser debonding','advanced packaging','3D integration','wafer thinning'],
    relatedProducts: JSON.stringify([{ href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface preparation for wafer bonding flows' }]) as any,
    isStandaloneComponent: false,
    isDraft: true,
  } as any);
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : `CREATED draft id=${(data as any).id}`);
})().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Upload figures** (user paths): `--name cover` / `--name thin-wafer-processing-flow-map --no-update-cover` / `--name debonding-method-selection-matrix --no-update-cover`, each via `AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts temporary-wafer-bonding-debonding <file> …`.

- [ ] **Step 3: llms sync BEFORE publish.** `public/llms.txt` (AP section, after the W2W entry):

```markdown
- [Temporary Wafer Bonding and Debonding](https://ninescrolls.com/insights/temporary-wafer-bonding-debonding): Thin-wafer handling for advanced packaging — the reversible carrier system, the thin-wafer processing flow, and how to choose a debonding method (laser, thermal-slide, mechanical, chemical) by thermal budget and device sensitivity
```

`public/llms-full.txt` (after the W2W block):

```markdown
**Temporary Wafer Bonding and Debonding: Thin-Wafer Processing for Advanced Packaging**
URL: https://ninescrolls.com/insights/temporary-wafer-bonding-debonding
Summary: Entity guide to the temporary carrier system that enables thin-wafer processing — the reversible adhesive + carrier + debond flow that supports a device wafer through thinning and TSV reveal, then releases it. Principle: thin-wafer processing is a coupled system; carrier, adhesive, thinning, reveal, and debond must be engineered together. Covers why thinned wafers (below ~100 µm) need a carrier, the thin-wafer processing flow (with per-step handling/stress/yield risk), and the core decision — debonding method selection (laser, thermal-slide, mechanical, chemical) by thermal budget and device sensitivity. Frames temporary bonding as the advanced-packaging "enablement layer" — it rarely appears in the final package yet enables the manufacturing steps that make 3D integration possible. Defers permanent-bonding mechanics to the Wafer Bonding hub, via/reveal to the TSV guide.
```

- [ ] **Step 4: Publish** (`update({id, isDraft:false})`) → verify DDB (title/slug/figures/principle) → CDN 200s (3 lg.webp) → live render → `rm scripts/create-tempbond-article.ts`.

## Task 6: Provenance + PR

- [ ] **Step 1:**

```bash
git add scripts/articles/temporary-wafer-bonding-debonding.html public/llms.txt public/llms-full.txt docs/superpowers/plans/2026-06-14-temporary-bonding-debonding.md
git commit -m "feat(insights): Temporary Wafer Bonding & Debonding entity page + llms sync"
git push -u origin insights/temporary-bonding-debonding
gh pr create --title "feat(insights): Temporary Wafer Bonding & Debonding (AP spoke #7, enablement layer)" --body "Fills the AP decision-chain gap (carrier -> temp bond -> thin -> reveal -> permanent -> debond). Gate 0.5 Create. Owns the reversible carrier entity + debonding-method selection (the scarcity play). Dual L3: Thin-Wafer Processing Flow Map (page-canonical, process layer) + Debonding Method Selection Matrix (climax). Coupling principle + enablement-layer role (2 citable lines). Gates: R1/R3b, §5-dominance, Gate-C, Gate-E 4/4, Gate-F, Debond-Matrix Ownership Test, Intent audit. Live in DDB; provenance + llms here.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

## Task 7: Phase-B1 Link Pass (one-shot NOT committed; NO B2)

- [ ] **Step 1: Fetch verbatim anchors** (read-only tsx): hub (its adhesive "held to a carrier through thinning, then released" sentence), TSV (its "mounted to a carrier, thinned from the backside… revealed" sentence in §3, or §7 cost-chain "carrier mounting, wafer thinning"), HBM4 (the coupling sentence "the temporary bonding adhesive, the post-thinning stress and the through-silicon via reveal all become coupled").
- [ ] **Step 2: One-shot `scripts/tempbond-backlinks.ts`** — standard module (rx() tolerant find, exactly-one-match guard, idempotency on `/insights/temporary-wafer-bonding-debonding`, --dry-run). THREE edits:
  1. **hub** → after the temporary-bonding/carrier sentence: "For the carrier system and how to remove it, see <a>Temporary Wafer Bonding and Debonding</a>."
  2. **TSV** → after the carrier-mounting sentence: "(the carrier flow that enables this is covered in <a>Temporary Wafer Bonding and Debonding</a>)".
  3. **HBM4** → after the coupling sentence: "See <a>Temporary Wafer Bonding and Debonding</a> for the thin-wafer handling flow."
- [ ] **Step 3: dry-run → apply → verify** (each page → new page ×1; new page → all cluster links) → `rm scripts/tempbond-backlinks.ts`. **NO B2** (all three are cluster pages).

## Task 8: Memory + wrap

- [ ] **Step 1: Update `memory/seo_strategy.md`:** Temporary Bonding PUBLISHED (slug/id/PR#); **AP cluster = 8 pages**; **Enablement Layer** role added (TSV=vertical-interconnect · hybrid=connection · temporary=enablement); **Thin-Wafer Processing Flow Map = new page-canonical PROCESS-LAYER asset** (sibling to, not replacement of, the W2W decision-layer AP Decision Chain map — both single-sourced at their own layers); §5-dominance + Debond-Matrix-Ownership-Test added to the template; next: **HBM Reliability** (frame as "Reliability Challenges in 3D-Stacked Memory", NOT "HBM4 Reliability" — longer lifespan) → then TSV sub-pages (Reveal, Cu Fill, Interposer). **⏳ STILL PENDING: TSV Phase-B2 DRIE edit ~2026-06-18** (`scripts/tsv-backlinks.ts --b2`; verify DRIE title/H2 byte-identical). **Continuous-expansion thesis** (per 06-13 GSC read): sustained cluster growth > publish-then-pause for topical authority; re-measure new AP pages ~early July (watch DRIE-impressions-rose-after-TSV signal).
- [ ] **Step 2: Report** with live URL + PR + verification evidence.

---

## Self-review

- **Spec coverage:** metadata ✓ (T5 code); R1/R3b ✓ (T1 + grep table); §3 Flow Map + principle + "Carrier Removal" not-a-chain ✓ (T1); §5 climax 800–900 + dominance grep + Debond-Matrix Ownership Test ✓ (T2); §6 caps ✓ (T3); §7 enablement-layer + role sentence ✓ (T3); FAQ5 lock ✓ (T3); Gate-C/E/F + Intent ✓ (T2/T3); figures relative-labels-only + last-step-not-a-chain ✓ (T4); llms-before-publish ✓ (T5); Phase-B1-only ✓ (T7); memory incl. TSV B2 reminder ✓ (T8).
- **Marker mechanics:** Task 1 writes lead+§1+§2+§3 (no marker needed — later tasks append to EOF in order). Final H2 order: 1,2,3,4,5,6,7,8,FAQ — T3 audit verifies.
- **Consistency:** slug + figure prefixes (`cover`, `thin-wafer-processing-flow-map`, `debonding-method-selection-matrix`) identical across blocks (T1/T2), prompts (T4), uploads (T5).
- **Placeholder scan:** image paths user-provided at gate time; all else concrete.
