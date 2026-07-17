# Cryogenic Cooling Architecture Figure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cryogenic buyer's guide's existing architecture image with a publication-grade thermal-path and comparison-matrix figure while preserving article and image-delivery contracts.

**Architecture:** A deterministic Python/PIL renderer converts repository WOFF2 fonts to temporary TTF files with fontTools, validates required glyphs, and writes a versioned 1600 × 900 sRGB candidate. After visual QA, the candidate becomes the formal PNG, the repository optimizer regenerates eight variants, and Vitest/Sharp assertions enforce alt text, dimensions, decoding, colorspace, and caption continuity.

**Tech Stack:** Python 3.12, Pillow, fontTools, TypeScript, Vitest, Sharp, Node.js.

## Global Constraints

- Work only on `feature/cryo-buyers-guide-article` in the PR #291 worktree; do not mutate `main` or the primary checkout.
- Canvas: exactly 1600 × 900, 16:9, sRGB. Header `#1e3a5f`; accent `#3b82f6`; header 18% of canvas; body 42% thermal paths / 58% matrix plus footer.
- Kelvin values may appear only as `77.4 K normal boiling-point reference` and `4.2 K normal boiling-point reference`, never as product or stage-temperature claims.
- Do not add brands, recognizable products, certification marks, guarantees, `10 K-class`, or product-performance claims.
- Preserve the existing figcaption and its case-insensitive `illustrative comparison` statement.
- Generate `cryo-cooling-architectures.v2-candidate.png` first; promote only after native and 640 × 360 QA, then remove it.
- Generate variants only with `scripts/optimize-images.js`; do not alter its width-only `fit: 'contain'` or WebP quality 80 conventions.
- Do not upload to CDN or update the article cover during implementation.

---

## File Structure

- Create `scripts/generate-cryo-architecture-figure.py`: font conversion, glyph validation, layout, icon drawing, wrapping, and sRGB candidate output.
- Modify `src/pages/probeStations/cryoBuyersGuideArticle.test.ts`: exact alt and Sharp metadata gates.
- Modify `scripts/articles/cryogenic-probe-station-buyers-guide.html`: replace only the figure alt.
- Replace `public/assets/images/insights/cryo-cooling-architectures.png` and its eight sm/md/lg/xl PNG/WebP variants.

### Task 1: Add the Failing Article and Asset Contract

**Files:**
- Modify: `src/pages/probeStations/cryoBuyersGuideArticle.test.ts:47-112`
- Test: `src/pages/probeStations/cryoBuyersGuideArticle.test.ts`

**Interfaces:**
- Consumes: existing `content`, `pictureBlocks`, `sharp`, and asset naming convention.
- Produces: `FIGURE_ALT`, `figureSizes`, and executable source/variant metadata gates.

- [ ] **Step 1: Record old responsive checksums**

```bash
shasum -a 256 public/assets/images/insights/cryo-cooling-architectures-{sm,md,lg,xl}.{png,webp} \
  | tee /tmp/cryo-cooling-architectures.before.sha256
```

Expected: eight lines saved outside the worktree.

- [ ] **Step 2: Add the exact alt and dimensions contract**

Beside the test's `CDN`, add:

```ts
const FIGURE_ALT = 'Comparison diagram of liquid-nitrogen flow or reservoir, closed-cycle cryocooler, and liquid-helium flow or bath architectures, showing thermal paths, consumables and utilities, mechanical vibration sources, operating patterns, and buyer questions';
const figureSizes = { sm: [640, 360], md: [768, 432], lg: [1024, 576], xl: [1280, 720] } as const;
```

After finding `block`, add:

```ts
expect(block, `${name} exact approved alt`).toContain(`alt="${FIGURE_ALT}"`);
```

After the local source existence check, add:

```ts
const sourcePath = `public/assets/images/insights/${localBase}.png`;
const sourceMeta = await sharp(sourcePath).metadata();
expect(sourceMeta.width).toBe(1600);
expect(sourceMeta.height).toBe(900);
expect(sourceMeta.space).toBe('srgb');
for (const [size, [width, height]] of Object.entries(figureSizes)) {
  for (const extension of ['png', 'webp']) {
    const variantPath = `public/assets/images/insights/${localBase}-${size}.${extension}`;
    const meta = await sharp(variantPath).metadata();
    expect(meta.width, `${size}.${extension} width`).toBe(width);
    expect(meta.height, `${size}.${extension} height`).toBe(height);
    expect(meta.space, `${size}.${extension} colorspace`).toBe('srgb');
  }
}
```

Do not alter the existing `/illustrative comparison/i` assertion.

- [ ] **Step 3: Verify the new test fails on the old alt**

```bash
npx vitest run src/pages/probeStations/cryoBuyersGuideArticle.test.ts
```

Expected: FAIL at `cooling-architectures exact approved alt`, with no syntax error.

