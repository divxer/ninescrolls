# Equipment Guide Visual v2 — Design-System Port (Design Spec)

**Date:** 2026-07-11
**Status:** Draft for user review
**Predecessors:** generator (PR #270) → visual polish v1 (PR #273) → content-v2 (PR #274) → print URL (PR #275)
**Reference design:** claude.ai/design project `94918668-8aae-4575-82db-cc2b41008148`, file `NineScrolls Equipment Guide.dc.html` (content already synced to content-v2; user-reviewed on 2026-07-11)

## 1. Goal

Port the approved Claude Design visual language into the repo's PDF generator so the **official** `public/NineScrolls-Equipment-Guide.pdf` ships the new design: typographic cover with categorized, page-numbered TOC; category color coding; modern sans type; unified page rhythm; About pillar cards; closing CTA band. **Copy/data change: zero.** Every content-v2 string ships byte-identical.

**Non-goals:** any copy edit, any spec-table change, any evidence-content change, datasheets, website pages.

## 2. Locked decisions (user-approved 2026-07-11)

| # | Decision | Choice |
|---|---|---|
| D1 | Page contract | **15 pages** = cover + existing 14 (About p2, Evidence p3, products p4–14, Contact p15) |
| D2 | Cover art | **Pure typographic** — no photo (the design's facility photo is AI-generated, not a NineScrolls facility; using it risks misrepresenting owned infrastructure) |
| D3 | Typography | **Open-source sans, base64-embedded**: Space Grotesk (headings) + Inter (body) |
| D4 | Rollout | **Direct replacement** of the official PDF, one complete PR |
| D5 | Approach | **A: token port** — keep the pure, data-driven renderer architecture; port design tokens + section markup |

## 3. `PAGE_ORDER` — single source of truth (review point 1)

One canonical constant drives BOTH the cover TOC and the render sequence. No page number or ordering is ever written twice.

```ts
// renderEquipmentGuideHtml.ts (renderer level — the products DATA array is untouched)
export type GuideCategory = 'plasma-etch' | 'thin-film' | 'litho-surface';
export const CATEGORY_META: Record<GuideCategory, { label: string; color: string }> = {
  'plasma-etch':   { label: 'Plasma Etch',              color: '#0066cc' },
  'thin-film':     { label: 'Thin-Film Deposition',     color: '#022448' },
  'litho-surface': { label: 'Litho & Surface Processing', color: '#0d7ea8' },
};
export const PAGE_ORDER: ReadonlyArray<
  | { kind: 'cover' } | { kind: 'about' } | { kind: 'evidence' } | { kind: 'contact' }
  | { kind: 'product'; id: string; category: GuideCategory }
> = [
  { kind: 'cover' },
  { kind: 'about' },
  { kind: 'evidence' },
  { kind: 'product', id: 'rie',              category: 'plasma-etch' },
  { kind: 'product', id: 'icp-rie',          category: 'plasma-etch' },
  { kind: 'product', id: 'ibe-ribe',         category: 'plasma-etch' },
  { kind: 'product', id: 'ald',              category: 'thin-film' },
  { kind: 'product', id: 'pecvd',            category: 'thin-film' },
  { kind: 'product', id: 'hdp-cvd',          category: 'thin-film' },
  { kind: 'product', id: 'sputter',          category: 'thin-film' },
  { kind: 'product', id: 'e-beam',           category: 'thin-film' },
  { kind: 'product', id: 'coater-developer', category: 'litho-surface' },
  { kind: 'product', id: 'stripper',         category: 'litho-surface' },
  { kind: 'product', id: 'plasma-cleaner',   category: 'litho-surface' },
  { kind: 'contact' },
];
```

- **Category-grouped product order** (matches the approved design TOC). This intentionally differs from the v1 sequence (`stripper` was p5). Implemented ONLY at the renderer level: the renderer walks `PAGE_ORDER` and looks products up by id; the `products` data array, its `order` fields, and therefore the order-sensitive `v1-specs-subtable.json` fixture are all byte-untouched.
- Page number of any section = its `PAGE_ORDER` index + 1. The cover TOC is generated from `PAGE_ORDER` (grouped by category, label + page number per entry, category label colored per `CATEGORY_META`).
- The renderer stamps `data-category="<category>"` on every product section (drives the color coding in CSS) alongside the existing `data-product-id`.

**Consistency contract (tests):**
- `PAGE_ORDER` has exactly 15 entries: 1 cover + about + evidence + 11 products (each guide id exactly once) + contact, in that shape.
- Rendered HTML section sequence == `PAGE_ORDER` sequence (assert by walking `<section class="page…">` order: cover marker, about marker, evidence marker, then `data-product-id` in `PAGE_ORDER` order, then contact marker).
- Every TOC entry's rendered page number == that product's `PAGE_ORDER` index + 1; TOC lists exactly the 11 products under the correct category labels, series titles matching `products[id].series` verbatim.
- `data-category` on each product section == its `PAGE_ORDER` category.

## 4. Cover page (review point 5 — final verbatim copy)

Layout (typographic, no photo): brandbar; NINESCROLLS logo; eyebrow; title + accent rule; tagline; edition line; categorized TOC (3 columns, each column = category label in its category color + underline, entries `series — page N`); page-foot.

**Final cover copy — verbatim, no implementation-stage authoring:**

- Eyebrow: `Precision Instrumentation`
- Title: `Equipment Guide`
- Tagline: `Research-grade plasma etching, thin-film deposition, and lithography platforms for university, institute, and corporate R&D laboratories.`
- Edition line: `Equipment Guide · 2026 Edition · ninescrolls.com · info@ninescrolls.com`
- TOC category labels: exactly the three `CATEGORY_META` labels.
- TOC entries: exactly the 11 `series` strings from `products.ts` (no rewording).

**Banned/claims scan:** the tagline and every cover string pass the generator's existing banned list (no OEM names, no `30+ years`/`1000+`/`300+`, no installed-base or superlative claims). A data test asserts the cover copy strings equal the above literals AND match no banned pattern (reuse the About test's regexes). The cover strings live in `guideMeta.ts` as a new `cover` object (`{ eyebrow, title, tagline, edition }`) so the renderer stays data-driven.

## 5. Typography — deterministic build (review point 2)

- **Assets committed to the repo** at `src/templates/equipmentGuide/fonts/`:
  - `SpaceGrotesk-SemiBold.woff2`, `SpaceGrotesk-Bold.woff2` (headings 600/700)
  - `Inter-Regular.woff2`, `Inter-Medium.woff2`, `Inter-SemiBold.woff2` (body 400/500/600)
  - `OFL-SpaceGrotesk.txt`, `OFL-Inter.txt` (licenses, committed)
  - `PROVENANCE.md`: for each file — upstream project + release version + download URL + **SHA-256** (recorded at vendoring time; refreshed only by an explicit future change)
- **No network at build time.** Generation and tests read ONLY these local files. Vendoring happens once, by hand, during implementation; the plan records the exact SHA-256 values in `PROVENANCE.md` and the checksums are re-verifiable offline (`shasum -a 256`).
- New module `src/templates/equipmentGuide/fontsCss.ts`: reads the five woff2 files (sync `readFileSync`), returns the `@font-face` CSS block with `data:font/woff2;base64,…` sources plus the family stacks (`--font-display: 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif;` etc. — the fallback stack exists only for catastrophic failure, and the tests below prove it is not used).
- **Tests:**
  - Rendered HTML contains `@font-face` rules for both families with `data:font/woff2;base64,` sources (one per committed file).
  - Each committed woff2's SHA-256 equals the value pinned in `PROVENANCE.md` (test parses the file and compares — the provenance doc is executable documentation, not prose).
  - **No-fallback proof (PDF level, in the generator's `validatePdf`):** run `pdffonts` on the output; assert at least one embedded font name matches `/SpaceGrotesk/` and one matches `/Inter/`, and assert NO line matches `/Helvetica|Arial|Times|LiberationSans/` — a match means Chrome fell back to system fonts and the build must fail.
- Size budget: ~300 KB of woff2 → Chrome subsets embedded glyphs at PDF export; expected PDF growth well under the 2 MB cap (hard-asserted anyway).

## 6. Design tokens (extracted from the approved design; exact values for implementation)

- **Category colors:** as `CATEGORY_META` above. Applied to: product-page eyebrow text, title accent rule, cover TOC category labels + underline. Everything else stays in the navy/blue brand family (`#1e3a5f` navy, `#0284c7` CTA blue unchanged).
- **Type scale:** page title 26px (Space Grotesk 700), lead 13px, body/bullets 12.5px, chips 12.5px, labels/eyebrows 10px (v1 sizes retained), footers 9px. Body copy floor stays **≥12.5px**.
- **Rhythm:** image well fixed 215px wide × 200px tall (lightweight border + light background, `object-fit: contain`, centered) — the design's post-pagination-fix values; spacing scale 16/24/24 (lead→bullets→table); chips row 20px top offset; CTA row 16px.
- **Plasma-cleaner density tier** (carried over from content-v2, re-derived if the new base rhythm changes the budget): page-scoped `section[data-product-id="plasma-cleaner"]` paddings + image well reduced to 170px tall; its 4 pinned chips and CTA must hold on one page.
- **About pillars:** 2×2 card grid (light indigo panel, icon + heading + body) — icons are inline SVG strokes in brand color, no external assets, no new copy.
- **Closing CTA band** (Contact page, top): full-width deep-navy band, white text, fixed literal: `Ready to scope your process? Request a quote — ninescrolls.com/products · sales@ninescrolls.com` (this literal is part of the spec; banned-scan applies; test pins it).
- **Print robustness (CSS contract):** each `PAGE_ORDER` section starts a new printed page (`break-before: page` semantics consistent with the current `.page` implementation); spec tables `break-inside: avoid` per row; chips row + CTA `break-inside: avoid`; the dark Evidence panel and CTA band print with `-webkit-print-color-adjust: exact`.

## 7. Protection & test strategy (review point 3)

**Unchanged and still enforced (byte-identical baselines):**
- `v1-specs-subtable.json` — deep-equal vs live data (data array untouched by this project).
- `v1-evidence.json` — deep-equal vs live data, **and the fixture file itself must be byte-equivalent to its pre-redesign state** (the Task-6 hygiene allowlist for this project EXCLUDES both data fixtures — if either shows up in the diff, the audit fails).
- All content-v2 data tests (leads/applications/hrefs/bullets/About/plasma-cleaner pins) — untouched.
- CTA anchor + visible `cta-url` render tests — carried over (markup containers may change; anchor href/text and url-span text contracts must not).

**Retired:** `v1-evidence-chunk.html` (markup-level pin — markup change is the point of this project). Deleted in the same commit that introduces its replacement:

**Replacement — evidence STRONG parity (render-level, order- and multiplicity-aware):**
- The Evidence page section (located by `data-section="evidence"`) contains, for the `evidence.publications` array:
  - exactly `publications.length` publication blocks (count),
  - in the SAME order as the data array (assert indexOf monotonicity of each title),
  - each `title`, `journal`, `year`, and (where present) `citations` + `citationsAsOf` rendered **exactly once** within the section (count occurrences == 1, escaped form),
  - each `doi` rendered exactly once as an `https://doi.org/<doi>` href, exact string equality per publication,
  - the attribution-boundary line rendered exactly once, verbatim.
- Plus the untouched `v1-evidence.json` deep-equal test — together these lock content, order, multiplicity, and links while freeing markup.

**New visual-v2 tests (summarized §3–§6):** PAGE_ORDER shape/sequence/TOC consistency; cover literals + banned scan; `data-category` stamping; font data-URIs + SHA-256 provenance; CTA band literal; 15-section render.

**Generator (`scripts/generate-equipment-guide.ts` — modifiable this time):** `EXPECTED_PAGES` 14→15; required-text list gains `Equipment Guide · 2026 Edition` and `Ready to scope your process?`; banned list unchanged; new `pdffonts` no-fallback assert (§5).

## 8. Constraints (hard, all exit-1 at finalize)

- Exactly **15** PDF pages; every section single-page (no product spill).
- `< 2_000_000` bytes.
- Body copy ≥ 12.5px (labels/eyebrows may keep v1 10–11px).
- Every content-v2 copy string byte-identical (enforced by the untouched data tests + data files not in the change allowlist).
- No network access during generation or tests.
- `package-lock.json` untouched; `tmp/` cache path behavior unchanged.

## 9. Process (review point 4 — pilot is a FULL 15-page build)

1. **Pilot (isolated worktree, review-only, never committed/pushed):** implement the full skeleton — fonts, PAGE_ORDER, cover, category coding, CSS — enough to generate the **complete 15-page PDF**. Visual polish focuses on cover + RIE + plasma-cleaner, but acceptance reviews ALL pages: the other 12 must show no pagination breaks, no font fallback (`pdffonts` clean), no clipped tables. Screenshots of all 15 pages presented for **user sign-off**; worktree then discarded.
2. **Batch port (real branch, TDD):** tests first per §3–§7, then implementation, page-by-page verification against the design reference.
3. **Finalize:** full suite + build + regenerate + hard asserts (§8) + all-15-page inspection + atomic PDF commit + hygiene audit (state-dir pattern from content-v2, allowlist per §10).
4. One complete PR; direct replacement (D4).

## 10. Files (change allowlist for the final audit)

- Modify: `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts`, `equipmentGuide.css.ts`, `renderEquipmentGuideHtml.test.ts`
- Modify: `src/data/equipmentGuide/guideMeta.ts` (add `cover` object only), `types.ts` (add `cover` type), `equipmentGuide.data.test.ts` (cover-literal tests)
- Create: `src/templates/equipmentGuide/fontsCss.ts`, `src/templates/equipmentGuide/fonts/*` (5 woff2 + 2 OFL + PROVENANCE.md)
- Modify: `scripts/generate-equipment-guide.ts` (EXPECTED_PAGES, required strings, pdffonts assert)
- Delete: `src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html`
- Modify: `public/NineScrolls-Equipment-Guide.pdf` (finalize only)
- **Explicitly NOT in allowlist:** `products.ts`, `index.ts`, `v1-specs-subtable.json`, `v1-evidence.json`, `package-lock.json` — any diff there fails the audit.
