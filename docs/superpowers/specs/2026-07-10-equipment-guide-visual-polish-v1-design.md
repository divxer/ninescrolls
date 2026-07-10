# Equipment Guide Visual Polish v1 — Design

Date: 2026-07-10
Status: Draft for review
Related:
- `docs/superpowers/specs/2026-07-09-equipment-guide-generator-design.md` (the generator this refines)
- `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` + `src/templates/equipmentGuide/equipmentGuide.css.ts` (the primary files modified — see the Files section for the complete list)
- Company logo source: `~/MyDocuments/Company_Registration/NineScrolls LLC/logo/logo_dragon_with_text.svg`

## Problem

The generated `public/NineScrolls-Equipment-Guide.pdf` is already far cleaner than the old hand-made guide and its information structure is clear — but it still reads like an **auto-generated technical document**, not a finished brand manual:

1. **Incomplete branding** — page 1 (About) and page 2 (Evidence) have no logo; product pages show a plain-text `NINESCROLLS` header wordmark instead of the real logo. Makes the PDF look like an internal draft.
2. **Style discontinuity across the three page types** — white big-text About page, dark Evidence card, then table-heavy product pages, with no shared brand header / section rhythm tying them together.
3. **Product pages feel templated** — image looks fixed-pasted in the top-right corner; the spec table dominates and the lower half of the page is empty. Reads like a datasheet generator, not a premium equipment guide.
4. **Table styling is "Excel-ish"** — usable but not elevated.

This is a **visual polish pass (v1)**, not a redesign: no content, copy, spec, or information-structure changes; page count stays 14; no cover page. The real "big redesign" is deferred to the datasheet-generator work.

## Decision

Ship **Guide Visual Polish v1** — logo on all 14 pages, a unified brand header across all page types, refined table styling, and a uniform product-image presentation. All changes are confined to the renderer, its CSS, its test, the new logo asset, and the regenerated PDF (the complete set is enumerated in the **Files** section). No canonical-data changes; `scripts/generate-equipment-guide.ts` is not modified.

## Asset

Copy the company logo lockup into the repo as a first-class asset:
- `~/MyDocuments/Company_Registration/NineScrolls LLC/logo/logo_dragon_with_text.svg` → `public/assets/images/logo-with-text.svg`

Verified properties: pure vector (19 `<path>`, no raster `<image>`/`<text>`), single fill `#243959`, transparent bg, `viewBox="0 0 659 249"` (~2.65:1 horizontal lockup). Single fill → the white variant is a deterministic `#243959` → `#ffffff` string replace.

## Files (implementation touches exactly these)

| File | Change |
|---|---|
| `public/assets/images/logo-with-text.svg` | **New** — the company logo lockup copied into the repo (committed asset) |
| `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` | `logoDataUri()` + memoization; `brandbar(variant)` renders the logo; About/Evidence gain headers; `.section-accent`, `.image-well`, `.page-foot` markup |
| `src/templates/equipmentGuide/equipmentGuide.css.ts` | `.brand-logo`, refined table styles, `.spec-table` wrapper, `.image-well`, `.section-accent`, `.page-foot` rules |
| `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts` | Structural logo assertions (see Testing) |
| `public/NineScrolls-Equipment-Guide.pdf` | **Regenerated** — committed generated artifact (see below) |

**`scripts/generate-equipment-guide.ts` is NOT modified** (the Puppeteer footer stays as-is; see §E).

**Committed generated artifact:** `public/NineScrolls-Equipment-Guide.pdf` is a checked-in build output (multiple product pages — 8 configs as of now — link to it as their datasheet download). The implementation commit that changes the renderer/CSS **MUST** include the regenerated PDF, so the committed file always matches the current generator. Do not land renderer/CSS changes without regenerating and committing the PDF in the same change.

## Changes

