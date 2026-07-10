# Equipment Guide Content Optimization v2 — Design

Date: 2026-07-10
Status: Draft for review
Related:
- `docs/superpowers/specs/2026-07-10-equipment-guide-visual-polish-v1-design.md` (v1 — visual polish; this builds on its renderer/data)
- `src/data/equipmentGuide/*` (canonical data being extended) + `src/templates/equipmentGuide/*` (renderer)
- `src/components/products/productDetailConfigs/*.ts` (website configs — the source of the reused copy)

## Problem

The Visual Polish v1 guide *looks* like a brand manual, but the **words** still read like a literal OEM-brochure translation: the same six feature bullets ("Uni-body Design Concept · Foot-print outstanding", "Cost or Performance Orientation · … depending on requirements", "Sample Handling Options · Open-Load or Load-Lock") repeat near-verbatim on every product page, some in awkward English ("Tuned as a preset parameter dependently"). Product pages have **no lead sentence, no applications, and no next step** — so a reader learns what the *chamber* is, never what *they* get or where to go. The About page is generic startup boilerplate.

## Decision

Ship **Content Optimization v2** — a copy/data change (plus a small renderer add) that gives each product page a benefit **lead**, a real **applications** strip, and a per-product **CTA**, rewrites the mechanical bullets into plain-English benefits, and rewrites the About page to NineScrolls' real value. **No changes** to spec tables, the evidence page, contact, images, or the v1 visual layout. Hard **14 pages**.

## Scope / Non-Goals

- **In:** `lead`, `applications`, `href`/CTA per product; rewritten `bullets`; rewritten About copy; renderer support for the three new fields; the tests/guardrails below.
- **Out:** spec-table values (untouched), the represented-platform evidence page (untouched), contact page, product images, page count/format, the v1 CSS visual system (extended only for `.lead`/`.apps`/`.cta`), and any OEM/dependency change.

## Data model (`src/data/equipmentGuide/types.ts`)

The three new fields form **one all-or-none content block** (contract 3 — no lead-only / CTA-only products), modeled as a single nested object so the "all present or all absent" invariant is structural, not just tested:

```ts
export interface GuideProductContent {
  lead: string;              // 1–2 sentence benefit lead, rewritten from config.hero.description
  applications: string[];    // = config.applications.items.slice(0, applicationCount); verbatim, ordered
  applicationCount: 3 | 4;   // 4 by default; 3 ONLY when a page genuinely can't fit 4 (explicit, testable)
  href: string;              // site-relative product route, e.g. '/products/rie-etcher'
}
```

`GuideProduct` gains `content` — **optional during the pilot, required after**:

- **Pilot:** `content?: GuideProductContent`, populated only for RIE + E-Beam. The 9 unauthored products have no `content` and render exactly as v1.
- **Final (after pilot approved + all 11 authored):** tighten to `content: GuideProductContent` (required) and add an **11/11 completeness test**, so a future product added/edited without a content block fails to compile/test rather than shipping thin.

The nested object guarantees all-or-none: you cannot supply `lead` without `applications`/`href`. `bullets` keeps its `{ heading, body }[]` shape but is rewritten (3–4 items) in the same change that adds a product's `content`. `specs`, `image`, `series`, `footprint`, `subTable`, `familyOptions`, `websiteSpecParity` are unchanged.

## Copy rules (normative — every rewrite must be traceable)

Every new/rewritten string must trace to the product's website config `hero.description`, its `applications`, its existing guide `bullets`/features, or the canonical `specs`. **No new performance numbers, no superlatives, no OEM/supplier names.**

| Field | Source rule | Budget |
|---|---|---|
| `content.lead` | Rewritten from `config.hero.description` (adapted to a fuller selection-context voice — not a verbatim SEO copy) | ≤ 2 rendered lines |
| `content.applications` | **`config.applications.items.slice(0, applicationCount)`** — reused verbatim and in the config's original order, never paraphrased or reordered (contract 1). `applicationCount` is **4 by default**; a product may set it to **3** only when its page genuinely can't fit 4, and the reduction is then explicit and tested (not ad-hoc). | exactly `applicationCount` chips (3 or 4) |
| `bullets` | Existing OEM feature bullets rewritten into plain-English customer benefits | **3–4** items, each ≤ 2 lines |
| `content.href` | The product's existing website route (`/products/<slug>`) | 1 line |
| `specs` | **Untouched** | existing table |

**Products without a 1:1 config — Plasma Cleaner (explicit source rule + fixed literals):** the guide's `plasma-cleaner` page is a family summary; there is **no single config `applications.items`** to slice. Its content is therefore pinned in-spec, traceable to the guide's own existing `plasma-cleaner` spec rows in `products.ts` (`Main Functions` = "Surface cleaning; surface activation; hydrophilic / hydrophobic treatment; functional group modification; contact-free plasma processing"; `Typical Applications` = "Chemical & biological laboratories; failure analysis; optical components; biomedical and medical devices"):

