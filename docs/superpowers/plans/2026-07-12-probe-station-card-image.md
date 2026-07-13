# Probe Station Products Card Image Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abstract ProductsPage probe-station card graphic with an original, recognizable industrial product rendering.

**Architecture:** Edit the existing PNG with the built-in image-generation workflow, preserving its 1200×900 canvas and project path. Convert the approved PNG to an un-suffixed WebP with Sharp, then verify dimensions, file integrity, thumbnail legibility, and the existing ProductsPage reference.

**Tech Stack:** Built-in image generation, PNG, Sharp/WebP, ImageMagick inspection, Vitest.

## Global Constraints

- Pure white 1200×900 canvas; centered three-quarter front view.
- Generic wafer probe station only: dark-gray frame, microscope/camera, circular chuck, four micropositioner probe arms, control panel, stable base.
- Polished industrial product-photography realism with restrained blue accents.
- No SEMISHARE logo, model number, text, watermark, people, lab clutter, or copied OEM geometry.
- Preserve the existing PNG and WebP paths; no application-code change.

---

### Task 1: Generate and validate the replacement card image

**Files:**
- Modify: `public/assets/images/redesign/products/probe-station-schematic-standardized.png`
- Modify: `public/assets/images/redesign/products/probe-station-schematic-standardized.webp`
- Test: `src/pages/ProductsPage.test.tsx`

**Interfaces:**
- Consumes: the existing ProductsPage image path `/assets/images/redesign/products/probe-station-schematic-standardized.webp`.
- Produces: visually approved 1200×900 PNG and WebP assets at the same paths.

- [ ] **Step 1: Inspect the existing image and surrounding product-card assets**

Open the current PNG at original resolution and compare its framing with two adjacent `*-standardized.webp` product-card assets. Confirm the target remains a white-background, centered catalog image.

- [ ] **Step 2: Generate the edited PNG**

Use the current PNG as the edit target. Prompt for a generic, original wafer probe station in a centered three-quarter product-photography view, following every Global Constraint. Generate without text or branding.

- [ ] **Step 3: Inspect at full size and thumbnail size**

Open the generated PNG at full size. Create a temporary 320×240 preview with ImageMagick and inspect it. Reject and regenerate if the chuck, microscope, and probe arms are not immediately recognizable or if any element is clipped.

- [ ] **Step 4: Replace the PNG and create the WebP**

Save the selected PNG to the existing project path, then run:

```bash
node -e "require('sharp')('public/assets/images/redesign/products/probe-station-schematic-standardized.png').resize(1200,900,{fit:'cover'}).png().toFile('/tmp/probe-station-card.png').then(() => require('sharp')('/tmp/probe-station-card.png').webp({quality:82}).toFile('public/assets/images/redesign/products/probe-station-schematic-standardized.webp'))"
mv /tmp/probe-station-card.png public/assets/images/redesign/products/probe-station-schematic-standardized.png
```

- [ ] **Step 5: Verify dimensions, formats, and consuming test**

Run:

```bash
identify public/assets/images/redesign/products/probe-station-schematic-standardized.png public/assets/images/redesign/products/probe-station-schematic-standardized.webp
npx vitest run src/pages/ProductsPage.test.tsx --exclude '**/.claude/**'
```

Expected: both images report 1200×900; ProductsPage tests pass and continue referencing the existing WebP path.

- [ ] **Step 6: Commit**

```bash
git add public/assets/images/redesign/products/probe-station-schematic-standardized.png public/assets/images/redesign/products/probe-station-schematic-standardized.webp
git commit -m "assets(probe-stations): improve products card rendering"
```
