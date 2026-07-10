# Equipment Guide Visual Polish v1 — Design

Date: 2026-07-10
Status: Draft for review
Related:
- `docs/superpowers/specs/2026-07-09-equipment-guide-generator-design.md` (the generator this refines)
- `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` + `src/templates/equipmentGuide/equipmentGuide.css.ts` (the two files modified)
- Company logo source: `~/MyDocuments/Company_Registration/NineScrolls LLC/logo/logo_dragon_with_text.svg`

## Problem

The generated `public/NineScrolls-Equipment-Guide.pdf` is already far cleaner than the old hand-made guide and its information structure is clear — but it still reads like an **auto-generated technical document**, not a finished brand manual:

1. **Incomplete branding** — page 1 (About) and page 2 (Evidence) have no logo; product pages show a plain-text `NINESCROLLS` header wordmark instead of the real logo. Makes the PDF look like an internal draft.
2. **Style discontinuity across the three page types** — white big-text About page, dark Evidence card, then table-heavy product pages, with no shared brand header / section rhythm tying them together.
3. **Product pages feel templated** — image looks fixed-pasted in the top-right corner; the spec table dominates and the lower half of the page is empty. Reads like a datasheet generator, not a premium equipment guide.
4. **Table styling is "Excel-ish"** — usable but not elevated.

This is a **visual polish pass (v1)**, not a redesign: no content, copy, spec, or information-structure changes; page count stays 14; no cover page. The real "big redesign" is deferred to the datasheet-generator work.

## Decision

Ship **Guide Visual Polish v1** — logo on all 14 pages, a unified brand header across all page types, refined table styling, and a uniform product-image presentation. All changes are confined to `renderEquipmentGuideHtml.ts` and `equipmentGuide.css.ts` (plus the logo asset). No canonical-data changes.

## Asset

Copy the company logo lockup into the repo as a first-class asset:
- `~/MyDocuments/Company_Registration/NineScrolls LLC/logo/logo_dragon_with_text.svg` → `public/assets/images/logo-with-text.svg`

Verified properties: pure vector (19 `<path>`, no raster `<image>`/`<text>`), single fill `#243959`, transparent bg, `viewBox="0 0 659 249"` (~2.65:1 horizontal lockup). Single fill → the white variant is a deterministic `#243959` → `#ffffff` string replace.

## Changes

### A. Logo on all 14 pages
- New `logoDataUri(variant: 'navy' | 'white'): string` in the renderer: reads `public/assets/images/logo-with-text.svg` (same `readFileSync` + `resolve(process.cwd(), 'public', …)` pattern as product images); for `'white'` replaces `#243959`→`#ffffff` (case-insensitive, all occurrences); returns `data:image/svg+xml;base64,<b64>`. ~12KB × 14 pages ≈ <0.2MB added, negligible vs the ~1.2MB PDF.
- Remove the plain-text `<strong>NINESCROLLS</strong>` header wordmark everywhere.

### B. Unified brand header (all page types)
- `brandbar(variant: 'navy' | 'white' = 'navy')`: logo `<img class="brand-logo" alt="NineScrolls LLC">` (left) + right-side `https://ninescrolls.com … info@ninescrolls.com`.
- **White pages** (About, product pages, Contact): navy logo, thin brand bottom-border, light-gray `.site` text.
- **Dark Evidence page**: white logo header **inside** the dark card; right-side URL/email brightened to a legible light tone (e.g. `#cbd5e1`) on the dark bg (resolves the low-contrast concern), or logo-only if it reads cleaner — decided during implementation by viewing the render.
- **About page** currently has no header → gains `brandbar('navy')` so it opens with the same rhythm as the rest.
- Add a subtle shared **section-open rhythm**: consistent top spacing + a thin sky accent under the eyebrow/heading so every page (About, Evidence, product) starts with the same visual beat. Keep it light — no heavy chrome.

### C. Refined table styling (`equipmentGuide.css.ts`)
- Wrap each spec table in a rounded container (`.spec-table { border: 1px solid #e8edf3; border-radius: 8px; overflow: hidden }`) so it reads as a contained card, not a raw grid.
- Cell padding up for breathing room: `td` `10px 14px` (from `8px 12px`); `th` header bar slightly taller with letter-spacing.
- Softer borders: row separators `1px solid #eef2f7` (lighter than current `#e2e8f0`); drop any heavy lines.
- Subtle zebra: `tr:nth-child(even) td { background: #fafbfc }`, keep the label column tint (`td.label` `#f5f8fc`, `font-weight:600`).
- Header (`th`): keep navy `#1e3a5f`, white text, uppercase letter-spacing `0.04em`.

### D. Uniform product-image presentation
- Replace the ad-hoc top-right image with a consistent framed "image well": fixed height (~190–210px) box, `object-fit: contain`, uniform padding, `1px solid #eef2f7` border, `border-radius: 10px`, a soft shadow (`0 6px 24px rgba(15,23,42,0.06)`) and a faint top-down light gradient background. Every product image then sits in an identical branded frame (removes the "pasted-on" feel) and all product pages share one image rhythm.
- Keep the existing two-column product head (copy left, image right); only the image container styling changes.

### E. Whitespace / lower-page balance (light touch)
- The Puppeteer footer already prints `Page X of Y · ninescrolls.com`. Add a thin full-width brand hairline above the footer content area (or a small right-aligned platform tagline) so the empty lower half of table pages feels intentional rather than blank. Keep minimal — no filler content, no fabricated data.

## Testing

Extend `renderEquipmentGuideHtml.test.ts` (pure, fast) — lock the durable invariants; the aesthetic tuning (C/D/E) is validated by rendering, not asserted pixel-by-pixel:
- Logo data-URI (`data:image/svg+xml;base64,`) appears **≥14 times** (every page branded).
- **White variant present**: at least one embedded logo's decoded SVG contains `#ffffff` (Evidence page provably uses the recolored logo, not the navy one) — assert via the `logoDataUri('white')` output or by decoding.
- Former header wordmark gone: rendered HTML does not contain `<strong>NINESCROLLS</strong>` (company-name text elsewhere is unaffected; assert only the old header element is absent).
- Each product page renders its image inside the framed well (assert the `.image-well`/container class wraps the product `<img>`).
- All existing render invariants still pass (no OEM leak, no scale claims, evidence page, 11 products, product images embedded).

Then **regenerate + visually verify + iterate**: `npm run generate-equipment-guide`, read the PDF, confirm — navy logo top-left on About/product/contact pages, white logo on the dark Evidence card, no plain-text wordmark, uniform image wells, elevated tables, URL/email legible on every page. Because C/D/E are aesthetic, expect one short iteration loop on the rendered PDF with the user before finalizing. Confirm final PDF stays ~≤1.5MB.

## Non-Goals

- No cover-page redesign; page count stays 14; no change to information structure.
- No content/copy rewrites (About paragraph length, bullet phrasing "略机械" noted but out of scope for v1), no spec/evidence/data changes, no new products.
- No new white-logo asset file — the white variant is derived at generation time from the single source SVG.
- The larger brand-manual redesign is deferred to the datasheet-generator effort.
