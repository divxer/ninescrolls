# RIE Cluster Intent Deconfliction (Phase 2) — Design

**Date:** 2026-06-02
**Status:** Approved design → ready for implementation plan
**Type:** SEO repositioning (titles, openings, headings, canonical/internal-link hierarchy) + one content expansion
**Predecessor:** Phase 1 (internal-link consolidation, done 2026-06-01). See `memory/seo_strategy.md`.

---

## Problem (GSC-grounded, 3-month window 2026-03-01 → 2026-05-31)

Five RIE-cluster pages cannibalize each other for the same head terms. Cluster sits at **avg position 9.8** overall, but the generic-RIE head terms are stuck on **page 5**.

**Per-page totals:**

| Page | Clicks | Impressions | CTR |
|---|---|---|---|
| `reactive-ion-etching-guide` (pillar) | 307 | 11,460 | 2.7% |
| `understanding-differences-pe-rie-icp-rie-plasma-etching` (comparison) | 126 | 11,495 | 1.1% |
| `icp-rie-technology-advanced-etching` (ICP) | 56 | 3,366 | 1.7% |
| `reactive-ion-etching-vs-ion-milling` (ion-milling) | 52 | **19,161** | **0.27%** |
| `deep-reactive-ion-etching-bosch-process` (DRIE) | 34 | **10,583** | **0.32%** |

**Cannibalization evidence (query → page breakdown):**

- **"reactive ion etching"** (2,906 impr, **position 49.3**): pillar 105/2,252 ✅; ion-milling 6/511 ❌; DRIE 1/50 ❌; comparison **0 clicks / 875 impr** ❌. Four URLs split one query.
- **"reactive ion etch"** (1,990 impr, **position 50.5**): pillar 84/1,649 ✅; ion-milling 7/416 ❌.
- **"icp" family** (2,310 impr, position 22.5): comparison 45/1,469 **vs** ICP page 38/839 — two URLs split the ICP intent; the *dedicated* ICP page is **thin (841 words)** and **losing** to the comparison page for its own head term.

