# ICP-RIE Product Boundary and Entity Consistency — Design

**Date:** 2026-07-07
**Status:** Draft for user review
**Type:** SEO Opportunity Framework Phase 2 — Intent Deconfliction
**Scope:** Code-owned product pages only; no DDB article edits
**Predecessor:** `docs/superpowers/specs/2026-06-02-rie-cluster-intent-deconfliction-design.md`

---

## Problem

GSC shows the ICP/RIE cluster already has meaningful traffic, but the intent split is not clean enough:

| Query | Clicks | Impressions | Read |
|---|---:|---:|---|
| `icp etcher` | 54 | 239 | High-intent product/select query |
| `icp rie etching` | 42 | 334 | Mixed Learn + Process query |
| `icp rie` | 4 | 1,114 | Large naked-head-term loss, strongly Mixed SERP |
| `rie etcher` | 44 | 514 | RIE product/select query |
| `reactive ion etching` | 70 | 490 | Learn query, should not be product-owned |

Page-level GSC confirms the cluster is active:

| Page | Clicks | Impressions | Intended role |
|---|---:|---:|---|
| `/insights/reactive-ion-etching-guide` | 179 | 7,335 | Learn: RIE pillar |
| `/insights/understanding-differences-pe-rie-icp-rie-plasma-etching` | 90 | 9,902 | Compare: PE/RIE/ICP-RIE selection |
| `/insights/icp-rie-technology-advanced-etching` | 76 | 6,341 | Learn: ICP-RIE technology canonical |
| `/products/rie-etcher` | 73 | 752 | Select/Buy: RIE system |
| `/products/icp-etcher` | 48 | 928 | Select/Buy: ICP-RIE system |

The product page currently uses broad phrasing such as "ICP-RIE Plasma Etching Platform". That is not wrong, but it leaves room for the product page to compete with the ICP-RIE technology article for the naked `icp rie` and `icp rie etching` queries. The product page should instead make its equipment-selection role unmistakable.

---

## Goal

Make the ICP-RIE product page own equipment-selection intent while preserving the existing Learn and Compare owners:

| Intent | Query family | Owner |
|---|---|---|
| Learn | `icp rie`, `icp-rie`, `icp rie etching`, `what is icp-rie`, `icp-rie technology` | `/insights/icp-rie-technology-advanced-etching` |
| Select/Buy | `icp etcher`, `icp-rie system`, `icp-rie equipment`, `icp-rie etching system`, `research plasma etcher` | `/products/icp-etcher` |
| Compare | `icp vs rie`, `rie vs icp-rie`, `pe vs rie vs icp-rie` | `/insights/understanding-differences-pe-rie-icp-rie-plasma-etching` |
| RIE Select/Buy | `rie etcher`, `reactive ion etcher`, `rie system` | `/products/rie-etcher` |
| Compact RIE Select/Buy | `compact rie`, `benchtop rie`, `sv-rie` | `/products/compact-rie` |

Success is a cleaner entity graph, not an immediate ranking promise.

---

## In Scope

1. Update the ICP-RIE product page's SEO title and meta description to signal equipment-selection intent.
2. Add or adjust one FAQ entry on the ICP-RIE product page that sends Learn-intent users to the ICP-RIE technology guide and Select-intent users through the product page.
3. Retitle ICP product-page resource links so their anchors communicate role:
   - `Learn ICP-RIE Technology`
   - `Compare ICP-RIE vs RIE`
   - `Deep Silicon Bosch Process`
   - `Diamond Semiconductor Processing`
4. Expand ICP product resources from 3 to 4 items to preserve the diamond deep link.
5. Verify RIE and Compact RIE title locks still pass, and add narrow meta-description regression tests for both sibling pages.

---

## Non-Goals

- Do not change H1 or visible page structure in this sprint. This preserves the experimental discipline from the Plasma Cleaner CTR sprint.
- Do not edit DDB insight articles in this sprint.
- Do not rewrite the RIE pillar, ICP-RIE technology article, PE/RIE/ICP-RIE comparison article, DRIE article, or ion-milling article.
- Do not add redirects or URL changes.
- Do not remove the diamond article deep link unless a separate DDB content task adds a better internal-link host first.
- Do not change product specs, images, Product/Offer schema, CTAs, or quote flow. FAQPage schema content will change as a direct consequence of the visible FAQ addition; this is intentional and must stay visible-content-matched.

---

## Proposed Content Changes

### ICP Product Page

Current title:

`ICP-RIE Plasma Etching Platform`

Proposed bare title:

`ICP-RIE Etching System for Research Labs`

Final rendered title will be:

`ICP-RIE Etching System for Research Labs | NineScrolls LLC`

Reasoning:

- Keeps `ICP-RIE` first.
- Adds `system`, which is stronger Select/Buy vocabulary than `platform`.
- Adds `research labs`, matching NineScrolls' actual customer segment.
- Avoids taking the naked Learn intent as aggressively as an encyclopedia-style title would.

Proposed meta description:

`Select a NineScrolls ICP-RIE etching system for silicon, MEMS, diamond, and compound semiconductor etching. Review specs, applications, and request a quote.`

Reasoning:

- Starts with `Select`, not `Learn`.
- Keeps the meta description at 158 characters so the CTA phrase survives likely search-result truncation.
- Contains `ICP-RIE etching system`, `silicon`, `MEMS`, `diamond`, and `compound semiconductor etching`.
- Keeps quote intent visible without changing visible layout.

### ICP FAQ

