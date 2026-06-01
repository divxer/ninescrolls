# Wafer Bonding for 3D Integration — Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Total length (recalibrated):** ~4500–5500-word pillar (the original 3500–4000 estimate conflicted with the per-section budgets, which sum to ~5000). Per-section caps still hold: §3 ≤1800, §4 ≥1000, §8+FAQ+CTA ≤800.

**Goal:** Draft, illustrate, import, and publish the "Wafer Bonding Technologies for 3D Integration" Insights pillar article per the approved spec.

**Architecture:** Author one standalone HTML file in `scripts/articles/`, import as a draft via `create-insight.ts`, generate 1 cover + 4 inline figures (user runs Gemini, agent embeds/uploads/invalidates), push final content via `update-insight-from-html.ts`, then publish + ping search engines. "Tests" here are spec-constraint checks (word caps, link/figure parity), not unit tests.

**Tech Stack:** HTML content, `tsx` scripts, AWS Amplify Data (DynamoDB), CloudFront CDN, Gemini/Imagen for figures.

**Status:** APPROVED FOR EXECUTION (design 9.7/10, plan 9.8/10 after review).

**Spec:** `docs/superpowers/specs/2026-05-31-wafer-bonding-for-3d-integration-design.md`

**Canonical facts (use verbatim — verified this session):**
- Slug: `wafer-bonding-technologies-for-3d-integration`
- Category: `Process Integration`
- Article file: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html`
- Product link slugs: `/products/icp-etcher`, `/products/rie-etcher`, `/products/plasma-cleaner`, `/products/ald`, `/products/pecvd`, `/products/hdp-cvd`, `/products/coater-developer`
- Internal article link targets (all confirmed live in DDB):
  - `/insights/from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges`
  - `/insights/mems-fabrication-process-guide`
  - `/insights/plasma-surface-modification-a-practical-guide-to-activation-functionalization`
  - `/insights/plasma-cleaner-applications-guide`
  - `/insights/plasma-cleaner-maintenance-guide`
  - `/insights/plasma-cleaner-buying-guide`
  - `/insights/atomic-layer-deposition-ald-comprehensive-guide`
  - `/insights/reactive-ion-etching-guide`
  - `/insights/coater-developer-systems-equipment-guide`
- Import tooling: `scripts/create-insight.ts` (strips TOC + h1, creates draft), `scripts/upload-insights-image.ts` (now auto-invalidates CloudFront after PR #174; needs `AWS_PROFILE=ninescrolls`), `scripts/update-insight-from-html.ts` (updates content/excerpt/readTime by slug)
- Env: `set -a; . ./.env; set +a` loads ADMIN_EMAIL/ADMIN_PASSWORD/CDN_DISTRIBUTION_ID

---

## File Structure

- **Create:** `scripts/articles/wafer-bonding-technologies-for-3d-integration.html` — the entire article body. One file; this is the source of truth committed to git, mirrored to DDB.
- **No code files.** No `src/` changes. The category `Process Integration` already exists in `insightCategories` (shipped in PR #173).

---

## Conventions (enforced every task)

- **NO hand-written `<h2>Table of Contents</h2>`** — the page auto-generates it (`create-insight.ts` strips one if present, but don't author it). [memory: feedback_no_toc]
- Product links → specific `/products/...` pages, never bare `https://ninescrolls.com`.
- Figures use `<figure class="post-figure"> <picture>…4 webp sources…</picture> <figcaption>…</figcaption> </figure>`, matching the HBM4 article.
- `<h2 id="...">` anchors on every section heading.
- US/international R&D audience; English only; engineer-credible, not salesy.

---

## Task 1: Scaffold + Section 1 (Why Wafer Bonding Matters) + Section 2 (Evolution)