**Two diagnoses:**
1. **Generic-RIE dilution** — ion-milling + comparison + DRIE bleed impressions on "reactive ion etching"/"reactive ion etch", keeping the pillar on page 5. The ion-milling page is the largest leak (19K impr @ 0.27% CTR = junk exposure for queries it should not target). **[REVISED 2026-06-02 — see "Diagnosis refinement" below: query-level data shows ion-milling's impressions are legitimate ion-beam long-tail, not junk; cannibalization was smaller than this aggregate implied.]**
2. **ICP intent split** — the thin ICP page loses to the encyclopedia-style comparison page; Google can't tell which is the ICP-RIE authority.

---

## Goal

One URL = one search intent. Consolidate each head-term family onto a single owner so the pillar lifts off page 5, the ICP page becomes the ICP-RIE authority, and the ion-milling page sheds junk impressions.

```
RIE Guide (pillar)          owns: reactive ion etching · RIE · what is RIE · RIE equipment
├─ ICP-RIE Technology       owns: ICP-RIE · ICP etcher · ICP plasma etching · high-density plasma etching
│                                 · independent ion density control · ICP source power · ICP bias power
├─ DRIE / Bosch Process     owns: deep reactive ion etching · DRIE · Bosch process · TSV/MEMS deep etch
├─ PE vs RIE vs ICP-RIE     owns: RIE vs ICP-RIE · plasma etch comparison · which plasma process to choose
└─ RIE vs Ion Milling       owns: RIE vs ion milling · RIE vs IBE · etch-vs-mill selection
```

---

## Scope

**In scope:** post titles (= rendered H1), opening paragraphs, first-H2 framing, meta/excerpt where it re-defines RIE, intra-cluster internal links, and **one body expansion** (the ICP page, 841 → 1,700–2,200 words).

**Out of scope:** rewriting the bodies of the pillar, comparison, DRIE, or ion-milling pages; URL changes / redirects (explicitly rejected — every URL keeps its own intent and long-term keyword equity); figures/covers (these are existing pages).

**Note on H1:** none of the 5 pages use an in-content `<h1>`; the renderer emits the post **title** as the page H1. Therefore "H1 ownership" (RULE 5) is enforced on the **title** field.

---

## The six anti-cannibalization rules (verifiable, greppable)

Same discipline as the Advanced Packaging cluster's hard rules. Each is checkable after every edit.

- **RULE 1 — Definitional RIE opening.** Only the **pillar's** opening paragraph may contain a definitional `Reactive ion etching is…` / `RIE is…`. The other 4 openings must NOT.
- **RULE 2 — Definitional ICP-RIE opening.** Only the **ICP page's** opening may contain a definitional `ICP-RIE is…` / `Inductively Coupled Plasma … is…`. The comparison page's first 150 words must NOT define ICP-RIE.
- **RULE 3 — Pillar up-link (scoped to the opening).** Each non-pillar page carries **exactly one EARLY pillar up-link** — in the opening section — anchored "Reactive Ion Etching (RIE)": at least one, at most one, *in the opening*. Additional contextual references to the pillar deeper in the body are allowed and expected; the rule constrains only the **opening canonical-anchor link** to be singular (no link-stacking up top). (Phase-1 added these — verify the opening has exactly one; do not duplicate. A whole-article count of 2+ is fine as long as the opening has exactly one.)
- **RULE 4 — ICP length.** The ICP page final length is **1,700–2,200 words**.
- **RULE 5 — H1 (title) ownership.** Exactly one page owns each head-term in its title:
  - pillar → title contains "Reactive Ion Etching"
  - ICP → title contains "ICP-RIE"
  - DRIE → title contains "Deep Reactive Ion Etching"
  - comparison → title is comparison/selection intent; must NOT be a standalone "ICP-RIE …" or "Reactive Ion Etching …" definitional title
  - ion-milling → title is comparison intent ("… vs Ion Milling")
- **RULE 6 — No generic-RIE H2 on non-pillar pages (most important; Google infers topic from H2s).** A non-pillar page may *mention* "reactive ion etching (RIE)" but must not target it as a primary topic. The **first substantive H2** of each non-pillar page must be page-specific.
  - Forbidden on non-pillar pages: `What is Reactive Ion Etching?`, `How Reactive Ion Etching Works`, `Reactive Ion Etching Process`.
  - Allowed: `What Is ICP-RIE?`, `How the Bosch Process Enables Deep Etching`, `RIE vs Ion Milling: Mechanism Comparison`, etc.
- **RULE 8 — (Advisory) "ICP etcher" head-term belongs to the ICP page only.** Only the ICP-RIE page may target "ICP etcher" / "ICP-RIE" in its title or first H2. A future edit must not add a `What Is an ICP Etcher?` / `What Is ICP-RIE?` H2 to the comparison page (or any other), which would re-create the ICP intent split RULE 2 just fixed. Advisory (not blocking), but recorded in `memory/seo_strategy.md` so it survives across sessions.
- **RULE 7 — Comparison pages may compare, but never become canonical owners.** The comparison page (`PE vs RIE vs ICP-RIE`) and the ion-milling page (`RIE vs Ion Milling`) must remain comparison/selection-focused: they answer **"which should I choose?"**, not **"what is X?"**. They may *summarize* a technology (a row in a matrix, a one-line definition for context) but must NOT become the canonical owner of any individual technology topic — no expansion that turns a comparison page into a `What is ICP-RIE?` / `What is RIE?` encyclopedia entry. This permanently prevents a future rewrite from re-creating the ICP-intent split that RULE 2 just fixed.

---

## Per-page work (ordered by traffic-leak priority, NOT article order)

### Priority 1 — Ion Milling (`reactive-ion-etching-vs-ion-milling`) — largest leak (19,161 impr @ 0.27%)
- **Title:** unchanged — "Reactive Ion Etching vs Ion Milling (IBE): Complete Comparison Guide" (already comparison intent).
- **Opening:** rewrite. Remove the generic "Reactive ion etching (RIE)… Ion Milling…" re-introduction. Open with the *contrast frame*: e.g. "This guide compares two fundamentally different material-removal mechanisms — chemically-driven reactive ion etching and physically-driven ion milling — and when to choose each." (RULE 1, RULE 6)
- **First H2:** verify/reframe to a comparison-specific H2 (current first H2 "Introduction" → make it mechanism/selection-specific).
- **Meta/excerpt:** already comparison-focused — verify it does not lead with a generic RIE definition.
- **Link:** verify one pillar up-link (RULE 3).

### Priority 2 — ICP-RIE (`icp-rie-technology-advanced-etching`) — make it the canonical
- **Title:** → "ICP-RIE Technology: Principles, Equipment & Applications" (RULE 5 — owns "ICP-RIE").
- **Expansion:** 841 → **1,700–2,200 words** (RULE 4), 9-section structure:
  1. What is ICP-RIE
  2. How ICP plasma is generated
  3. ICP source power vs RF bias power (independent ion-density / energy control)
  4. Why ICP achieves high-density plasma
  5. ICP-RIE equipment architecture
  6. Semiconductor manufacturing applications (structured for long-tail capture — e.g. "ICP etching for GaN", "ICP etching SiC"):
     - Logic & Memory
     - SiC/GaN power devices
     - III-V photonics
     - Advanced packaging (TSV, deep-Si)
  7. ICP-RIE advantages
  8. ICP-RIE limitations
  9. ICP-RIE vs RIE (summary table)
- **Target terms:** ICP-RIE, ICP etcher, ICP plasma etching, high-density plasma etching, independent ion density control, ICP source power, ICP bias power.
- **Opening:** keep ONE definitional "ICP-RIE is…" (RULE 2 — this is the only page allowed it). Do NOT open with a generic "Reactive ion etching is…" (RULE 1); reference RIE only as contrast, with the pillar up-link (RULE 3).
- **Drafting:** sequential-subagent workflow (semiconductor-accurate), RULE 2/4/6 checks between sections; then DDB update + provenance HTML committed to `scripts/articles/icp-rie-technology-advanced-etching.html`.

### Priority 3 — Comparison (`understanding-differences-pe-rie-icp-rie-plasma-etching`) — de-encyclopedia-ize
- **Title:** → "PE vs RIE vs ICP-RIE: Which Plasma Etching Process Should You Choose?" (RULE 5 — selection intent).
- **Opening (first 150 words):** must NOT re-define ICP-RIE (RULE 2). Go straight to selection framing: Purpose → Comparison Matrix → Selection Guide → Use cases.
- **First H2:** verify it is comparison/selection-oriented (current "Terminology: What Does PE Mean?" is acceptable as PE-scoping but prefer a selection-first H2; must not become a standalone ICP-RIE or RIE definition — RULE 6).
- **Internal link:** add a strong link "For a complete explanation of ICP-RIE technology, see our ICP-RIE Technology Guide" → `/insights/icp-rie-technology-advanced-etching` (feeds the new canonical).
- **Category fix (optional hygiene):** currently "Materials Science" while siblings are "Nanotechnology" — align to the cluster.

### Priority 4 — DRIE (`deep-reactive-ion-etching-bosch-process`) — NOT untouched
GSC (10,583 impr @ 0.32% CTR) shows it is still mis-judged, so:
- **Title:** unchanged — "Deep Reactive Ion Etching (DRIE): Bosch Process Guide for MEMS & TSV" (already good, RULE 5).
- **Opening:** rewrite so "Deep Reactive Ion Etching (DRIE)" lands in the first ~20 words and frames DRIE as extending RIE — e.g. "Deep Reactive Ion Etching (DRIE) extends conventional reactive ion etching to create extremely deep, high-aspect-ratio structures…". Cede generic RIE intent to the pillar; do NOT open with a generic "Reactive ion etching is…" (RULE 1), and add no second pillar link (RULE 3).
- **First H2:** verify "1) Introduction to DRIE and the Bosch Process" stays DRIE-specific (RULE 6 — OK as-is, confirm).
- **Meta/excerpt:** verify it leads with DRIE/Bosch, not generic RIE.
- **Link:** verify pillar up-link (RULE 3).

### Pillar (`reactive-ion-etching-guide`) — unchanged
Already the canonical RIE owner (title + first H2 "1) What is Reactive Ion Etching?" + strong hub). It is the ONLY page allowed RULE 1 / generic-RIE H2. Verify only.

---

## Execution mechanics

- **4 surgical edits** (ion-milling, comparison, DRIE openings/titles/links + comparison internal link): one **one-shot DDB edit script** — verbatim find/replace, dry-run first, idempotency guards, **not committed** (same pattern as every prior content edit; live source of truth is DDB).
- **1 content expansion** (ICP page): sequential-subagent draft → DDB `update` → provenance HTML committed to `scripts/articles/`.
- **No `update-insight-from-html` on the 3 metadata-edited pages** — it replaces the whole content field and would clobber the surgical edits. Use targeted regex find/replace only (tolerant of whitespace/attribute drift in the live HTML).
- **ICP technical-accuracy gate** — after drafting, the ICP body passes a dedicated technical review before going live: ICP density 10¹¹–10¹² cm⁻³ (vs CCP ~10⁹–10¹⁰); source power → plasma density, RF bias → ion energy (the decoupling); low-pressure operation → longer mean free path → anisotropy; ARDE (aspect-ratio-dependent etching) and microloading named correctly. These are the page's E-E-A-T spine.
- **Auditability** — because the 3 surgical edits live only in DDB, a committed `docs/seo/rie-phase2-change-log.md` records old→new title and old→new opening for every changed page, so a future reader can see why the live pages differ from any historical source.

## Diagnosis refinement — query-level GSC review (2026-06-02, post-deploy)

A detailed query-level GSC pull (28-day window, sorted by impressions) **partially revises the original cannibalization thesis**, which was built on the 3-month aggregate + clicks-sorted tables:

- **ion-milling page** (4,788 impr, avg position **8.2**): its named queries are ALL on-topic ion-milling/IBE ("ion beam etching", "ion milling etching", "mtj ion beam etching redeposition", "ion beam etcher"). The huge impression count is a **legitimate anonymized long-tail** of ion-beam micro-queries (top named query only 44 impr; the bulk is sub-threshold long-tail). It is **NOT** cannibalizing "reactive ion etching."
- **DRIE page** (4,200 impr, position **8.9**): same — all queries are on-topic DRIE/Bosch ("deep reactive ion etching", "silicon drie", "bosch process etching").
- **ICP page** already ranks position **13** and owns the right ICP-RIE terms — a good base for the canonical expansion.
- **Exact "reactive ion etching"** (28-day): pillar already holds ~98% impression share (256/262) but at **position 73.8** — so the live problem on this term is *position*, not splitting.

**Conclusion:** real cannibalization was **smaller** than the aggregate implied. The "19K junk impressions @ 0.27%" framing was an artifact; those impressions are legitimate topical long-tail at mediocre position/CTR. The work remains net-positive (ICP thin→canonical is real upside; RULE 5/6/7 prevent future drift), but the metrics below are corrected accordingly.

## Success metrics (re-pull GSC ~3–4 weeks after deploy) — CORRECTED 2026-06-02

1. **Pillar position rises** — "reactive ion etching" / "reactive ion etch" climb off page 7 (recent position ~73; 3-mo ~49) toward page 1 as intent signals consolidate. (Primary win to watch.)
2. **ICP page overtakes comparison page** for "icp-rie" / "icp etcher" / "icp plasma etching" head terms, and its own position improves from ~13. (Strongest expected win — the canonical expansion.)
3. ~~Ion-milling impressions decrease while CTR increases.~~ **RETRACTED — invalid metric.** Ion-milling's impressions are legitimate on-topic ion-beam long-tail, not junk; a decline would be *bad*, not success. (Replaced by #3' below.)
3'. **No topical regression** — ion-milling and DRIE retain their page-1 positions (~8–9) and impression volume on their own ion-beam / DRIE queries; the opening/H2 edits must not cost them their existing topical ranking.
4. **Query ownership** — on a future GSC page-breakdown for exact query **"reactive ion etching"**, the pillar holds **>90% of cluster impressions** (already ~98% in recent 28-day data; track as a guardrail against regression rather than a gain).

**Separate future opportunity (not part of this project):** ion-milling & DRIE rank page-1 (pos 8–9) on their own terms but at ~0.2% CTR — a titles/snippet optimization candidate, distinct from intent deconfliction.

---

## Risks

- **Title changes on ranking pages** carry short-term volatility; the comparison and ICP titles change, but both currently rank poorly for their intended intent, so downside is low.
- **Consolidation lag** — Google needs re-crawl + re-evaluation; the 3–4 week measurement window accounts for it. Optionally ping/submit updated URLs (IndexNow not configured; rely on sitemap + natural crawl).
- **Regression risk** — RULE 5/6 exist specifically so a future edit can't re-introduce a generic-RIE H1/H2 on a non-pillar page and restart the cannibalization. Record the rules in `memory/seo_strategy.md`.
