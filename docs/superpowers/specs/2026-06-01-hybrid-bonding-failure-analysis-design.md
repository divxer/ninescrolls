# Insights Spoke Design: Hybrid Bonding Failure Analysis

**Date:** 2026-06-01
**Type:** Insights spoke article (content) — Advanced Packaging cluster, Spoke #2
**Status:** Approved — ready for writing-plans
**Author:** NineScrolls Engineering (drafted with Claude)

---

## 1. Strategic Positioning

### Title
**Hybrid Bonding Failure Analysis: Detecting, Imaging, and Root-Causing Bond Defects**

### Slug
`hybrid-bonding-failure-analysis`

### One-line definition (the cluster contract)
*Hybrid Bonding Failure Analysis explains how bonding defects are detected, imaged,
characterized, and traced to root cause — from initial electrical symptoms through
advanced inspection and physical analysis techniques.*
- This page answers **"How do I prove what happened?"** (diagnosis)
- Surface Preparation answers **"Why did it happen / how to prevent it?"** (origin)
- The Wafer Bonding hub answers **"What can go wrong?"** (overview)

### Category
`Process Integration`

### Target length
**2,800–3,300 words.** Deliberately NOT chasing 3,500. This is **lookup content** for FA /
packaging / reliability engineers, not a tutorial — favor **tables + figures over prose**
(a clean "Tool | Detects | Limits" table beats 500 words on C-SAM physics). Surface Prep ran
~3,400 because it had to walk a full process chain; FA does not.

### Role in the cluster
Spoke #2. CHILD of Surface Preparation §8 (which explicitly forward-points to "the
failure-analysis side… a guide of its own" — that guide is this page) and related to the
hub §6 overview. It is the **convergence point**: the only page in the cluster that handles
*all* defect types together — void, particle, oxide, dishing, **misalignment**,
delamination — because diagnosis is defect-agnostic at the moment of observation.

---

## 2. Anti-Cannibalization — THREE HARD RULES

| Neighbor | Owns | This page's boundary |
|---|---|---|
| Hub §6 (Failure Modes) | The 5 modes at mechanism→cause→mitigation (overview) | Don't re-list modes as an overview; assume them, diagnose them |
| Surface Prep §8 (mapped to surface prep) | Defect → originating CMP/clean/activation/copper step (prevention) | **Never explain origins** |
| HBM article | Industry/thermal | n/a |

**RULE 1 — §3 does NOT discuss origins.** Each defect gets exactly three things:
**Signature** (electrical/physical symptom) → **Evidence** (what each technique shows) →
**Next step** (which technique to run next). NO "Causes: CMP… / cleaning… / activation…"
— that is Surface Prep's territory, forbidden here.

