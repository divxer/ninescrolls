# ICP-RIE Article Expansion — Design Spec

**Date:** 2026-07-20
**Article:** `icp-rie-technology-advanced-etching` — "ICP-RIE Technology: Principles, Equipment & Applications"
**Status:** Design approved (pending written-spec review)

## Problem

The ICP-RIE article is the #4 highest-traffic insight (162 views / 107 uniques in the
trailing 90 days) but the **thinnest** in the etching cluster: ~2,048 words vs. sibling
guides at 3,400–5,835 words. It is currently a 9-section physics explainer with no
process-depth, troubleshooting, decision guidance, FAQ, or references. This is a
high-traffic / low-depth page — the highest-ROI content investment in the cluster.

This is a **depth** problem, not a **freshness** problem: the top etching articles are
evergreen and carry no dated claims that rot (verified — only citation years appear).

## Goal

Roughly double the article (~4,000–4,500 words) with **ICP-RIE-specific depth**, without
re-teaching general RIE fundamentals (which would duplicate the RIE guide and worsen the
known cannibalization risk flagged in `seo_strategy`).

## Strategic spine

Every new section explains a capability or failure mode **in terms of the one thing that
makes ICP-RIE different: it decouples plasma density (ICP source power) from ion energy
(RF bias power).** This is the intellectual through-line and the anti-cannibalization
mechanism — content that only makes sense for ICP-RIE, not general RIE.

## Differentiation guardrails (vs. `reactive-ion-etching-guide`)

- **Do NOT re-teach:** Coburn–Winters synergy, basic gas-chemistry primer, RIE history,
  generic parameter definitions. These live in the RIE guide.
- **Link OUT** to sibling articles for shared fundamentals — strengthens the internal-link
  cluster and avoids duplication:
  - `reactive-ion-etching-guide` (general RIE principles)
  - `deep-reactive-ion-etching-bosch-process` (Bosch / deep Si)
  - `cryogenic-etching-vs-bosch-process` (cryo alternative)
  - `metal-etching-complete-guide` (metal/hard-mask specifics)
  - `reactive-ion-etching-vs-ion-milling` (physical etch comparison)

## Sourcing guardrail (`feedback_no_fabricated_specs` — "不要造参数")

**100% qualitative relationships.** No new numeric recipe/process values are invented. A
concrete number appears ONLY if cited from the article's existing references or the RIE
guide's already-established sources. Qualitative relationships (source↑ → density↑,
bias↑ → ion energy↑/selectivity↓) carry the technical weight instead.

## Structure

**Keep** the 9 existing sections; tighten §3 (source vs. bias) and §6 (applications) so the
new dedicated sections carry the depth. **Add** the following ICP-RIE-specific sections.

### New / amplified sections

1. **TL;DR** (top) — snippet-friendly summary, mirrors sibling template.

2. **Decoupled control in practice** *(core mechanical section — amplify)*
   Explicit qualitative **interaction matrix** mapping the two competing vectors — NOT prose:

   | Regime | Radical density | Ion energy | Etch character | Selectivity | Lattice/mask damage |
   |---|---|---|---|---|---|
   | **High source / low bias** | High | Low | Chemical / isotropic-leaning | High | Ultra-low |
   | **Low source / high bias** | Low | High (directional) | Physical / anisotropic, sputter-leaning | Lower | Higher |

   Plus the mixed-regime narrative (how real recipes sit between these poles) and how
   decoupling is what lets an operator move along each axis independently — impossible on a
   parallel-plate CCP where density and energy are coupled to a single RF supply.

3. **High-aspect-ratio & deep etching**
   Why high-density plasma enables high-AR / deep etching; qualitative treatment of
   passivation-driven anisotropy. **Links out** to DRIE/Bosch and cryo articles rather than
   re-teaching them.

