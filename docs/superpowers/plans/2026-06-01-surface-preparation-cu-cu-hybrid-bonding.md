# Surface Preparation for Cu-Cu Hybrid Bonding — Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draft, illustrate, import, and publish the "Surface Preparation for Cu-Cu Hybrid Bonding" Insights spoke (Advanced Packaging cluster, spoke #1) per the approved spec.

**Architecture:** One standalone HTML file in `scripts/articles/`, drafted section-by-section by sequential subagents (each spec-reviewed against this article's anti-cannibalization guards), imported as a draft via `create-insight.ts` (then slug-fixed in DDB), illustrated with 1 cover + 3 inline figures (cover-first human gate), uploaded + slug/imageUrl fixed, content pushed via `update-insight-from-html.ts`, then published + pinged. "Tests" are spec-constraint checks (word caps, link/boundary/keyword presence), not unit tests.

**Tech Stack:** HTML content, `tsx` scripts, AWS Amplify Data (DynamoDB), CloudFront CDN, Gemini/Imagen for figures.

**Spec:** `docs/superpowers/specs/2026-06-01-surface-preparation-cu-cu-hybrid-bonding-design.md`

**Total length:** ≤ 3,200 words (~14–16 min). Spoke, not hub — stay tight.

**Canonical facts (verified this session):**
- Slug (target): `surface-preparation-cu-cu-hybrid-bonding`
- Category: `Process Integration`
- Article file: `scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html`
- CDN figure base: `https://cdn.ninescrolls.com/insights/surface-preparation-cu-cu-hybrid-bonding/`
- Figure CDN names: `cover`, `surface-conditioning-chain`, `copper-oxide-queue-time`, `failure-to-surface-prep-map`
- Internal link targets (**all 4 re-verified LIVE 2026-06-01**):
  - `/insights/wafer-bonding-technologies-for-3d-integration` (hub — parent)
  - `/insights/plasma-surface-modification-a-practical-guide-to-activation-functionalization` (general science — parent)
  - `/insights/atomic-layer-deposition-ald-comprehensive-guide` (Cu barrier — lateral)
  - `/insights/plasma-cleaner-applications-guide` (cleaning — used in §4; confirmed live)
- Product links: `/products/plasma-cleaner`, `/products/icp-etcher`
- Tooling: `create-insight.ts` (creates draft; **auto-derives slug from title → MUST fix slug in DDB after import, as done for the hub**), `upload-insights-image.ts` (needs `AWS_PROFILE=ninescrolls`; on this branch still writes `imageUrl` as `cover-lg.png` → fix to extension-less `cover-lg` after upload), `update-insight-from-html.ts`, `ping-search-engines.ts`.
- Env: `set -a; . ./.env; set +a`

---

## THE THREE HARD CONSTRAINTS (every subagent gets these verbatim)

1. **HARD STOP at "surface ready."** NO discussion of the bonding tool, alignment, contact, or anneal — those are the hub's. The article ends the moment the surface is planarized/cleaned/activated/oxide-controlled/verified. (Closing line provided in Task 8.)
2. **§5 vs §6 exclusive boundary.** §5 (Plasma Activation) answers ONLY "how do dielectric surfaces become bondable?" — SiO₂/SiCN, –OH termination, surface energy. §6 (Copper Surface Chemistry) **exclusively** owns copper oxide, queue time, re-oxidation, reducing ambient. §5 may note in ONE clause that activation also de-oxidizes Cu, then point to §6 — no more.
3. **Dual-defer up top.** Near the top, a declaration deferring full-workflow to the hub and general-activation-science to the Plasma Surface Modification Guide.

---

## File Structure

- **Create:** `scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html` — entire article body, source of truth committed to git, mirrored to DDB.
- **No `src/` changes.** Category `Process Integration` already in `insightCategories`.

## Conventions (every task)
- NO hand-written `<h2>Table of Contents</h2>`.
- Product links → specific `/products/...`.
- Figures: `<figure class="post-figure"> <picture>…sm/md/lg/xl webp…</picture> <figcaption></figcaption> </figure>`.
- `<h2 id="...">` on every section.
- Voice: declarative, engineer-credible, specific, not salesy (match the wafer-bonding article).
- Never use `git --no-verify` (no hook exists; plain commit works).

---

## Task 1: Scaffold + §1 (Why Surface Prep Dominates Yield) + §2 (The Conditioning Chain)

**Files:** Create `scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html`

- [ ] **Step 1: Write head + h1 + target-readers + dual-defer + §1 + §2**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Surface Preparation for Cu-Cu Hybrid Bonding: The Conditioning Chain That Decides Yield</title>
</head>
<body>
<h1>Surface Preparation for Cu-Cu Hybrid Bonding: The Conditioning Chain That Decides Yield</h1>

<p><strong>Target Readers:</strong> Process and packaging engineers, yield engineers, and R&amp;D teams working on Cu-Cu hybrid bonding for 3D integration, advanced memory, and CMOS image sensors.</p>

<p>This article focuses only on surface preparation. For the complete hybrid-bonding workflow, see our <a href="/insights/wafer-bonding-technologies-for-3d-integration">Wafer Bonding Technologies Guide</a>. For the fundamentals of plasma surface activation, see our <a href="/insights/plasma-surface-modification-a-practical-guide-to-activation-functionalization">Plasma Surface Modification Guide</a>.</p>

<!-- COVER FIGURE PLACEHOLDER -->

<h2 id="why-surface-prep">1. Why Surface Preparation Dominates Yield</h2>
<!-- ~250w. Thesis: alignment, the bonder, and the anneal all matter, but the SURFACE
     CONDITION going into bonding is what decides voids, yield, and bond strength.
     Stand the thesis up immediately. Do NOT detail alignment/anneal (hub territory). -->

<h2 id="conditioning-chain">2. The Surface Conditioning Chain</h2>
<!-- ~250w. Navigation: CMP → post-CMP clean → dielectric activation → copper prep →
     metrology → (bond). Frame as ONE continuous chain, not parallel steps.
     <!-- FIGURE 1 PLACEHOLDER --> goes at end of this section. -->

</body>
</html>
```

§1+§2 ≈ 500 words. §2 ends with `<!-- FIGURE 1 PLACEHOLDER -->`.

- [ ] **Step 2: Verify scaffold**

```bash
F=scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
grep -c "Table of Contents" $F   # 0
grep -o 'href="/insights/[a-z0-9-]*"' $F | sort -u   # hub + surface-mod present (dual-defer)
grep -c "This article focuses only on surface preparation" $F   # 1 (dual-defer)
python3 -c "import re;h=open('$F').read();m=re.search(r'<body>(.*)</body>',h,re.S);print('words:',len(re.sub(r'<[^>]+>',' ',m.group(1)).split()))"
```
Expected: TOC=0; dual-defer present (both parent links); ~500 words.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep scaffold + dual-defer + §1 §2"
```

---

## Task 2: §3 CMP Requirements (~550w)

**Files:** Modify the article (append after §2)

- [ ] **Step 1: Write §3**

`<h2 id="cmp">3. CMP Requirements</h2>`. The most under-appreciated step (with §6). Cover: chemical-mechanical planarization brings Cu pads + dielectric into one coplanar plane; **sub-nm roughness** target; **global + local coplanarity**; the deliberate **Cu dishing / recess window** (a few nm — too much → gap the Cu can't close on anneal → open; too little → proud Cu props dielectric apart → void). Frame as "the plane and the recess CMP leaves set the ceiling on everything downstream." Link the hub for the bonding context where natural: `<a href="/insights/wafer-bonding-technologies-for-3d-integration">hybrid bonding</a>`. Do NOT describe the anneal mechanism in depth (mention recess closes "on the post-bond anneal" in a clause, defer to hub).
**SCOPE GUARDS:** Do NOT explain CMP slurry formulation, abrasive/oxidizer chemistry, or pad/consumable mechanics — this is a *surface-requirements* section, not a CMP-process tutorial (that would balloon §3 and drift off-topic). Stay on what the surface must END UP as (roughness/coplanarity/recess), not how CMP gets there chemically. Keep §3 ≤ 600 words.

- [ ] **Step 2: Verify**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html').read()
m=re.search(r'<h2 id="cmp".*?(?=</body>)',h,re.S)  # §3 currently last
t=re.sub(r'<[^>]+>',' ',m.group(0)) if m else ''
print("§3 words:",len(t.split()))
low=t.lower()
print("has roughness/coplanar/recess:", all(k in low for k in ['rough','coplanar','recess']))
print("LEAK check — must NOT walk alignment/contact:", not any(k in low for k in ['alignment','overlay','bond wave']))
PY
```
Expected: §3 ~550 (≤650); roughness/coplanar/recess present; no alignment leak.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep §3 CMP requirements"
```

---

## Task 3: §4 Post-CMP Cleaning (~350w)

**Files:** Modify (append after §3)

- [ ] **Step 1: Write §4**

`<h2 id="cleaning">4. Post-CMP Cleaning</h2>`. ~350w. Cover: CMP leaves slurry residue + particles; **a single sub-µm particle props the wafers apart and opens a void orders of magnitude larger than itself** (the single largest yield killer); megasonic wet clean; residue/metal-ion contamination; re-deposition risk. Link `<a href="/insights/plasma-cleaner-applications-guide">plasma cleaner applications</a>` for related dry-cleaning. Keep to cleaning — do NOT pre-empt §5 activation.

- [ ] **Step 2: Verify**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html').read()
m=re.search(r'<h2 id="cleaning".*?(?=</body>)',h,re.S); t=re.sub(r'<[^>]+>',' ',m.group(0)).lower()
print("§4 words:",len(t.split()))
print("particle focus:", 'particle' in t and 'void' in t)
PY
```
Expected: §4 ~350 (≤450); particle+void present.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep §4 post-CMP cleaning"
```

---

## Task 4: §5 Plasma Activation — dielectric ONLY (~450w)

**Files:** Modify (append after §4)

- [ ] **Step 1: Write §5**

`<h2 id="activation">5. Plasma Activation</h2>`. ~450w. **Answers ONLY "how do dielectric surfaces become bondable?"** Cover: low-energy plasma (N₂/O₂/H₂) terminates the **dielectric** (SiO₂ vs SiCN) with reactive species → raises surface energy → dielectric-to-dielectric bonds form on contact at room temperature. SiCN is the emerging preferred bonding dielectric. Defer the general activation mechanism: `<a href="/insights/plasma-surface-modification-a-practical-guide-to-activation-functionalization">Plasma Surface Modification Guide</a>`. Product link: `<a href="/products/icp-etcher">ICP-RIE systems</a>` and/or `<a href="/products/plasma-cleaner">plasma cleaners</a>` for low-energy activation.
**HARD BOUNDARY:** copper oxide / queue time / re-oxidation belong to §6. §5 may note in ONE clause that the same plasma also strips Cu oxide, then say "covered in the next section" — nothing more.

- [ ] **Step 2: Verify the §5/§6 boundary holds**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html').read()
m=re.search(r'<h2 id="activation".*?(?=</body>)',h,re.S); t=re.sub(r'<[^>]+>',' ',m.group(0)).lower()
print("§5 words:",len(t.split()))
print("dielectric focus:", 'dielectric' in t and ('sicn' in t or 'sio' in t))
print("queue-time leak (should be 0):", t.count('queue time'))   # must be 0 — that's §6
print("oxide mentions (<=1 clause ok):", t.count('oxide'))       # <=1 acceptable
PY
```
Expected: §5 ~450 (≤520); dielectric+SiCN/SiO₂ present; `queue time`=0; oxide ≤1.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep §5 plasma activation (dielectric only)"
```

---

## Task 5: §6 Copper Surface Chemistry — owns queue time (~550w)

**Files:** Modify (append after §5)

- [ ] **Step 1: Write §6**

`<h2 id="copper">6. Copper Surface Chemistry</h2>`. ~550w, the under-explained centerpiece. **Answers ONLY "how does copper stay bondable?"** Use an `<h3>Queue Time</h3>` subsection (SEO). Cover: native copper oxide regrows in air within minutes; it blocks the Cu-Cu interdiffusion the anneal must drive → weak/open joints even where the dielectric bonded; **queue time** = the activation-to-bond clock, a hard yield variable; re-oxidation kinetics; mitigations — minimize air exposure, reducing/forming-gas ambient, tight queue-time control, inert storage. Lateral link to ALD for the Cu diffusion barrier where natural: `<a href="/insights/atomic-layer-deposition-ald-comprehensive-guide">ALD</a>`.

- [ ] **Step 2: Verify §6 owns queue time + oxide**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html').read()
m=re.search(r'<h2 id="copper".*?(?=</body>)',h,re.S); seg=m.group(0); t=re.sub(r'<[^>]+>',' ',seg).lower()
print("§6 words:",len(t.split()))
print("queue time H3:", 'queue time' in seg.lower() and '<h3' in seg.lower())
print("owns oxide+reoxid+ambient:", all(k in t for k in ['oxide','queue time']) and ('reducing' in t or 'forming' in t))
PY
```
Expected: §6 ~550 (≤650); `queue time` as H3; oxide + queue-time + reducing/forming ambient present.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep §6 copper surface chemistry (queue time)"
```

---

## Task 6: §7 Metrology and Inspection (~350w)

**Files:** Modify (append after §6)

- [ ] **Step 1: Write §7**

`<h2 id="metrology">7. Metrology and Inspection</h2>`. ~350w. How each conditioning step is verified before bonding: **AFM** (roughness), **profilometry / reflectometry** (Cu recess/step height), **particle inspection** (defect scan), **contact angle** (surface energy after activation), and **SAM / IR** (post-bond void check — note this verifies the *result* of prep). Keep it to verification of surface readiness — do not drift into bonding-tool metrology.

- [ ] **Step 2: Verify**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html').read()
m=re.search(r'<h2 id="metrology".*?(?=</body>)',h,re.S); t=re.sub(r'<[^>]+>',' ',m.group(0)).lower()
print("§7 words:",len(t.split()))
print("methods present:", sum(k in t for k in ['afm','profil','particle','contact angle','sam'])>=4)
PY
```
Expected: §7 ~350 (≤450); ≥4 of the metrology methods present.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep §7 metrology"
```

---

## Task 7: §8 Failure Modes Mapped to Surface Prep (~350w) + Fig 3 placeholder

**Files:** Modify (append after §7)

- [ ] **Step 1: Write §8**

`<h2 id="failure-map">8. Failure Modes Mapped to Surface Preparation</h2>`. ~350w. Map each defect to the conditioning step that causes it: **void** → planarity/cleaning/activation; **particle-induced void** → cleaning; **copper-oxide open** → §6 queue-time/oxide; **dishing/recess open or proud-Cu void** → CMP. **MUST include the boundary-reinforcing statement:** misalignment / overlay error is **NOT** a surface-preparation defect — it originates at the bonding step (see the hub), and is deliberately out of scope here. This seeds the future Failure Analysis spoke. Insert `<!-- FIGURE 3 PLACEHOLDER -->` after the mapping. Link hub failure section: `<a href="/insights/wafer-bonding-technologies-for-3d-integration">Wafer Bonding Technologies Guide</a>`.

- [ ] **Step 2: Verify boundary statement + mapping**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html').read()
m=re.search(r'<h2 id="failure-map".*?(?=</body>)',h,re.S); seg=m.group(0); t=re.sub(r'<[^>]+>',' ',seg).lower()
print("§8 words:",len(t.split()))
print("maps 4 defects:", all(k in t for k in ['void','particle','oxid','dishing']))
print("misalignment-NOT-surface-defect boundary present:", 'misalign' in t or 'overlay' in t)
print("FIG3:", 'FIGURE 3 PLACEHOLDER' in h)
PY
```
Expected: §8 ~350; 4 defects mapped; misalignment-exclusion present; FIG3 placeholder present.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep §8 failure mapping (boundary reinforced)"
```

---

## Task 8: FAQ + CTA + hard-stop closing (~150–250w) + Fig 2 placeholder

**Files:** Modify (append after §8)

- [ ] **Step 1: Write the closing line + FAQ + CTA**

First, a one-sentence closing paragraph (the **hard stop at "surface ready"**), verbatim intent:
> Once the surface has been planarized, cleaned, activated, oxide-controlled, and verified, the bonding step itself becomes far more predictable.

Then `<h2 id="faq">Frequently Asked Questions</h2>` with exactly these 6 (each `<h3>` Q + `<p>` A, 2–4 sentences, accurate):
1. What surface conditions does Cu-Cu hybrid bonding require?
2. Why is queue time critical before hybrid bonding?
3. How is copper oxide removed before bonding?
4. What roughness and dishing does CMP need to hit for hybrid bonding?
5. Why does plasma activation enable room-temperature dielectric bonding?
6. How long can a wafer wait between activation and bonding?

**FAQ ANSWER GUARD:** FAQ answers must be **rule-of-thumb / direct numbers only** — do NOT re-explain the mechanism already covered in the body. Q4 especially: give the target figures (e.g. "sub-nm RMS roughness; Cu recess within a few nm") and point to §3, do NOT re-derive why. The FAQ is a quick-reference layer, not a second pass at the content.

Then a short CTA → `<a href="/products/plasma-cleaner">plasma cleaners</a>` + `<a href="/products/icp-etcher">ICP-RIE systems</a>` (engineer tone).

**Also:** insert `<!-- FIGURE 2 PLACEHOLDER -->` into §6 (Copper Surface Chemistry) — Fig 2 is the queue-time figure and the article's MVP, so place it as a **reveal**: AFTER the sentence(s) that introduce the queue-time concept, BEFORE the paragraph that explains the regrowth kinetics. (Introduce → show Fig 2 → explain — not tacked on at the end of §6 as an afterthought.)

- [ ] **Step 2: Verify FAQ + closing + no hub-territory leak**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html').read()
faq=re.search(r'id="faq".*',h,re.S).group(0)
print("FAQ Qs:", len(re.findall(r'<h3',faq)))   # 6
print("hard-stop closing present:", 'becomes far more predictable' in h)
print("FIG2 present:", 'FIGURE 2 PLACEHOLDER' in h)
print("TOC:", h.count('Table of Contents'))   # 0
b=re.search(r'<body>(.*)</body>',h,re.S); print("TOTAL words:",len(re.sub(r'<[^>]+>',' ',b.group(1)).split()))
PY
```
Expected: FAQ=6; closing present; FIG2 present; TOC=0; TOTAL ≤ 3,200.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep FAQ + CTA + hard-stop closing"
```

---

## Task 9: Whole-article audit (boundary, links, length, anchors)

**Files:** Modify (fix anything flagged)

- [ ] **Step 1: Run the full audit**
```bash
F=scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
echo "--- total words (target ≤3200) ---"; python3 -c "import re;h=open('$F').read();m=re.search(r'<body>(.*)</body>',h,re.S);print(len(re.sub(r'<[^>]+>',' ',m.group(1)).split()))"
echo "--- HARD STOP: bonding-tool/alignment/contact/anneal must NOT be walked as steps ---"
grep -ioE "alignment|overlay|bond wave|bonding tool|anneal" $F | sort | uniq -c
echo "  ⚠️ This grep is a MANUAL-REVIEW TRIGGER, NOT a pass/fail. 'anneal' legitimately"
echo "  appears in clauses (e.g. 'recess the Cu closes on the post-bond anneal',"
echo "  'Cu interdiffusion during anneal') and 'misalignment'/'overlay' MUST appear in §8"
echo "  (the exclusion statement). VIOLATION = a section or multi-sentence passage that"
echo "  WALKS alignment/contact/anneal/the bonder as a process step. Read each hit in"
echo "  context and confirm it only DEFERS to the hub — do not treat raw counts as failures."
echo "--- TOC=0 ---"; grep -c "Table of Contents" $F
echo "--- internal links resolve ---"; grep -oE 'href="/insights/[a-z0-9-]+"' $F | sort | uniq -c
echo "--- product links ---"; grep -oE 'href="/products/[a-z-]+"' $F | sort -u
echo "--- no bare domain ---"; grep -c 'href="https://ninescrolls.com"' $F
echo "--- 8 section anchors + faq ---"; grep -oE '<h2 id="[a-z-]+"' $F
echo "--- queue time keyword present ---"; grep -ic "queue time" $F
```
Expected: total ≤3,200; TOC=0; dual-defer + hub + surface-mod + ALD links resolve; product links present; bare-domain=0; anchors why-surface-prep/conditioning-chain/cmp/cleaning/activation/copper/metrology/failure-map/faq; `queue time` present; **no section walks alignment/contact/anneal**.

- [ ] **Step 2: Fix flagged issues, commit (skip if clean)**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep audit fixes" || echo "clean"
```

---

## Task 10: Figure prompts + `<figure>` blocks (cover-first gate)

**Files:** Modify article; Create `/tmp/surface-prep-figure-prompts.md`

- [ ] **Step 1: Replace the 3 inline placeholders with `<figure>` blocks**

Swap `<!-- FIGURE 1/2/3 PLACEHOLDER -->` for `<figure class="post-figure"><picture>` blocks (xl/lg/md/sm `.webp` sources + `-lg.png` fallback `<img>` with descriptive alt + `loading="lazy" decoding="async"`) + `<figcaption>`, CDN base `https://cdn.ninescrolls.com/insights/surface-preparation-cu-cu-hybrid-bonding/<name>`, names: Fig 1 = `surface-conditioning-chain`, Fig 2 = `copper-oxide-queue-time`, Fig 3 = `failure-to-surface-prep-map`. Remove the cover placeholder (cover = imageUrl, not inline).

- [ ] **Step 2: Write `/tmp/surface-prep-figure-prompts.md`, COVER FIRST**

Stage 1 = cover prompt only (navy hero: wafer-surface cross-section, Cu pads inlaid in dielectric with labeled recess, tagline "flat · clean · activated · oxide-free"). Stage 2 (after cover approved) = Fig 1 (conditioning-chain flow), Fig 2 (copper-oxide vs queue-time timeline — the signature figure), Fig 3 (failure→step map, color-coded by source step, misalignment greyed/struck-through). Inherit the wafer-bonding white-bg inline / navy-hero style + brand palette.

- [ ] **Step 3: Verify markup**
```bash
F=scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
grep -c "post-figure" $F        # 3
grep -c "PLACEHOLDER" $F         # 0
grep -oE "/(surface-conditioning-chain|copper-oxide-queue-time|failure-to-surface-prep-map)-lg.png" $F | sort -u  # 3
```
Expected: 3 figures, 0 placeholders, 3 distinct names.

- [ ] **Step 4: Commit + HANDOFF**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "draft(insights): surface-prep figure blocks + prompts"
```
**HANDOFF (two-stage):** give user the cover prompt → user generates + approves → then author Fig 1–3 prompts → user generates. (Prevents a cover redo from invalidating inline figures.)

---

## Task 11: Import as draft + fix slug

**Files:** none (DDB)

- [ ] **Step 1: Import**
```bash
set -a; . ./.env; set +a
npx tsx scripts/create-insight.ts scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html \
  --category "Process Integration" \
  --tags "hybrid bonding,surface preparation,Cu-Cu bonding,CMP,plasma activation,copper oxide,queue time,dielectric activation,SiCN,post-CMP cleaning,3D integration,advanced packaging,bond yield"
```
Expected: prints an id + auto-derived (wrong, long) slug. **Record the id.**

- [ ] **Step 2: Fix slug to the canonical one** (create-insight derives slug from title)
```bash
set -a; . ./.env; set +a
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
(async()=>{await authenticate();
const want='surface-preparation-cu-cu-hybrid-bonding';
const {data:ex}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug:want});
if(ex&&ex.length){console.error('TARGET SLUG TAKEN by',ex[0].id);process.exit(1);}
// find the just-created draft by title
const {data:all}=await (c as any).models.InsightsPost.list({filter:{title:{contains:'Surface Preparation for Cu-Cu Hybrid Bonding'}},limit:5});
const p=all.find((x:any)=>x.slug!==want)||all[0];
const {data:u}=await (c as any).models.InsightsPost.update({id:p.id,slug:want});
console.log('id',p.id,'slug now',u.slug);})();
"
```
Expected: slug now `surface-preparation-cu-cu-hybrid-bonding`.

- [ ] **Step 3: Verify draft + slug**
```bash
set -a; . ./.env; set +a; npx tsx scripts/list-insights-ddb.ts 2>/dev/null | grep "surface-preparation-cu-cu-hybrid-bonding"
```
Expected: row with category `Process Integration`.

---

## Task 12: Generate + upload images (user-in-loop), fix imageUrl, push content

**Files:** none (CDN + DDB)

- [ ] **Step 1: Cover calibration** — user generates cover, returns path, review for brand fit.

- [ ] **Step 2: Upload all 4** (cover updates imageUrl; figs `--no-update-cover`)
```bash
set -a; . ./.env; set +a
SLUG=surface-preparation-cu-cu-hybrid-bonding
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <cover> --name cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig1> --name surface-conditioning-chain --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig2> --name copper-oxide-queue-time --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig3> --name failure-to-surface-prep-map --no-update-cover
```

- [ ] **Step 3: Fix imageUrl to extension-less + verify variants**
```bash
set -a; . ./.env; set +a
SLUG=surface-preparation-cu-cu-hybrid-bonding
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
(async()=>{await authenticate();const {data}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug:'$SLUG'});
const {data:u}=await (c as any).models.InsightsPost.update({id:data[0].id,imageUrl:'https://cdn.ninescrolls.com/insights/$SLUG/cover-lg'});
console.log('imageUrl',u.imageUrl);})();
"
for n in cover surface-conditioning-chain copper-oxide-queue-time failure-to-surface-prep-map; do
  for v in sm lg xl; do printf "%s-%s %s\n" $n $v "$(curl -sI -o /dev/null -w '%{http_code}' https://cdn.ninescrolls.com/insights/$SLUG/$n-$v.webp)"; done
