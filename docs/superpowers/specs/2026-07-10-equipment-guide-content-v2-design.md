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

Add to `GuideProduct`:

```ts
lead: string;            // 1–2 sentence benefit lead, rewritten from the config hero.description
applications: string[];  // reused from the website config; ≤ 4 entries
href: string;            // site-relative product route, e.g. '/products/rie-etcher'
```

**Pilot vs final typing (contract 3):** during the **pilot** these three fields are **optional** (`lead?`, `applications?`, `href?`) and populated only for RIE + E-Beam. After the pilot is visually approved AND the remaining 9 products are authored, the fields are **tightened to required** (`string` / `string[]`) and an **11/11 completeness test** is added, so a future product added/edited without this content fails the build rather than silently shipping thin.

`bullets` keeps its `{ heading, body }[]` shape but is rewritten (3–4 items). `specs`, `image`, `series`, `footprint`, `subTable`, `familyOptions`, `websiteSpecParity` are unchanged.

## Copy rules (normative — every rewrite must be traceable)

Every new/rewritten string must trace to the product's website config `hero.description`, its `applications`, its existing guide `bullets`/features, or the canonical `specs`. **No new performance numbers, no superlatives, no OEM/supplier names.**

| Field | Source rule | Budget |
|---|---|---|
| `lead` | Rewritten from `config.hero.description` (adapted to a fuller selection-context voice — not a verbatim SEO copy) | ≤ 2 rendered lines |
| `applications` | **`config.applications.items.slice(0, 4)`** — reused verbatim, not paraphrased (contract 1) | ≤ 4 chips |
| `bullets` | Existing OEM feature bullets rewritten into plain-English customer benefits | 3–4 items, each ≤ 2 lines |
| `href` | The product's existing website route slug | 1 line |
| `specs` | **Untouched** | existing table |

**Products without a 1:1 config:** the guide's `plasma-cleaner` page is a family summary (no single config). Its `lead`/`bullets`/`applications` are authored from the `PlasmaCleanerOverviewPage` + HY/PLUTO family content (still traceable, still no fabricated specs), and its `href` = `/products/plasma-cleaner` (the overview). E-Beam maps to `eBeamEvaporatorConfig` (`/products/e-beam-evaporator`).

## CTA (contract 2)

- Rendered as a single line on each product page: **`Explore configurations & request a quote →`** followed by the URL, authored as a real `<a href>` so it is a live clickable link in the PDF (Puppeteer preserves anchors).
- **The href in the rendered anchor MUST be absolute:** `https://ninescrolls.com${product.href}` (e.g. `https://ninescrolls.com/products/rie-etcher`). Canonical data stores the site-relative route (`/products/…`); the **renderer prepends the `https://ninescrolls.com` origin**. Under Puppeteer `setContent()` a bare `/products/…` has no base origin and would not resolve as a working PDF link — the absolute form is required.
- One CTA per product page; no duplicated global CTA.

## About page rewrite (`guideMeta.about`)

Keep the current **2-paragraph + 4-pillar** structure (fits one page, compatible with the 14-page constraint). Rewrite the content:

- **Four pillars — fixed headings:**
  1. Process-first platform selection
  2. Configured around your lab
  3. U.S.-based project coordination and support
  4. Peer-reviewed validation for represented platforms
- **Body copy covers:** who we serve (universities, national labs, R&D and advanced-manufacturing teams); how we work (confirm materials, process window, sample size, and facility conditions first, then match the platform); NineScrolls' role (U.S.-based selection, configuration, quoting, delivery, and after-sales coordination); evidence framing (corresponding platforms are used in real peer-reviewed research — no OEM disclosure, no claim that papers came from NineScrolls-owned equipment).
- **Forbidden:** re-introducing years-in-business, installed-base counts, customer counts, or any supplier identity. `subtitle`/`title` copy stays factual.

## Renderer changes (`renderEquipmentGuideHtml.ts` + `equipmentGuide.css.ts`)

- Product page: render `lead` under the series title (before bullets); render `applications` as the `.apps` chip strip; render the CTA `.cta` line (absolute `href`). Markup/CSS mirror the approved mockup (`.lead`, `.apps`/`.chip`, `.cta`/`.btn`).
- Guard for pilot optionality: only render `.lead`/`.apps`/`.cta` blocks when the field is present (so the 9 not-yet-authored products render unchanged during the pilot). After tightening to required, all 11 render them.
- About page: no structural change — it consumes the rewritten `about` data through the existing markup.
- Origin constant: a single `const SITE_ORIGIN = 'https://ninescrolls.com'` used to build the absolute CTA href.

## Page budget & overflow policy (hard 14 pages)

Per-product content budget: `lead` ≤ 2 lines · `bullets` 3–4 items (≤ 2 lines each) · `applications` ≤ 4 chips · CTA 1 line · specs unchanged. If a product overflows its single page, reduce in this order — **never shrink body font, never let a product spill to a second sheet:**
1. Compress/merge repeated bullet content
2. Shorten the lead
3. Reduce applications from 4 → 3
4. Tighten local spacing
If a product still overflows after these, the content selection isn't strict enough — that is a copy problem, not a reason to grow the guide.

## Rollout

1. **Pilot** — author `lead`/`applications`/`href` + rewritten `bullets` for **RIE and E-Beam only** (fields optional). Regenerate. **Pilot acceptance (all required):** both pages remain single-page, the guide total is still exactly **14 pages**, and neither page is crowded or has an illegibly-compressed table.
2. **Review** the two pilot pages with the user; lock voice + format.
3. **Batch** — author the remaining 9 products under the same rules; rewrite the About page.
4. **Tighten** the three fields to required and add the 11/11 completeness test.
5. Regenerate + full verification; the committed PDF ships with the code (same atomic-commit rule as v1).

## Testing

Pure/data tests (fast) + generation checks:
- **Applications-in-config parity (contract 1):** for every product with a `websiteSpecParity.productSlug` (i.e. a real config), each of its guide `applications` entries must appear in that config's `applications.items` — prevents drift or accidental rewrite. (The config-less `plasma-cleaner` is exempted, or checked against the overview page's declared applications.)
- **CTA absolute-URL:** the rendered HTML's product CTAs contain `href="https://ninescrolls.com/products/…"` (absolute), one per product page, matching each product's slug.
- **Copy integrity (reused v1 guards, extended):** rendered output contains no OEM/supplier name and no scale claims (`30+ years`, install/customer counts, "Trusted Manufacturer Partner", etc.); the About page contains none of the forbidden claims and renders the four fixed pillar headings verbatim.
- **Bullets shape:** each authored product has 3–5 bullets.
- **Completeness (after batch, contract 3):** all 11 products have non-empty `lead`, `applications` (1–4), and `href`; the types are required so this is compile-enforced, plus a test asserting 11/11.
- **Page count == 14** after `npm run generate-equipment-guide` (the hard constraint); PDF under the generator's `MAX_PDF_BYTES = 2_000_000`.

## Integrity guardrails (carried from prior work)

No OEM/supplier name in customer-facing output; no fabricated specs/performance numbers; no superlatives; `applications` must be real (config-sourced); About forbidden-claims list enforced. Specs and the evidence page are byte-for-byte unchanged by this work.

## Open Inputs For User

- None blocking — the three contracts + CTA copy are settled. (The pilot review in step 2 is the one interactive checkpoint.)
