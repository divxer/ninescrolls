# Probe Station Products Card Image — Design

**Date:** 2026-07-12
**Status:** Approved

## Goal

Replace the overly abstract probe-station schematic used by the ProductsPage
category card with a more recognizable, original industrial product rendering.

## Visual Design

- Canvas: 1200 × 900 pixels, pure white background.
- Composition: centered three-quarter front view; equipment occupies roughly
  75% of the frame and remains legible at product-card thumbnail size.
- Subject: a generic wafer probe station with a dark-gray structural frame,
  microscope/camera assembly, circular wafer chuck, four micropositioner probe
  arms, control panel, and stable equipment base.
- Treatment: polished industrial product-photography realism, soft studio
  lighting, restrained shadow, and limited blue brand-color accents.
- Exclusions: no SEMISHARE logo, model number, text, watermark, people, lab
  clutter, copied OEM geometry, or implication that this is an actual product
  photograph.

## Deliverables

- Replace `public/assets/images/redesign/products/probe-station-schematic-standardized.png`.
- Regenerate the matching un-suffixed WebP used by ProductsPage.
- Keep both files at 1200 × 900 and preserve the existing asset paths so no
  application-code change is required.

## Acceptance Criteria

- The probe station is immediately recognizable at card size.
- Major elements do not clip and the subject is visually centered.
- The image has no text, logos, model identifiers, or watermark.
- The result is an original generic concept, not a replica of a SEMISHARE model.
- PNG and WebP render correctly at 1200 × 900.
