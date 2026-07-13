# Evidence Framework — Phase 1 Design

**Date:** 2026-07-04
**Branch:** feature/semishare-probe-stations (spec only; implementation branch to be created)
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

1. **`Evidence` Amplify data model** — new, independent model (not an extension of `InsightsPost`), authenticated-only auth.
2. **`listPublishedEvidence` Lambda-backed custom query** — the sole public read path, returning `published`-only records, paginating internally to completeness, under a read-only least-privilege role (see Public Read Boundary). This is the data-level no-leak boundary.
3. **Admin CRUD** — `AdminEvidenceListPage` + `EvidenceForm` + an `evidenceAdminService`, mirroring the existing Insights admin pattern. This is the "backend just needs to support it" deliverable.
4. **Product-page Evidence summary module** — `<ProductEvidence productSlug={slug} />`, inserted after the existing *Process Capabilities* section on each product page. Reads via `listPublishedEvidence`. Renders **only** when the product has ≥1 published Evidence record; otherwise renders nothing (no heading, no placeholder).

### Explicitly out of scope (deferred to Phase 2+)

- Standalone **Evidence Center hub page** and its sub-category taxonomy (SEM Gallery, Uniformity Reports, etc.).
- `Resources` nav entry for Evidence Center — must not appear while `evidence_count == 0`; built together with the hub.
- Citations Hub (Phase 4).
- Any **public Evidence detail page** (see Boundary Statement 2).
- Clickable / expandable counts in the product module (see Product Module section — Phase 1 is display-only).

## Data Model

New Amplify model in `amplify/data/resource.ts`. **The base model is NOT publicly readable** — see the Public Read Boundary subsection below for why this differs from the `InsightsPost` pattern.

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
    allow.authenticated(),                // any authenticated identity may CRUD (see Write Authorization Premise); NO public read
  ])
  .secondaryIndexes((index) => [index('slug')]),
