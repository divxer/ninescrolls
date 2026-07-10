# Equipment Guide Generator — Design

Date: 2026-07-09
Status: Draft for review
Related:
- `docs/superpowers/specs/2026-07-09-research-validation-claim-reframe-design.md` (shipped; the represented-platform attribution rules this guide reuses)
- `public/NineScrolls-Equipment-Guide.pdf` (the current hand-made guide being replaced)
- `src/components/products/productDetailConfigs/*.ts` (website product configs; the guide's spec screening subset is derived from the guide, not vice-versa)

## Problem

The customer-facing **Equipment Guide** (`public/NineScrolls-Equipment-Guide.pdf`, 14 pages, last hand-authored Apr 30) is downloadable from **7 product pages** (hy4l, hy20l, hy20lrf, compactRie, plutoT/M/F) and has three live problems:

1. **OEM disclosure + unverified scale claims (critical).** Page 2 ("Our Trusted Manufacturer Partner") names the OEM **"Tyloong"** — on the standing never-expose list — and asserts **30+ Years / 1000+ Global Installations / 300+ Research Institutions Served**, the supplier's numbers presented as NineScrolls' own (page 1 itself calls NineScrolls a "dynamic start-up"). This is the same mis-attribution the homepage reframe just fixed, but worse: it literally names the vendor, and it is live and downloadable.
2. **Stale product images.** The 10 product pages use the old raw 3D renders; the website now uses standardized images (`public/assets/images/redesign/products/*-standardized.webp`).
3. **Not regenerable / drift-prone.** It is a hand-made document with no source pipeline in the repo, so it drifts from the site every time products change.

## Goals

- Replace the guide with a **regenerable artifact** produced from a **canonical structured data source**, so it never silently drifts again.
- Remove all OEM disclosure and unverified scale claims; reframe the partner page as **represented-platform validation**, consistent with the homepage.
- Use the website's **standardized product images** and **July-redesign visual language**.
- Ship a clean `public/NineScrolls-Equipment-Guide.pdf` that replaces the current one.

## Non-Goals (this phase)

- Per-product datasheets (`public/docs/*.pdf`) — Phase 2, same generator, deferred until the guide lands.
- Rewiring the website product configs to read from the canonical data — Phase 2 reverse-reuse.
- Any change to website runtime code or bundle (the generator is a build/authoring script only).

## Decisions (locked in brainstorming)

1. **Single source of truth:** a new canonical TS data set under `src/data/equipmentGuide/`. Website configs are untouched.
2. **Engine:** Node/TS generator → HTML/CSS template → **Puppeteer** `page.pdf()`. `puppeteer` is a **devDependency** (Chromium download; never enters the web bundle).
3. **Page 2:** a **represented-platform evidence page** (content below), aligned with the homepage Research Validation reframe.
4. **Scope:** **11 series pages** = the 10 existing series + **E-Beam Evaporation** (MEB-600). Plasma cleaning stays **one** series page listing HY-4L / HY-20L / HY-20LRF / PLUTO-F/M/T as family options.
5. **Visual:** align to the **July web redesign** — navy/slate + sky-blue accents, white product pages, ~8px radii, light borders, standardized images, new type; dark evidence/CTA styling. No maroon.

## Architecture

```
src/data/equipmentGuide/*.ts   (canonical SoT: company, evidence, 11 products, contact)
            │  import
            ▼
src/templates/equipmentGuide/renderEquipmentGuideHtml.ts  (pure: data → HTML string)
   + equipmentGuide.css  (inlined into the HTML <style>)
   + images embedded as base64 data URIs (self-contained, deterministic)
            │  returns HTML string
            ▼
scripts/generate-equipment-guide.ts
   → puppeteer.launch() → page.setContent(html, {waitUntil:'networkidle0'})
   → page.pdf({ format:'Letter', printBackground:true, margin, displayHeaderFooter, footerTemplate })
            │
            ▼
public/NineScrolls-Equipment-Guide.pdf   (overwrites current)
```

The render step is a **pure function** (`data → HTML string`) so it is unit-testable without a browser. Puppeteer is only invoked by the script. Images are read from `public/assets/images/redesign/products/*.webp` and inlined as base64 data URIs, so the rendered HTML is fully self-contained (no path/`file://`/network fragility) and the output is deterministic.

## File Structure

```
src/data/equipmentGuide/
  types.ts        # EquipmentGuideData, GuideProduct, SpecRow, EvidenceStudy, etc.
  guideMeta.ts    # company/about copy, evidence page, contact page, brand tokens
  products.ts     # the 11 GuideProduct entries (bullets + full spec tables + image + citations)
  index.ts        # assembles and exports the single EquipmentGuideData object
src/templates/equipmentGuide/
  equipmentGuide.css.ts     # exported CSS string (navy/slate/sky design system)
  renderEquipmentGuideHtml.ts  # pure: (EquipmentGuideData) => string (full HTML doc)
scripts/
  generate-equipment-guide.ts  # data → html → puppeteer → public/…pdf
public/NineScrolls-Equipment-Guide.pdf   # generated output (committed)
```

`package.json` gets a script: `"generate-equipment-guide": "npx tsx scripts/generate-equipment-guide.ts"` and `puppeteer` in `devDependencies`.

## Data Model (types.ts)

```ts
export interface SpecRow { label: string; value: string; value2?: string } // value2 for 2-column spec tables (e.g. IBE Kaufman/RF, Coater/Developer)
export interface GuideProduct {
  id: string;               // 'icp-rie'
  series: string;           // 'ICP Etcher Series'
  order: number;            // page order 1..11
  image: string;            // repo-relative path to a -standardized.webp
  imageAlt: string;
  footprint?: string;       // 'ref 1.0m x 1.5m'
  bullets: { heading: string; body: string }[];  // the "Uni-body Design Concept" style pairs
  specHeaders?: [string, string]; // for 2-col tables: ['Kaufman ion source','RF ion Source']
  specs: SpecRow[];
  familyOptions?: string[]; // plasma-cleaner page lists HY-4L/HY-20L/... here
}
export interface EvidenceStudy {
  journal: string; year: number; title: string; platform: string; // 'RIE' | 'ICP' | ...
  citations?: number; citationsAsOf?: string; doi?: string;       // shipping-gate fields
}
export interface EquipmentGuideData {
  about: { title: string; subtitle: string; paragraphs: string[]; pillars: { heading: string; body: string }[] };
  evidence: { title: string; subtitle: string; intro: string; studies: EvidenceStudy[]; disclaimer: string };
  products: GuideProduct[];
  contact: { office: string[]; hours: string[]; contacts: { label: string; value: string }[]; support: { label: string; value: string }[] };
}
```

## Content

### Page 1 — About (keep, lightly verified)
Retain the current About copy: NineScrolls is a US start-up building a platform connecting manufacturers, researchers, and industry professionals; pillars **Integration / Innovation / Collaboration / Expertise**. No changes needed — it is already accurate and OEM-free.

### Page 2 — Represented-Platform Evidence (replaces OEM partner page)

- **Title:** `Peer-Reviewed Validation for the Platforms We Represent`
- **Subtitle:** `Research using corresponding plasma, deposition, and vacuum process platforms has appeared in Nature Portfolio journals, ACS, Advanced Materials, Materials Today, and Scientific Reports.`
- **Intro:** `Real published research using corresponding process platforms.`
- **Representative studies** — every journal named in the subtitle must have a listed study (the reframe's "no orphan journal claim" rule). Six studies; the first four are verified (from the shipped reframe), the last two are candidates to verify at implementation (card shipping gate):
  1. **Nature Communications**, 2021 — vdW rectifier — RIE platform — 245 citations (as of Jul 2026) — `10.1038/s41467-021-21861-6` ✓
  2. **Light: Science & Applications**, 2026 — color router — RIE platform — `10.1038/s41377-025-02146-9` ✓
  3. **Advanced Materials**, 2026 — antireflection metasurface — ICP platform — `10.1002/adma.202519943` ✓
  4. **Materials Today**, 2026 — solar-blind UV photodetector — PECVD platform — `10.1016/j.mattod.2026.103220` ✓
  5. **ACS Applied Nano Materials**, 2025 — RIE-100 SERS (Liu et al.) — RIE platform — *verify DOI + count*
  6. **Scientific Reports**, 2025 — ICP diamond etch (Zhao et al.) — ICP platform — *verify DOI + count*
  If studies 5–6 fail verification, drop them **and** trim ACS / Scientific Reports from the subtitle.
- **Disclaimer ("How to read this evidence"):** `These publications validate represented platform classes and process capabilities. They are not claims of NineScrolls-branded installed-base citations.`

### Pages 3–13 — 11 product series pages

Each page: series title, footprint, the design-concept bullet pairs, a **standardized product image**, and the **full spec table** (transcribed from the current guide PDF, which has been read in full — RIE p3, ICP p4, Stripper p5, IBE/RIBE p6, ALD p7, PECVD p8, HDP-CVD p9, Sputter p10, Coater/Developer p11, Plasma Cleaner p12–13). E-Beam is new; its data comes from `eBeamEvaporatorConfig.ts` (specs: Substrate 1×8in/5×4in, E-Gun 6 pockets ×17cc, Uniformity ±3–5%, in-situ QCM endpoint, Vacuum ~8×10⁻⁴ Pa, E-beam + thermal sources, materials metals/oxides/fluorides/IR).

**Image map (all verified to exist):**

| Series | Image |
|---|---|
| RIE Etcher | `rie-standardized.webp` |
| ICP-RIE Etcher | `icp-rie-standardized.webp` |
| Plasma Photoresist Stripping | `striper-standardized.webp` |
| IBE/RIBE | `ibe-ribe-standardized.webp` |
| ALD | `ald-standardized.webp` |
| PECVD | `pecvd-standardized.webp` |
| HDP-CVD | `hdp-cvd-standardized.webp` |
| PVD Magnetron Sputtering | `sputter-standardized.webp` |
| Coater/Developer & Hotplate | `coater-developer-standardized.webp` |
| Plasma Cleaner Systems | `hy-20l-standardized.webp` (family page; lists HY-4L/HY-20L/HY-20LRF/PLUTO-F/M/T) |
| E-Beam Evaporation | `e-beam-standardized.webp` |

Plasma-cleaner page: replace the guide's generic "100C-PT" content with the family framing (`familyOptions`), imaged with `hy-20l-standardized.webp`.

### Page 14 — Contact (keep, verified)
Office 12546 Cabezon Pl, San Diego, CA 92129; Mon–Fri 9–5 PST; info@ / sales@ / +1 (858) 879-8898; support@ Mon–Fri 8–6 PST, 24/7 emergency. Current — retain.

## Attribution / Brand Rules (normative — reused from the reframe)

- **No OEM/supplier name anywhere in output:** Tyloong / Zhongke Tailong / 中科泰隆 / Chuangshi / 创世威纳 / Peiyuan / 沛沅 / Advanstech / 埃德万斯. Product copy names the **process type** only.
- **No mis-attributed scale claims:** no "30+ Years", "1000+ Global Installations", "300+ Research Institutions", "Our Trusted Manufacturer Partner", or equivalents implying NineScrolls installed base.
- **No flagship "Nature":** "Nature Portfolio" / "Nature Communications" / "Light: Science & Applications" only, each backed by a listed study.
- Data files (`src/data/equipmentGuide/`) may carry `doi`/`citations` provenance; the **rendered** output shows only accurate, sourced values with an "as of" date where a count is shown.

## Rendering Details

- **Page:** US Letter, print margins ~0.6in, `printBackground: true`.
- **Footer:** `displayHeaderFooter` with a `footerTemplate` showing `Page X of Y` + `ninescrolls.com` (replaces the current per-page header/footer). Product/section header band drawn in-content (navy).
- **Images:** each product image read from disk, base64-encoded, inlined as `data:image/webp;base64,…`. Chrome renders webp natively.
- **Fonts:** use the site's type where feasible via a web-safe stack (Arial/system sans for body; a serif or bold sans for headings to match the redesign); if brand fonts are required, embed via base64 `@font-face`. Keep the default self-contained (no external font fetch — Puppeteer runs offline).
- **CSS:** page-break control (`break-inside: avoid` on product cards/tables; `break-before: page` per product), navy/slate/sky tokens, light borders, ~8px radii.

## Testing

Pure-function and data tests (fast, no browser):

1. **No OEM leak:** the full rendered HTML string contains none of the banned vendor terms (rendered DOM/text/alt), across all pages.
2. **No unverified scale claims:** rendered HTML contains no `30+`, `1000+`, `300+`, `Trusted Manufacturer Partner`, `Years of Experience`, `Global Installations`, `Research Institutions Served`.
3. **Evidence integrity:** every journal named in the evidence subtitle appears in `evidence.studies`; no bare flagship `Nature`; any displayed citation count has an `asOf`.
4. **Completeness:** exactly 11 products, each with a non-empty `specs`, a `-standardized.webp` image path that exists on disk, non-empty `bullets`.
5. **Spec-parity consistency (reverse-drift guard):** for products that also exist on the website, assert the Guide's screening-relevant values are consistent with the website config's `specifications.items` (e.g., ICP RF Power, gas lines, stage temp) — flags future drift between the two sources.

Generation smoke (script / manual, may run outside unit CI given Puppeteer weight):

6. Run `npm run generate-equipment-guide`; assert the output PDF exists, is non-trivial in size, and has the expected page count (~14). Then open it (Read/browser) to visually confirm the evidence page and standardized images.

## Phase 2 (deferred, noted only)

- Extend the same generator to emit the 11 per-product `public/docs/*.pdf` datasheets from the same canonical data.
- Consider having website product configs derive their `specifications.items` screening subset from the canonical data (reverse-reuse), collapsing the two sources into one.

## Open Items For User

- Studies 5–6 (ACS Applied Nano 2025, Scientific Reports 2025): include (verify DOIs) or trim the subtitle. Default: include + verify.
- Heading font: match the redesign's display face exactly (embed) vs. a close web-safe fallback. Default: web-safe fallback unless you want pixel-match.