done
```
Expected: imageUrl ends `/cover-lg`; all variants `200`.

- [ ] **Step 4: Push final content + review excerpt**
```bash
set -a; . ./.env; set +a
npx tsx scripts/update-insight-from-html.ts surface-preparation-cu-cu-hybrid-bonding scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
```
Then check the auto-excerpt; if it's the "Target Readers" boilerplate, set a hand-written one (140–180 chars, contains "hybrid bonding surface preparation"): e.g. *"The surface-conditioning chain behind Cu-Cu hybrid bonding — CMP, cleaning, plasma activation, and copper-oxide/queue-time control — and how each step decides bond yield."*

---

## Task 13: Review + publish + ping

**Files:** none

- [ ] **Step 1: Human review** at `/admin/insights/<id>/edit` — figures land in §2/§6/§8, mobile preview, confirm the hard-stop (no alignment/contact/anneal), confirm §5/§6 boundary held.
- [ ] **Step 2: Publish** (admin toggle or set `isDraft:false`). Set hand-written excerpt if not already.
- [ ] **Step 3: Verify public page + cover 200 BEFORE ping**
```bash
SLUG=surface-preparation-cu-cu-hybrid-bonding
curl -sI "https://cdn.ninescrolls.com/insights/$SLUG/cover-lg.webp" -o /dev/null -w 'cover: %{http_code}\n'
curl -s -o /dev/null -w 'page: %{http_code}\n' "https://ninescrolls.com/insights/$SLUG"
```
Expected: both 200.
- [ ] **Step 4: Ping** (IndexNow not configured; sitemap auto-includes — this is best-effort)
```bash
set -a; . ./.env; set +a
npx tsx scripts/ping-search-engines.ts https://ninescrolls.com/insights/surface-preparation-cu-cu-hybrid-bonding || echo "ping best-effort (IndexNow key not configured)"
```
- [ ] **Step 5: Final commit**
```bash
git add scripts/articles/surface-preparation-cu-cu-hybrid-bonding.html
git commit -m "content(insights): finalize surface-prep spoke" || echo "already committed"
```

---

## Task 14 (DEFERRED — Phase B): cluster backlinks

Not part of shipping this spoke. Once published, in a consolidated pass: add down-links from the Wafer Bonding hub §5/§7 to this spoke, and (when the Failure Analysis spoke exists) wire this page's §8 as its parent. Deferred to avoid editing the hub mid-flight and to batch the link work — same rationale as the hub plan's Task 14.

---

## Self-Review (plan author)

**Spec coverage:** §1–§8 → Tasks 1–7; FAQ/CTA/closing → Task 8; figures → Task 10/12; dual-defer → Task 1; slug fix → Task 11; SEO tags/excerpt → Task 11/12; cluster backlinks → Task 14 (deferred). The three hard constraints are enforced as runnable checks: hard-stop (Task 9 grep + Task 8/13 manual), §5/§6 boundary (Task 4 `queue time`=0 / Task 5 owns it), dual-defer (Task 1). Misalignment-exclusion (Task 7/§8). `queue time` keyword (Task 5 §6 H3 + Task 9). All covered.

**Placeholder scan:** figure prompts deferred to Task 10 Step 2 (user-generated, not a gap); all links concrete + verified; checks are runnable. No "TBD/handle appropriately."

**Consistency:** figure CDN names (`surface-conditioning-chain`, `copper-oxide-queue-time`, `failure-to-surface-prep-map`) identical across Tasks 10/12. Slug identical across Tasks 1/11/12/13. Anchor ids (why-surface-prep, conditioning-chain, cmp, cleaning, activation, copper, metrology, failure-map, faq) consistent between authoring tasks and the Task 9 audit. Length cap ≤3,200 consistent across header / Task 8 / Task 9.
