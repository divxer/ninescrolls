# Design: Insight Article #4 — Types of Wafer Probe Stations (Measurement-Environment Guide)

**Date:** 2026-07-19
**Status:** Approved (brainstorm 2026-07-19; all six design sections approved with owner refinements)
**Branch:** `feature/probe-station-types-article`
**Cluster lane:** "which TYPE for which measurement environment" — fourth article of the probe-station cluster. Lane contract: #1 = how to choose (decision framework incl. automation), #2 = how to buy compliantly, #3 = how to evaluate cryogenic, **#4 = the environment/capability type map**. Zero content overlap with the other lanes; overlap only as interlinks.

## Purpose and audience

Researchers, lab managers, and first-time buyers who search type-level queries ("types of probe stations", "semiconductor probe station", "vacuum probe station", "manual probe station" adjacents). GSC (2026-07-17 check) already shows impressions on type/purchase-intent terms with zero content targeting them. The article maps measurement requirements to probe-station types along the **environment/capability axis**, explicitly orthogonal to the automation axis owned by article #1 §2.

## Type roster (locked)

Six type profiles, in article order:

1. Standard ambient
2. Cryogenic (deep-dive lives in article #3 — this profile stays survey-level and links out)
3. High-temperature
4. Vacuum
5. RF & microwave
6. Silicon photonics / optical

**High-power is NOT a seventh type.** It is woven into High-Temperature and Vacuum profiles as boundary-parameter passages (qualitative form, e.g. chuck insulation and breakdown protection under high current and voltage — SiC/GaN test context), placed inside "key specs to review" or "when not to choose".

## Article structure (locked)

1. TL;DR checklist
2. Opening framework (~2 paragraphs): the environment axis and how it composes orthogonally with the automation choice — "first fix the environment, then fix the automation level"; automation discussion links to article #1 §2. No restatement of #1 content.
3. Six type profiles, uniform five-part template each:
   a. What it is / distinguishing hardware
   b. Typical applications
   c. Key specs to review (datasheet-reading checklist — see wording rules)
   d. Qualitative cost drivers
   e. When NOT to choose it
   Plus per-profile interlinks (see interlink map).
4. Master comparison matrix figure + adjacent `<figcaption>` disclaimer ("An illustrative comparison…" pattern, case-insensitive guard as in #3).
5. Type-selection checklist (RFQ-ready, acceptance-criteria style continuing #3's pattern).
6. Where NineScrolls Fits (registry-safe wording only — attestation registry rules apply).
7. Further reading (cluster links) + References.

Estimated read time 13–15 min.

## Master matrix content contract (locked copy, single source)

Figure and in-article HTML table render the SAME 6-column × 4-row content from one source array (mirroring the `StationTypeComparison` cells-mirror-figure precedent). Layout: **types as columns, dimensions as rows**, 1600×900 landscape editorial figure.

Locked cell copy (review-refinable during spec/plan review, then frozen):

| Dimension | Standard ambient | Cryogenic | High-temperature | Vacuum | RF & microwave | Silicon photonics |
|---|---|---|---|---|---|---|
| **Environment hardware signature** | Open platen, micropositioners, isolation table | Sealed chamber; cryocooler or cryogen cooling; multi-stage vibration isolation | Heated chuck with thermal-isolation stack | Vacuum chamber, feedthrough wiring, in-chamber probe arms | High-frequency positioners, calibration-substrate holder, low-loss cabling | Fiber positioners with alignment optics alongside electrical probes |
| **Best-fit applications** | General current–voltage and capacitance characterization; wafer-level debug | Low-temperature device physics; superconducting and quantum-device screening | Elevated-temperature device behavior; reliability studies | Surface-sensitive devices; MEMS; moisture-free measurement | On-wafer high-frequency parameter extraction | Wafer-level optical coupling and photonic-circuit test |
| **Cost drivers** | Positioner precision; platform isolation grade | Cooling architecture; isolation stages; radiation shielding | Chuck uniformity engineering; thermal isolation of positioners | Chamber and pumping stack; feedthrough count and signal integrity | Calibration substrates; low-loss interconnect; probe replacement cycle | Alignment automation; optical instrumentation integration |
| **Buyer's key question** | Which upgrades will the platform accept later? | What does the stage deliver under your real heat load? | How uniform and stable is the chuck across a long soak? | Which signals must cross the chamber wall? | What does the daily calibration workflow look like? | How repeatable is fiber-to-chip alignment? |

Matrix content rules: purely qualitative; **no digits with physical units, no currency, no relative-cost symbols, no vendor/brand names**. The single-source array is guard-tested directly (see below), so neither the figure generator nor the HTML renderer can be bypassed.

## Wording and guard contract

Reused families (from #3, verbatim discipline):

- KELVIN token (digits + composable spelled-number grammar × K/kelvin), bidirectional brand-proximity ban, capability-verb ban, "guaranteed" ban, installation-included ban.
- Cryogenic profile reuses #3's phrasing contracts; temperatures appear ONLY as cryogen boiling-point references if at all (prefer none — survey level).

New families specific to this article:

- **no-unit-regex:** body text and matrix cells must contain no performance number with a physical unit (nm, µm, K, °C, GHz, MHz, dB, torr, Pa, A, V, W …). The article teaches WHAT to review, never HOW MUCH. Wording direction: architecture abstraction — "leakage-current dynamics", "thermal gradient control", "transition-loss behavior" (owner-approved register).
- **no-currency-regex:** no currency symbols, currency codes, or price digits anywhere; no $–$$$$ relative symbols. Price-intent traffic is routed to article #1's price table by interlink.
- **References exemption window:** external standards / literature citations in the References section MAY contain numbers, but the guard applies the no-unit family only OUTSIDE the references block (explicit scoping in the test, not a global weakening), AND a brand-proximity check ensures no NineScrolls/SEMISHARE mention shares a citation's context window.
- Both new families live in the single-source `GUARD_FAMILIES` structure consumed by (a) article-content assertions, (b) matrix-cell literal assertions, (c) the mutation meta-test with negative controls. Sabotage verification required (delete a pattern → its mutation row reds).

## Figures

Two assets, both on the proven deterministic pipelines:

1. **Cover** (`types-of-wafer-probe-stations` slug, `--name cover`): two-stage — text-free photorealistic scene (multi-environment lab feel; no recognizable OEM likeness, no brands, no temperature/frequency digits, no certification marks) + Sharp SVG deterministic typography (repo logo asset, U+2019 verification, pinned fonts). Acceptance: sRGB, 1600×900, spelling/curly-apostrophe check, banned-elements sweep.
2. **Type matrix figure** (`--name type-matrix --no-update-cover` — upload contract locked): PIL + fontTools WOFF2→TTF pipeline from `src/templates/equipmentGuide/fonts/` (Space Grotesk + Inter). **Generalized glyph assertion:** before drawing, assert every codepoint of every rendered string exists in the loaded font cmaps (covers U+2019, any dash/subscript, and all profile vocabulary), not just a fixed glyph shortlist. Nine-asset rule: base + 8 variants via `scripts/optimize-images.js`, checksum-freshness check, committed to this branch. sRGB asserted via sharp metadata. Versioned candidate first; canonical filename replaced only after visual acceptance.

Both figures follow the non-destructive candidate → QA → promote ordering; CDN upload happens exactly once, at publish time, never during implementation.

## Interlink map

Outbound (in-article):

- Opening framework → article #1 §2 (automation axis)
- Cryogenic profile → article #3 + `/applications/cryogenic-probing`
- Silicon-photonics profile → `/applications/silicon-photonics-probing`
- Cost-driver passages → article #1 price/award table (price-intent handoff)
- Type-selection checklist → article #2 (procurement lane)
- Where NineScrolls Fits → `/wafer-probe-stations/semishare`

**Post-deployment hooks (required, after this article publishes):** add reciprocal links pointing to #4 from article #1 (types survey from the five-decisions frame) and article #3 (Further reading), via the established repo-HTML-edit → guard-tests → `update-insight-from-html` path (one commit each, main).

## SEO and metadata (locked)

- Slug: `types-of-wafer-probe-stations`
- Title direction: "Types of Wafer Probe Stations: A Measurement-Environment Guide" (≤60-char check at implementation)
- Schema: TechArticle; category Metrology & Testing; author NineScrolls Engineering
- Standalone-HTML flow: `scripts/articles/types-of-wafer-probe-stations.html` with `article:*` meta tags (incl. slug override) + `data-related-products` JSON
- Publish chain identical to #3: `create-insight` draft → cover + figure upload (`--name cover` / `--name type-matrix --no-update-cover`) → fail-fast curl verification of all CDN keys → admin review/publish → llms.txt + llms-full.txt entries (74→75) + `check-llms-sync` → GSC Request Indexing.

## Constraints inherited from standing policy

- 不要造参数: no fabricated specs anywhere; this article's no-unit rule makes the discipline structural.
- Attestation gate wording only from the registry; no partner/authorized language.
- No Malaysia-assembly mention, no warranty duration, no delivered-pricing commitments.
- Article maintenance contract: any later price/legal edits update both visible "Last reviewed" and meta/schema dates together (inherited; this article ships with no price/legal content, minimizing exposure).

## Testing summary

- `typesArticle.test.ts` (name at implementer's discretion, colocated with cluster guard tests): guard families incl. new no-unit / no-currency / references-scoping; matrix single-source assertions; interlink presence; title-length and meta assertions; mutation meta-test + negative controls, sabotage-verified.
- Figure pipeline tests: glyph-coverage assertion, sRGB + dimensions via sharp, nine-asset freshness.
- Full suite green before PR; browser verification of the article route in dev before merge.