**Files:**
- Create: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html`

- [ ] **Step 1: Write the HTML head + h1 + intro + §1 + §2**

Create the file with this skeleton (fill prose to spec). `<head>` title = full article title. `<h1>` matches. Target-readers paragraph first (matches house style of other articles). NO TOC.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Wafer Bonding Technologies for 3D Integration: From Fusion Bonding to Hybrid Bonding</title>
</head>
<body>
<h1>Wafer Bonding Technologies for 3D Integration: From Fusion Bonding to Hybrid Bonding</h1>

<p><strong>Target Readers:</strong> Process and packaging engineers, PIs and lab managers, and R&D teams evaluating wafer-bonding and advanced-packaging capability. Newcomers get the method map and evolution arc; experienced engineers can jump to the hybrid bonding process flow, failure modes, and equipment requirements.</p>

<!-- COVER FIGURE PLACEHOLDER (inserted in Task 9) -->

<h2 id="why-bonding-matters">1. Why Wafer Bonding Matters</h2>
<!-- Application sweep: MEMS, CIS, silicon photonics, 3D IC/chiplets, HBM.
     Thesis: every advanced 3D integration tech ultimately depends on bonding
     two surfaces together. Link HBM4 article + MEMS Fabrication Guide. -->

<h2 id="evolution">2. The Evolution of Wafer Bonding</h2>
<!-- Tight historical spine: Fusion → Anodic → Eutectic → Thermocompression →
     Hybrid. Sets up the arc §4 pays off. Keep short; do NOT explain mechanisms. -->

</body>
</html>
```

§1 must contain inline links (exact href):
- `<a href="/insights/from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges">HBM4 &amp; Advanced Packaging guide</a>`
- `<a href="/insights/mems-fabrication-process-guide">MEMS Fabrication Process Guide</a>`

- [ ] **Step 2: Verify scaffold constraints**

Run:
```bash
grep -c "Table of Contents" scripts/articles/wafer-bonding-technologies-for-3d-integration.html
grep -o 'href="/insights/[a-z0-9-]*"' scripts/articles/wafer-bonding-technologies-for-3d-integration.html | sort -u
```
Expected: TOC count = `0`. Both §1 internal links present.

- [ ] **Step 3: Commit**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding scaffold + §1 §2"
```

---

## Task 2: Section 3 (Major Wafer Bonding Technologies — the transition section)

**Files:**
- Modify: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html` (append after §2)

- [ ] **Step 1: Write §3 — matrix table first, then per-method subsections**

Lead with a comparison `<table>`: columns = Method | Temp | Materials | Bond strength | Typical use. Rows = Fusion, Anodic, Adhesive, Eutectic, Thermocompression, Hybrid.

Then `<h3>` subsections with these **word budgets** (do not exceed):
- Fusion (direct/SiO₂): ~250 — room-temp contact + high-temp anneal; SOI, MEMS.
- Anodic (Si–glass): ~200 — voltage + heat, Na⁺ migration; MEMS sealing.
- Adhesive (BCB/polymer): ~150 — tolerant of topography/particles; temporary/heterogeneous.
- Eutectic (Au–Sn, Al–Ge): ~200 — hermetic MEMS caps.
- Thermocompression (Cu–Cu TCB): ~300 — heat + force; the direct ancestor of hybrid; sets up §4.
- Hybrid bonding (**teaser only, 400–500**): define Cu-Cu + dielectric-dielectric simultaneous bond; place in matrix; END on a cliffhanger handing the "why" to §4. Do NOT spend pitch/density/latency/mechanism here.

§3 internal link: `<a href="/insights/mems-fabrication-process-guide">MEMS Fabrication Process Guide</a> §3.6` in the anodic/fusion context.

- [ ] **Step 2: Verify §3 word cap and teaser discipline**

Run:
```bash
python3 - <<'PY'
import re,sys
html=open('scripts/articles/wafer-bonding-technologies-for-3d-integration.html').read()
# crude: extract from "2. The Evolution" wait -> use §3 anchor to next h2
m=re.search(r'id="major-methods".*?(?=<h2 )',html,re.S)
text=re.sub(r'<[^>]+>',' ',m.group(0)) if m else ''
words=len(text.split())
print("§3 words:",words, "OK" if words<=1800 else "OVER CAP")
PY
```
Expected: §3 words ≤ 1800. (Anchor id must be `major-methods` — see Step 1.)

- [ ] **Step 3: Commit**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding §3 methods matrix (≤1800w, hybrid teaser)"
```

---

## Task 3: Section 4 (Why Hybrid Bonding Became the Industry Focus — the climax)

**Files:**
- Modify: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html` (append after §3)

