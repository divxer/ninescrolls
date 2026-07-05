# Evidence Framework — Phase 1 Design

**Date:** 2026-07-04
**Branch:** feature/homepage-redesign (spec only; implementation branch TBD)
**Status:** Approved design, pending implementation plan

## Background & Motivation

Oxford Instruments runs a [Citations Hub](https://www.oxinst.com/citations-hub) — an aggregated, searchable wall of peer-reviewed papers that cite their equipment. It works because Oxford has decades of installed base, so the wall is *full*. NineScrolls today has essentially **no** published process data or customer citations, so cloning a Citations Hub now would produce an empty wall — which damages credibility more than having nothing.

Instead of copying the *entry point* (a citations wall), we build the *system underneath it*. Oxford's real product is: **every claim on the site has evidence behind it** — specifications, process library, application notes, customer publications, case studies, technical notes. Citations are just one subset.

NineScrolls builds a broader **Evidence Framework** where citations (`type: publication`) are one future subset. This avoids the "empty wall" problem and lets the information architecture grow naturally with installed base, lab data, and customer papers — without a later teardown.

### Evolution roadmap (context, not Phase 1 scope)

- **Phase 1 (now):** Define the `Evidence` data model + admin CRUD + conditional product-page summary module. Zero content today ⇒ everything auto-hides, site is visually unchanged.
- **Phase 2 (~6 months):** First real application notes / validation data. Build the Evidence Center hub page + `Resources` nav entry (gated on `evidence_count > 0`).
- **Phase 3:** First customer papers appear as `type: publication` ("Published Research") — the true analogue of Oxford's citations.
- **Phase 4:** Once publications reach dozens, build a dedicated Citations Hub view. Not before.

## Boundary Statements (normative)

These define what Evidence *is* and are binding on the implementation:

1. **Evidence is not an article subtype.** It is a structured proof layer that may optionally link to an article, PDF, image gallery, or external publication.
2. **Phase 1 does not require any public Evidence detail page.** Each evidence item may link to an existing article, PDF, image, or external URL, but Evidence itself is primarily a structured metadata layer in this phase.

`InsightsPost` remains the article system (Knowledge Center, Process Guides, News/Insights, educational articles). `Evidence` is a separate, structured technical-proof system (Application Notes, Process Validation, Publications, SEM Gallery, Uniformity Reports, Etch/Deposition Results, Case Studies).

## Phase 1 Scope

### In scope (build now)

1. **`Evidence` Amplify data model** — new, independent model (not an extension of `InsightsPost`).
2. **Admin CRUD** — `AdminEvidenceListPage` + `EvidenceForm` + an `evidenceAdminService`, mirroring the existing Insights admin pattern. This is the "backend just needs to support it" deliverable.
3. **Product-page Evidence summary module** — `<ProductEvidence productSlug={slug} />`, inserted after the existing *Process Capabilities* section on each product page. Renders **only** when the product has ≥1 published Evidence record; otherwise renders nothing (no heading, no placeholder).

### Explicitly out of scope (deferred to Phase 2+)

- Standalone **Evidence Center hub page** and its sub-category taxonomy (SEM Gallery, Uniformity Reports, etc.).
- `Resources` nav entry for Evidence Center — must not appear while `evidence_count == 0`; built together with the hub.
- Citations Hub (Phase 4).
- Any **public Evidence detail page** (see Boundary Statement 2).
- Clickable / expandable counts in the product module (see Product Module section — Phase 1 is display-only).

## Data Model

New Amplify model in `amplify/data/resource.ts`, following the `InsightsPost` auth + secondary-index pattern:

```ts
Evidence: a
  .model({
    id: a.id().required(),
    slug: a.string().required(),          // future detail page / anchor; reserved now, no page in Phase 1
    title: a.string().required(),
    type: a.string().required(),          // enum below; string-stored for extensibility, consistent with existing models
    summary: a.string(),                  // one-line summary for cards

    // —— Associations (one evidence item may map to multiple products) ——
    products: a.string().array().required(), // Product.slug values; product module aggregates on this
    process: a.string(),                  // e.g. "Silicon Deep Etching"
    materials: a.string().array(),        // e.g. ["Si", "SiO2"]
    keywords: a.string().array(),

    // —— Structured metrics (core of the card/product display) ——
    metrics: a.json(),                    // [{label:"Etch rate", value:"3.2", unit:"μm/min"}, ...]

    // —— Optional links (Evidence is a metadata layer, no detail page of its own) ——
    articleSlug: a.string(),              // link to an existing InsightsPost (optional)
    pdfUrl: a.string(),                   // "Download PDF"
    images: a.string().array(),           // SEM / chart gallery
    sourceUrl: a.string(),                // neutral source link: external publication (DOI), internal PDF, case page, etc.
    meta: a.json(),                       // type-specific extras (e.g. publication: {journal, year, doi, authors})

    // —— Publish control ——
    publishDate: a.string(),
    status: a.string().default('draft'),  // draft | published | archived
  })
  .authorization((allow) => [
    allow.publicApiKey().to(['read']),
    allow.authenticated(),
  ])
  .secondaryIndexes((index) => [index('slug')]),
```

### `type` enum

String constants, defined once in a shared frontend module:

`application_note` · `process_note` · `technical_note` · `publication` · `case_study` · `validation`

- `publication` is the Oxford-Citation analogue. It links out via `sourceUrl` + `meta{journal, year, doi, authors}`; no detail page needed.

### `status` semantics

- `draft` — admin only, never public.
- `published` — public; counted by the product module and (Phase 2) the hub.
- `archived` — **admin-visible, never shown on the public site.** All public queries filter to `status == 'published'`.

### Deliberate trade-offs

- **`products` is an array** (not single-valued): a validation run may apply to multiple systems (e.g. ICP-RIE and RIE).
- **`metrics` is JSON** `[{label, value, unit}]`: metrics vary by process (etch rate, uniformity, film thickness, refractive index, stress…), so a fixed column set would not fit.
- **`meta` is JSON**: avoids adding mostly-empty typed columns for type-specific fields like a publication's journal/DOI.

### Scale note (normative)

> Phase 1 intentionally uses client-side aggregation over published Evidence records because evidence volume is expected to remain small. If evidence grows beyond roughly 100–200 records, introduce a product-evidence lookup model or indexed relation.

`products` is an array, which DynamoDB cannot directly index with a GSI. In Phase 1/2 the product module fetches all `status='published'` Evidence and filters/aggregates client-side by `product.slug` membership.

## Product-Page Evidence Module

**Component:** `<ProductEvidence productSlug={slug} />`, inserted after the *Process Capabilities* section on each product page (evidence follows the capability claim it backs). Introduced the same way as the existing *Related Equipment & Articles* block.

**Behavior:**

```
fetch all Evidence where status = 'published'
  → filter to records whose `products` array contains the current product.slug
    → 0 matches: render nothing (return null — no heading, no placeholder)
    → ≥1 match:  render the summary, grouped by `type` with counts
```

**Phase 1 render form — display-only, not clickable:**

```
Evidence
  ✓ 3 Application Notes
  ✓ 1 Published Research
  ✓ 2 Process Validation
```

The module's single Phase-1 job is to signal: **"This product has verifiable evidence."** It is explicitly **not** a mini-hub. Counts are not links and there is no expand interaction in Phase 1. Clickable/expandable counts and links to individual items are deferred to Phase 2, together with the hub.

Type→label mapping (e.g. `publication` → "Published Research", `validation` → "Process Validation") lives in the shared type-enum module.

## Admin Authoring

Mirrors the existing Insights admin pattern:

- **`AdminEvidenceListPage`** — list with filters by `type` and `status`.
- **`EvidenceForm`** — fields: title, type, products (multi-select of Product slugs), process, materials, metrics (key/value/unit rows), sourceUrl, pdfUrl, images, meta, status.
- **`evidenceAdminService`** — service layer parallel to `insightsAdminService`.
- **Images** reuse the existing upload pipeline (`insightsImageService` / `optimize-insights-image`).
- `status='archived'` records remain visible in the admin list but are never surfaced on the public site.

No new architectural decisions here — it follows established patterns.

## Testing

- **Data model:** unit coverage of the aggregation helper — given a set of Evidence records with varied `products` arrays and `status`, it returns correct per-product, per-type counts and excludes non-`published` records.
- **Product module:** renders nothing at 0 matches; renders correct grouped counts at ≥1; excludes `draft`/`archived`.
- **Admin:** service-layer create/update/list round-trip, following the existing Insights admin test pattern.

## Out of Scope / Non-Goals

- No Evidence Center hub page, no `Resources` nav change, no Citations Hub (all Phase 2+).
- No public Evidence detail page.
- No clickable counts, no client-facing search/filter over Evidence.
- No GSI / join table for product→evidence lookup (client-side aggregation until ~100–200 records).