**RULE 2 — §7 stops at the suspect *category*.** The root-cause decision tree maps
**Evidence → suspect category** (e.g. "C-SAM void + TEM interfacial layer → suspect
surface-state issue → see Surface Preparation §8"). It must NOT explain the process cause
("activation power too low / queue time too long") — that is Surface Prep. §7 ends at the
root-cause *family* and links out.

**RULE 3 — length 2,800–3,300**, tables/figures over prose.

### The structural anti-overlap device (approved)
- **§3 is defect-indexed** (read *down* the defects: what does a void / oxide / misalignment
  look like).
- **§4–§6 are technique-indexed** (read *down* the tools: what does C-SAM / CT / cross-section
  reveal, and not reveal).
Same matrix transposed → complementary, never duplicative. §3 = symptom-first entry; §4–6 =
tool-first entry.

---

## 3. Section Structure (8 sections + FAQ)

| § | Title | Words | Focus |
|---|---|---|---|
| 1 | The Failure-Analysis Mindset | ~250 | Diagnosis-not-prevention framing; the one-line definition; **dual-defer**: overview → hub §6, origins → Surface Prep §8. **MUST open on the philosophy line (verbatim intent): "Failure analysis begins with evidence, not defects."** — this keeps the page evidence-centric, not a defect catalogue. |
| 2 | The FA Workflow | ~250 | The spine (6 nodes, real FA): Observed Symptom → Non-Destructive Inspection → Physical Characterization → Evidence Correlation → Suspect Root-Cause Family → Corrective Action. **Figure 1.** |
| 3 | Failure Signatures & Evidence | ~500 | **Defect-indexed.** Per defect — void, particle-void, copper open/oxide, proud-copper void, **misalignment**, delamination — give ONLY: Signature / Evidence / Next step (RULE 1: no origins). **End the section with a "Symptom-to-First-Tool Quick Reference" table** (~80–100w): Open circuit→electrical test; High resistance→daisy chain; Void indication→C-SAM; Delamination→C-SAM; Misalignment suspicion→overlay/cross-section; Interfacial anomaly→TEM. (Answers the engineer's real first question: "what do I look with first?") |
| 4 | FA Toolbox I — Non-Destructive Inspection | ~450 | **Technique-indexed.** C-SAM (voids/delamination), X-ray (gross defects), CT (3D void distribution), IR (buried-interface). Lead with a **table: Technique \| Detects \| Typical Resolution \| Key Limitation** (engineer-reading order, not "doesn't see"). |
| 5 | FA Toolbox II — Physical Analysis | ~550 | Semi-destructive (polish, decap) → destructive (cross-section, FIB, SEM, TEM, EDS/EELS). **Table.** **Figure 2** (the Toolbox ladder — the moat). |
| 6 | Electrical Failure Analysis | ~400 | Daisy chains / test structures, resistance excursion, open/short localization. **Includes a short subsection "Correlating Electrical and Physical Evidence"** (~150–200w): high-R → daisy-chain fail → localized region → CT → cross-section. The layer that ties electrical FA to physical FA — territory Surface Prep never touches. |
| 7 | Root-Cause Decision Tree | ~350 | **Evidence → suspect category**, then link out (RULE 2: stop at family). **Figure 3** (decision tree with arrows out to Surface Prep / hub). |
| 8 | Failure Evolution Under Reliability Stress | ~400 | FA lens (not reliability-engineering): TC → crack growth / delamination; EM → Cu depletion / void nucleation; THB → interfacial degradation. Thesis: **reliability stress reveals latent bonding defects.** |
| — | FAQ + CTA | ~250 | 6 Qs + engineer CTA. |

The **FA Toolbox (§4 + §5)** is the largest, most differentiated block — the cluster's only
FA-technique content and this page's SEO moat.

The per-section figures are **upper targets, not floors** (they sum to ~3,150 prose). §4/§5
are table-heavy, so their *prose* word counts run well under the figures shown — that is the
mechanism for landing the whole article (incl. FAQ) at **≤ 3,300** while keeping the content
dense. If the total pushes over, trim §1/§2/§8 first; never pad §4/§5 prose to "explain" what
the tables already say (RULE 3).

---

## 4. Figure Plan (cover + 3; white-bg flat infographics, brand palette)

Inherits the cluster visual standard (navy hero; white-bg inline; navy/blue/violet/copper;
red for defect/failure). Uploaded via `upload-insights-image.ts` (`AWS_PROFILE=ninescrolls`),
imageUrl extension-less `-lg`.

| # | Title | CDN name | § | Content |
|---|---|---|---|---|
| Cover | navy hero | `cover` | top | a hybrid-bond cross-section with a highlighted defect, probed by three converging inspection modalities (acoustic / X-ray / cross-section); tagline "detect · image · root-cause" |
| Fig 1 | The FA Workflow | `fa-workflow` | §2 | Symptom → Inspection → Characterization → Root Cause → Corrective Action (the spine) |
| Fig 2 | The Hybrid Bonding FA Toolbox | `fa-toolbox-matrix` | §5 | **THE signature figure** — a **2D matrix: x-axis = Information Content, y-axis = Destructiveness**. Plot C-SAM / X-ray / CT (low destructiveness) … cross-section / FIB / SEM … TEM / EELS (high destructiveness, high information). Conveys the real engineering trade-off (C-SAM = non-destructive but low info; TEM = atomic detail but fully destructive), not a flat ladder. |
| Fig 3 | Root-Cause Decision Tree | `root-cause-decision-tree` | §7 | evidence → **suspect category** → **where to fix** (arrows OUT to Surface Prep / hub). MUST show suspect *category* and the exit, NOT the actual process cause (RULE 2). e.g. "TEM interfacial layer → suspect surface-state → Surface Preparation" — never "→ activation too weak → raise RF power". |

Heavy use of **tables in §4/§5** to keep prose down (RULE 3).

---

## 5. Internal Link Map

| § | Links to | Direction / context |
|---|---|---|
| §1 (dual-defer) | Hub (overview); Surface Preparation (origins) | UP — "Wafer Bonding Technologies Guide", "Surface Preparation for Cu-Cu Hybrid Bonding" |
| §3 | Surface Preparation §8 | per-defect "for how this originates / prevention, see…" (do NOT explain origin inline) |
| §7 | Surface Preparation (process causes); Hub (bonding-step / misalignment origin) | the decision tree's "where to fix" exits |
| §4/§5 | (optional) `/products/icp-etcher`, `/products/plasma-cleaner` only if natural — this is an FA page, light on product push | product (sparing) |
| CTA | `/products/plasma-cleaner`, `/products/icp-etcher` | product |

Confirmed-live targets: `/insights/wafer-bonding-technologies-for-3d-integration`,
`/insights/surface-preparation-cu-cu-hybrid-bonding`, `/products/plasma-cleaner`,
`/products/icp-etcher`.

**Phase B (post-publish):** wire Surface Prep §8's forward-pointer ("a guide of its own") to
this page, and add a hub §6 down-link. Deferred — don't edit neighbors mid-flight; batch the
backlink pass after publish (same pattern as the surface-prep spoke).

---

## 6. SEO Ownership & Metadata

**This spoke owns (no conflict with hub §6 / Surface Prep §8):**
- hybrid bonding failure analysis
- hybrid bond void detection / C-SAM hybrid bonding
- hybrid bonding delamination / hybrid bond reliability
- hybrid bonding defect root cause
- hybrid bond cross-section / TEM interface analysis
- daisy chain test hybrid bonding

```
Meta description (~155 chars):
How Cu-Cu hybrid bonding defects are detected, imaged, and traced to root cause — the FA
toolbox (C-SAM, X-ray/CT, cross-section, TEM) and the evidence-to-root-cause workflow.

OG title: Hybrid Bonding Failure Analysis — Detect, Image, Root-Cause
articleType: TechArticle
```

Tags: hybrid bonding, failure analysis, C-SAM, scanning acoustic microscopy, X-ray CT,
cross-section, TEM, delamination, void detection, daisy chain, reliability, 3D integration,
advanced packaging, root cause analysis

### FAQ (pre-locked, FAQPage schema)
1. How do you detect voids in a hybrid bond?
2. What is the difference between C-SAM and X-ray for hybrid bond inspection?
3. How is a copper-oxide bond defect confirmed?
4. How do you tell a surface-prep defect from a misalignment defect?
5. What failure-analysis techniques are destructive vs non-destructive?
6. How does reliability stress (thermal cycling, EM) reveal latent bonding defects?

---

## 7. Authoring Conventions
- NO hand-written TOC (auto-generated). [memory: feedback_no_toc]
- Product links → specific `/products/...`; keep product pushes sparing (FA page, not a sales page).
- Figures: `<figure class="post-figure">` + responsive `<picture>` (sm/md/lg/xl webp) + `<figcaption>`.
- `<h2 id="...">` anchors per section; `<h3>` for the §6 correlation subsection.
- Import: HTML in `scripts/articles/hybrid-bonding-failure-analysis.html` → `create-insight.ts`
  (**FIX slug in DDB after — it auto-derives from title**) → cover-first figure gate →
  upload (`AWS_PROFILE=ninescrolls`) → fix imageUrl extension-less → update-insight-from-html →
  hand-written excerpt → publish → ping.
- Audience: US/international FA / packaging / reliability engineers; English only.
- **Three hard rules enforced in the plan's per-section checks:** RULE 1 (§3 no origins),
  RULE 2 (§7 stops at suspect category), RULE 3 (length 2,800–3,300).