- [ ] **Step 1: Write §4 — 1,000+ words, inevitability argument**

`<h2 id="why-hybrid">4. Why Hybrid Bonding Became the Industry Focus</h2>`. Drivers as a connected argument (not a feature list): pitch scaling wall → I/O density → signal integrity → power → latency. **Must include the quantitative anchor:** micro-bump pitch ≈ 20–40 µm hitting its limit vs. hybrid-bond pitch < 10 µm (sub-µm leading edge), and the resulting interconnect-density / bandwidth gain. Reference (don't duplicate) the HBM4 article's structural comparison: `<a href="/insights/from-ucla-s-semiconductor-hub-to-16-hi-hbm-the-thermal-and-materials-challenges">HBM4 &amp; Advanced Packaging guide</a>`.

Insert `<!-- FIGURE 2 PLACEHOLDER -->` at the natural midpoint (after the pitch-scaling paragraph).

- [ ] **Step 2: Verify §4 length + quantitative anchor present**

Run:
```bash
python3 - <<'PY'
import re
html=open('scripts/articles/wafer-bonding-technologies-for-3d-integration.html').read()
m=re.search(r'id="why-hybrid".*?(?=<h2 )',html,re.S)
text=re.sub(r'<[^>]+>',' ',m.group(0)) if m else ''
print("§4 words:",len(text.split()), "OK" if len(text.split())>=1000 else "TOO SHORT")
print("has pitch number:", bool(re.search(r'\b(20|40|10)\s*[–-]?\s*\d*\s*µm|<\s*10\s*µm', text)))
PY
```
Expected: §4 ≥ 1000 words; pitch number present = True.

- [ ] **Step 3: Mid-draft cumulative word check (§1–§4) — prevents end-of-draft bloat**

Run:
```bash
python3 - <<'PY'
import re
html=open('scripts/articles/wafer-bonding-technologies-for-3d-integration.html').read()
# from <body> up to the §5 anchor
m=re.search(r'<body>(.*?)<h2 id="process-flow"',html,re.S)
text=re.sub(r'<[^>]+>',' ',m.group(1)) if m else ''
w=len(text.split())
print("§1-§4 words:",w, "(informational; total target recalibrated to ~4500-5500 pillar)")
PY
```
CORRECTED: the original 2200-2600 gate was arithmetically impossible (§3 cap 1800 + §4 floor 1000 + §1-§2 738 = 3538 min). Total target recalibrated to a ~4500-5500-word pillar (between the HBM4 article and the RIE pillar). This check is now informational — keep §5-§8 disciplined instead of trimming the passed §3/§4.

- [ ] **Step 4: Commit**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding §4 climax (1000w+, quantitative anchor)"
```

---

## Task 4: Section 5 (Hybrid Bonding Process Flow — "what happens")

**Files:**
- Modify: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html` (append after §4)

- [ ] **Step 1: Write §5 — six process steps, process logic only**

`<h2 id="process-flow">5. Hybrid Bonding Process Flow</h2>`. Steps as `<h3>` or ordered structure: CMP → Cleaning → Plasma Activation → Alignment → Contact → Annealing. Each describes **what happens to the wafer** (mechanism/chemistry/sequence dependency) — NOT tool specs (those are §7). Plasma activation gets the most depth (terminates dielectric with reactive species, removes Cu oxide, enables room-temp dielectric bond + anneal-driven Cu-Cu diffusion; <0.5 nm RMS roughness target).

Insert `<!-- FIGURE 3 PLACEHOLDER -->` after the step list.

§5 links (the conversion path — exact href):
- `<a href="/insights/plasma-surface-modification-a-practical-guide-to-activation-functionalization">Plasma Surface Modification guide</a>` (heavy/primary)
- `<a href="/insights/plasma-cleaner-applications-guide">Plasma Cleaner Applications</a>`
- `<a href="/insights/atomic-layer-deposition-ald-comprehensive-guide">ALD guide</a>` (Cu barrier / dielectric prep)

- [ ] **Step 2: Verify §5 links + no tool-spec leakage**

Run:
```bash
grep -o 'href="/insights/plasma-surface-modification[^"]*"' scripts/articles/wafer-bonding-technologies-for-3d-integration.html
grep -o 'href="/insights/plasma-cleaner-applications-guide"' scripts/articles/wafer-bonding-technologies-for-3d-integration.html
grep -o 'href="/insights/atomic-layer-deposition-ald-comprehensive-guide"' scripts/articles/wafer-bonding-technologies-for-3d-integration.html
```
Expected: all three present. (Manual read-check: §5 describes mechanisms, not tool requirements.)

- [ ] **Step 3: Commit**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding §5 process flow"
```

---

## Task 5: Section 6 (Failure Modes — five modes)

**Files:**
- Modify: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html` (append after §5)

- [ ] **Step 1: Write §6 — exactly five failure modes, each mechanism→root cause→mitigation**

`<h2 id="failure-modes">6. Failure Modes and Yield Challenges</h2>`. Five modes (all required, for figure parity): (1) Voids, (2) Particle contamination, (3) Misalignment/overlay, (4) Copper oxidation, (5) Cu dishing/recess. Insert `<!-- FIGURE 4 PLACEHOLDER -->`. Link `<a href="/insights/plasma-cleaner-maintenance-guide">Plasma Cleaner Maintenance guide</a>` in the particle/contamination mode.

- [ ] **Step 2: Verify all five modes present**

Run:
```bash
for m in -i "void" "particle" "misalign\|overlay" "oxidation" "dishing\|recess"; do :; done
grep -ioE "void|particle|overlay|misalign|oxidation|dishing|recess" scripts/articles/wafer-bonding-technologies-for-3d-integration.html | sort -u
```
Expected: void, particle, overlay/misalign, oxidation, dishing/recess all appear.

- [ ] **Step 3: Commit**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding §6 failure modes (5, incl. dishing/recess)"
```

---

## Task 6: Section 7 (Equipment — "what capability is required", no process restate)

**Files:**
- Modify: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html` (append after §6)

- [ ] **Step 1: Write §7 — capability requirements per workflow step**

`<h2 id="equipment">7. Equipment Required Across the Bonding Workflow</h2>`. NOT a sales pitch, NOT a process re-description. Each step → the spec it demands of a tool, e.g.:
- CMP → sub-nm post-polish roughness, tight dishing control
- Plasma activation → uniform radical exposure across 300 mm, controlled ion energy (the dominant yield driver — say so)
- Cleaning → particle removal without re-deposition
- Alignment → sub-µm overlay accuracy
- Bonding tool → particle-controlled environment, force/temperature uniformity

Landing line: "plasma surface preparation is one of the most critical yield drivers" → route to products. §7 links (exact href):
- `<a href="/products/icp-etcher">ICP-RIE systems</a>` and/or `<a href="/insights/reactive-ion-etching-guide">RIE guide</a>`
- `<a href="/products/plasma-cleaner">plasma cleaners</a>` + `<a href="/insights/plasma-cleaner-buying-guide">Plasma Cleaner Buying Guide</a>`
- `<a href="/products/ald">ALD systems</a>`
- `<a href="/insights/coater-developer-systems-equipment-guide">Coater/Developer guide</a>`

- [ ] **Step 2: Verify §7 product links present**

Run:
```bash
grep -oE 'href="/products/(icp-etcher|plasma-cleaner|ald)"' scripts/articles/wafer-bonding-technologies-for-3d-integration.html | sort -u
```
Expected: all three product links present.

- [ ] **Step 3: Mid-draft cumulative word check (§1–§7)**

Run:
```bash
python3 - <<'PY'
import re
html=open('scripts/articles/wafer-bonding-technologies-for-3d-integration.html').read()
m=re.search(r'<body>(.*?)<h2 id="future"',html,re.S)
text=re.sub(r'<[^>]+>',' ',m.group(1)) if m else ''
w=len(text.split())
print("§1-§7 words:",w, "(target ~3800-4800 en route to ~4500-5500 total)")
PY
```
Target: §1–§7 ~3800–4800, leaving ~700 for §8+FAQ to land a ~4500–5500 pillar. (Recalibrated; see Task 3 note.)

- [ ] **Step 4: Commit**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding §7 equipment/capability requirements"
```

---

## Task 7: Section 8 (Future) + FAQ + References + CTA

**Files:**
- Modify: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html` (append after §7)

- [ ] **Step 1: Write §8 + the application→trend table + TSV seed sentence**

`<h2 id="future">8. Future Directions</h2>`. Light touch: HBM4E, HBM5, logic-on-logic, chiplets, photonic packaging. Include the table:

```html
<table>
  <thead><tr><th>Application</th><th>Dominant bonding trend</th></tr></thead>
  <tbody>
    <tr><td>HBM memory</td><td>Hybrid (Cu-Cu)</td></tr>
    <tr><td>Logic-on-logic</td><td>Hybrid (Cu-Cu)</td></tr>
    <tr><td>CMOS image sensors (CIS)</td><td>Hybrid (Cu-Cu)</td></tr>
    <tr><td>Silicon photonics</td><td>Hybrid + adhesive (heterogeneous III-V/Si)</td></tr>
    <tr><td>MEMS</td><td>Fusion + anodic</td></tr>
  </tbody>
</table>
```

Include the TSV-seed sentence verbatim: *"Hybrid bonding and TSV technology are increasingly co-optimized in modern 3D integration schemes."* Close-loop link to HBM4 article.

- [ ] **Step 2: Write FAQ (six locked questions) + References + CTA**

`<h2 id="faq">Frequently Asked Questions</h2>` with exactly these six, each `<h3>` Q + `<p>` A:
1. What is wafer bonding?
2. What is hybrid bonding?
3. Hybrid bonding vs thermocompression bonding — what's the difference?
4. Why is plasma activation used before wafer bonding?
5. What causes voids in hybrid bonding?
6. What equipment is required for wafer bonding?

Then `<h2 id="references">References</h2>` (authoritative sources: a SEMI/IEEE/IMAPS or journal cite per major claim) and a short CTA paragraph routing to `/products/plasma-cleaner` and `/products/icp-etcher`.

- [ ] **Step 3: Verify FAQ count (precise) + table + TSV seed**

The naive `grep -c "<h3>"` is wrong — §3 method subsections are also `<h3>`. Extract the
FAQ block (between `id="faq"` and `id="references"`) and count h3 there:

```bash
python3 - <<'PY'
import re
html=open('scripts/articles/wafer-bonding-technologies-for-3d-integration.html').read()
m=re.search(r'id="faq".*?(?=<h2 id="references")',html,re.S)
faq=m.group(0) if m else ''
print("FAQ questions:", len(re.findall(r'<h3', faq)), "(expect 6)")
print("TSV seed:", html.count("co-optimized"), "(expect 1)")
print("trend table:", html.count("Dominant bonding trend"), "(expect 1)")
# §8 + FAQ + References + CTA combined word cap — guards the total budget
tail=re.search(r'<h2 id="future".*',html,re.S)
ttext=re.sub(r'<[^>]+>',' ',tail.group(0)) if tail else ''
tw=len(ttext.split())
print("§8+FAQ+refs+CTA words:",tw, "OK" if tw<=800 else "OVER 800 — trim to protect 4000 total")
PY
```
Expected: FAQ questions = 6; TSV seed = 1; trend table = 1; tail block ≤ 800 words.
This cap is the third checkpoint: §1–§7 ≤3500 (Task 6) + tail ≤800 keeps the total under
~4300 worst-case and on-target at 3500–4000. It preserves flexibility in §1–§7 rather
than tightening Task 6's range.

- [ ] **Step 4: Commit**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding §8 + FAQ + references + CTA"
```

---

## Task 8: Whole-article link + structure audit

**Files:**
- Modify: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html` (fix anything the audit flags)

- [ ] **Step 1: Run the full audit**

```bash
F=scripts/articles/wafer-bonding-technologies-for-3d-integration.html
echo "--- total word count (target 3500-4000) ---"
python3 -c "import re;print(len(re.sub(r'<[^>]+>',' ',open('$F').read()).split()))"
echo "--- no TOC ---"; grep -c "Table of Contents" $F
echo "--- all internal links resolve to known slugs ---"; grep -oE 'href="/insights/[a-z0-9-]+"' $F | sort -u
echo "--- product links ---"; grep -oE 'href="/products/[a-z-]+"' $F | sort -u
echo "--- no bare ninescrolls.com links ---"; grep -c 'href="https://ninescrolls.com"' $F
echo "--- section anchors ---"; grep -oE '<h2 id="[a-z-]+"' $F
```
Expected: word count 3500–4000; TOC = 0; every `/insights/...` href matches a confirmed slug; bare-domain links = 0; eight `<h2 id>` anchors present.

- [ ] **Step 2: Fix any flagged issue, then commit (skip commit if clean)**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding link + structure audit fixes" || echo "clean, nothing to commit"
```

---

## Task 9: Author figure prompts + insert responsive `<picture>` placeholders

**Files:**
- Modify: `scripts/articles/wafer-bonding-technologies-for-3d-integration.html`
- Create: `/tmp/wafer-bonding-figure-prompts.md` (handed to user for Gemini)

- [ ] **Step 1: Replace the 4 placeholders with real `<figure>` blocks**

For cover + Fig 1–4, swap each `<!-- ... PLACEHOLDER -->` for a `<figure class="post-figure">` with `<picture>` (xl/lg/md/sm `.webp` sources + `-lg.png` fallback `<img>`) + `<figcaption>`, using CDN base `https://cdn.ninescrolls.com/insights/wafer-bonding-technologies-for-3d-integration/<name>` and these names: cover = `cover`, Fig 1 = `bonding-methods-compared`, Fig 2 = `path-to-hybrid-bonding`, Fig 3 = `hybrid-bonding-process-flow`, Fig 4 = `hybrid-bonding-failure-modes`. (Cover figure is omitted from body — it becomes the post `imageUrl`; only Fig 1–4 are inline. Remove the cover placeholder line.)

Each `<img>` needs a descriptive `alt` and `loading="lazy" decoding="async"`.

- [ ] **Step 2: Write the figure prompts — COVER FIRST, gate Fig 1–4 on cover approval**

HBM4 experience: the cover is where generation fails/iterates, not the inline figures.
So **author and hand off ONLY the cover prompt first.** The user generates + approves
the cover's visual direction before we write Fig 1–4 prompts — otherwise a cover redo
forces re-deriving all four inline figures against a changed style.

Write to `/tmp/wafer-bonding-figure-prompts.md` in two stages:
- **Stage 1 (now):** cover prompt only — navy hero, fusion→hybrid evolution, per the
  HBM4 hero style guide + brand palette.
- **Stage 2 (after cover locked):** Fig 1 (white matrix + mini cross-sections), Fig 2
  (evolution timeline w/ pitch/I/O/bandwidth/power trend arrows), Fig 3 (6-step process
  flow, plasma step violet), Fig 4 (5-up failure catalogue incl. dishing/recess) — all
  inheriting the now-locked cover's visual direction.

- [ ] **Step 3: Verify figure markup parity**

```bash
F=scripts/articles/wafer-bonding-technologies-for-3d-integration.html
grep -c "post-figure" $F          # = 4 (Fig 1-4 inline)
grep -c "PLACEHOLDER" $F          # = 0
grep -oE "/(bonding-methods-compared|path-to-hybrid-bonding|hybrid-bonding-process-flow|hybrid-bonding-failure-modes)-lg.png" $F | sort -u  # 4 distinct
```
Expected: 4 figures, 0 placeholders, 4 distinct figure names.

- [ ] **Step 4: Commit**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "draft(insights): wafer-bonding figure blocks + prompts"
```

**HANDOFF (two-stage, mirrors Step 2):** First hand off the cover prompt only; user
generates + approves the cover in Gemini. THEN author Fig 1–4 prompts and hand those
off; user generates the four inline figures. This gate prevents a cover redo from
invalidating four already-generated inline figures.

---

## Task 10: Import as draft via create-insight.ts

**Files:** none (DDB write)

- [ ] **Step 1: Import**

```bash
set -a; . ./.env; set +a
npx tsx scripts/create-insight.ts scripts/articles/wafer-bonding-technologies-for-3d-integration.html \
  --category "Process Integration" \
  --tags "wafer bonding,hybrid bonding,Cu-Cu bonding,fusion bonding,anodic bonding,thermocompression,plasma activation,3D integration,advanced packaging,chiplet,TSV,CMP,surface activation"
```
Expected: prints `slug: wafer-bonding-technologies-for-3d-integration`, `contentType: insight`, `isDraft: true`, and an id. **Record the id.**

- [ ] **Step 2: Verify the draft exists**

```bash
set -a; . ./.env; set +a; npx tsx scripts/list-insights-ddb.ts 2>/dev/null | grep "wafer-bonding-technologies"
```
Expected: row appears with category `Process Integration`.

- [ ] **Step 3: Review the auto-generated excerpt (it's often weak on long-form)**

`create-insight.ts` slices the first ~200 chars of plain text as the excerpt — for a
"Target Readers:" intro that's a poor SERP/card snippet. Check it:
```bash
set -a; . ./.env; set +a
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
(async()=>{await authenticate();const {data}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug:'wafer-bonding-technologies-for-3d-integration'});
const e=data[0].excerpt||'';console.log('len:',e.length);console.log(e);})();
"
```
Requirement: 140–180 chars, contains ≥2 of {wafer bonding, hybrid bonding, 3D integration}. If it fails, set a hand-written excerpt in the admin UI at Task 13 Step 1 (or via an `update` call). Target excerpt: *"A practical guide to wafer bonding for 3D integration — fusion, anodic, and eutectic bonding through to Cu-Cu hybrid bonding: process flow, failure modes, and equipment."*

---

## Task 11: Generate, upload, and embed figures (user-in-loop)

**Files:** none (CDN + DDB)

- [ ] **Step 1: Cover calibration** — user generates cover in Gemini, returns path. Review visually for brand fit before proceeding (HBM4 pattern).

- [ ] **Step 2: Upload all 5 images** (cover updates imageUrl; Fig 1-4 use `--no-update-cover`)

```bash
set -a; . ./.env; set +a
SLUG=wafer-bonding-technologies-for-3d-integration
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <cover-path> --name cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig1-path> --name bonding-methods-compared --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig2-path> --name path-to-hybrid-bonding --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig3-path> --name hybrid-bonding-process-flow --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig4-path> --name hybrid-bonding-failure-modes --no-update-cover
```
Expected: each prints 8 generated variants + an invalidation id. imageUrl set to `.../cover-lg` (extension-less, per PR #174 fix).

- [ ] **Step 3: Verify all variants resolve**

```bash
SLUG=wafer-bonding-technologies-for-3d-integration
for n in cover bonding-methods-compared path-to-hybrid-bonding hybrid-bonding-process-flow hybrid-bonding-failure-modes; do
  for v in sm md lg xl; do
    printf "%s-%s.webp %s\n" $n $v "$(curl -sI -o /dev/null -w '%{http_code}' https://cdn.ninescrolls.com/insights/$SLUG/$n-$v.webp)"
  done