### Task 2: Build and Visually Qualify the Candidate

**Files:**
- Create: `scripts/generate-cryo-architecture-figure.py`
- Create temporarily: `public/assets/images/insights/cryo-cooling-architectures.v2-candidate.png`

**Interfaces:**
- Consumes: repository WOFF2 fonts and fixed design copy.
- Produces: `main() -> None`; helpers `convert_font`, `fit_text`, `draw_icon`, `draw_path`, and `draw_matrix`; versioned candidate only.

- [ ] **Step 1: Implement deterministic font and copy inputs**

Use these exact constants and data structures:

```python
from pathlib import Path
from tempfile import TemporaryDirectory
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / 'src/templates/equipmentGuide/fonts'
OUT = ROOT / 'public/assets/images/insights/cryo-cooling-architectures.v2-candidate.png'
W, H = 1600, 900
NAVY, ACCENT, INK = '#1e3a5f', '#3b82f6', '#17324d'
MUTED, FIELD, WHITE, RULE = '#5c7085', '#f6f9fc', '#ffffff', '#d6e2ec'
HEADER_BOTTOM, THERMAL_BOTTOM, MATRIX_BOTTOM = 162, 472, 844
ROWS = ['CONSUMABLES / UTILITIES', 'MECHANICAL VIBRATION SOURCE',
        'OPERATING PATTERN', 'BUYER’S KEY QUESTION']
ARCHITECTURES = [
 {'title':'LN₂ flow / reservoir','path':['Dewar','Flow or reservoir','Sample stage'],
  'reference':'77.4 K normal boiling-point reference',
  'cells':['Dewar and refills','No mechanical cryocooler','Moderate low-temperature work','Local supply and refill cadence'],
  'icons':['dewar','reservoir','stage']},
 {'title':'Closed-cycle cryocooler','path':['Compressor','Cold head','Thermal link','Sample stage'],
  'reference':'No liquid-cryogen refill during operation',
  'cells':['Electricity; cooling water or air','Compressor / cold-head motion','Long-running operation without cryogen refills','Vibration at the sample under load'],
  'icons':['compressor','cold_head','thermal_link','stage']},
 {'title':'LHe flow / bath','path':['Dewar','Flow or bath','Sample stage'],
  'reference':'4.2 K normal boiling-point reference',
  'cells':['Helium supply; recovery planning','No mechanical cryocooler','Lowest-temperature work in this comparison','Recovery and supply contingency'],
  'icons':['dewar','bath','stage']},
]
FOOTER = ('Illustrative comparison. Actual stage temperature depends on heat load, '
          'thermal links, and configuration.')
```

`convert_font(source, target)` must load `TTFont(source)`, set `flavor = None`, assert `0x2082` and `0x2019` are in `getBestCmap()`, and save the temporary TTF. Convert Space Grotesk Variable and Inter Regular/Medium/SemiBold inside `TemporaryDirectory`; raise `RuntimeError` naming a missing code point rather than falling back.

- [ ] **Step 2: Implement the fixed layout and icon grammar**

Use Pillow primitives only. Icons occupy 56 × 56 boxes, use `INK` 3-pixel strokes, and sit on pale `#e8f1ff` discs. Meanings are fixed:

```text
dewar: tall rounded vessel, neck, two bands
reservoir: rounded chamber, inlet and outlet stubs
bath: open vessel, horizontal liquid level
compressor: rounded housing, central fan and four blades
cold_head: stepped vertical cylinder, two stages
thermal_link: two parallel curves joining terminal bars
stage: thin platform over circular wafer outline
```

Header title `(72,38)`, size 46 Space Grotesk; subtitle `(74,105)`, size 22 Inter. Architecture columns are `(250,690)`, `(700,1140)`, `(1150,1590)`; left 230 pixels are matrix row labels. Center headings at y=196, path nodes at y=246-374, references at y=421. Connect nodes with 2-pixel accent arrows.

Matrix rows run y=490-816 with heights `[78,78,88,82]`; alternate `#ffffff` / `#eef4f9`, with horizontal `RULE` separators only. Wrap cells at 18 pixels minimum and 1.25 line spacing. Footer starts `(72,862)`, size 15 Inter. `fit_text(...)` must reduce font size until text fits its explicit box and raise `ValueError` instead of clipping.

Save an RGB PNG with:

```python
image.save(OUT, format='PNG', optimize=True, icc_profile=None)
with Image.open(OUT) as check:
    assert check.size == (1600, 900)
    assert check.mode == 'RGB'
```

- [ ] **Step 3: Generate the candidate**

```bash
/Users/harvey/miniforge3/bin/python scripts/generate-cryo-architecture-figure.py
```

Expected: exits 0, prints the candidate path, and leaves no TTF in the repository.

- [ ] **Step 4: Inspect native and 640 × 360 renders**

