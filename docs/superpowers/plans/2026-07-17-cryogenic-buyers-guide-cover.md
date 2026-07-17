# Cryogenic Buyer's Guide Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the typography-only cryogenic buyer's-guide cover with a photographic, brand-correct 1600×900 hero while preserving the existing filename and responsive asset contract.

**Architecture:** Generate only the unbranded laboratory/instrument scene with ImageGen. Composite the exact title, subtitle, navy copy field, and repository logo deterministically with Sharp, then use the existing optimization pipeline for responsive variants. Visual review and automated asset tests gate replacement.

**Tech Stack:** built-in ImageGen, Node.js, Sharp, repository SVG logo, Vitest, `scripts/optimize-images.js`

## Global Constraints

- Keep the formal source filename exactly `public/assets/images/insights/cryo-buyers-guide-cover.png`.
- Preserve a 1600×900, 16:9 canvas with approximately 43% copy area and 57% photographic area.
- Use exact copy: `Cryogenic Probe Station`, `Buyer’s Guide`, and `Architectures, Specifications, and an Acceptance-Ready RFQ`.
- Use `public/assets/images/logo.svg`; never generate or redraw the logo.
- Show a generic cryogenic vacuum probe station, not a recognizable vendor product and not a conventional microscope.
- No temperature numbers, vendor logos, certification seals, guarantees, exaggerated frost, dense fog, or science-fiction effects.
- Replace the formal source only after visual approval; regenerate `sm`, `md`, `lg`, and `xl` PNG/WebP variants before commit.

---

### Task 1: Generate and approve the unbranded scene

**Files:**
- Create: `tmp/cryo-cover/generated-scene.png`
- Inspect: `public/assets/images/insights/cryo-buyers-guide-cover.png`

**Interfaces:**
- Consumes: the approved cover design specification.
- Produces: a text-free 1600×900 photographic scene with the instrument contained in the right 57%.

- [ ] **Step 1: Generate the scene with built-in ImageGen**

Use this exact prompt:

```text
Use case: product-mockup
Asset type: editorial hero background for a scientific equipment buyer's guide
Primary request: Create a photorealistic modern laboratory scene centered on a generic cryogenic vacuum probe station.
Subject: A sealed cryogenic sample chamber with a circular observation window, multiple precision probe manipulators entering the chamber, visible vacuum and cooling lines, and a subtle wafer/sample-stage reflection. It must read as a cryogenic vacuum probe station, not as a conventional microscope.
Composition/framing: 16:9 wide frame. Keep the left 43 percent dark, quiet, and free of equipment for later typography. Place the complete instrument in the right 57 percent without cropping critical parts.
Lighting/mood: restrained cool-blue laboratory lighting, subtle cyan highlights, blue-violet wafer reflection, premium scientific editorial photography.
Constraints: no text, no logos, no numbers, no labels, no recognizable commercial product geometry, no people.
Avoid: ordinary microscope, open-air probe station, exaggerated frost, dense nitrogen fog, science-fiction machinery, certification seals, watermark.
```

- [ ] **Step 2: Save the selected output non-destructively**

Copy the selected built-in output to:

```text
tmp/cryo-cover/generated-scene.png
```

- [ ] **Step 3: Inspect the scene**

Open it at full resolution and reject it unless all of these are true:

```text
generic enclosed cryogenic chamber present
probe manipulators visibly connect to the chamber
vacuum/cooling lines present
no generated text or logo
no recognizable vendor model
left copy field remains quiet
```

### Task 2: Composite exact branding and replace the source

**Files:**
- Create: `scripts/generate-cryo-buyers-guide-cover.mjs`
- Modify: `public/assets/images/insights/cryo-buyers-guide-cover.png`
- Test: `src/pages/probeStations/cryoBuyersGuideArticle.test.ts`

**Interfaces:**
- Consumes: `tmp/cryo-cover/generated-scene.png`, `public/assets/images/logo.svg`.
- Produces: deterministic `public/assets/images/insights/cryo-buyers-guide-cover.png`.

