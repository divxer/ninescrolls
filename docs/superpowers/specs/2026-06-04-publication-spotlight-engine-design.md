# Publication Spotlight Engine — Design Spec

**Date:** 2026-06-04
**Status:** Approved design → ready for implementation plan (Gate-1 automation sub-project first)
**Type:** Editorial system (content governance) + one software sub-project (Gate-1 automation)

---

## Strategic context

GSC analysis (2026-06-02, recorded in `memory/seo_strategy.md`) settled the strategy question for NineScrolls: the content *infrastructure* is built (a coherent etching/deposition/packaging topic graph), cannibalization is minor, and CTR is not a lever (every good-position query already converts 19–20%; every low-CTR query is low-CTR because it sits on page 5). **The only remaining lever is rankings → domain authority.** The site is young: few backlinks, weak brand signals, sparse citations. Authority does not accrue by waiting.

**Governing equation:** `Authority ≈ Content × Distribution`. Content with zero distribution ≈ zero authority. So this engine treats *off-page distribution* (outreach) as a first-class gate, not an afterthought.

**The central risk this engine exists to prevent:** sliding from scarce, high-value *equipment-in-publication* content (A1) toward easy, low-value *news rehash* (B2). A1 is hard to source; B2 is trivial to write. Left ungoverned, any content program drifts A1→B2 and becomes a "high-frequency, low-value industry-news site" Google has no reason to trust.

---

## Content taxonomy (governs every Spotlight)

| Type | Definition | SEO value | Authority value | Backlink probability |
|---|---|---|---|---|
| **A1** | A published paper **used NineScrolls equipment** (cites a model) | High | **Highest** | High |
| **A2** | Equipment-relevant paper, not a NineScrolls customer | Medium | High | Medium |
| **B1** | Original industry analysis **with a NineScrolls-specific lens** | Medium | Medium | Low |
| **B2** | News rehash (no original angle) | Low | Low | ≈ Zero |

**A1 is NineScrolls' irreproducible asset** — no competitor can write it, because it depends on real customers publishing real results with named NineScrolls tools (RIE-150, ICP-100, PECVD-150LL, ICP-S-150, MEB-600, RIE-150A, ICP-200, …). It is the engine's center of gravity.

**B1 rule:** allowed *only* with a NineScrolls-specific lens that links into the cluster. Forbidden vs allowed:
- ❌ "TSMC Announces A13 Process" (pure news → B2)
- ✅ "What TSMC A13 Means for Hybrid Bonding Yield Requirements" (links to Surface Preparation, Wafer Bonding, Failure Analysis → cluster reinforcement)

**B2 is banned.** It never passes Gate 2.

---

## Resource allocation (hard rule, A1-first)

Over any rolling 60-day window:
- **50% — A1 Equipment-in-Publication** (the scarce, irreproducible asset)
- **30% — Cluster Authority** (keyword-targeting spokes): priority order **Hybrid Bonding vs Micro-Bump → TSV Etching → Temporary Bonding/Debonding → HBM4 Reliability**
- **20% — B1 Commentary** (NineScrolls-lens only)

**Velocity ceiling (thin-content guard):** cadence serves quality, not the reverse. Prefer 1 A1 + 1 original-angle piece per week over 3 filler pieces. Google's helpful-content / scaled-content systems penalize mass low-originality output, which is fatal for a young domain. No page ships to hit a number.

---

## The 5 quality gates (every Spotlight passes all five)

### Gate 1 — Source (priority-ranked)
1. A1 Equipment-in-Publication
2. Cluster-supporting publication (A2)
3. Industry commentary (B1)

A1 sourcing is automated (see "Gate-1 Citation Monitoring Automation v1" below) because *discovering A1 candidates is the engine's true bottleneck* — not writing, illustrating, or SEO.

### Gate 2 — Linkable Asset (the kill gate)
Before publishing, ask: **"If I were a UCLA PhD student, why would I cite this page?"**
- Answer = "it summarizes the news" → **killed.**
- Answer = "it tabulates equipment parameters" → **not enough.**
- Must satisfy **≥1** linkable-asset level:
  - **Level 1 — Original figure** (process-flow diagram, failure map, equipment-comparison matrix)
  - **Level 2 — Original data synthesis** (e.g. etch rates aggregated across 10 papers; HBM generational parameters)
  - **Level 3 — Original framework** (e.g. the proven Failure-Analysis Funnel, Surface-Conditioning Chain, Failure Routing Map)

Level 3 assets are the most citable and the highest-leverage output of the whole engine.

