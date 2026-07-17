# Cryogenic Probe Station Buyer's Guide Cover Design

## Purpose

Replace the current typography-only cover with a publication-grade hero that immediately reads as cryogenic probe-station procurement while remaining neutral, editorial, and consistent with the NineScrolls Insights visual system.

## Composition

- Canvas: 1600 × 900 pixels, 16:9.
- Left 43%: dark navy copy field with generous margins and strong thumbnail legibility.
- Right 57%: a realistic cryogenic vacuum probe station in a modern laboratory.
- Equipment cues: enclosed cryogenic chamber, observation window, probe arms, wafer/sample stage, vacuum and cooling lines.
- Background: softly defocused laboratory, visually subordinate to the instrument.
- Lighting: restrained cool-blue laboratory light with cyan accents and blue-violet wafer reflections.
- Avoid exaggerated frost, dense liquid-nitrogen fog, science-fiction effects, or a conventional microscope presented as a cryogenic station.

## Copy and Branding

- Primary title, verbatim:
  - `Cryogenic Probe Station`
  - `Buyer’s Guide`
- Subtitle, verbatim: `Architectures, Specifications, and an Acceptance-Ready RFQ`
- Use the correct repository NineScrolls logo at the upper left, smaller and quieter than the title.
- Render title, subtitle, and logo deterministically after image generation so spelling and brand geometry remain exact.
- Do not show vendor logos, product model names, temperature figures, certification seals, or guaranteed-performance language.

## Production Method

1. Generate the photographic right-side laboratory/instrument scene without embedded text or logos.
2. Inspect the generated scene for plausible probe-station geometry and absence of proprietary product resemblance.
3. Composite the approved scene with the navy copy field, exact typography, and repository logo.
4. Save non-destructively as a versioned source image before replacing the article's formal cover.
5. Produce the established `sm`, `md`, `lg`, and `xl` PNG/WebP responsive variants with the repository image pipeline.

## Acceptance Criteria

- The instrument reads as a cryogenic vacuum probe station at thumbnail and full size.
- All exact copy is correct and remains legible at responsive sizes.
- The correct NineScrolls logo is used; no generated approximation is accepted.
- The composition remains balanced at approximately 43/57 copy-to-image coverage.
- No brand-specific performance implication or prohibited regulatory/commercial wording appears.
- Source and responsive assets decode correctly, preserve 16:9 framing, and pass existing article asset tests.