```ts
// plasma-cleaner content (fixed literals — NOT config-sliced)
applications = ['Surface activation', 'Surface cleaning', 'Failure analysis', 'Optical & biomedical device prep'];
applicationCount = 4;
href = '/products/plasma-cleaner';
// lead + bullets: rewritten from the plasma-cleaner Main Functions / Typical Applications rows and the HY-4L/HY-20L/PLUTO family descriptions — no fabricated specs.
```

`plasma-cleaner` is **exempt from the config-parity test** (contract 1) because it has no config; instead the test asserts its `applications` deep-equals this fixed literal constant. Every other product (10) maps 1:1 to a config, and E-Beam maps to `eBeamEvaporatorConfig` (`/products/e-beam-evaporator`).

## CTA (contract 2)

- Rendered as a single line on each product page (only where `content` is present): **`Explore configurations & request a quote →`** followed by the URL, authored as a real `<a href>` so it is a live clickable link in the PDF (Puppeteer preserves anchors).
- **Data invariant:** `content.href` is stored **site-relative** and MUST match `^/products/[a-z0-9-]+$` (validated by test).
- **Render invariant:** the renderer builds the anchor href as `${SITE_ORIGIN}${content.href}` with `const SITE_ORIGIN = 'https://ninescrolls.com'`, producing an **absolute** `https://ninescrolls.com/products/<slug>`. Under Puppeteer `setContent()` a bare `/products/…` has no base origin and would not resolve as a working PDF link — the absolute form is required.
- Exactly **one** CTA per product page; no duplicated global CTA.

## About page rewrite (`guideMeta.about`)

Keep the current **2-paragraph + 4-pillar** structure (fits one page, compatible with the 14-page constraint). Rewrite the content:

- **Four pillars — fixed headings:**
  1. Process-first platform selection
  2. Configured around your lab
  3. U.S.-based project coordination and support
  4. Peer-reviewed validation for represented platforms
- **The fourth pillar's body MUST carry an in-page qualifier** stating that the peer-reviewed research validates the **corresponding platform class / process capability**, and is **not** research produced on NineScrolls-owned equipment nor authored/attributed to NineScrolls — the same represented-platform boundary the Evidence page (p2) uses. (Prevents the About page from re-introducing the very mis-attribution v1's reframe removed.)
- **Body copy covers:** who we serve (universities, national labs, R&D and advanced-manufacturing teams); how we work (confirm materials, process window, sample size, and facility conditions first, then match the platform); NineScrolls' role (U.S.-based selection, configuration, quoting, delivery, and after-sales coordination); the evidence framing above.
- **Forbidden:** re-introducing years-in-business, installed-base counts, customer counts, or any supplier identity. `subtitle`/`title` copy stays factual.

## Renderer changes (`renderEquipmentGuideHtml.ts` + `equipmentGuide.css.ts`)

- Product page: render `lead` under the series title (before bullets); render `applications` as the `.apps` chip strip; render the CTA `.cta` line (absolute `href`). Markup/CSS mirror the approved mockup (`.lead`, `.apps`/`.chip`, `.cta`/`.btn`).
- Guard for pilot optionality: only render `.lead`/`.apps`/`.cta` blocks when the field is present (so the 9 not-yet-authored products render unchanged during the pilot). After tightening to required, all 11 render them.
- About page: no structural change — it consumes the rewritten `about` data through the existing markup.
- Origin constant: a single `const SITE_ORIGIN = 'https://ninescrolls.com'` used to build the absolute CTA href.

## Files

| File | Change |
|---|---|
| `src/data/equipmentGuide/types.ts` | Add `GuideProductContent`; `GuideProduct.content?` (pilot) → `content` required (final) |
| `src/data/equipmentGuide/products.ts` | Add `content` + rewritten `bullets` per product (RIE+E-Beam pilot, then all 11) |
| `src/data/equipmentGuide/guideMeta.ts` | Rewrite `about` (paragraphs + 4 fixed pillars incl. evidence qualifier) |
| `src/data/equipmentGuide/equipmentGuide.data.test.ts` | Applications parity, href format, bullets 3–4, About integrity, completeness (final), protection snapshots for specs/subTable/evidence |
| `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` | Render `.lead`/`.apps`/`.cta`; `SITE_ORIGIN` absolute CTA href |
| `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts` | CTA-per-section, Evidence-HTML-chunk assertion |
| `src/templates/equipmentGuide/equipmentGuide.css.ts` | `.lead`, `.apps`/`.chip`, `.cta`/`.btn` styles |
| `public/NineScrolls-Equipment-Guide.pdf` | Regenerated (committed atomically; final step only) |
| `docs/equipment-guide/content-v2-traceability.md` | New — per-product per-line source record |

## Page budget & overflow policy (hard 14 pages)

Per-product content budget: `lead` ≤ 2 lines · `bullets` 3–4 items (≤ 2 lines each) · `applications` ≤ 4 chips · CTA 1 line · specs unchanged. If a product overflows its single page, reduce in this order — **never shrink body font, never let a product spill to a second sheet:**
1. Compress/merge repeated bullet content
2. Shorten the lead
3. Reduce applications from 4 → 3
4. Tighten local spacing
If a product still overflows after these, the content selection isn't strict enough — that is a copy problem, not a reason to grow the guide.