### Gate 3 — Internal Graph
Each Spotlight must link **≥3 existing cluster pages** and be back-linked from **≥3 existing pages** — weaving it into the topic network, not stranding it.

### Gate 4 — Outreach (Distribution — from day 1)
After publishing, at least one outreach touch to the natural, warm audiences (NineScrolls' actual prospects — not cold link-building):
- Paper **authors** — "Your work was featured."
- **Labs / research groups** — "We highlighted your publication."
- **Cleanroom managers** — "We referenced your process flow."
- **University centers** (UCLA, UCSD, Stanford, Berkeley, …).

Gate-1's automation pre-populates this list (authors + affiliations come free from the citation APIs).

### Gate 5 — Measurement (authority metrics, NOT CTR)
Track: **impressions growth, referring domains, branded queries, assisted clicks.** Explicitly **not** CTR (proven a non-lever for this site). Review monthly.

---

## Gate-1 Citation Monitoring Automation v1 (software sub-project)

**Single responsibility:** *discover and rank A1 candidate papers.* It does **NOT** write, publish, or perform outreach. This boundary is the design's most important constraint.

**Feasibility constraint:** Google Scholar has no API and aggressively blocks scrapers/CAPTCHAs — **do not scrape it.** Use legitimate sources instead.

**Pipeline:**
```
[OpenAlex API]  [Crossref API]  [Google Scholar Alert emails (Gmail MCP)]
        \             |                    /
         →  normalize → dedupe vs citation-ledger → score & rank  →  Candidate Queue
```

**Cadence:** weekly — **Sunday 09:00 UTC** (daily is unnecessary at current scale; papers publish continuously, a weekly sweep never misses, never spams).

**Data sources:**
- **OpenAlex** (free, no key) — workhorse keyword search for each equipment model string + "NineScrolls" across titles/abstracts/fulltext.
- **Crossref** (free) — metadata corroboration (DOI, authors, affiliation, journal).
- **Google Scholar Alerts** — user creates standing alerts for the model strings; the task reads those alert emails via the connected Gmail MCP and folds them in.
- **Citation ledger** — a persistent store of already-known citations (the MEB-600 verified citations in `memory/project_meb600_oem.md` seed it) for deduplication.

**Candidate record schema (each queue entry):**
| Field | Use |
|---|---|
| DOI | unique key (dedupe) |
| Title | fast human triage |
| Equipment Match | which model(s) hit |
| Authors | Gate-4 outreach |
| Affiliation | Gate-4 outreach + scoring |
| Journal | authority weighting |
| Publication Date | freshness |
| Match Confidence | false-positive guard |
| Spotlight Score | ranking |

**Scoring model (initial weights — tune after first runs):**
```
A1 Direct Equipment Citation      +100
A2 Related Equipment Usage         +40
Top Journal                        +20
US Research University             +15
Multiple Equipment Mentions        +10
```
Output = ranked queue, e.g.:
```
1. Nature Communications · ICP-100 · Score 145
2. ACS Applied Materials · RIE-150 · Score 130
3. Applied Surface Science · PECVD-150LL · Score 118
```
Opening the queue each week immediately shows the highest-value A1 to write next.

**Match-confidence / false-positive guard:** equipment strings like "ICP-100" are generic; require corroboration (e.g. co-occurrence with "NineScrolls", or known model+vendor context) before scoring as A1. Low-confidence hits are flagged, not auto-promoted.

---

## Non-goals / boundaries
- **No auto-writing, auto-publishing, or auto-outreach** anywhere in the system. Automation ends at a ranked candidate queue; humans do everything downstream.
- **No B2.** News rehash never passes Gate 2.
- **No velocity-for-its-own-sake.** The cadence ceiling overrides any quota.
- **No Google Scholar scraping.** Alerts + APIs only.
- **No naming the MEB-600 OEM** on customer-facing Spotlights (per `memory/project_meb600_oem.md`); papers cite the model only, which is fine.

## Decomposition (two deliverables)
1. **The Engine** = editorial governance (taxonomy + 50/30/20 + 5 gates + asset levels). No code; it's a documented standard the writing workflow follows. This spec *is* its definition.
2. **Gate-1 Citation Monitoring Automation v1** = a software sub-project (cron task + OpenAlex/Crossref clients + Gmail-alert reader + dedupe ledger + scorer). **This gets its own implementation plan** (TDD, tasks) via writing-plans. Build it first — it fuels everything else.

## Measurement of the engine itself (90-day)
- A1 share of published Spotlights ≥ 50% (allocation held)
- Referring domains trend up (distribution working)
- Branded-query impressions trend up (brand signal growing)
- Zero pages that fail the "would a PhD cite this?" test in a quarterly audit