Add one FAQ item:

**Question:** `Should I use this ICP-RIE system page or the ICP-RIE technology guide?`

**Answer:** `Use this product page when you are selecting an ICP-RIE etching system, checking wafer size, ICP power, bias control, gas lines, temperature range, applications, or quote requirements. Use the ICP-RIE Technology guide when you want to learn the principles of inductively coupled plasma generation, source power, bias power, and high-density plasma etching.`

This explicitly divides Select/Buy from Learn intent in visible copy and FAQ schema.

### ICP Resources

Replace the current three-resource list with four resources:

| Anchor | URL | Role |
|---|---|---|
| `Learn ICP-RIE Technology` | `/insights/icp-rie-technology-advanced-etching` | Learn owner for naked `icp rie` and `icp rie etching` |
| `Compare ICP-RIE vs RIE` | `/insights/understanding-differences-pe-rie-icp-rie-plasma-etching` | Compare owner |
| `Deep Silicon Bosch Process` | `/insights/deep-reactive-ion-etching-bosch-process` | DRIE/deep silicon spoke |
| `Diamond Semiconductor Processing` | `/insights/diamond-semiconductor-processing-icp-etching-deposition` | Preserve diamond deep link |

The diamond item must not disappear silently. If a future design wants only three product-page resources, it must first place a stronger diamond internal link in another content asset.

---

## Entity Usage Rules

Use these rules as testable copy constraints for the product cluster:

1. Product page primary entity: `ICP-RIE etching system`.
2. Product page secondary entities: `ICP etcher`, `ICP-RIE equipment`, `research plasma etcher`, `silicon etching`, `MEMS`, `diamond processing`, `compound semiconductor etching`.
3. Technology article primary entity: `ICP-RIE technology`.
4. Technology article owns naked `icp rie` and `icp rie etching`.
5. Comparison article owns `ICP-RIE vs RIE` and `PE vs RIE vs ICP-RIE`.
6. Product pages may link to Learn/Compare articles, but should not define ICP-RIE as an encyclopedia entry in title/meta/H1.
7. RIE product keeps `RIE etcher` / `reactive ion etcher`.
8. Compact RIE product keeps `compact`, `benchtop`, and `SV-RIE` modifiers.

---

## Testing Plan

Use TDD before implementation.

### Red Tests

Add failing tests that assert:

1. ICP product `document.title` is exactly `ICP-RIE Etching System for Research Labs | NineScrolls LLC`.
2. ICP meta description contains:
   - `ICP-RIE etching system`
   - `request a quote`
   - `silicon`
   - `diamond`
3. ICP visible FAQ contains the new system-vs-technology question.
4. ICP resources contain four links, including:
   - `Learn ICP-RIE Technology`
   - `Compare ICP-RIE vs RIE`
   - `Deep Silicon Bosch Process`
   - `Diamond Semiconductor Processing`
5. The diamond resource still links to `/insights/diamond-semiconductor-processing-icp-etching-deposition`.
6. RIE and Compact RIE title locks still pass.

Add narrow RIE and Compact RIE assertions that their meta descriptions keep their distinct intent:

- RIE meta contains `Reactive ion etching platform` and does not become `ICP-RIE`.
- Compact RIE meta contains `Space-efficient SV-RIE` and `footprint`.

Sibling-page lock assertions must be copied from the current config text. Do not invent assertion strings from design prose and accidentally force copy changes on RIE or Compact RIE.

### Green Implementation

Only edit:

- `src/components/products/productDetailConfigs/icpEtcherConfig.ts`
- `src/components/products/ICPEtcher.test.tsx`
- `src/components/products/RIEEtcher.test.tsx`
- `src/components/products/CompactRIE.test.tsx`

No template changes.

### Verification

Run:

- `npm test -- src/components/products/ICPEtcher.test.tsx src/components/products/RIEEtcher.test.tsx src/components/products/CompactRIE.test.tsx --run`
- `npx tsc --noEmit --pretty false`
- `npm run build`

---

## Follow-Ups

These are intentionally excluded from this sprint:

1. DDB article update: add Select-intent links from the ICP-RIE technology article and PE/RIE/ICP-RIE comparison article down to `/products/icp-etcher`.
2. GSC validation after deployment: compare page/query ownership for `icp rie`, `icp rie etching`, `icp etcher`, `icp-rie system`, and `icp-rie equipment` after 14-28 days.
3. SERP re-sampling after deployment to see whether Google continues to treat naked `icp rie` as Mixed/Learn and whether product modifiers move toward product pages.
4. Broader Compare template standardization for `ICP vs RIE`, `DRIE vs RIE`, `PECVD vs HDP-CVD`, and related comparison pages.

---

## Risks

- Title changes can temporarily shift query matching. This is why the sprint only changes title/meta/FAQ/resource anchors and not H1 or layout.
- Adding a fourth resource slightly increases visual density, but it preserves an important diamond deep link and avoids creating an orphan.
- The naked `icp rie` query may still show the product page in GSC because SERP intent is mixed. That is acceptable as long as the technology article remains the intended Learn owner and the product page strengthens product-modifier queries.

---

## Review Checklist

- No `TBD` placeholders.
- Diamond deep link preserved.
- Naked `icp rie` and `icp rie etching` explicitly assigned to the ICP-RIE technology article.
- Product page assigned only Select/Buy modifiers.
- Article-to-product hub-spoke links captured as follow-up, not implementation scope.
- No H1, layout, template, Product/Offer schema, or DDB article edits in this sprint.