- [ ] **Step 1: Extend the asset test before replacement**

Add Sharp metadata assertions to the existing cover-asset test:

```ts
const coverMeta = await sharp('public/assets/images/insights/cryo-buyers-guide-cover.png').metadata();
expect(coverMeta.width).toBe(1600);
expect(coverMeta.height).toBe(900);
```

- [ ] **Step 2: Run the targeted test to establish the current baseline**

Run:

```bash
npx vitest run src/pages/probeStations/cryoBuyersGuideArticle.test.ts
```

Expected: PASS before replacement; these assertions protect dimensions during generation.

- [ ] **Step 3: Create the deterministic compositor**

Implement `scripts/generate-cryo-buyers-guide-cover.mjs` with Sharp. It must:

```text
resize/crop generated-scene.png to 1600×900
apply a navy left-to-right gradient over the left 48% for contrast
render the exact three text strings via an SVG overlay
render public/assets/images/logo.svg at the upper left, tinted light blue
write only to public/assets/images/insights/cryo-buyers-guide-cover.png
```

Use these layout constants:

```js
const canvas = { width: 1600, height: 900 };
const left = 70;
const logo = { x: 70, y: 55, width: 44, height: 42 };
const title = { x: 70, y: 300, size: 76, lineHeight: 92 };
const subtitle = { x: 72, y: 565, size: 31, maxWidth: 610 };
const colors = { navy: '#071b31', white: '#f8fbff', blue: '#4aa8f5', muted: '#c8d8eb' };
```

- [ ] **Step 4: Run the compositor**

Run:

```bash
node scripts/generate-cryo-buyers-guide-cover.mjs tmp/cryo-cover/generated-scene.png
```

Expected: the formal source is rewritten as a 1600×900 PNG with exact deterministic copy.

- [ ] **Step 5: Perform full-resolution visual QA**

Reject and iterate if the title overlaps the instrument, the subtitle is clipped, the logo is distorted, the chamber reads as a microscope, or the system resembles a named vendor product.

### Task 3: Generate responsive assets and verify the article contract

**Files:**
- Modify: `public/assets/images/insights/cryo-buyers-guide-cover-{sm,md,lg,xl}.{png,webp}`
- Test: `src/pages/probeStations/cryoBuyersGuideArticle.test.ts`

**Interfaces:**
- Consumes: approved 1600×900 formal source.
- Produces: responsive assets accepted by the existing article and upload pipeline.

- [ ] **Step 1: Generate responsive variants**

Run:

```bash
node scripts/optimize-images.js public/assets/images/insights/cryo-buyers-guide-cover.png
```

Expected: eight regenerated `sm/md/lg/xl` PNG/WebP files.

- [ ] **Step 2: Run targeted tests**

Run:

```bash
npx vitest run src/pages/probeStations/cryoBuyersGuideArticle.test.ts src/pages/probeStations/CryogenicProbingPage.test.tsx
```

Expected: all tests pass.

- [ ] **Step 3: Verify the final diff**

Run:

```bash
git diff --check
git status --short
```

Expected: only the compositor, article test, cover source, responsive cover variants, design specification, and implementation plan are changed; no unrelated checkout files appear.

- [ ] **Step 4: Commit the cover implementation**

```bash
git add scripts/generate-cryo-buyers-guide-cover.mjs \
  src/pages/probeStations/cryoBuyersGuideArticle.test.ts \
  public/assets/images/insights/cryo-buyers-guide-cover*.png \
  public/assets/images/insights/cryo-buyers-guide-cover*.webp \
  docs/superpowers/specs/2026-07-17-cryogenic-buyers-guide-cover-design.md \
  docs/superpowers/plans/2026-07-17-cryogenic-buyers-guide-cover.md
git commit -m "feat(article): upgrade cryogenic buyer guide cover"
```

- [ ] **Step 5: Request code and visual review before pushing or replacing CDN assets**

Review the final branch diff and full-resolution image. Do not run the CDN upload until PR merge and the normal publishing cover-upload step.