done
```
Expected: all `200`.

---

## Task 12: Push final content (with figures) to DDB

**Files:** none (DDB write)

- [ ] **Step 1: Update content from the now-complete HTML**

```bash
set -a; . ./.env; set +a
npx tsx scripts/update-insight-from-html.ts wafer-bonding-technologies-for-3d-integration scripts/articles/wafer-bonding-technologies-for-3d-integration.html
```
Expected: prints new content length + recalculated readTime (target 12–14 min).

- [ ] **Step 2: Verify figures are live in DDB content**

```bash
set -a; . ./.env; set +a
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
(async()=>{await authenticate();const {data}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug:'wafer-bonding-technologies-for-3d-integration'});
const p=data[0];const n=(p.content.match(/post-figure/g)||[]).length;console.log('inline figures in content:',n,'imageUrl:',p.imageUrl);})();
"
```
Expected: `inline figures in content: 4`, imageUrl ends `/cover-lg`.

---

## Task 13: Review and publish

**Files:** none

- [ ] **Step 1: Human review** at `/admin/insights/<id>/edit` — read top to bottom, check figure placement, mobile preview, excerpt quality (rewrite excerpt in admin if the auto-extract is weak), confirm no §5/§7 duplication slipped in.

- [ ] **Step 2: Publish** (via admin UI toggle, or set `isDraft:false`). If the excerpt failed Task 10 Step 3, set the hand-written excerpt now.

- [ ] **Step 3: Verify public page + cover image resolve BEFORE pinging**

CloudFront invalidation has lag; don't send Google's first crawl into a 404 cover.
```bash
SLUG=wafer-bonding-technologies-for-3d-integration
curl -sI "https://cdn.ninescrolls.com/insights/$SLUG/cover-lg.webp" -o /dev/null -w 'cover: %{http_code}\n'
curl -sI "https://cdn.ninescrolls.com/insights/$SLUG/hybrid-bonding-process-flow-lg.webp" -o /dev/null -w 'fig3: %{http_code}\n'
```
Expected: both `200`. Also open `https://ninescrolls.com/insights/wafer-bonding-technologies-for-3d-integration` in a browser and confirm the page renders with cover + 4 figures. Only proceed once green.