## Rollout

1. **Pilot** — author the `content` block + rewritten `bullets` for **RIE and E-Beam only** (`content` optional). Regenerate. **Pilot acceptance (all required):** both pages remain single-page, the guide total is still exactly **14 pages**, and neither page is crowded or has an illegibly-compressed table (verified via the screenshots).
2. **Review** the two pilot pages with the user; lock voice + format. **The pilot output is REVIEW-ONLY** — its intermediate PDF/commits must **not** be merged to `main` or deployed (9 products would still be thin and `content` is optional). Only the final state in step 5 is mergeable.
3. **Batch** — author the remaining 9 products under the same rules; rewrite the About page; fill the traceability checklist for all 11.
4. **Tighten** — make `content` required, add the 11/11 completeness test.
5. **Finalize** — regenerate + full verification (data tests, render tests incl. protection snapshots, page-count 14, screenshots); the committed PDF ships atomically with the code (v1 rule). This is the only state that merges/deploys.

## Testing

Pure/data tests (fast) + generation checks + a manual traceability checklist.

**Data-layer tests (`equipmentGuide.data.test.ts`):**
- **Applications parity — ordered deep equality (contract 1):** for each of the 10 config-backed products, `content.applications` **deep-equals** `WEBSITE_CONFIGS[slug].applications.items.slice(0, content.applicationCount)` — same items, same order, exact length (not membership). For `plasma-cleaner` (config-less), `content.applications` deep-equals the fixed literal constant defined in the spec. `content.applicationCount ∈ {3, 4}`.
- **href format:** every `content.href` matches `^/products/[a-z0-9-]+$` (site-relative).
- **All-or-none:** structurally enforced by the nested `content` object; the completeness test below covers presence.
- **Bullets shape:** each authored product has **3–4** bullets (not 5).
- **Completeness (after batch, contract 3):** all 11 products have a `content` block with non-empty `lead`, `applications` (length === `applicationCount`), and `href`; once the type is required this is compile-enforced, plus an explicit 11/11 test.
- **About integrity:** the four pillar headings render verbatim; the fourth pillar body contains the represented-platform qualifier; the About text contains none of the forbidden claims (years-in-business / install / customer counts / supplier identity) and no OEM name.

**Render tests (`renderEquipmentGuideHtml.test.ts`):**
- **CTA per product section:** split by `<section class="page` (v1 helper); for each product section **with content**, assert exactly **one** CTA anchor whose `href` **exactly equals** `https://ninescrolls.com${product.content.href}`, and that the label is `Explore configurations & request a quote`. Non-content (pilot) product sections and non-product pages have zero CTAs.
- **Copy integrity (v1 guards, still passing):** no OEM/supplier name, no scale claims anywhere in the rendered HTML.
- **Protection snapshots (replaces the un-executable "byte-for-byte" claim, #6):** the serialized `specs` + `subTable` of every product, and the entire `evidence` data object, are asserted **deep-equal to a committed snapshot** captured from the v1 baseline; additionally the rendered **Evidence page HTML chunk** (the `<section>` containing `Peer-Reviewed Validation`) is asserted **string-equal to a committed expected chunk**. This proves this change touched neither the spec tables nor the evidence page. The PDF itself gets a **visual-consistency** check (below), not a byte comparison.

**Generation / visual checks:**
- **Page count == 14** after `npm run generate-equipment-guide` (hard constraint); PDF under `MAX_PDF_BYTES = 2_000_000`.
- **Rendered screenshots (pilot AND final, Minor):** `pdftoppm` the PDF to images; visually confirm no text clipping, no page overflow to a 2nd sheet, and no illegibly-compressed table on any product page. Save the pilot RIE + E-Beam page images for the review checkpoint.

**Traceability checklist (manual, #4 — the part tests can't cover):**
Commit `docs/equipment-guide/content-v2-traceability.md`. For every product, record — per rewritten `lead` and per `bullet` — the exact source it traces to: the config field (`hero.description` / a `processIntro` / `coreWindows` entry), the original guide bullet, or a canonical `specs` row. The implementation review verifies each line against its cited source (no new performance numbers, no superlatives). This file is the auditable record that "traceable" was actually honored.

## Integrity guardrails (carried from prior work)

No OEM/supplier name in customer-facing output; no fabricated specs/performance numbers; no superlatives; `applications` must be real (config-sourced or the pinned plasma-cleaner literals); About forbidden-claims list enforced. Specs, `subTable`, and the evidence page are protected by **committed data snapshots + the Evidence HTML-chunk string assertion** (see Testing) — not an (un-runnable) PDF byte comparison.

## Open Inputs For User

- None blocking — the three contracts + CTA copy are settled. (The pilot review in step 2 is the one interactive checkpoint.)
