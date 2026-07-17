# Cryogenic Cooling Architecture Figure Design

## Purpose

Replace the existing three-card comparison with a publication-grade editorial figure that explains each cooling architecture's thermal path and lets buyers compare operating trade-offs on shared axes.

## Composition

- Canvas: 1600 × 900 pixels, 16:9, sRGB.
- Header: deep-navy band with the title `Three Cryogenic Cooling Architectures` and subtitle `Thermal paths and operating trade-offs for probe-station evaluation`.
- Body: light editorial field with three equal architecture columns and no product-card framing.
- Upper body: one simplified thermal-path diagram per architecture, using a single dark-blue outline icon system and thin directional arrows.
- Lower body: a shared four-row comparison matrix aligned across the three columns.

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
- The PIL generator must not load WOFF2 directly. Use fontTools to convert WOFF2 to temporary TTF files, then load those TTF files with PIL.
- Before drawing, assert the converted font cmap contains U+2082 (`₂`) and U+2019 (`’`).
- Use correct LN₂ and LHe typography.
- Use uniform outline icons and thin arrows; do not draw real products or recognizable vendor equipment.
- Do not include brand names, certification marks, guarantees, or product performance claims.
- Footer inside the image: `Illustrative comparison. Actual stage temperature depends on heat load, thermal links, and configuration.`
- The image footer is supplemental. The adjacent HTML `<figcaption>` must remain present and continue to contain `Illustrative comparison`.

## HTML Alt Text

Replace the current figure alt with exactly:

```text
Comparison diagram of liquid-nitrogen flow or reservoir, closed-cycle cryocooler, and liquid-helium flow or bath architectures, showing thermal paths, consumables and utilities, mechanical vibration sources, operating patterns, and buyer questions
```

The alt contains no Kelvin figures, spelled temperature values, capability verbs, or guarantee wording and must pass `src/pages/probeStations/cryoBuyersGuideArticle.test.ts`.

## Asset and Integration Contract

- Generate a versioned candidate first; promote it only after full-size and small-size visual QA.
- Preserve the formal source filename `public/assets/images/insights/cryo-cooling-architectures.png`.
- Regenerate and commit all eight responsive variants: sm/md/lg/xl PNG and WebP.
- Validate all nine assets for decoding, expected dimensions, and sRGB.
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