- [ ] **Step 4: Ping search engines**

```bash
set -a; . ./.env; set +a
npx tsx scripts/ping-search-engines.ts https://ninescrolls.com/insights/wafer-bonding-technologies-for-3d-integration
```
(If that script signature differs, check its `--help`/header first.)

- [ ] **Step 5: Commit the final article source + plan completion**

```bash
git add scripts/articles/wafer-bonding-technologies-for-3d-integration.html
git commit -m "content(insights): finalize wafer-bonding pillar article" || echo "already committed"
```

**The article is shipped at this point.** Task 14 is explicitly deferred (see below).

---

## Task 14 (DEFERRED — Post-Publish Enhancement, Phase B): Reverse internal links

**Status: NOT part of shipping this article.** Downgraded from required after review.
The hub→existing links (authored inside this article, Tasks 1–7) are sufficient at
launch. Reverse links (existing→hub) are best done as a **single cluster backlink pass
once the first spoke exists** (Surface Preparation for Cu-Cu Hybrid Bonding), for two
reasons:
1. Verbatim string-replace against already-published articles is fragile — those
   articles may have been edited since this session, so anchors can drift.
2. Doing one consolidated pass (hub + spoke 1 cross-linking everything) is less total
   churn than editing the same 3 articles twice.

**When Phase B runs** (after spoke 1 drafts): add a backlink to this hub from MEMS
Fabrication Guide (§3.6), DRIE Bosch (TSV/packaging context), and the ALD guide
(advanced-packaging barriers bullet) — mirroring the `add-hbm-backlinks.ts` approach
(fetch current DDB content, single verbatim-anchored replace per article, idempotency
guard on the href, dry-run first, delete the one-shot script after). Verify each target
then contains exactly one `/insights/wafer-bonding-technologies-for-3d-integration`
href.

---

## Self-Review (completed by plan author)

**Spec coverage:** §1–§8 each map to Tasks 1–7; figures → Task 9/11; FAQ/refs → Task 7; metadata/tags → Task 10; cluster backlinks → Task 14 (deferred to Phase B); cannibalization guard enforced via §4-vs-HBM-figure distinction (Task 3) and §5/§7 boundary (Tasks 4/6). Mid-draft word checks at Tasks 3 & 6 prevent end-of-draft bloat. All spec sections covered.

**Placeholder scan:** Figure prompts deferred to Task 9 Step 2 (legitimately user-generated, not a plan gap); all link hrefs are concrete and verified; word-cap/anchor checks are runnable commands. No "TBD/handle appropriately" left.

**Consistency:** Figure CDN names (`bonding-methods-compared`, `path-to-hybrid-bonding`, `hybrid-bonding-process-flow`, `hybrid-bonding-failure-modes`) identical across Tasks 9/11/12. Slug identical across Tasks 1/10/11/12/13. Section anchor ids (`why-bonding-matters`, `evolution`, `major-methods`, `why-hybrid`, `process-flow`, `failure-modes`, `equipment`, `future`, `faq`, `references`) consistent between authoring tasks and the Task 8 audit.
