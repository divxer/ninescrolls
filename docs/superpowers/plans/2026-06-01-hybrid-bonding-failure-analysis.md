# Hybrid Bonding Failure Analysis — Article Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draft, illustrate, import, and publish the "Hybrid Bonding Failure Analysis" Insights spoke (Advanced Packaging cluster, spoke #2) per the approved spec.

**Architecture:** One standalone HTML file in `scripts/articles/`, drafted section-by-section by sequential subagents (each spec-reviewed against the 3 hard rules), imported as a draft via `create-insight.ts` (then slug-fixed in DDB), illustrated with 1 cover + 3 inline figures (cover-first human gate), uploaded + imageUrl-fixed, content pushed via `update-insight-from-html.ts`, then published + pinged. "Tests" are spec-constraint checks (rule/length/link/keyword presence), not unit tests.

**Tech Stack:** HTML content, `tsx` scripts, AWS Amplify Data (DynamoDB), CloudFront CDN, Gemini/Imagen for figures.

**Spec:** `docs/superpowers/specs/2026-06-01-hybrid-bonding-failure-analysis-design.md`

**Total length:** 2,800–3,300 words. Lookup content — tables/figures over prose.

**Canonical facts (verified this session):**
- Slug (target): `hybrid-bonding-failure-analysis`
- Category: `Process Integration`
- Article file: `scripts/articles/hybrid-bonding-failure-analysis.html`
- CDN figure base: `https://cdn.ninescrolls.com/insights/hybrid-bonding-failure-analysis/`
- Figure CDN names: `cover`, `fa-workflow`, `fa-toolbox-matrix`, `root-cause-decision-tree`
- Internal link targets (confirmed live this session):
  - `/insights/wafer-bonding-technologies-for-3d-integration` (hub — overview, up)
  - `/insights/surface-preparation-cu-cu-hybrid-bonding` (origins/prevention — up; the parent)