### A. Logo on all 14 pages
- New **`export function logoDataUri(variant: 'navy' | 'white'): string`** in the renderer — it MUST be exported (like `defaultImageDataUri` / `renderEquipmentGuideHtml` already are) so the test can import it and compute the exact navy/white URIs to assert against.
- **Caching (required):** the source SVG is read from disk **at most once** and each variant's data-URI is memoized at module scope — e.g. a module-level `const logoCache = new Map<'navy' | 'white', string>()` plus a lazily-read `logoSvgSource` (read once on first `logoDataUri` call, then reused). Subsequent calls return the cached URI; `logoDataUri` must NOT call `readFileSync` per page (14 header renders → **1** disk read, **≤2** encodes total). Use the same `resolve(process.cwd(), 'public', …)` path convention as product images.
- For `'white'`, replace `#243959`→`#ffffff` (case-insensitive, all occurrences) on the source SVG before encoding; return `data:image/svg+xml;base64,<b64>`. ~12KB × 14 pages ≈ <0.2MB added, negligible vs the ~1.2MB PDF.
- Remove the plain-text `<strong>NINESCROLLS</strong>` header wordmark everywhere.

### B. Unified brand header (all page types)
- `brandbar(variant: 'navy' | 'white' = 'navy')`: logo `<img class="brand-logo" alt="NineScrolls LLC">` (left) + right-side `https://ninescrolls.com … info@ninescrolls.com`.
- **White pages** (About, product pages, Contact): navy logo, thin brand bottom-border, light-gray `.site` text.
- **Dark Evidence page (hard contract):** `brandbar('white')` renders the **white** logo header **inside** the dark card, AND the right-side `https://ninescrolls.com … info@ninescrolls.com` renders in `#cbd5e1` (legible on the dark bg). URL/email are **NOT** omitted and logo-only is **not** permitted — this is a fixed requirement, not an implementation judgment call. The dark-card variant suppresses the navy bottom-border (uses a `rgba(255,255,255,0.14)` hairline instead).
- **About page** currently has no header → gains `brandbar('navy')` so it opens with the same rhythm as the rest.
- **Concrete shared section-open accent:** a `.section-accent` element — `width: 40px; height: 3px; background: #0284c7; border-radius: 2px; margin: 8px 0 14px;` — rendered directly under the eyebrow on product pages, and directly under the `<h1>` on About and Evidence (which have no eyebrow), so all three page types open with the same visual beat. On the dark Evidence card the accent stays `#0284c7` (sky reads fine on navy). No other chrome.