Verify: three paths read left-to-right; all 12 cells are present/aligned; no clipping; `LN₂` and `Buyer’s` are real glyphs; only two approved numbers occur; no brand/product/certification/guarantee/`10 K-class`; footer is legible at 640 × 360; layout does not read as three product cards. If any check fails, edit only the renderer and repeat Steps 3-4.

### Task 3: Promote, Integrate, and Regenerate

**Files:**
- Modify: `scripts/articles/cryogenic-probe-station-buyers-guide.html:49`
- Replace: formal source and eight responsive assets
- Remove: candidate

**Interfaces:**
- Consumes: visually approved candidate and Task 1 gates.
- Produces: formal source, exact alt, and eight optimizer-generated variants.

- [ ] **Step 1: Promote and remove the candidate**

```bash
cp public/assets/images/insights/cryo-cooling-architectures.v2-candidate.png public/assets/images/insights/cryo-cooling-architectures.png
rm public/assets/images/insights/cryo-cooling-architectures.v2-candidate.png
```

- [ ] **Step 2: Replace only the image alt**

Use exactly:

```html
alt="Comparison diagram of liquid-nitrogen flow or reservoir, closed-cycle cryocooler, and liquid-helium flow or bath architectures, showing thermal paths, consumables and utilities, mechanical vibration sources, operating patterns, and buyer questions"
```

Keep CDN URLs, attributes, and figcaption unchanged.

- [ ] **Step 3: Generate all variants through the repository optimizer**

```bash
npm run optimize-images -- public/assets/images/insights/cryo-cooling-architectures.png
```

Expected: eight generated paths and `Single image optimization complete!`.

- [ ] **Step 4: Prove every responsive checksum changed**

```bash
shasum -a 256 public/assets/images/insights/cryo-cooling-architectures-{sm,md,lg,xl}.{png,webp} > /tmp/cryo-cooling-architectures.after.sha256
cut -d' ' -f1 /tmp/cryo-cooling-architectures.before.sha256 | sort > /tmp/cryo-before.hashes
cut -d' ' -f1 /tmp/cryo-cooling-architectures.after.sha256 | sort > /tmp/cryo-after.hashes
comm -12 /tmp/cryo-before.hashes /tmp/cryo-after.hashes
```

Expected: no output.

- [ ] **Step 5: Run the focused test**

```bash
npx vitest run src/pages/probeStations/cryoBuyersGuideArticle.test.ts
```

Expected: PASS, including exact alt, caption, source metadata, and eight variant metadata checks.

- [ ] **Step 6: Commit the figure unit**

```bash
git add scripts/generate-cryo-architecture-figure.py \
  scripts/articles/cryogenic-probe-station-buyers-guide.html \
  src/pages/probeStations/cryoBuyersGuideArticle.test.ts \
  public/assets/images/insights/cryo-cooling-architectures.png \
  public/assets/images/insights/cryo-cooling-architectures-{sm,md,lg,xl}.{png,webp}
git commit -m "feat(article): redesign cryogenic architecture figure"
```

Expected: no candidate or temporary TTF staged.

### Task 4: Regression Verification and PR Handoff

**Files:**
- Verify: all Task 1-3 changes
- Verify: article and cryogenic application tests

**Interfaces:**
- Consumes: committed figure unit.
- Produces: verified PR #291 update without publication-side mutation.

- [ ] **Step 1: Run targeted tests**

```bash
npx vitest run src/pages/probeStations/cryoBuyersGuideArticle.test.ts
npx vitest run --testNamePattern="cryogenic probing"
```

Expected: both exit 0.

- [ ] **Step 2: Run static and full regression checks**

```bash
npx tsc --noEmit
npm test
git diff --check HEAD~1
```

Expected: TypeScript and all tests pass; diff check is silent.

- [ ] **Step 3: Audit final state**

```bash
git status --short
git diff HEAD~1 -- scripts/articles/cryogenic-probe-station-buyers-guide.html src/pages/probeStations/cryoBuyersGuideArticle.test.ts scripts/generate-cryo-architecture-figure.py
git ls-files 'public/assets/images/insights/cryo-cooling-architectures*'
```

Expected: clean worktree; HTML changes only alt; exactly source plus eight variants tracked; no candidate or TTF tracked.

- [ ] **Step 4: Push the PR branch**

```bash
git push origin feature/cryo-buyers-guide-article
```

Expected: PR #291 updates. Do not run `upload-insights-image.ts`, `create-insight`, or a cover-update command.

- [ ] **Step 5: Preserve the publication-only handoff command without executing it**

```bash
npx tsx scripts/upload-insights-image.ts \
  cryogenic-probe-station-buyers-guide \
  public/assets/images/insights/cryo-cooling-architectures.png \
  --name cooling-architectures \
  --no-update-cover
```

Run this exactly once during first publication so the inline image retains the `cooling-architectures-*` CDN key and cannot replace the cover.