- Product links (sparing — this is an FA page): `/products/plasma-cleaner`, `/products/icp-etcher`
- Tooling: `create-insight.ts` (**auto-derives slug from title → MUST fix slug in DDB after, as done for both prior articles**), `upload-insights-image.ts` (needs `AWS_PROFILE=ninescrolls`; on a fresh branch from main it has the PR #174 fix, but VERIFY: if imageUrl comes out as `cover-lg.png`, fix to extension-less `cover-lg`), `update-insight-from-html.ts`, `ping-search-engines.ts`.
- Env: `set -a; . ./.env; set +a`

---

## THE THREE HARD RULES (every subagent gets these verbatim)

**RULE 1 — §3 does NOT discuss origins.** Each defect gets exactly: **Signature** → **Evidence** → **Next step**. NO "Causes: CMP / cleaning / activation / queue time" — that is Surface Prep's territory. Forbidden *causal* framing in §3 — do not write that a defect "is caused by", "results from", "arises from", "is due to", or "originates" with any process/condition. Even origin-agnostic causal phrasing ("oxide defects often arise when…") is out of bounds; §3 describes what is OBSERVED, never why it happened.

**RULE 2 — §7 stops at the suspect *category*.** Map **Evidence → suspect category → where to fix (link out)**. NEVER the process cause. Allowed: "TEM interfacial layer → suspect surface-state issue → see Surface Preparation." Forbidden: "→ activation too weak → raise RF power."

**RULE 3 — 2,800–3,300 words total**, tables/figures over prose. Never pad §4/§5 prose to explain what a table already says.

**Plus the page philosophy:** §1 opens on "Failure analysis begins with evidence, not defects." The page is evidence-centric, not a defect catalogue (that's the hub).

---

## File Structure
- **Create:** `scripts/articles/hybrid-bonding-failure-analysis.html` — entire article, source of truth committed to git, mirrored to DDB.
- **No `src/` changes.** Category `Process Integration` already in `insightCategories`.

## Conventions (every task)
- NO hand-written `<h2>Table of Contents</h2>`.
- Product links → specific `/products/...`; sparing (FA page, not sales).
- Figures: `<figure class="post-figure"> <picture>…sm/md/lg/xl webp…</picture> <figcaption></figcaption> </figure>`.
- `<h2 id="...">` per section; `<h3>` for the §6 correlation subsection.
- Voice: declarative, engineer-credible, specific (match wafer-bonding + surface-prep).
- Never `git --no-verify` (no hook; plain commit works).

---

## Task 1: Scaffold + §1 (FA Mindset) + §2 (FA Workflow)

**Files:** Create `scripts/articles/hybrid-bonding-failure-analysis.html`

- [ ] **Step 1: Write head + h1 + target-readers + dual-defer + §1 + §2**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Hybrid Bonding Failure Analysis: Detecting, Imaging, and Root-Causing Bond Defects</title>
</head>
<body>
<h1>Hybrid Bonding Failure Analysis: Detecting, Imaging, and Root-Causing Bond Defects</h1>

<p><strong>Target Readers:</strong> Failure-analysis, packaging, and reliability engineers diagnosing Cu-Cu hybrid bonding defects in 3D-integrated devices, advanced memory, and CMOS image sensors.</p>

<p>This guide is about diagnosis — how a hybrid-bonding defect is detected, imaged, characterized, and traced to root cause. For what can go wrong at a high level, see our <a href="/insights/wafer-bonding-technologies-for-3d-integration">Wafer Bonding Technologies Guide</a>; for how these defects originate in surface preparation and how to prevent them, see <a href="/insights/surface-preparation-cu-cu-hybrid-bonding">Surface Preparation for Cu-Cu Hybrid Bonding</a>. This page picks up where prevention ends: you have a failing or suspect bond — now prove what happened.</p>

<!-- COVER FIGURE PLACEHOLDER -->

<h2 id="fa-mindset">1. The Failure-Analysis Mindset</h2>
<!-- ~250w. MUST open: "Failure analysis begins with evidence, not defects." Establish the
     diagnosis-not-prevention framing + the one-line definition. The FA engineer starts from
     an observed symptom and works toward evidence, not from a named defect. -->

<h2 id="fa-workflow">2. The FA Workflow</h2>
<!-- ~250w. The 6-node spine: Observed Symptom -> Non-Destructive Inspection -> Physical
     Characterization -> Evidence Correlation -> Suspect Root-Cause Family -> Corrective Action.
     End with <!-- FIGURE 1 PLACEHOLDER -->. -->

</body>
</html>
```

§1 MUST contain the verbatim-intent opener "Failure analysis begins with evidence, not defects." §1+§2 ≈ 500 words. §2 ends with `<!-- FIGURE 1 PLACEHOLDER -->`.

- [ ] **Step 2: Verify scaffold**
```bash
F=scripts/articles/hybrid-bonding-failure-analysis.html
grep -c "Table of Contents" $F   # 0
grep -ci "begins with evidence" $F   # >=1 (the philosophy line)
grep -o 'href="/insights/[a-z0-9-]*"' $F | sort -u   # hub + surface-prep (dual-defer)
grep -c "FIGURE 1 PLACEHOLDER" $F   # 1
python3 -c "import re;h=open('$F').read();m=re.search(r'<body>(.*)</body>',h,re.S);print('words:',len(re.sub(r'<[^>]+>',' ',m.group(1)).split()))"
```
Expected: TOC=0; philosophy line present; both parent links; Fig1 placeholder; ~500 words.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA scaffold + dual-defer + §1 §2"
```

---

## Task 2: §3 Failure Signatures & Evidence (~500w) — RULE 1

**Files:** Modify (append after §2)

- [ ] **Step 1: Write §3 — defect-indexed, Signature/Evidence/Next-step ONLY**

`<h2 id="signatures">3. Failure Signatures &amp; Evidence</h2>`. Defect-indexed. For each defect, give exactly three labelled items and NOTHING about origin (RULE 1): **Signature** (electrical/physical symptom), **Evidence** (what specific techniques show), **Next step** (which technique to run). Cover: Void, Particle-induced void, Copper open / oxide interface, Proud-copper void, **Misalignment** (the cross-defect convergence point — diagnose via chain-resistance shift + overlay/cross-section), Delamination.
Example template (copper-oxide): *Signature — elevated contact resistance, open at anneal-sensitive sites. Evidence — TEM interfacial layer, EELS oxygen at the bond plane. Next step — cross-section/TEM the suspect pad.* Do NOT write "caused by long queue time / weak activation."
Per-defect, where natural, link once to Surface Prep for the origin (NOT explained inline): `<a href="/insights/surface-preparation-cu-cu-hybrid-bonding">how it originates</a>`.
**End §3 with a "Symptom-to-First-Tool Quick Reference" `<table>`** (~80–100w): Open circuit→Electrical test; High resistance→Daisy chain; Void indication→C-SAM; Delamination→C-SAM; Misalignment suspicion→Overlay / cross-section; Interfacial anomaly→TEM.

- [ ] **Step 2: Verify RULE 1 + quick-ref table**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/hybrid-bonding-failure-analysis.html').read()
m=re.search(r'<h2 id="signatures".*?(?=</body>)',h,re.S); seg=m.group(0); t=re.sub(r'<[^>]+>',' ',seg).lower()
print("§3 words:",len(t.split()))
print("6 defects:", all(k in t for k in ['void','particle','oxide','proud','misalign','delamin']))
print("signature+evidence+next:", all(k in t for k in ['signature','evidence','next step']))
print("quick-ref table:", '<table' in seg and 'first' in t)
# RULE 1 leak check — §3 must not assign causes (origin-agnostic causal framing also banned)
print("RULE1 leak (expect 0):", len(re.findall(r'caused by|results from|arise[s]? from|arise[s]? when|due to|originate', t)))
PY
```
Expected: §3 ≤600; 6 defects present; signature/evidence/next-step present; quick-ref table present; **RULE1 leak = 0**.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA §3 signatures & evidence (RULE 1, quick-ref)"
```

---

## Task 3: §4 FA Toolbox I — Non-Destructive Inspection (~450w)

**Files:** Modify (append after §3)

- [ ] **Step 1: Write §4 — technique-indexed, table-led**

`<h2 id="toolbox-nd">4. FA Toolbox I — Non-Destructive Inspection</h2>`. Technique-indexed (read down the tools). **Lead with a `<table>`: Technique | Detects | Typical Resolution | Throughput | Key Limitation** covering: **C-SAM** (scanning acoustic microscopy — voids/delamination at the bond interface; high throughput), **X-ray** (gross defects, bridging; high), **CT / 3D X-ray** (3D void distribution through the stack; medium), **IR transmission** (buried-interface anomalies on IR-transparent stacks; medium). The **Throughput** column matters to FA engineers (can I screen 100 dies, or only 1 sample?) and feeds Figure 2's bubble size. Then 1 short paragraph per technique adding only what the table can't carry (when to reach for it). Keep prose lean (RULE 3) — the table does the work.

- [ ] **Step 2: Verify**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/hybrid-bonding-failure-analysis.html').read()
m=re.search(r'<h2 id="toolbox-nd".*?(?=</body>)',h,re.S); seg=m.group(0); t=re.sub(r'<[^>]+>',' ',seg).lower()
print("§4 words:",len(t.split()))
print("table present:", '<table' in seg)
print("techniques:", sum(k in t for k in ['c-sam','acoustic','x-ray','ct','infrared','ir '])>=4)
PY
```
Expected: §4 ≤520; table present; ≥4 ND techniques.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA §4 toolbox I non-destructive"
```

---

## Task 4: §5 FA Toolbox II — Physical Analysis (~550w) + Fig 2 placeholder

**Files:** Modify (append after §4)

- [ ] **Step 1: Write §5 — semi-destructive → destructive, table-led**

`<h2 id="toolbox-pa">5. FA Toolbox II — Physical Analysis</h2>`. The moat. **Lead with a `<table>`: Technique | Reveals | Destructiveness** covering: semi-destructive (mechanical polish to expose the interface; decapsulation for package-level) → destructive (cross-section — morphology; FIB — site-specific isolation; SEM — interface structure; TEM — atomic-scale interface; EDS/EELS — interfacial chemistry/composition). Short prose framing the progression from least to most destructive and information-rich. Insert `<!-- FIGURE 2 PLACEHOLDER -->` after the table.

- [ ] **Step 2: Verify**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/hybrid-bonding-failure-analysis.html').read()
m=re.search(r'<h2 id="toolbox-pa".*?(?=</body>)',h,re.S); seg=m.group(0); t=re.sub(r'<[^>]+>',' ',seg).lower()
print("§5 words:",len(t.split()))
print("table present:", '<table' in seg)
print("techniques:", sum(k in t for k in ['cross-section','fib','sem','tem','eels','eds'])>=5)
print("FIG2:", 'FIGURE 2 PLACEHOLDER' in h)
PY
```
Expected: §5 ≤650; table present; ≥5 PA techniques; FIG2 placeholder.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA §5 toolbox II physical analysis (moat)"
```

---

## Task 5: §6 Electrical FA + Correlation subsection (~400–500w)

**Files:** Modify (append after §5)

- [ ] **Step 1: Write §6**

`<h2 id="electrical-fa">6. Electrical Failure Analysis</h2>`. Allow **400–500 words** (not a hard 400) — this is the most engineering-distinctive section and competitor pages omit it. ~250–300w: daisy-chain / Kelvin test structures, resistance excursion as the earliest signal, and **failure isolation** — open/short localization that narrows *where* to look before any destructive cut (use the term "failure isolation"; it's a real FA search term). Then a `<h3>Correlating Electrical and Physical Evidence</h3>` subsection (~150–200w): the chain high-R → daisy-chain fail → isolated region → CT → cross-section/TEM — the layer that ties electrical FA to physical FA, and the thing competitor articles omit. Do NOT explain process causes (that's §7's exit + Surface Prep).

- [ ] **Step 2: Verify**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/hybrid-bonding-failure-analysis.html').read()
m=re.search(r'<h2 id="electrical-fa".*?(?=</body>)',h,re.S); seg=m.group(0); t=re.sub(r'<[^>]+>',' ',seg).lower()
print("§6 words:",len(t.split()))
print("daisy chain + resistance:", 'daisy' in t and 'resistance' in t)
print("correlation H3:", '<h3' in seg.lower() and 'correlat' in t)
PY
```
Expected: §6 ≤480; daisy-chain + resistance present; correlation H3 present.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA §6 electrical FA + correlation"
```

---

## Task 6: §7 Root-Cause Decision Tree (~350w) — RULE 2 + Fig 3 placeholder

**Files:** Modify (append after §6)

- [ ] **Step 1: Write §7 — evidence → suspect category → link out (RULE 2)**

`<h2 id="root-cause">7. Root-Cause Decision Tree</h2>`. Map **evidence → suspect category → where to investigate**, then link out. STOP at the suspect family (RULE 2). Examples: "void + clean dielectric → suspect surface-prep planarity/cleaning → see <a href="/insights/surface-preparation-cu-cu-hybrid-bonding">Surface Preparation</a>"; "chain-resistance shift + overlay error → suspect bonding-step alignment → see <a href="/insights/wafer-bonding-technologies-for-3d-integration">Wafer Bonding Technologies Guide</a>"; "TEM interfacial layer → suspect surface-state/copper-oxide → Surface Preparation." NEVER write the process cause ("activation power low," "queue time long," "raise RF power"). **The tree branches by EVIDENCE, never by process step** — do NOT structure it as "Void → CMP / Cleaning / Activation" (that is Surface Prep §8). Insert `<!-- FIGURE 3 PLACEHOLDER -->`.

- [ ] **Step 2: Verify RULE 2**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/hybrid-bonding-failure-analysis.html').read()
m=re.search(r'<h2 id="root-cause".*?(?=</body>)',h,re.S); seg=m.group(0); t=re.sub(r'<[^>]+>',' ',seg).lower()
print("§7 words:",len(t.split()))
print("suspect + links out:", 'suspect' in t and 'surface-preparation-cu-cu-hybrid-bonding' in seg)
print("FIG3:", 'FIGURE 3 PLACEHOLDER' in h)
# RULE 2 leak — must not prescribe process fixes
print("RULE2 leak (expect 0):", len(re.findall(r'rf power|queue time too|activation too|increase the|lower the (power|pressure)', t)))
PY
```
Expected: §7 ≤420; suspect + outbound links present; FIG3 placeholder; **RULE2 leak = 0**.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA §7 root-cause decision tree (RULE 2)"
```

---

## Task 7: §8 Failure Evolution Under Reliability Stress (~400w)

**Files:** Modify (append after §7)

- [ ] **Step 1: Write §8**

`<h2 id="reliability">8. Failure Evolution Under Reliability Stress</h2>`. FA lens, not reliability-engineering. Three stressors and the latent bonding defects they expose: **Thermal cycling (TC)** → interfacial crack growth, delamination propagation from a marginal bond; **Electromigration (EM)** → Cu depletion / void nucleation at the Cu-Cu joint; **Temperature-humidity bias (THB)** → interfacial corrosion/degradation. Thesis sentence: **reliability stress reveals latent bonding defects** — a marginal as-bonded interface that passed at t=0 fails at TC500 / HTOL 1000h, and the FA workflow is identical regardless of when the failure surfaces.

- [ ] **Step 2: Verify**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/hybrid-bonding-failure-analysis.html').read()
m=re.search(r'<h2 id="reliability".*?(?=</body>)',h,re.S); t=re.sub(r'<[^>]+>',' ',m.group(0)).lower()
print("§8 words:",len(t.split()))
print("3 stressors:", sum(k in t for k in ['thermal cycl','electromigration','humidity','htol','thb'])>=3)
print("latent thesis:", 'latent' in t)
PY
```
Expected: §8 ≤480; ≥3 stressors; "latent" thesis present.

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA §8 failure evolution under reliability stress"
```

---

## Task 8: FAQ + CTA (~250w)

**Files:** Modify (append after §8)

- [ ] **Step 1: Write FAQ + CTA**

`<h2 id="faq">Frequently Asked Questions</h2>` with exactly these 6 (each `<h3>` Q + `<p>` A, 2–4 sentences, rule-of-thumb, no body re-explanation):
1. How do you detect voids in a hybrid bond?
2. How is a copper-oxide bond defect confirmed? (oxide + TEM = high-value long-tail; promoted to #2)
3. What is the difference between C-SAM and X-ray for hybrid bond inspection?
4. How do you tell a surface-prep defect from a misalignment defect?
5. What failure-analysis techniques are destructive vs non-destructive?
6. How does reliability stress (thermal cycling, EM) reveal latent bonding defects?
Then a short CTA (engineer tone) → `<a href="/products/plasma-cleaner">plasma cleaners</a>` + `<a href="/products/icp-etcher">ICP-RIE systems</a>`, framed around surface-prep being where most FA root causes lead.

- [ ] **Step 2: Verify**
```bash
python3 - <<'PY'
import re
h=open('scripts/articles/hybrid-bonding-failure-analysis.html').read()
faq=re.search(r'id="faq".*',h,re.S).group(0)
print("FAQ Qs:", len(re.findall(r'<h3',faq)))   # 6
print("TOC:", h.count('Table of Contents'))   # 0
b=re.search(r'<body>(.*)</body>',h,re.S); print("TOTAL words:",len(re.sub(r'<[^>]+>',' ',b.group(1)).split()))
PY
```
Expected: FAQ=6; TOC=0; TOTAL ≤ 3,300 (aim 2,800–3,300).

- [ ] **Step 3: Commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA FAQ + CTA"
```

---

## Task 9: Whole-article audit (rules, links, length, anchors)

**Files:** Modify (fix anything flagged)

- [ ] **Step 1: Run the full audit**
```bash
F=scripts/articles/hybrid-bonding-failure-analysis.html
echo "--- total words (2800-3300) ---"; python3 -c "import re;h=open('$F').read();m=re.search(r'<body>(.*)</body>',h,re.S);print(len(re.sub(r'<[^>]+>',' ',m.group(1)).split()))"
echo "--- TOC=0 ---"; grep -c "Table of Contents" $F
echo "--- philosophy line ---"; grep -ci "begins with evidence" $F
echo "--- 8 section anchors + faq ---"; grep -oE '<h2 id="[a-z-]+"' $F
echo "--- internal links resolve ---"; grep -oE 'href="/insights/[a-z0-9-]+"' $F | sort | uniq -c
echo "--- product links (sparing) ---"; grep -oE 'href="/products/[a-z-]+"' $F | sort | uniq -c
echo "--- no bare domain ---"; grep -c 'href="https://ninescrolls.com"' $F
echo "--- tables (>=3: quick-ref + 2 toolbox) ---"; grep -c "<table" $F
echo "--- RULE 1 (§3 origin-cause leak) MANUAL: read §3, confirm no 'caused by a process step' ---"
echo "--- RULE 2 (§7 process-fix leak) MANUAL: read §7, confirm it stops at suspect category ---"
```
Expected: total 2,800–3,300; TOC=0; philosophy line present; anchors fa-mindset/fa-workflow/signatures/toolbox-nd/toolbox-pa/electrical-fa/root-cause/reliability/faq; hub + surface-prep links resolve; ≥3 tables; bare-domain=0. Manually confirm RULE 1 (§3) and RULE 2 (§7).

- [ ] **Step 2: Fix flagged issues, commit (skip if clean)**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA audit fixes" || echo "clean"
```

---

## Task 10: Figure prompts + `<figure>` blocks (cover-first gate)

**Files:** Modify article; Create `/tmp/fa-figure-prompts.md`

- [ ] **Step 1: Replace the 3 inline placeholders with `<figure>` blocks**

Swap `<!-- FIGURE 1/2/3 PLACEHOLDER -->` for `<figure class="post-figure"><picture>` blocks (xl/lg/md/sm `.webp` sources + `-lg.png` fallback `<img>` w/ descriptive alt + `loading="lazy" decoding="async"`) + `<figcaption>`, CDN base `https://cdn.ninescrolls.com/insights/hybrid-bonding-failure-analysis/<name>`, names: Fig 1 = `fa-workflow`, Fig 2 = `fa-toolbox-matrix`, Fig 3 = `root-cause-decision-tree`. Remove the cover placeholder (cover = imageUrl).

- [ ] **Step 2: Write `/tmp/fa-figure-prompts.md`, COVER FIRST**

Stage 1 = cover only (navy hero: hybrid-bond cross-section with a highlighted defect, probed by three converging modalities — acoustic / X-ray / cross-section beam; tagline "detect · image · root-cause"; title/subtitle/footer burned in). Stage 2 (after cover approved) = Fig 1 (6-node FA workflow), Fig 2 (**THE signature figure — 2D matrix: x = Information Content, y = Destructiveness, with bubble size = Throughput** — C-SAM = low-destructive/low-info but a big bubble (high throughput); TEM = high-destructive/high-info but a tiny bubble (very low throughput); plot X-ray/CT/cross-section/FIB/SEM/EELS between), Fig 3 (root-cause tree: **Evidence → Suspect Family → Where To Investigate** with exits to Surface Prep / hub — NOT "Evidence → Cause", and NOT branched by process step). White-bg flat inline / navy hero, brand palette.

- [ ] **Step 3: Verify markup**
```bash
F=scripts/articles/hybrid-bonding-failure-analysis.html
grep -c "post-figure" $F        # 3
grep -c "PLACEHOLDER" $F          # 0
grep -oE "/(fa-workflow|fa-toolbox-matrix|root-cause-decision-tree)-lg.png" $F | sort -u  # 3
```
Expected: 3 figures, 0 placeholders, 3 distinct names.

- [ ] **Step 4: Commit + HANDOFF**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "draft(insights): FA figure blocks + prompts"
```
**HANDOFF (two-stage):** give user the cover prompt → user generates + approves → then author Fig 1–3 prompts → user generates.

---

## Task 11: Import as draft + fix slug

**Files:** none (DDB)

- [ ] **Step 1: Import**
```bash
set -a; . ./.env; set +a
npx tsx scripts/create-insight.ts scripts/articles/hybrid-bonding-failure-analysis.html \
  --category "Process Integration" \
  --tags "hybrid bonding,failure analysis,failure isolation,C-SAM,scanning acoustic microscopy,X-ray CT,cross-section,TEM,delamination,void detection,daisy chain,reliability,3D integration,advanced packaging,root cause analysis"
```
Expected: prints an id + auto-derived (long) slug. **Record the id.**

- [ ] **Step 2: Fix slug** (create-insight derives slug from title)
```bash
set -a; . ./.env; set +a
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
(async()=>{await authenticate();
const id='<RECORDED_ID>';const want='hybrid-bonding-failure-analysis';
const {data:ex}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug:want});
if(ex&&ex.length){console.error('TARGET SLUG TAKEN by',ex[0].id);process.exit(1);}
const {data:u}=await (c as any).models.InsightsPost.update({id,slug:want});
console.log('slug now:',u.slug);})();
"
```
Expected: slug now `hybrid-bonding-failure-analysis`.

- [ ] **Step 3: Verify draft**
```bash
set -a; . ./.env; set +a; npx tsx scripts/list-insights-ddb.ts 2>/dev/null | grep "hybrid-bonding-failure-analysis"
```
Expected: row with category `Process Integration`.

---

## Task 12: Generate + upload images, fix imageUrl, push content

**Files:** none (CDN + DDB)

- [ ] **Step 1: Cover calibration** — user generates cover, returns path, review for brand fit.

- [ ] **Step 2: Upload all 4** (cover updates imageUrl; figs `--no-update-cover`)
```bash
set -a; . ./.env; set +a
SLUG=hybrid-bonding-failure-analysis
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <cover> --name cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig1> --name fa-workflow --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig2> --name fa-toolbox-matrix --no-update-cover
AWS_PROFILE=ninescrolls npx tsx scripts/upload-insights-image.ts $SLUG <fig3> --name root-cause-decision-tree --no-update-cover
```

- [ ] **Step 3: Ensure imageUrl extension-less + verify variants**
```bash
set -a; . ./.env; set +a
SLUG=hybrid-bonding-failure-analysis
npx tsx -e "
import {Amplify} from 'aws-amplify';import {generateClient} from 'aws-amplify/data';
import {authenticate} from './scripts/lib/auth';import out from './amplify_outputs.json';
Amplify.configure(out as any);const c=generateClient({authMode:'userPool'} as any);
(async()=>{await authenticate();const {data}=await (c as any).models.InsightsPost.listInsightsPostBySlug({slug:'$SLUG'});
const {data:u}=await (c as any).models.InsightsPost.update({id:data[0].id,imageUrl:'https://cdn.ninescrolls.com/insights/$SLUG/cover-lg'});
console.log('imageUrl',u.imageUrl);})();
"
for n in cover fa-workflow fa-toolbox-matrix root-cause-decision-tree; do
  for v in sm lg xl; do printf "%s-%s %s\n" $n $v "$(curl -sI -o /dev/null -w '%{http_code}' https://cdn.ninescrolls.com/insights/$SLUG/$n-$v.webp)"; done
done
```
Expected: imageUrl ends `/cover-lg`; all variants `200`.

- [ ] **Step 4: Push final content + hand-written excerpt**
```bash
set -a; . ./.env; set +a
npx tsx scripts/update-insight-from-html.ts hybrid-bonding-failure-analysis scripts/articles/hybrid-bonding-failure-analysis.html
```
Then set excerpt (140–180 chars, contains "hybrid bonding failure analysis"): *"How Cu-Cu hybrid bonding defects are detected, imaged, and traced to root cause — the FA toolbox (C-SAM, X-ray/CT, cross-section, TEM) and the evidence-to-root-cause workflow."*

---

## Task 13: Review + publish + ping

**Files:** none

- [ ] **Step 1: Human review** at `/admin/insights/<id>/edit` — figures land in §2/§5/§7, mobile preview, confirm RULE 1 (§3) and RULE 2 (§7) held.
- [ ] **Step 2: Publish** (admin toggle or set `isDraft:false`). Set excerpt if not already.
- [ ] **Step 3: Verify public page + cover 200 BEFORE ping**
```bash
SLUG=hybrid-bonding-failure-analysis
curl -sI "https://cdn.ninescrolls.com/insights/$SLUG/cover-lg.webp" -o /dev/null -w 'cover: %{http_code}\n'
curl -s -o /dev/null -w 'page: %{http_code}\n' "https://ninescrolls.com/insights/$SLUG"
```
Expected: both 200.
- [ ] **Step 4: Ping** (IndexNow not configured; sitemap auto-includes — best-effort)
```bash
set -a; . ./.env; set +a
npx tsx scripts/ping-search-engines.ts https://ninescrolls.com/insights/hybrid-bonding-failure-analysis || echo "ping best-effort"
```
- [ ] **Step 5: Final commit**
```bash
git add scripts/articles/hybrid-bonding-failure-analysis.html
git commit -m "content(insights): finalize hybrid bonding failure analysis spoke" || echo "already committed"
```

---

## Task 14 (DEFERRED — Phase B): cluster backlinks

Not part of shipping this spoke. Once published, in a consolidated pass: wire Surface Prep §8's forward-pointer ("a guide of its own") to this page, and add a hub §6 down-link. Deferred to avoid editing neighbors mid-flight — same rationale as the prior two articles. Also: the docs/article-source PR (provenance) batches with the next docs PR.

---

## Self-Review (plan author)

**Spec coverage:** §1–§8 → Tasks 1–7; FAQ/CTA → Task 8; figures → Task 10/12; dual-defer → Task 1; slug fix → Task 11; SEO tags/excerpt → Task 11/12; cluster backlinks → Task 14 (deferred). The 3 hard rules are enforced as checks: RULE 1 (Task 2 §3 leak grep + Task 9 manual), RULE 2 (Task 6 §7 leak grep + Task 9 manual), RULE 3 (length checks Task 8/9). Philosophy line (Task 1). §3-defect-indexed vs §4/§5-technique-indexed split is reflected in the section prompts. Quick-ref table (Task 2), correlation subsection (Task 5), reliability-as-evolution (Task 7), Fig 2 = 2D matrix (Task 10). All covered.

**Placeholder scan:** figure prompts deferred to Task 10 Step 2 (user-generated, not a gap); `<RECORDED_ID>` in Task 11 Step 2 is an explicit fill-from-Step-1 value, not a vague placeholder; all link hrefs concrete + verified; checks runnable. No "TBD/handle appropriately."

**Consistency:** figure CDN names (`fa-workflow`, `fa-toolbox-matrix`, `root-cause-decision-tree`) identical across Tasks 10/12. Slug identical across Tasks 1/11/12/13. Anchor ids (fa-mindset, fa-workflow, signatures, toolbox-nd, toolbox-pa, electrical-fa, root-cause, reliability, faq) consistent between authoring tasks and the Task 9 audit. Length cap 2,800–3,300 consistent across header / Task 8 / Task 9.