### C. Refined table styling (`equipmentGuide.css.ts`)
- Wrap each spec table in a rounded container (`.spec-table { border: 1px solid #e8edf3; border-radius: 8px; overflow: hidden }`) so it reads as a contained card, not a raw grid.
- Cell padding (fixed values): `td { padding: 10px 14px }` (from `8px 12px`); `th { padding: 11px 14px }`.
- Softer borders: row separators `td { border-bottom: 1px solid #eef2f7 }` (lighter than current `#e2e8f0`); drop any heavy lines.
- Subtle zebra: `tr:nth-child(even) td:not(.label) { background: #fafbfc }` (scoped to non-label cells so the label column tint survives on even rows); keep the label column tint (`td.label { background: #f5f8fc; font-weight: 600 }`).
- Header (`th`): keep navy `#1e3a5f`, white text, `letter-spacing: 0.04em`, uppercase.
- Logo sizing (fixed): `.brand-logo { height: 30px; width: auto }` (matches the site's ~h-8 scale; ~79px wide at the 659×249 aspect).

### D. Uniform product-image presentation
- Replace the ad-hoc top-right image with a consistent framed **`.image-well`** container (fixed values): `height: 200px; padding: 14px; border: 1px solid #eef2f7; border-radius: 10px; box-shadow: 0 6px 24px rgba(15,23,42,0.06); background: linear-gradient(180deg, #ffffff 0%, #f4f6f9 100%); display: flex; align-items: center; justify-content: center;`. The `<img>` inside: `object-fit: contain; max-width: 100%; max-height: 100%;`. Every product image then sits in an identical branded frame (removes the "pasted-on" feel) and all product pages share one image rhythm.
- Keep the existing two-column product head (copy left, `.image-well` right, `flex: 0 0 42%`); only the image container styling changes.

### E. Whitespace / lower-page balance (light touch)
- **Done purely in HTML/CSS content — the Puppeteer `footerTemplate` in `scripts/generate-equipment-guide.ts` is NOT modified** (the existing `Page X of Y · ninescrolls.com` page-number footer stays as-is; this task does not touch the generator script).
- Give product pages a `page--product` class that fills the printable height as a flex column: `.page--product { display: flex; flex-direction: column; min-height: 9.1in }` (Letter content height ≈ 11in − 0.6in top − 0.7in bottom − footer allowance; 9.1in is deliberately conservative to avoid forcing a blank overflow page).
- Append a **text-free** `.page-foot` element as the last child of each product `<section class="page page--product">`: `.page-foot { margin-top: auto; border-top: 1px solid #eef2f7 }`. `margin-top: auto` pins the hairline to the bottom of the printable area so the empty lower half reads as an intentional framed region rather than blank. **No new copy** — no tagline or any added text (this satisfies the "no content/copy changes" non-goal); it is a pure visual rule.
- The visual-iteration loop MUST confirm the guide is still exactly 14 pages. If any page overflows to a second sheet, **diagnose the actual cause before changing anything** — render pages to images (`pdftoppm`), find the overflowing section, and identify whether it is `min-height` too tall, `.image-well { height }`, table cell padding, a margin, or a genuinely tall product's content. Adjust only the causal value, then re-verify. Do **not** reflexively reduce `min-height`.

## Testing

Extend `renderEquipmentGuideHtml.test.ts` (pure, fast) — lock the durable invariants; the aesthetic tuning (C/D/E) is validated by rendering, not asserted pixel-by-pixel:
- **Per-variant counts (structural, not just `≥14`):** compute `logoDataUri('navy')` and `logoDataUri('white')` in the test; assert the rendered HTML contains the **navy** URI exactly **13** times (About + 11 product pages + Contact) and the **white** URI exactly **1** time (Evidence). Total 14 — every page branded, none double-branded.
- **Per-page structure:** split the rendered HTML into page chunks with `html.split('<section class="page').slice(1)` — note the delimiter has **no closing quote after `page`**, so it matches both `class="page"` (About/Evidence/Contact) and `class="page page--product"` (product pages). The `.slice(1)` drops the leading pre-first-section chunk (doctype/`<head>`/opening `<body>`) so the array is exactly the 14 page sections. Assert `chunks.length === 14`, and that **every** chunk contains exactly one logo data-URI, and specifically:
  - the About chunk (identified by `About NineScrolls LLC`) has 1 **navy** logo;
  - the Evidence chunk (identified by `Peer-Reviewed Validation`) has 1 **white** logo;
  - the Contact chunk (identified by `Office Location`) has 1 **navy** logo;
  - each of the 11 product chunks — identified by **`esc(p.series)`** (the escaped series string, since e.g. `Coater/Developer & Hotplate Series` renders with `&amp;`) — has 1 **navy** logo. Import `esc` or mirror it in the test as the render test already does for series matching.
- **White-variant correctness:** the white URI's decoded SVG contains `#ffffff` and no `#243959` (recolor applied).
- **Former header wordmark gone:** rendered HTML does not contain `<strong>NINESCROLLS</strong>` (company-name text elsewhere is unaffected; assert only the old header element is absent).
- **Image well:** each product page renders its image inside the framed container (assert the `.image-well` class wraps each product `<img>`; ≥11 occurrences).
- All existing render invariants still pass (no OEM leak, no scale claims, evidence page, 11 products, product images embedded).

Then **regenerate + visually verify + iterate**: `npm run generate-equipment-guide`, read the PDF, confirm — navy logo top-left on About/product/contact pages, white logo on the dark Evidence card, no plain-text wordmark, uniform image wells, elevated tables, URL/email legible on every page, and **still exactly 14 pages** (§E `min-height` introduced no blank overflow pages). The generator already enforces its `MAX_PDF_BYTES = 2_000_000` ceiling and fails if exceeded, so the size guard is automatic — the added logos (~<0.2MB) keep it well under 2,000,000 bytes. Because C/D/E are aesthetic, expect one short iteration loop on the rendered PDF with the user before finalizing.

## Non-Goals

- No cover-page redesign; page count stays 14; no change to information structure.
- No content/copy rewrites (About paragraph length, bullet phrasing "略机械" noted but out of scope for v1), no spec/evidence/data changes, no new products.
- No new white-logo asset file — the white variant is derived at generation time from the single source SVG.
- The larger brand-manual redesign is deferred to the datasheet-generator effort.