```

### Public Read Boundary (Critical — data-level, not a frontend convention)

`allow.publicApiKey().to(['read'])` on the base model (the `InsightsPost` pattern) would let any anonymous client issue a raw GraphQL query for the whole table, including `draft`/`archived` rows — bypassing our service entirely. A frontend service that "only requests published" cannot uphold the spec's **防泄露 (no-leak)** goal against a caller who crafts their own query. Amplify's declarative auth has no row-level predicate for `apiKey` (it cannot say "public may read a row only when `status == 'published'`").

Therefore Phase 1 establishes a **server-side published-only boundary**:

- The base `Evidence` model is **authenticated-only** — public clients cannot read it directly at all.
- A **Lambda-backed custom query** `listPublishedEvidence(productSlug?: string)` is added (`apiKey` auth). The Lambda returns **only `status = EVIDENCE_STATUS.PUBLISHED` records** (optionally filtered by product). `draft`/`archived` rows are physically never returned to an anonymous caller.
- This mirrors NineScrolls' existing Lambda-backed API pattern (order-api / tender-api / custom list resolvers), so it fits the codebase rather than introducing a new paradigm.

This is a genuine data-access boundary, not a UI convention. Everything downstream (the product module, any Phase 2 hub) reads through `listPublishedEvidence`.

#### Pagination contract (normative)

DynamoDB `Scan`/`Query` returns at most 1 MB per call; a single-page scan would silently drop matches once the table crosses that size — and the product module shows **complete** counts, so a missed page = a wrong count. Phase 1 fixes the behavior (plan authors do not get to choose):

- **The Lambda paginates internally until `LastEvaluatedKey` is empty**, accumulating the full result set, then returns the complete (small-scale) published set. It does **not** return a `nextToken`; the caller never has to page.
- **`status` and `productSlug` filtering happen server-side in the Lambda** (a `FilterExpression`/predicate applied on each page before accumulation), never on the client.
- **Test coverage must exercise ≥2 pages** (mock/seed so results span more than one `Scan` page) and prove a published record on the second page is included in the counts.

#### Lambda least-privilege (normative — part of the no-leak boundary)

The security boundary is an acceptance contract, not just a description:

- The custom query is explicitly invokable with **`apiKey`** auth.
- **The Lambda's DynamoDB data-plane permissions are exactly `dynamodb:Query` and `dynamodb:Scan`, scoped by resource to the Evidence base-table ARN only.** The handler runs a `Scan` on the base table and never queries a GSI, so **index ARNs are deliberately NOT granted** — granting `${tableArn}/index/*` would be unused privilege, contrary to least-privilege. (The `slug` GSI is used only by the admin client's generated `listEvidenceBySlug`, which goes through AppSync's own resolver, not this Lambda.) No other DynamoDB action (`PutItem`/`UpdateItem`/`DeleteItem`/`BatchWrite`/etc.), and no access to any other table. `dynamodb:DescribeTable` is **not** granted in Phase 1; if a concrete implementation need arises, grant it explicitly and note it here — do not add it speculatively.
- This constrains **DynamoDB access only.** The execution role still carries the standard non-DynamoDB permissions every Lambda needs (e.g. CloudWatch Logs) — those are expected and out of scope for this constraint.
- The Lambda enforces the `published` predicate server-side before responding.
- A deployment/IAM check (or test) verifies both halves: (a) the Lambda's role grants **no DynamoDB action beyond `Query`/`Scan` on the Evidence base-table ARN** (assert on DynamoDB actions specifically, not "no other permissions at all"), and (b) an anonymous `apiKey` query against the **base** `Evidence` model is denied.

> Note: `InsightsPost` has the same latent exposure (public read + `isDraft`). That is pre-existing and out of scope here; we deliberately do **not** propagate that pattern to Evidence because this spec makes an explicit no-leak commitment.

### Write Authorization Premise (operational — not a security guarantee)

`allow.authenticated()` on the base model means **any authenticated Cognito identity may CRUD Evidence** — it is *not* server-side admin authorization, and this spec does not claim it is. This is stated explicitly to avoid overclaiming:

- The app's auth is bare email login (`defineAuth({ loginWith: { email: true } })`); there is **no Cognito `ADMINS` group** today, and the entire existing admin surface (`InsightsPost`, `Product`, `Order`, `RFQ`) already relies on `allow.authenticated()`.
- `AdminRoute` is a **UI route guard only** — it does not constrain direct GraphQL calls.
- **Operational premise:** Cognito accounts are issued only to trusted administrators. Write-side protection rests on this premise, not on a technical admin boundary.
- **App-wide `ADMINS`-group hardening is tracked as a separate, cross-cutting security initiative** — deliberately out of scope for Phase 1 Evidence, to avoid a false "Evidence is protected while other admin models stay open" inconsistency.
- This decision **does not affect the anonymous no-leak guarantee**, which is enforced independently by the authenticated-only base model + the `published`-only Lambda (Public Read Boundary above).

### `type` enum

String constants, defined once in a shared frontend module:

`application_note` · `process_note` · `technical_note` · `publication` · `case_study` · `validation`

- `publication` is the Oxford-Citation analogue. It links out via `sourceUrl` + `meta{journal, year, doi, authors}`; no detail page needed.

**Fixed public labels** (defined alongside the enum, never hard-coded ad hoc):

| `type` | public label |
| --- | --- |
| `application_note` | Application Note |
| `process_note` | Process Note |
| `technical_note` | Technical Note |
| `publication` | Published Research |
| `case_study` | Case Study |
| `validation` | **Process Validation** (never just "Validation" — too generic) |

**Admin help text** to keep the two "note" types from blurring:

- `process_note` — process recipe / process-specific explanation
- `technical_note` — equipment / design / operation explanation

### `status` semantics

- `draft` — visible only on the admin side (never returned by `listPublishedEvidence`, never public).
- `published` — public; counted by the product module and (Phase 2) the hub.
- `archived` — **admin-visible, never shown on the public site.** Unreachable via `listPublishedEvidence` (the only public read path).

### Deliberate trade-offs

- **`products` is an array** (not single-valued): a validation run may apply to multiple systems (e.g. ICP-RIE and RIE).
- **`metrics` is JSON** `[{label, value, unit}]`: metrics vary by process (etch rate, uniformity, film thickness, refractive index, stress…), so a fixed column set would not fit.
- **`meta` is JSON**: avoids adding mostly-empty typed columns for type-specific fields like a publication's journal/DOI.

### Scale note (normative)

> Phase 1 intentionally uses client-side aggregation over published Evidence records because evidence volume is expected to remain small. If evidence grows beyond roughly 100–200 records, introduce a product-evidence lookup model or indexed relation.

`products` is an array, which DynamoDB cannot directly index with a GSI. **Status filtering is server-side** (the `listPublishedEvidence` Lambda returns published-only). Product membership and per-type counting are then computed over that already-published result set — either passed as `productSlug` into the Lambda (server pre-filter) or aggregated in the component. Aggregation here means *counting by type*, not *status gating* — status never crosses the boundary as a client responsibility.

## Implementation Constraints (normative)

Anti-ambiguity / anti-leak / anti-dirty-data rules binding on the implementation:

1. **`slug` uniqueness is best-effort in Phase 1 (not a DB-level atomic constraint).** The admin service checks for an existing slug on save and rejects duplicates. This is honest about its limits: a check-then-write has a race window, and the `slug` GSI does **not** impose a DynamoDB uniqueness constraint. This is acceptable in Phase 1 because authoring is single-admin and low-frequency. **Upgrade path** (if concurrent authoring ever becomes real): make `slug` the model identifier (`.identifier(['slug'])`, giving Amplify a conditional `attribute_not_exists` write = atomic uniqueness), or write a companion slug-registry item with a conditional expression. The spec does **not** claim hard atomic global uniqueness in Phase 1 — do not describe it as such in code or docs.

2. **`status` values come from a shared constant, never inline strings — in implementation code AND this spec's pseudocode:**

   ```ts
   export const EVIDENCE_STATUS = {
     DRAFT: 'draft',
     PUBLISHED: 'published',
     ARCHIVED: 'archived',
   } as const;
   ```

   Every reference in implementation code must use `EVIDENCE_STATUS.PUBLISHED` etc., never a literal `'published'` — **including the `evidence-api` Lambda and the schema `.default(...)`**. Because the constant is needed by both frontend (`src/`) and backend (`amplify/functions/`), it lives in a **dependency-free shared module** both can import: `amplify/lib/evidence/status.ts` (pure `export const` string literals, zero imports). The Lambda imports it via `../../lib/evidence/status`; `src/config/evidence.ts` re-exports it (mirroring the existing `src → amplify` type import in `amplifyClient.ts`). No copy of the literal exists in the Lambda.

3. **Published-only reads are enforced server-side (see Public Read Boundary), not by client filtering.** The `listPublishedEvidence` Lambda is the only public read path; it returns `status = EVIDENCE_STATUS.PUBLISHED` records exclusively. `draft`/`archived` rows never reach the client because the base model is not publicly readable. Components must never receive non-published records to filter.

4. **Every evidence record must have at least one payload/target; link display priority defined now, used Phase 2.** Admin validation requires **≥1 of `{articleSlug, pdfUrl, sourceUrl, images}`** to be *meaningfully* present (a record with none is meaningless — nothing to point at and no inline payload). "Present" means non-empty: for the string fields a non-blank value, and for `images` **`images.length > 0`** — an empty array must NOT satisfy the rule. When an item is eventually made clickable (Phase 2), the display target resolves in order **`articleSlug` → `pdfUrl` → `sourceUrl` → `images` (gallery)**. Because admin validation guarantees ≥1 of these is non-empty, the chain always resolves — no field is individually `required` in the schema, but the cross-field rule makes the set non-empty. Phase 1 stores these fields and renders none as links.

5. **`products` multi-select is sourced from canonical `Product.slug` values.** `EvidenceForm`'s products field is a controlled multi-select populated from the Product model / canonical product list — never a free-text slug entry. A typo'd slug would silently make the product module never aggregate the record.

## Product-Page Evidence Module

**Component:** `<ProductEvidence productSlug={slug} />`, inserted after the *Process Capabilities* section on each product page (evidence follows the capability claim it backs). Introduced the same way as the existing *Related Equipment & Articles* block.

**Behavior:**

```
listPublishedEvidence(productSlug)   // Lambda returns EVIDENCE_STATUS.PUBLISHED records only
  → (records already scoped to this product's slug, published-only)
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

- **`AdminEvidenceListPage`** — list with filters by `type` and `status`. Reads the base model via authenticated auth, so an authenticated user (a trusted admin, per the Write Authorization Premise) sees all statuses, including `draft`/`archived`.
- **`EvidenceForm`** — full field set and how each is populated in Phase 1:

  | Field | Phase 1 handling |
  | --- | --- |
  | `title` | user-entered, required |
  | `slug` | auto-generated from `title`, **editable**; best-effort duplicate check on save (constraint 1) |
  | `type` | select from the `type` enum, required |
  | `summary` | user-entered, optional (one-line card text) |
  | `products` | **controlled multi-select** from canonical `Product.slug` (constraint 5), required (≥1) |
  | `process` | user-entered, optional |
  | `materials` | tag input, optional |
  | `keywords` | tag input, optional |
  | `metrics` | repeatable key/value/unit rows, optional |
  | `articleSlug` | optional; select from existing `InsightsPost` slugs |
  | `pdfUrl` | optional |
  | `images` | optional; existing upload pipeline (`insightsImageService` / `optimize-insights-image`) |
  | `sourceUrl` | optional |
  | `meta` | optional; type-specific JSON (e.g. publication `{journal, year, doi, authors}`) |
  | `status` | select `draft`/`published`/`archived` (via `EVIDENCE_STATUS`), defaults `draft` |
  | `publishDate` | **auto-set** when `status` first transitions to `published`; not hand-edited in Phase 1 |

  **Cross-field validation (constraint 4):** save is rejected unless at least one of `{articleSlug, pdfUrl, sourceUrl, images}` is *non-empty* (strings non-blank; `images.length > 0` — an empty array does not count).

- **`evidenceAdminService`** — service layer parallel to `insightsAdminService`; performs the best-effort slug check and the ≥1-payload validation before write.
- `status='archived'` records remain visible in the admin list but are never surfaced on the public site (they are unreachable via `listPublishedEvidence`).

No new architectural decisions here — it follows established patterns, except the base-model auth is authenticated-only (Public Read Boundary).

## Testing

Security tests target the **server boundary**, not client-side status filtering (constraint 3 / Public Read Boundary):

- **Public read boundary (security):**
  - `listPublishedEvidence` returns only `EVIDENCE_STATUS.PUBLISHED` records — given a table containing `draft`/`published`/`archived`, the Lambda's result excludes non-published rows.
  - The base `Evidence` model is not publicly readable — a direct `apiKey` query against the base model is denied by auth (no path for anonymous callers to read `draft`/`archived`).
  - **Least-privilege IAM:** assert the Lambda role grants **no DynamoDB action beyond `Query`/`Scan`** on the Evidence base-table ARN (no writes, no index ARNs, no other tables). The assertion targets DynamoDB actions specifically — not "the role has no other permissions" (CloudWatch Logs etc. are expected).
- **Pagination completeness:** seed/mock results spanning **≥2 `Scan` pages**; assert a `published` record on the second page is included in the returned set and its type count — proving the Lambda drains `LastEvaluatedKey` rather than returning a single page.
- **Aggregation helper (counting, not gating):** given a set of **already-published** records with varied `products` arrays, it returns correct per-product, per-type counts. It is tested for counting correctness only — status gating is not its job.
- **Product module:** its input type/fixtures contain **only public records**; renders nothing at 0 matches; renders correct grouped counts at ≥1. (No test feeds it `draft`/`archived` — those cannot reach it in production.)
- **Admin:**
  - service-layer create/update/list round-trip, following the existing Insights admin test pattern;
  - best-effort duplicate-slug rejection on save;
  - ≥1-payload cross-field validation (rejects a record with none of `{articleSlug, pdfUrl, sourceUrl, images}`, **including the case where `images` is an empty array** — that must not satisfy the rule);
  - `publishDate` auto-set on first transition to `published`.

## Out of Scope / Non-Goals

- No Evidence Center hub page, no `Resources` nav change, no Citations Hub (all Phase 2+).
- No public Evidence detail page.
- No clickable counts, no client-facing search/filter over Evidence.
- No GSI / join table for product→evidence lookup (client-side aggregation until ~100–200 records).