4. **Material-specific ICP-RIE behavior** *(framing: the physical limits of standard RIE)*
   Qualitative "why ICP" per hard/low-volatility substrate — no recipe numbers:
   - **SiC / GaN / wide-bandgap:** high bond/binding energies require the **independent high
     ion flux** of an ICP source to break bonds efficiently *without* the excessive bias
     voltage a CCP would need — bias that would erode masks and cause severe lattice damage.
   - **III-V (InP, GaAs):** **volatility balance** — managing the temperature-dependent
     volatility of indium by-products vs. phosphorus/arsenic, where high-density plasma +
     independent temperature/energy control keeps etching congruent.

5. **Profile, damage & uniformity control** *(ICP-specific failure modes)*
   Emphasize failure modes **amplified by high-density plasmas**:
   - **ARDE / RIE-lag** (aspect-ratio-dependent etch rate).
   - **Micro-trenching** driven by ion deflection off charging sidewalls.
   - Notching / charging damage, sidewall bowing, loading.
   Bridge naturally to why **helium backside cooling and precise wafer-temperature control**
   are paramount in ICP systems vs. simple parallel-plate configurations.

6. **Endpoint detection & metrology** — OES / interferometry considerations at high density.

7. **Troubleshooting (ICP-RIE-specific)** — qualitative cause → fix table: RIE-lag,
   micro-trenching, notching, grass/black-Si, sidewall bowing.

8. **Choosing ICP-RIE + NineScrolls portfolio** *(clean commercial integration)*
   Focus on the **inflection point** where a lab/fab must move from standard RIE to ICP-RIE
   — e.g. aspect ratios exceeding a practical threshold, or mask selectivity failing on hard
   materials. Then seamlessly map those inflection points to NineScrolls ICP hardware, with
   links to the relevant ICP product pages. No hard sell.

9. **Future trends** — ALE (atomic layer etching), pulsed / mixed-mode plasma; brief and
   ICP-relevant only (do not duplicate the RIE guide's broader trends section).

10. **FAQ / Glossary / References** — ICP-RIE-specific.

## Authoring & delivery constraints

- Source of truth is DynamoDB; content is authored/edited and synced via the insight update
  scripts (`update-insight-from-html.ts` / `update-insight.ts`). Editor-save normalization
  is expected (`feedback_editor_save_normalization`).
- **No TOC in the HTML** — the page auto-generates it (`feedback_no_toc`).
- Table styling via existing CSS classes in `InsightsPostPage.css`, not inline styles.
- Keep responsive `<picture>`/srcset intact if any images are added.
- No fabricated specs; flag any unverified claim rather than guess.

## Pre-sync checklist (Phase 4, before `update-insight-from-html.ts`)

`update-insight-from-html.ts` does a **full `content` overwrite** and the repo file is
already divergent from the live DynamoDB record (the live CTA paragraph exists only in DDB).
Before syncing:

1. **Diff live vs. file:** run `fetch-insight-content.ts` and diff against the working HTML
   to confirm the only live-only content is the CTA paragraph (already verified once:
   5-line delta = the CTA) and nothing else is silently dropped.
2. **No surviving skeleton comments:** assert zero `<!-- SKELETON` / `<!-- NEW` / `<!-- Phase`
   comments remain. Beyond being incomplete, `stripHtml` (`/<[^>]*>/g`) mis-parses the `->`
   arrows in stub comments and would leak fragments into the computed `excerpt`/`readTime`.
3. **Confirm the CTA is restored** inside the finished §15 commercial section.

## Success criteria

- ~4,000–4,500 words, ICP-RIE-distinct.
- Zero duplicated fundamentals with the RIE guide; ≥4 **live** internal links to sibling
  articles in rendered output (skeleton has 1 of 5 live; Phases 2–4 close the rest — do not
  count links that live only inside comment stubs).
- §8 device-domain applications actively **trimmed** of the materials-physics prose that §9
  now owns (delete, don't just add §9) — else the spec's redundancy warning is violated.
- Explicit source-vs-bias interaction matrix present.
- No invented numeric process values.
- Clean commercial section anchored on the RIE→ICP-RIE inflection point.

## Out of scope

- Rewriting sibling articles.
- Any numeric recipe cookbook / process-window tables.
- Broader SEO cluster / intent-deconfliction work (separate `seo_strategy` Phase 2).
