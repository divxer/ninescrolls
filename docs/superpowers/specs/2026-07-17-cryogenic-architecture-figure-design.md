# Cryogenic Cooling Architecture Figure Design

## Purpose

Replace the existing three-card comparison with a publication-grade editorial figure that explains each cooling architecture's thermal path and lets buyers compare operating trade-offs on shared axes.

## Composition

- Canvas: 1600 × 900 pixels, 16:9, sRGB.
- Header: deep-navy `#1e3a5f` band occupying 18% of the canvas height, with the title `Three Cryogenic Cooling Architectures` and subtitle `Thermal paths and operating trade-offs for probe-station evaluation`.
- Body: light editorial field with three equal architecture columns and no product-card framing.
- Upper body: 42% of the body height, with one simplified thermal-path diagram per architecture using a single dark-blue outline icon system, `#3b82f6` accents, and thin directional arrows.
- Lower body: 58% of the body height, with a shared four-row comparison matrix aligned across the three columns; the footer is contained within this allocation.

## Thermal Paths

### LN₂ flow / reservoir

- Path: Dewar → flow or reservoir → sample stage.
- Reference: `77.4 K normal boiling-point reference`.

### Closed-cycle cryocooler

- Path: Compressor → cold head → thermal link → sample stage.
- Reference: `No liquid-cryogen refill during operation`.

### LHe flow / bath

- Path: Dewar → flow or bath → sample stage.
- Reference: `4.2 K normal boiling-point reference`.

The two Kelvin values are physical cryogen references, never stage-temperature or product-capability claims. The figure deliberately omits `10 K-class` to avoid information overload and category/product ambiguity.

## Comparison Matrix

| Evaluation axis | LN₂ | Closed cycle | LHe |
|---|---|---|---|
| Consumables / utilities | Dewar and refills | Electricity; cooling water or air | Helium supply; recovery planning |
| Mechanical vibration source | No mechanical cryocooler | Compressor / cold-head motion | No mechanical cryocooler |
| Operating pattern | Moderate low-temperature work | Long-running operation without cryogen refills | Lowest-temperature work in this comparison |
| Buyer’s key question | Local supply and refill cadence | Vibration at the sample under load | Recovery and supply contingency |

## Visual and Typography Rules

- Use `src/templates/equipmentGuide/fonts/SpaceGrotesk-Variable.woff2` for headings and the Inter WOFF2 files in the same directory for supporting copy.
- Implement the deterministic renderer at `scripts/generate-cryo-architecture-figure.py`.
- The PIL generator must not load WOFF2 directly. Use fontTools to convert WOFF2 to temporary TTF files, then load those TTF files with PIL.
- Before drawing, assert the converted font cmap contains U+2082 (`₂`) and U+2019 (`’`).
- Use correct LN₂ and LHe typography.
- Use uniform outline icons and thin arrows; do not draw real products or recognizable vendor equipment.
- Do not include brand names, certification marks, guarantees, or product performance claims.
- Footer inside the image: `Illustrative comparison. Actual stage temperature depends on heat load, thermal links, and configuration.`
- The image footer is supplemental. The adjacent HTML `<figcaption>` must remain present and continue to match `illustrative comparison` case-insensitively; its current `An illustrative comparison…` wording must not be changed merely to match the image footer's capitalization.

## HTML Alt Text

Replace the current figure alt with exactly:

```text
Comparison diagram of liquid-nitrogen flow or reservoir, closed-cycle cryocooler, and liquid-helium flow or bath architectures, showing thermal paths, consumables and utilities, mechanical vibration sources, operating patterns, and buyer questions
```

The alt contains no Kelvin figures, spelled temperature values, capability verbs, or guarantee wording and must pass `src/pages/probeStations/cryoBuyersGuideArticle.test.ts`.

## Asset and Integration Contract

- Generate the versioned candidate first at `public/assets/images/insights/cryo-cooling-architectures.v2-candidate.png`; promote it to the formal source only after full-size and small-size visual QA, then remove the candidate before committing.
- Preserve the formal source filename `public/assets/images/insights/cryo-cooling-architectures.png`.
- Regenerate all eight responsive variants with the repository's established optimizer, not hand-written resize logic:

```bash
npm run optimize-images -- public/assets/images/insights/cryo-cooling-architectures.png
```

  This delegates to `scripts/optimize-images.js`, preserving its width-only `fit: 'contain'` resize behavior and WebP quality 80. Commit the resulting sm/md/lg/xl PNG and WebP variants.
- Extend `src/pages/probeStations/cryoBuyersGuideArticle.test.ts` with Sharp metadata assertions for the formal source and all eight `cryo-cooling-architectures-*` variants. The assertions must verify decoding, exact 16:9 dimensions, and `metadata().space === 'srgb'`, providing an executable acceptance gate rather than relying on manual inspection.
- Record old checksums before regeneration and require all eight responsive checksums to change after regeneration so stale assets cannot pass existence-only checks.
- Commit the source, eight variants, generator, HTML alt update, and tests to `feature/cryo-buyers-guide-article` in PR #291.
- Do not upload during implementation. During the first publication workflow, upload the inline figure exactly once with:

```bash
npx tsx scripts/upload-insights-image.ts \
  cryogenic-probe-station-buyers-guide \
  public/assets/images/insights/cryo-cooling-architectures.png \
  --name cooling-architectures \
  --no-update-cover
```

The explicit name preserves the HTML CDN key `cooling-architectures-*`; `--no-update-cover` prevents the inline figure from replacing the article's cover `imageUrl`.

## Acceptance Criteria

- The thermal paths are physically understandable without reading the article.
- The twelve matrix cells match this specification verbatim or with layout-only line breaks.
- Kelvin values appear only as normal boiling-point references.
- U+2082 and U+2019 render as real glyphs, not fallback boxes.
- The HTML alt is exact and the adjacent figcaption remains valid.
- Source and all responsive variants decode, have the expected 16:9 dimensions, report sRGB, and are newly generated.
- Article guard tests and application-page tests pass.
- No CDN upload, cover update, or main-branch mutation occurs during implementation.
