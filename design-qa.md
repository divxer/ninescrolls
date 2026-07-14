**Findings**
- No blocking P0/P1/P2 findings remain.

**Open Questions**
- The source visual target used a more product-rendered hero machine and small metric icons. The implementation now separates brand imagery from product imagery: the homepage hero uses the approved plasma/wafer/fab brand image, while product cards use real NineScrolls equipment images normalized onto a clean technical-render canvas.
- The final implementation follows the later user-approved refinements: solution-oriented hero copy, simplified navigation, process-led interaction, product cards focused on positioning rather than detailed specs, and a mobile CTA-visible hero.

**Implementation Checklist**
- Source visual truth path: `/Users/harvey/.codex/generated_images/019f2807-cf52-75a3-a806-7cff54fbcdbc/ig_015f5e1685ed8b11016a47b2b14da881999ab6c755f40e1b33.png`
- Implementation desktop screenshot path: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/ninescrolls-redesign-desktop-clean.png`
- Implementation mobile screenshot path: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/ninescrolls-redesign-mobile-viewport-v4.png`
- Process interaction screenshot path: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/ninescrolls-redesign-process-panel.png`
- Product anchor screenshot path: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/ninescrolls-redesign-products-anchor.png`
- Final asset contact sheet path: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/real-product-images/processed/final-redesign-assets-contact-sheet.jpg`
- Full-view comparison evidence: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/source-vs-implementation.html`
- Viewport: desktop `1440 x 1000`, mobile `390 x 844`.
- State: public homepage, cookie banner dismissed for desktop/mobile clean screenshots; Thin Film Deposition selected for process interaction.
- Fonts and typography: Headlines use the site-standard `font-headline` (Space Grotesk) for consistency with the rest of the site; body copy uses `font-body` (Inter); metrics/spec-like labels use mono styling. The homepage does not alter the global font tokens. Mobile headline was reduced after screenshot QA so text no longer collides with the chat widget and CTA remains visible in the first viewport.
- Spacing and layout rhythm: Desktop hero, metrics, process, applications, products, research, knowledge, proof strip, and final CTA follow the approved story sequence. Section anchors include `scroll-mt-24` to avoid sticky-header clipping.
- Colors and visual tokens: The Precision White palette (`#FAFAFA` background, white surfaces, slate text, restrained sky-blue accent) is applied via homepage-local classes — the global `app.css` theme tokens were intentionally left unchanged so no other page is affected. Dark treatment is limited to hero/final CTA.
- Image quality and asset fidelity: Product visuals use real NineScrolls equipment images pulled from the existing product/CDN paths and normalized into `/assets/images/redesign/products/*-technical-render.jpg`. Generated equipment concepts were used only as style exploration, not as final product imagery.
- Review follow-up: process capability buttons now expose `aria-pressed`, homepage JSON-LD declares English only, the hero image is served through a preloaded WebP with JPEG fallback, global theme token changes were scoped back out of this homepage pass, and the non-homepage `HeroCleanroomBackground` drive-by change was reverted.
- Product platform follow-up: the featured ICP-RIE card no longer creates a non-functional two-row void. The card now uses a full-height product photography column, a larger real equipment image, key specifications, and a Learn More affordance. Latest product-section evidence: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/products-section-featured-specs-final.png`
- Secondary platform card follow-up: non-featured cards now keep a lighter hierarchy with natural `self-start` height, a larger image region, and a full-width `View Platform` footer instead of duplicating the featured specs block. Latest evidence: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/products-section-secondary-cards-balanced.png`
- Final CTA follow-up: the closing section keeps the dark conversion moment but now uses a viewport-focused chamber crop instead of a full dark hero image. The right side has a recognizable flange/viewport silhouette, local cold-white/cyan rim contrast, wafer rim highlight, engineering-grid texture, left-aligned buttons, and four trust signals. Latest evidence: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/final-cta-viewport-crop.png`
- Product image replacement: homepage product cards now use the six downloaded real-equipment candidates as standardized 1200x900 WebP/JPG assets, mapped to ICP-RIE, RIE, PECVD, ALD, Sputter, and IBE/RIBE. Product wells use a shared `#F4F5F7` thumbnail background, a larger featured ICP scale, and tighter secondary thumbnails to reduce double whitespace while preserving the product-family look. Latest evidence: `/Users/harvey/Dev/src/cursor/ninescrolls/tmp/product-design/products-section-thumbnail-spec-balanced.png`
- Copy and content: Hero copy, process-led positioning, trust metrics, peer-reviewed validation, Knowledge Center, and CTA text match the confirmed redesign direction.
- Patches made since previous QA pass: reduced mobile hero type/spacing, made CTA visible on mobile, added `aria-label` for process buttons, fixed hash-section navigation, changed global design tokens, simplified nav labels.

**Follow-up Polish**
- [P3] Source higher-resolution CAD/photo exports for each real equipment platform if NineScrolls wants sharper product cards at large desktop sizes.
- [P3] Add lightweight metric icons if the brand wants closer fidelity to the source visual target.
- [P3] Consider repositioning or suppressing the third-party chat bubble on the homepage hero for an even cleaner mobile first impression.

final result: passed

---

# Quotation Workbench — Design QA

Status: **PASS**
Reviewed: 2026-07-14
Reference: `/Users/harvey/.codex/generated_images/019f5ea1-79a6-70b1-be6b-cc2c3ccf9110/exec-1a57fc6d-0aa8-4345-bc2e-72c954649ae8.png`

## Visual comparison

- Reference and implementation were compared side by side at approximately 1488 × 1057.
- Implementation capture: `.superpowers/sdd/quotation-workbench-qa.png`.
- Combined comparison: `.superpowers/sdd/quotation-workbench-comparison.png`.
- The implementation preserves the selected information architecture: compact header, grouped Pricing / Catalog / Validity context, BOM-centered table, collapsed validation affordance, sticky total, and compact bottom summary.
- Existing NineScrolls admin navigation, typography, color tokens, light/dark themes, and real ICP-RIE product artwork are retained.

## Responsive and interaction checks

- 1488 × 1057 desktop: all BOM pricing columns, `% of Quote`, totals, and summary are visible without page-level horizontal overflow.
- 1366 × 768 laptop: Validation opens as an overlay drawer and does not force the BOM/table wider; measured page overflow was zero.
- Catalog search matched SKU/supplier-code data and added the selected service rather than a fallback item.
- Adding a line with unknown cost propagated `—` through totals and margin instead of treating unknown as zero.
- Inline actual-price editing displayed live same-row margin impact.
- Validation identified the exact EXPIRING and MISSING lines.
- Positive and negative cost deltas used distinct risk/savings colors.
- Preview remained disabled with the required PDF-template tooltip.

## Final corrections made during QA

- Replaced the incorrect customer-name content in the Pricing context with Exchange, Target Margin, and Minimum Margin from the saved policy snapshot/current policy.
- Kept customer editing in the compact header.
- Added the compact pricing-adjustment reason field.
- Corrected manual-override serialization so authoritative actual prices are not falsely submitted as overrides, while real edits always carry a resolver-valid reason.
- Added an exact, development-only fixture route for authenticated visual QA; production builds remove the route branch and fixture data, confirmed by marker scan.

## Result

The workbench is visually and behaviorally ready for P1 implementation use. No blocking visual, responsive, or accessibility issue remains from this review.
