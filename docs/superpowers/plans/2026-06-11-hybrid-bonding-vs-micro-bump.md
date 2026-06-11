# Hybrid Bonding vs Micro-Bump — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the Advanced Packaging cluster's *selection* page — "Hybrid Bonding vs Micro-Bump: Where Each Technology Wins" (slug `hybrid-bonding-vs-micro-bump`) — with the 2-axis Interconnect Selection Framework as its Level-3 asset, then wire cluster backlinks.

**Architecture:** Sequential subagents draft sections into a provenance HTML file, with grep checks between tasks enforcing boundary rules R1–R7 (the anti-cannibalization discipline). Live source of truth is DynamoDB; HTML in `scripts/articles/` is git provenance. Cover-first figure gate (user generates 3 figures in Gemini). One-shot DDB scripts (create/backlinks) are NOT committed.

**Tech Stack:** HTML article fragments (house style), TypeScript + tsx one-shots against Amplify Data (DynamoDB), `upload-insights-image.ts` with `AWS_PROFILE=ninescrolls`.

**Spec:** `docs/superpowers/specs/2026-06-11-hybrid-bonding-vs-micro-bump-design.md`
**Branch:** `insights/hybrid-bonding-vs-micro-bump` (current; spec committed here)
**Env for every DDB script:** `set -a; . ./.env; set +a` then `npx tsx <script>`

---

## Locked metadata (from spec — do not improvise)

- **Title:** `Hybrid Bonding vs Micro-Bump: Where Each Technology Wins`
- **Slug:** `hybrid-bonding-vs-micro-bump`
- **Excerpt:** `Explore the interconnect crossover between micro-bumps and hybrid bonding — pitch scaling, density, yield, thermal, and which interconnect wins at each pitch.`
- **Category:** `Process Integration` (matches the other 3 cluster spokes) · **readTime:** 12 · **author:** `NineScrolls Engineering`
- **Tags:** `["hybrid bonding","micro-bump","advanced packaging","interconnect","3D integration","chiplets","copper pillar","flip chip"]`
- **relatedProducts:** `[{"href":"/products/plasma-cleaner","label":"Plasma Cleaners","subtitle":"Surface activation for wafer bonding"}]` (JSON.stringify — a.json() field)
- **Schema gotchas (from memory):** NO `lastModifiedDate` field; `relatedProducts`/`heroImages`/`faqs` are `a.json()` → pass `JSON.stringify(...)`; do NOT use `create-insight.ts` (auto-slugs) — use a direct create script with explicit slug.

## Boundary rules → grep checks (run between drafting tasks)

| Rule | Check (on `scripts/articles/hybrid-bonding-vs-micro-bump.html`) |
|---|---|
| R1 | `grep -ic "what is hybrid bonding" f` == 0; no H2 defines hybrid bonding; selection intent only |
| R2 | opening (first 800 chars) contains exactly 1 link to `/insights/wafer-bonding-technologies-for-3d-integration` |
| R3 | §4 contains NO `CMP\|post-CMP\|plasma activation\|queue time` (surface-prep owns) and NO `C-SAM\|FIB\|failure analysis` detail (FA owns) — mentions allowed only as link anchors |
| R4/R7 | §7 has exactly 3 `<h3>`, each example ≤160 words, each contains a link; HBM example links `/insights/from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges` |
| R5 | total words 2,400–2,800: `sed 's/<[^>]*>/ /g' f \| tr -s ' ' '\n' \| grep -c .` |
| R6 | exactly 1 framework figure block (`interconnect-selection-framework`) |
| §5 | contains the verbatim pull-quote "Hybrid bonding is not adopted when it becomes possible." and the 4-step order (Density → Yield economics → Cost → Throughput) |

**Cluster link targets (all four required somewhere in the article):**
`/insights/wafer-bonding-technologies-for-3d-integration` · `/insights/surface-preparation-cu-cu-hybrid-bonding` · `/insights/hybrid-bonding-failure-analysis` · `/insights/from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges`

---

## Task 1: Scaffold + lead + §1 quick answer + §2 (with Ladder figure block)

**Files:** Create `scripts/articles/hybrid-bonding-vs-micro-bump.html`

