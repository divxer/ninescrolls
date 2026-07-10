# Equipment Guide Logo — Design

Date: 2026-07-10
Status: Draft for review
Related:
- `docs/superpowers/specs/2026-07-09-equipment-guide-generator-design.md` (the generator this extends)
- `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` (the renderer being modified)
- Company logo source: `~/MyDocuments/Company_Registration/NineScrolls LLC/logo/logo_dragon_with_text.svg`

## Problem

The generated `public/NineScrolls-Equipment-Guide.pdf` shows a **plain-text `NINESCROLLS` wordmark** in the page header bar instead of the real logo, and two pages carry **no branding at all**: page 1 (About) and page 2 (the dark Evidence page). For downloadable customer sales collateral — which the website and the previous hand-made guide both branded with the real logo — a text-only wordmark and unbranded pages look like template/draft pages.

## Decision

Put the **real NineScrolls logo on all 14 pages**, lightweight, with no cover redesign and no change to the 14-page information structure:
- Use `logo_dragon_with_text.svg` (the emblem + "NineScrolls" wordmark lockup), NOT the emblem-only mark.
- White-bg pages (About, product pages, Contact) → **navy** logo (its native `#243959`).
- Dark Evidence page → **white** logo (recolored at generation time).
- Remove the plain-text `NINESCROLLS` wordmark from the header; keep URL/email on the right.

## Asset

Copy the company logo source into the repo as a first-class asset:
- `~/MyDocuments/Company_Registration/NineScrolls LLC/logo/logo_dragon_with_text.svg` → `public/assets/images/logo-with-text.svg`

Properties (verified): pure vector (19 `<path>`, no `<image>`/`<text>` raster), single fill `#243959`, transparent background, `viewBox="0 0 659 249"` (~2.65:1 horizontal lockup). Single-fill means the white variant is a deterministic string replace (`#243959` → `#ffffff`).

## Implementation

All changes in `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` + `equipmentGuide.css.ts`:

1. **`logoDataUri(variant: 'navy' | 'white'): string`** — reads `public/assets/images/logo-with-text.svg` (via the existing `readFileSync` + `resolve(process.cwd(), 'public', …)` pattern), and for `'white'` replaces `#243959` → `#ffffff` (case-insensitive, all occurrences) in the SVG text before encoding. Returns `data:image/svg+xml;base64,<b64>`. The SVG is tiny (~12KB); embedded on 14 pages this adds <0.2MB, negligible vs the ~1.2MB PDF.

2. **`brandbar(variant: 'navy' | 'white' = 'navy'): string`** — replaces the current `<strong>NINESCROLLS</strong>` with `<img class="brand-logo" src="${logoDataUri(variant)}" alt="NineScrolls LLC"/>`; keeps the right-side `<span class="site">https://ninescrolls.com … info@ninescrolls.com</span>`. Retains the existing navy bottom-border on white pages.

3. **Placement:**
   - Product pages + Contact page: already call `brandbar()` → now render `brandbar('navy')` (default). Wordmark text is gone.
   - Page 1 (About): add `brandbar('navy')` at the top of the section (currently unbranded).
   - Page 2 (Evidence, dark card): render the **white** logo at the top of the `.evidence` card (`brandbar('white')` or a white-logo header row inside the card). The right-side URL/email on the dark card must stay legible (use the existing light `.site` color, or omit URL/email on this one page if contrast is poor — logo-only is acceptable there).

4. **CSS (`equipmentGuide.css.ts`):** `.brand-logo { height: 34px; width: auto; }` (matches the site's ~h-8 scale; ~90px wide at this aspect). Ensure the brandbar on the dark card uses a variant that doesn't draw the navy bottom-border on dark.

## Testing

Extend `renderEquipmentGuideHtml.test.ts`:
- The logo data-URI (`data:image/svg+xml;base64,`) appears **at least 14 times** (once per page).
- The **white variant** is present: the rendered HTML contains a logo data-URI whose decoded SVG contains `#ffffff` (or assert the recolor helper output distinctly) — i.e. the Evidence page uses the recolored logo, not the navy one.
- The old header wordmark is gone: rendered HTML does not contain `<strong>NINESCROLLS</strong>` (the exact former header token). (Note: "NINESCROLLS"/"NineScrolls" still legitimately appears elsewhere as company-name text; assert only that the former plain-text *header* wordmark element is gone.)
- All existing render invariants still pass (no OEM leak, no scale claims, evidence page, 11 products, product images).
- Then regenerate `npm run generate-equipment-guide` and visually verify the PDF: navy logo top-left on About + product + contact pages, white logo on the dark evidence page, no plain-text wordmark, URL/email still right-aligned.

## Non-Goals

- No cover-page redesign; page count stays 14; no change to information structure or copy.
- No change to product images, evidence content, or specs.
- No new white-logo asset file committed — the white variant is derived at generation time from the single source SVG.
