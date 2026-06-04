# Publication Spotlight Engine — Operating Standard

NineScrolls has built its content infrastructure (etching/deposition/packaging topic graph). The remaining SEO lever is **domain authority**, and `Authority ≈ Content × Distribution`. This engine is the governance standard for earning authority through publication-grounded content. It is a **standard, not software**. Gate-1 sourcing is handled by Google Scholar Alert emails (email-only v1); see `citation-sourcing-reference.md` for the active alerts, vendor aliases, and manual-triage reference.

## Content taxonomy (B2 is banned)
| Type | Definition | Authority value |
|---|---|---|
| **A1** | Paper that **used NineScrolls/Tailong equipment** (cites a model) | Highest — irreproducible |
| **A2** | Equipment-relevant paper, not a customer | High |
| **B1** | Original industry analysis **with a NineScrolls-specific lens** (links into the cluster) | Medium |
| **B2** | News rehash, no original angle | Banned (fails Gate 2) |

**A1 confidence grading:** A1-confirmed (manufacturer + model) → writing queue · A1-probable (manufacturer or distinctive model only) → verify first · A1-unverified (generic model only) → flagged.

## Resource allocation (rolling 60-day, A1-first hard rule)
- **50% A1** equipment-in-publication (the scarce, irreproducible asset)
- **30% Cluster** spokes — priority: Hybrid Bonding vs Micro-Bump → TSV Etching → Temporary Bonding/Debonding → HBM4 Reliability
- **20% B1** commentary (NineScrolls-lens only)
- **Velocity ceiling:** quality over cadence; no page ships to hit a number.

## Gate 0.5 — Existing Topic Ownership (run BEFORE deciding to create a page)
Authority > URL count. Before writing a new Spotlight, ask two questions:
1. **Does a NineScrolls Guide already own this topic?** If yes → **enrich the guide**, don't create a competing page (avoids the cannibalization the RIE cluster had to undo). A new standalone Spotlight is only the default when **no** existing page owns the topic.
2. **Does that guide already cite this exact paper?** If yes → the enrichment may be just the **equipment attribution** (name the NineScrolls/Tailong model that produced the cited data), not a new section or figure.

Worked example (2026-06-04): the ICP-S-150 single-crystal-diamond paper (Sci Reports 2025) was a strong A1 candidate, but the **Diamond Semiconductor Processing** guide already owned diamond ICP etching AND already cited that paper as ref [1] (with the parameter-trends figure + 1:46 selectivity). So the action was NOT a new page — just a one-sentence equipment attribution in §5. → new standalone Spotlights are reserved for topics with no competing guide (e.g. RIE-100 SERS, thermoelectric dry etching).

## The 5 gates (every Spotlight passes all)
1. **Source** — A1 > A2 > B1 (Gate-1 automation finds A1 candidates).
2. **Linkable Asset (kill gate)** — "If I were a UCLA PhD, why cite this?" Must carry a filled `Why this is citable:` field = exactly one of **Original figure** / **Original data synthesis** / **Original framework** (e.g. Failure-Analysis Funnel, Surface-Conditioning Chain, Failure Routing Map). Can't fill it → don't publish.
3. **Internal Graph** — link ≥3 existing cluster pages; be back-linked from ≥3.
4. **Outreach (Distribution, from day 1)** — ≥2 channels per Spotlight (author email / lab or group page / university center or facility manager / LinkedIn-X), each logged with outcome. Targets come free from the Gate-1 candidate record (authors + affiliations).
5. **Measurement** — authority metrics, **not CTR**:
   - *Leading (weekly):* A1 candidates found, Spotlights published (A1 share), outreach sent + replies, internal-graph links added.
   - *Lagging (8–12+ wks):* referring domains, branded-query impressions, assisted clicks, ranking movement.

## Governance rules (anti-drift)
- **B2 banned.** No news rehash.
- **Comparison pages never become canonical owners** (RULE 7 from the RIE cluster): they answer "which to choose?", not "what is X?".
- **A1-first allocation is a hard floor**, not a target — the engine's central risk is sliding A1→B2.

See `citation-sourcing-reference.md` for Gate-1 sourcing (Scholar Alerts + manual-triage reference).