- [ ] **Step 1: Dispatch a subagent** to write the opening through §2. Pass it: the spec's structure table (lead 110w hook+dual-defer; §1 `The Quick Answer: Micro-Bump or Hybrid Bonding?` 190w with the 3 pitch zones in brief; §2 `Why Not Just Keep Shrinking Micro-Bumps?` 230w including the Evolution Ladder figure block), the house style (read `scripts/articles/hybrid-bonding-failure-analysis.html` for `<h2>` numbering, `<p>`, figure markup), and rules R1/R2. The lead MUST open with the hook line: *"The interconnect crossover: where micro-bumps stop scaling and hybrid bonding takes over."* and dual-defer: mechanism → hub link; surface chemistry → surface-prep link; defects → FA link. Figure block for the Ladder uses prefix `interconnect-evolution-ladder` under `https://cdn.ninescrolls.com/insights/hybrid-bonding-vs-micro-bump/` with `<picture>` sm/md/lg/xl webp + lg.png fallback + `<figcaption>`. Instruct: never use `--no-verify`.

- [ ] **Step 2: Rule-grep**

```bash
f=scripts/articles/hybrid-bonding-vs-micro-bump.html
grep -ic "what is hybrid bonding" $f                 # expect 0 (R1)
head -c 800 $f | grep -oc "wafer-bonding-technologies-for-3d-integration"   # expect 1 (R2)
grep -o "<h2>[^<]*</h2>" $f                          # lead has no h2; then §1, §2 titles
grep -c "interconnect-evolution-ladder" $f           # expect >=4 (picture sources)
```

- [ ] **Step 3: Commit**

```bash
git add scripts/articles/hybrid-bonding-vs-micro-bump.html
git commit -m "feat(insights): HB-vs-microbump scaffold + lead + §1-2"
```

## Task 2: §3 Scaling Wall + §4 What Hybrid Bonding Changes

- [ ] **Step 1: Dispatch a subagent** to append §3 (`The Micro-Bump Scaling Wall`, 420w: bump collapse, solder bridging/IMC, current crowding/electromigration, RC parasitics, routing congestion, fine-pitch throughput economics) and §4 (`What Hybrid Bonding Changes`, 280w: pad-less direct Cu-Cu + dielectric bond, the pitch/density step-change, shorter interconnect → electrical/thermal gains — **interconnect-level only**, link the hub for mechanism, R3). Pass the existing file for continuity + rules R1/R3.

- [ ] **Step 2: Rule-grep**

```bash
f=scripts/articles/hybrid-bonding-vs-micro-bump.html
# R3: §4 must not contain surface/FA process detail (extract §4 region between its h2 and §5 h2 if present, else tail)
awk '/What Hybrid Bonding Changes/,/Crossover Region|$/' $f | grep -icE "post-CMP|plasma activation|queue time|C-SAM|FIB"   # expect 0
grep -ic "what is hybrid bonding" $f                  # still 0 (R1)
```

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): HB-vs-microbump §3-4"`

## Task 3: §5 Crossover Region (THE THOUGHT CORE) — review extra carefully

- [ ] **Step 1: Dispatch a subagent** for §5 (`The Crossover Region`, **700–800w** — the article's climax). Must cover: why the crossover is not a single pitch number; the three zones (>~20µm µbump / ~10–20µm transition / <~10µm hybrid) stated conservatively with "roughly/approximately"; **yield economics** (known-good-die, test cost, hybrid bonding's no-rework property raising the stakes); thermal crossover (direct Cu-Cu vs solder joints + underfill); cost/throughput crossover (mass-reflow maturity vs fab-grade cleanliness requirements); why the transition zone is architecture-dependent. **MUST include the citable selection principle as a styled pull-quote block:**

```html
<blockquote style="border-left:4px solid #2563eb;background:#eff6ff;padding:16px 20px;margin:24px 0;font-size:1.1em;">
  <p style="margin:0;"><strong>Hybrid bonding is not adopted when it becomes possible. It is adopted when density requirements outweigh manufacturing economics.</strong></p>
</blockquote>
```

followed by the explicit 4-step decision order (Density requirement → Yield economics → Cost structure → Throughput constraint) as an ordered list.

- [ ] **Step 2: Rule-grep + manual read** (this section carries the article — read it fully, not just grep)

```bash
f=scripts/articles/hybrid-bonding-vs-micro-bump.html
grep -c "Hybrid bonding is not adopted when it becomes possible" $f   # expect 1
grep -ic "density requirement" $f    # >=1 (decision order present)
```

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): HB-vs-microbump §5 crossover thought-core + selection principle"`

