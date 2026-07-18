# Cryogenic Buyer's Guide Cover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the typography-only cryogenic buyer's-guide cover with a photographic, brand-correct 1600×900 hero while preserving the existing filename and responsive asset contract.

**Architecture:** Generate only the unbranded laboratory/instrument scene with ImageGen. Composite the exact title, subtitle, navy copy field, and unmodified repository logo deterministically with Sharp into a versioned candidate, then promote it to the formal filename only after visual approval. Use the existing optimization pipeline for responsive variants; visual review and automated asset tests gate replacement.

**Tech Stack:** built-in ImageGen, Node.js, Sharp, repository SVG logo, Vitest, `scripts/optimize-images.js`

## Global Constraints

- Keep the formal source filename exactly `public/assets/images/insights/cryo-buyers-guide-cover.png`.
- Execute in an isolated worktree attached to `feature/cryo-buyers-guide-article`, the PR #291 head branch; never commit implementation work from a detached HEAD. Cherry-pick the two reviewed documentation commits into that branch before implementation and push the final cover commit to the same branch before merge.
- Preserve a 1600×900, 16:9 canvas with approximately 43% copy area and 57% photographic area.
- Use exact copy: `Cryogenic Probe Station`, `Buyer’s Guide`, and `Architectures, Specifications, and an Acceptance-Ready RFQ`.
- Use the unmodified `public/assets/images/logo-with-text.svg` on a restrained pale translucent plaque; never tint, generate, or redraw the logo.
- Pin title typography to `src/templates/equipmentGuide/fonts/SpaceGrotesk-Variable.woff2` and supporting typography to `src/templates/equipmentGuide/fonts/Inter-Regular.woff2` / `Inter-SemiBold.woff2`.
- Show a generic cryogenic vacuum probe station, not a recognizable vendor product and not a conventional microscope.
- No temperature numbers, vendor logos, certification seals, guarantees, exaggerated frost, dense fog, or science-fiction effects.
- Replace the formal source only after visual approval; regenerate `sm`, `md`, `lg`, and `xl` PNG/WebP variants before commit.

---

### Task 0: Attach execution to the PR branch

**Files:**
- Integrate: `docs/superpowers/specs/2026-07-17-cryogenic-buyers-guide-cover-design.md`
- Integrate: `docs/superpowers/plans/2026-07-17-cryogenic-buyers-guide-cover.md`

**Interfaces:**
- Consumes: the reviewed documentation series on local ref `codex/cryo-cover-plan`, based on article commit `1730681a`.
- Produces: an isolated worktree whose HEAD is attached to `feature/cryo-buyers-guide-article`.

- [ ] **Step 1: Verify the PR branch and current shared checkout**

Run from the main repository:

```bash
git fetch origin
git branch --show-current
git rev-parse feature/cryo-buyers-guide-article
git rev-parse origin/feature/cryo-buyers-guide-article
```

Expected: the shared checkout remains `feature/quotation-pricebook`; local and remote cryogenic article branch SHAs match before creating the execution worktree.

- [ ] **Step 2: Create an attached execution worktree**

```bash
git worktree add /tmp/ninescrolls-cryo-cover-exec feature/cryo-buyers-guide-article
cd /tmp/ninescrolls-cryo-cover-exec
git symbolic-ref --short HEAD
```

Expected: `feature/cryo-buyers-guide-article`, never `HEAD` or a detached state.

- [ ] **Step 3: Integrate the reviewed design and plan**

```bash
git cherry-pick 1730681a..codex/cryo-cover-plan
git status --short
```

Expected: both documentation commits are now ancestors of the attached PR branch and the worktree is clean.

### Task 1: Generate and approve the unbranded scene

**Files:**
- Create: `tmp/cryo-cover/generated-scene.png`
- Create: `tmp/cryo-cover/cryo-buyers-guide-cover-v2.png`
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
- Consumes: `tmp/cryo-cover/generated-scene.png`, `public/assets/images/logo-with-text.svg`.
- Produces: deterministic `public/assets/images/insights/cryo-buyers-guide-cover.png`.

- [ ] **Step 1: Extend the asset test before replacement**

Add `import sharp from 'sharp';` with the existing imports, make the cover-asset test callback `async`, and add Sharp metadata assertions:

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
apply a navy left-to-right gradient over the left 43% for contrast
embed the repository Space Grotesk and Inter WOFF2 files in the SVG overlay
render the exact three text strings via that pinned SVG typography
render public/assets/images/logo-with-text.svg unmodified on a pale translucent plaque
convert the output to sRGB
write only to tmp/cryo-cover/cryo-buyers-guide-cover-v2.png
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

Expected: the versioned candidate is written as a 1600×900 sRGB PNG; the formal source remains untouched.

- [ ] **Step 5: Perform full-resolution visual QA**

Reject and iterate unless every item passes:

```text
title and subtitle match the approved copy exactly
the U+2019 curly apostrophe in “Buyer’s Guide” renders correctly, not as a missing-glyph box
the official logo geometry and original color are unchanged
title does not overlap the instrument and subtitle is not clipped
the chamber reads as a cryogenic probe station, not a microscope
the system does not resemble a recognizable vendor product
no temperature numbers, vendor marks, certification seals, guarantee language, watermark, exaggerated frost, dense fog, or science-fiction effects appear
the left copy field occupies approximately 43%, not 48%
embedded color profile/output colorspace is sRGB
```

- [ ] **Step 6: Promote the approved candidate to the formal filename**

Only after Step 5 passes:

```bash
cp tmp/cryo-cover/cryo-buyers-guide-cover-v2.png public/assets/images/insights/cryo-buyers-guide-cover.png
```

Expected: the approved candidate and formal source have identical SHA-256 hashes; the versioned candidate remains available until commit review completes.

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

Expected: only the compositor, article test, cover source, responsive cover variants, design specification, and implementation plan are changed; no unrelated checkout files appear. `git symbolic-ref --short HEAD` still returns `feature/cryo-buyers-guide-article`.

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

Expected: the commit is on `feature/cryo-buyers-guide-article` and is pushed to the PR #291 branch with `git push origin feature/cryo-buyers-guide-article`. Do not upload CDN assets before merge.

- [ ] **Step 5: Request code and visual review before pushing or replacing CDN assets**

Review the final branch diff and full-resolution image. Do not run the CDN upload until PR merge and the normal publishing cover-upload step.