## Task 4: §6 Framework figure + §7 applications + §8 takeaways + FAQ/refs/CTA

- [ ] **Step 1: Dispatch a subagent** to append: §6 (`The Interconnect Selection Framework`, 200–250w: the figure block prefix `interconnect-selection-framework` + how-to-read paragraph — find density on x, candidates above on y, zone gives default winner); §7 (`Where Each Interconnect Is Winning Today`, 3 `<h3>` examples **120–150w each**, pattern Example→why→link: HBM → HBM4 article; logic-on-logic chiplets → hub; CIS → brief + surface-prep link); §8 (`Key Takeaways`, 190w decision summary); FAQ (3–4 Q&A on selection questions), Further Reading (the 4 cluster links), CTA (contact for bonding-adjacent equipment: plasma activation/cleaning). Rules R4/R7.

- [ ] **Step 2: Full-article rule audit (all rules)**

```bash
f=scripts/articles/hybrid-bonding-vs-micro-bump.html
echo "R5 words:"; sed 's/<[^>]*>/ /g' $f | tr -s ' ' '\n' | grep -c .          # 2400-2800
echo "R1:"; grep -ic "what is hybrid bonding" $f                                # 0
echo "R7 h3 count in §7:"; awk '/Winning Today/,/Key Takeaways/' $f | grep -c "<h3>"   # 3
echo "R6 framework figure:"; grep -c "interconnect-selection-framework" $f      # >=4
echo "pull-quote:"; grep -c "not adopted when it becomes possible" $f           # 1
echo "all 4 cluster links:"; for l in wafer-bonding-technologies surface-preparation-cu-cu hybrid-bonding-failure-analysis 16-hi-hbm; do grep -oc "$l" $f; done   # each >=1
```

If word count is out of band: trim §3/§7 prose (keep §5 intact) or deepen §5. Fix, re-audit.

- [ ] **Step 3: Commit** — `git commit -am "feat(insights): HB-vs-microbump §6-8 + FAQ/refs/CTA + full rule audit"`

## Task 5: Figure prompts file + cover-first gate (USER ACTION)

- [ ] **Step 1: Write `/tmp/hbmb-figure-prompts.md`** with the 3 prompts:

**① Cover (generate + approve FIRST; 3:2 navy hero):** Editorial technology cover, deep navy (#1e3a5f) gradient. Split visual: left half a fine-pitch micro-bump array (solder spheres on copper pillars, slightly aged/warm tones) and right half a seamless Cu-Cu hybrid-bonded interface (clean bonded plane, cool blue/violet), meeting at a glowing vertical "crossover" seam. Title "Hybrid Bonding vs Micro-Bump", subtitle "Where Each Technology Wins · Advanced Packaging", footer ninescrolls.com. Premium, no people, correct spelling.

**② Interconnect Selection Framework (§6, Level-3 asset; white-bg flat infographic ~1200×900):** 2-axis chart: x = Connection density (low→high), y = Manufacturing readiness & cost-economics (mature/low-cost → emerging/high-cost). Plot four labeled technology regions: Flip Chip (low x, top y), Cu Pillar (mid x, high y), Fine-Pitch Micro-Bump (high x, mid y), Hybrid Bonding (highest x, lower y). Overlay three vertical zones: A "Micro-Bump Dominant" (>~20 µm), B "Transition" (~10–20 µm), C "Hybrid Bonding Dominant" (<~10 µm). Brand palette navy #1e3a5f / blue #3b82f6 / violet #8b5cf6 / copper #d97706. Footer "ninescrolls.com · Interconnect Selection Framework".

**③ Interconnect Evolution Ladder (§2 mini-figure; white-bg, compact):** 4-step ladder Flip Chip → Cu Pillar → Fine-Pitch Micro-Bump → Hybrid Bonding, with three trend arrows alongside: "Pitch ↓ (hundreds of µm → <10 µm)", "Density ↑", "Interconnect length ↓". Clean, small-format, footer "ninescrolls.com".

- [ ] **Step 2: GATE — user generates ① in Gemini → approve → then ② and ③.** Verify each image's text is correctly spelled and numbers match the article before accepting.

## Task 6: Import to DDB (draft) + upload 3 images + publish

- [ ] **Step 1: Write one-shot `scripts/create-hbmb-article.ts`** (NOT committed; delete after) — same pattern as the RIE-100 spotlight create:

```typescript
/** One-shot: create HB-vs-microbump article as draft with explicit slug. NOT committed. */
import { readFileSync } from 'fs';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../amplify/data/resource';
import { authenticate } from './lib/auth';
import amplifyOutputs from '../amplify_outputs.json';
Amplify.configure(amplifyOutputs as any);
const client = generateClient<Schema>({ authMode: 'userPool' });
const SLUG = 'hybrid-bonding-vs-micro-bump';
(async () => {
  await authenticate();
  const { data: existing } = await client.models.InsightsPost.listInsightsPostBySlug({ slug: SLUG });
  if (existing?.length) { console.log('SKIP exists', (existing[0] as any).id); return; }
  const { data, errors } = await client.models.InsightsPost.create({
    title: 'Hybrid Bonding vs Micro-Bump: Where Each Technology Wins',
    slug: SLUG,
    content: readFileSync('scripts/articles/hybrid-bonding-vs-micro-bump.html', 'utf-8'),
    excerpt: 'Explore the interconnect crossover between micro-bumps and hybrid bonding — pitch scaling, density, yield, thermal, and which interconnect wins at each pitch.',
    author: 'NineScrolls Engineering',
    publishDate: '2026-06-11',
    category: 'Process Integration',
    readTime: 12,
    imageUrl: 'https://cdn.ninescrolls.com/insights/hybrid-bonding-vs-micro-bump/cover-lg',
    tags: ['hybrid bonding','micro-bump','advanced packaging','interconnect','3D integration','chiplets','copper pillar','flip chip'],
    relatedProducts: JSON.stringify([{ href: '/products/plasma-cleaner', label: 'Plasma Cleaners', subtitle: 'Surface activation for wafer bonding' }]) as any,
    isStandaloneComponent: false,
    isDraft: true,
  } as any);
  console.log(errors ? `FAIL ${JSON.stringify(errors)}` : `CREATED draft id=${(data as any).id}`);
})().catch((e) => { console.error(e); process.exit(1); });
```

Run: `set -a; . ./.env; set +a; npx tsx scripts/create-hbmb-article.ts` → expect `CREATED draft id=...`

- [ ] **Step 2: Upload the 3 images** (paths = wherever the user saved them, e.g. ~/Downloads):

```bash
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts hybrid-bonding-vs-micro-bump <cover-file> --name cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts hybrid-bonding-vs-micro-bump <framework-file> --name interconnect-selection-framework --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts hybrid-bonding-vs-micro-bump <ladder-file> --name interconnect-evolution-ladder --no-update-cover
```

Each: expect 8 generated files + CloudFront invalidation submitted.

- [ ] **Step 3: Publish** — one-shot update `isDraft: false` (same client pattern, `update({ id, isDraft: false })`), then verify live in DDB: title/slug/category correct, both figure prefixes present in content, imageUrl extension-less.

- [ ] **Step 4: Live render check** (Chrome): page title, H2 list, pull-quote visible, figures load (curl the CDN lg.webp URLs → 200).

- [ ] **Step 5: Delete one-shots** — `rm scripts/create-hbmb-article.ts`

## Task 7: Commit provenance + llms sync + PR

- [ ] **Step 1: llms sync** — add to `public/llms.txt` under `## Insights — Advanced Packaging & 3D Integration`:

```markdown
- [Hybrid Bonding vs Micro-Bump](https://ninescrolls.com/insights/hybrid-bonding-vs-micro-bump): Interconnect selection guide — where micro-bumps stop scaling and hybrid bonding takes over; pitch zones, yield economics, thermal and cost crossovers, and the Interconnect Selection Framework
```

and a matching block in `public/llms-full.txt` (before `## News`):

```markdown
**Hybrid Bonding vs Micro-Bump: Where Each Technology Wins**
URL: https://ninescrolls.com/insights/hybrid-bonding-vs-micro-bump
Summary: Selection guide for the interconnect crossover. Explains why micro-bump scaling hits a wall (collapse, bridging, current crowding, parasitics), what hybrid bonding changes at the interconnect level, and where each technology wins: micro-bump dominant above ~20 µm pitch, transition at ~10–20 µm, hybrid bonding below ~10 µm. Centers on the Interconnect Selection Framework (connection density vs manufacturing economics, all four generations: flip chip, Cu pillar, fine-pitch micro-bump, hybrid bonding) and the selection principle that hybrid bonding is adopted when density requirements outweigh manufacturing economics. Defers mechanism to the Wafer Bonding hub, chemistry to Surface Preparation, defects to Failure Analysis.
```

- [ ] **Step 2: Commit + PR**

```bash
git add scripts/articles/hybrid-bonding-vs-micro-bump.html public/llms.txt public/llms-full.txt docs/superpowers/plans/2026-06-11-hybrid-bonding-vs-micro-bump.md
git commit -m "feat(insights): Hybrid Bonding vs Micro-Bump — cluster selection page + llms sync"
git push -u origin insights/hybrid-bonding-vs-micro-bump
gh pr create --title "feat(insights): Hybrid Bonding vs Micro-Bump (Advanced Packaging spoke #4)" --body "Cluster selection page (Gate 0.5 Create). Crossover framing, 2-axis Interconnect Selection Framework (Level-3 asset), citable selection principle, R1-R7 boundary rules enforced. Live in DDB; provenance + llms sync in this diff.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

(No `--no-verify`. Spec is already committed on this branch.)

## Task 8: Phase-B backlinks (surgical DDB edits, NOT committed)

- [ ] **Step 1: Fetch exact anchor sentences** from the hub (§3/§4 region) and the HBM4 article where a selection-pointer fits, via a read-only tsx snippet (print 200-char windows around "micro-bump" mentions).

- [ ] **Step 2: One-shot `scripts/hbmb-backlinks.ts`** (pattern = the FA Phase-B script): regex-tolerant find (whitespace/attribute-tolerant `rx()` helper), **exactly-one-match guard** (`found N !== 1 → FAIL`), idempotency guard (skip if `/insights/hybrid-bonding-vs-micro-bump` already present), `--dry-run` first. Two edits:
  - **Hub §4** (after the why-hybrid-won discussion): append sentence "For when to choose hybrid bonding over micro-bumps — the pitch zones, yield economics, and cost crossover — see <a href=\"/insights/hybrid-bonding-vs-micro-bump\">Hybrid Bonding vs Micro-Bump: Where Each Technology Wins</a>."
  - **HBM4** (at its packaging-implications section): append "For the general selection framework between micro-bumps and hybrid bonding, see <a href=\"/insights/hybrid-bonding-vs-micro-bump\">Hybrid Bonding vs Micro-Bump</a>."
  Exact find-anchors are determined from Step 1's output (verbatim sentences), not guessed.

- [ ] **Step 3: dry-run → apply → verify** bidirectional counts (new page → 4 cluster links; hub & HBM4 → 1 link each to new page) → `rm scripts/hbmb-backlinks.ts`.

## Task 9: Memory + wrap

- [ ] **Step 1: Update `memory/seo_strategy.md`:** spoke #4 PUBLISHED (slug, date, PR#, framework asset + citable principle); cluster = 5 pages / 5 intents complete; next spokes = TSV Etching → Temporary Bonding/Debonding → HBM Reliability (note candidate: Wafer-to-Wafer vs Die-to-Wafer); backlinks DDB-only note (re-running update-insight-from-html on hub/HBM4 would clobber them).

- [ ] **Step 2: Report** completion to user with live URL + merged-PR link + verification evidence.

---

## Self-review

- **Spec coverage:** locked metadata ✓ (Task 6); 8-section structure + budgets ✓ (Tasks 1–4, §5=700–800w in Task 3); pull-quote + decision order ✓ (Task 3, greppable); R1–R7 → grep table + per-task checks ✓; 3 figures + cover-first gate ✓ (Task 5); 4 cluster links ✓ (Task 4 audit); Phase-B backlinks ✓ (Task 8); llms sync ✓ (Task 7); memory ✓ (Task 9). Schema gotchas baked into Task 6 code.
- **Placeholder scan:** image paths in Task 6 Step 2 are intentionally user-provided (`<cover-file>` etc. — the user generates figures at gate time); everything else is concrete.
- **Consistency:** slug/prefixes (`cover`, `interconnect-selection-framework`, `interconnect-evolution-ladder`) match between article figure blocks (Tasks 1, 4), upload commands (Task 6), and prompts (Task 5).
