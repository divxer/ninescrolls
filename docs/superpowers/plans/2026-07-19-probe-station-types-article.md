# Probe Station Types Article (#4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship insight article #4 "Types of Wafer Probe Stations: A Measurement-Environment Guide" (slug `types-of-wafer-probe-stations`) with a single-source 6×4 type matrix (figure + HTML table), full guard-test coverage (no-unit / no-currency / references-sentinel + inherited KELVIN & brand families), and two deterministic image assets — per the approved spec `docs/superpowers/specs/2026-07-19-probe-station-types-article-design.md`.

**Architecture:** Standalone-HTML article flow (`scripts/articles/*.html` → create-insight at publish time). Matrix content lives in ONE JSON file consumed by (a) the Python figure generator, (b) test assertions that every cell appears verbatim in the article HTML table, and (c) guard-rule assertions on the cells themselves. Images reuse the proven pipelines: PIL + fontTools WOFF2→TTF for the editorial matrix figure (adapt `scripts/generate-cryo-architecture-figure.py`), Sharp SVG overlay for the cover (adapt `scripts/generate-cryo-buyers-guide-cover.mjs`).

**Tech Stack:** Vitest, sharp, Python 3 (`/Users/harvey/miniforge3/bin/python`: Pillow 11 + fontTools + brotli), `scripts/optimize-images.js`, standalone-HTML article tooling.

**Worktree:** `.claude/worktrees/types-article`, branch `feature/probe-station-types-article`. The worktree has no `node_modules`: symlink before running tests — `ln -sfn /Users/harvey/Dev/src/cursor/ninescrolls/node_modules <worktree>/node_modules` — and remove the symlink before committing. All `git` commands run with `git -C <worktree>`.

**Reference files (read before starting):**
- Spec: `docs/superpowers/specs/2026-07-19-probe-station-types-article-design.md` (this branch)
- Guard-test precedent: `src/pages/probeStations/cryoBuyersGuideArticle.test.ts` (KELVIN grammar, GUARD_FAMILIES single-source pattern, mutation meta-test, sharp assertions)
- Figure generator precedent: `scripts/generate-cryo-architecture-figure.py`
- Cover compose precedent: `scripts/generate-cryo-buyers-guide-cover.mjs`
- Article HTML precedent: `scripts/articles/cryogenic-probe-station-buyers-guide.html` (meta tags, picture blocks, figcaption pattern)

---

### Task 1: Matrix single-source JSON + cell-rule tests

**Files:**
- Create: `src/data/probeStations/typeMatrixContent.json`
- Create: `src/pages/probeStations/typesArticle.test.ts` (first describe block only)

- [ ] **Step 1: Write the SSoT JSON** (locked copy from spec §"Master matrix content contract"):

```json
{
  "types": [
    "Standard ambient",
    "Cryogenic",
    "High-temperature",
    "Vacuum",
    "RF & microwave",
    "Silicon photonics"
  ],
  "dimensions": [
    "Environment hardware signature",
    "Best-fit applications",
    "Cost drivers",
    "Buyer’s key question"
  ],
  "cells": [
    ["Open platen, micropositioners, isolation table", "Sealed chamber; cryocooler or cryogen cooling; multi-stage vibration isolation", "Heated chuck with thermal-isolation stack", "Vacuum chamber, feedthrough wiring, in-chamber probe arms", "High-frequency positioners, calibration-substrate holder, low-loss cabling", "Fiber positioners with alignment optics alongside electrical probes"],
    ["General current–voltage and capacitance characterization; wafer-level debug", "Low-temperature device physics; superconducting and quantum-device screening", "Elevated-temperature device behavior; reliability studies", "Surface-sensitive devices; MEMS; moisture-free measurement", "On-wafer high-frequency parameter extraction", "Wafer-level optical coupling and photonic-circuit test"],
    ["Positioner precision; platform isolation grade", "Cooling architecture; isolation stages; radiation shielding", "Chuck uniformity engineering; thermal isolation of positioners", "Chamber and pumping stack; feedthrough count and signal integrity", "Calibration substrates; low-loss interconnect; probe replacement cycle", "Alignment automation; optical instrumentation integration"],
    ["Which upgrades will the platform accept later?", "What does the stage deliver under your real heat load?", "How uniform and stable is the chuck across a long soak?", "Which signals must cross the chamber wall?", "What does the daily calibration workflow look like?", "How repeatable is fiber-to-chip alignment?"]
  ]
}
```

Note: `Buyer’s` uses U+2019; `current–voltage` uses U+2013. `cells` is dimension-major: `cells[row][col]` where row follows `dimensions`, col follows `types`.

**ESLint character discipline (applies to every task touching the .ts test file):** in `typesArticle.test.ts` string/regex literals, write typographic characters as Unicode escapes — `’` for ’, `–` for – — never as raw characters (`no-irregular-whitespace` family lesson from PR #327). The JSON file keeps the real characters (content is data, not lint-scoped).

- [ ] **Step 2: Write failing cell-rule tests** — create `src/pages/probeStations/typesArticle.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import matrix from '../../data/probeStations/typeMatrixContent.json';

// ---------------------------------------------------------------------------
// Single-source guard families. Consumed by: (a) matrix-cell assertions,
// (b) article-content assertions, (c) the mutation meta-test. Mirrors the
// GUARD_FAMILIES pattern in cryoBuyersGuideArticle.test.ts.
// ---------------------------------------------------------------------------
const UNIT = String.raw`(?:nm|µm|um|mm|cm|K|°C|GHz|MHz|kHz|Hz|dB|dBm|torr|Torr|mbar|Pa|pA|nA|µA|uA|mA|A|mV|kV|V|mW|kW|W|Ω|ohm)`;
const GUARD_FAMILIES = {
  // Any digit attached to a physical unit — the article teaches WHAT to
  // review, never HOW MUCH. (\d then optional space/decimal then unit, word-bounded.)
  noUnitNumbers: [new RegExp(String.raw`\d+(?:\.\d+)?\s?${UNIT}\b`)],
  // Currency symbols, codes, price words with digits, and relative-cost runs.
  noCurrency: [
    /[$€£¥]/,
    /\bUSD|CNY|EUR|RMB\b/,
    /\$+\s*[–-]\s*\$+/,
    /\bprice[sd]?\s+(?:from|at|around)\s+\d/i,
  ],
  // No vendor/brand names in matrix cells or type profiles (brand mentions
  // belong only in "Where NineScrolls Fits" + registry-safe contexts).
  noBrandInMatrix: [/semishare/i, /ninescrolls/i, /formfactor|lake\s*shore|micromanipulator|mpi\b|accretech/i],
} as const;

const allCells: string[] = (matrix.cells as string[][]).flat();

describe('type matrix single source', () => {
  it('has 6 types × 4 dimensions with a full cell grid', () => {
    expect(matrix.types).toHaveLength(6);
    expect(matrix.dimensions).toHaveLength(4);
    expect(matrix.cells).toHaveLength(4);
    for (const row of matrix.cells) expect(row).toHaveLength(6);
  });

  it('cells contain no unit-numbers, currency, or brand names', () => {
    for (const cell of allCells) {
      for (const family of Object.values(GUARD_FAMILIES)) {
        for (const pattern of family) {
          expect(cell, `cell "${cell}" vs ${pattern}`).not.toMatch(pattern);
        }
      }
    }
  });

  it('uses typographic punctuation in locked copy', () => {
    expect(matrix.dimensions[3]).toBe('Buyer’s key question');
    expect(allCells.join(' ')).not.toContain("Buyer's"); // no straight-quote drift
  });
});
```

- [ ] **Step 3: Run to verify it fails** (JSON not yet created → module-not-found, or passes if Step 1 done first — order Steps 1–2 as written so this run PASSES; the failing-state check for guards happens in Step 4)

Run: `cd <worktree> && npx vitest run src/pages/probeStations/typesArticle.test.ts`
Expected: 3 passed

- [ ] **Step 4: Prove the guards bite (temporary sabotage)** — edit one JSON cell to `"Handles 3 kV bias"`, rerun, expect the no-unit assertion to FAIL naming that cell; revert the cell, rerun, expect 3 passed. Do not commit the sabotage.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add src/data/probeStations/typeMatrixContent.json src/pages/probeStations/typesArticle.test.ts
git -C <worktree> commit -m "feat(article): type-matrix single source + cell guard rules"
```

---

### Task 2: Article structure & content assertions (failing first)

**Files:**
- Modify: `src/pages/probeStations/typesArticle.test.ts` (append describe blocks)

- [ ] **Step 1: Append article-level assertions.** Add after the existing code:

```ts
const ARTICLE_PATH = 'scripts/articles/types-of-wafer-probe-stations.html';
const html = () => readFileSync(ARTICLE_PATH, 'utf8');

// References-exemption scoping: guard families apply OUTSIDE the references
// block only. The article MUST wrap references in these exact markers.
const REF_OPEN = '<!-- guard-exempt:references -->';
const REF_CLOSE = '<!-- /guard-exempt:references -->';
const outsideReferences = (doc: string) => {
  const start = doc.indexOf(REF_OPEN);
  const end = doc.indexOf(REF_CLOSE);
  expect(start, 'references exemption markers present').toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return doc.slice(0, start) + doc.slice(end + REF_CLOSE.length);
};

describe('types article — structure and metadata', () => {
  it('declares the locked slug, title, and TechArticle schema', () => {
    const doc = html();
    expect(doc).toMatch(/<meta name="article:slug" content="types-of-wafer-probe-stations">/);
    const title = doc.match(/<title>([^<]+)<\/title>/)?.[1] ?? '';
    expect(title).toContain('Types of Wafer Probe Stations');
    expect(title.length).toBeLessThanOrEqual(70); // page <title>; SEO title ≤60 asserted on article:title meta
    expect(doc).toMatch(/article:type" content="TechArticle"/);
  });

  it('contains the six type-profile sections in locked order', () => {
    const doc = html();
    const positions = matrix.types.map((t) => doc.indexOf(`<h3>${t}</h3>`));
    for (const [i, pos] of positions.entries()) {
      expect(pos, `profile heading "${matrix.types[i]}"`).toBeGreaterThan(-1);
      if (i > 0) expect(pos).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('renders every matrix cell verbatim in the HTML table (single source)', () => {
    const doc = html();
    for (const cell of allCells) expect(doc).toContain(cell);
    for (const dim of matrix.dimensions) expect(doc).toContain(dim);
    expect(doc).toMatch(/<div class="table-scroll"|overflow-x:\s*auto/); // responsive defense
  });

  it('keeps unit-numbers, currency, and price symbols out of the body', () => {
    const body = outsideReferences(html());
    for (const family of [GUARD_FAMILIES.noUnitNumbers, GUARD_FAMILIES.noCurrency]) {
      for (const pattern of family) expect(body).not.toMatch(pattern);
    }
  });

  it('sentinel: no brand within 3 sentences of any exempted number', () => {
    const doc = html();
    const start = doc.indexOf(REF_OPEN);
    const end = doc.indexOf(REF_CLOSE);
    const refs = doc.slice(start, end);
    // Split the references block into sentence-ish units; any window of 7
    // consecutive units (≈3 sentences each side) containing a digit must not
    // also contain a brand.
    const units = refs.split(/(?<=[.!?])\s+|<\/li>/);
    for (let i = 0; i < units.length; i++) {
      if (!/\d/.test(units[i])) continue;
      const window = units.slice(Math.max(0, i - 3), i + 4).join(' ');
      expect(window, `brand near exempted number: "${units[i].slice(0, 60)}"`).not.toMatch(/ninescrolls|semishare/i);
    }
  });

  it('carries the required interlinks (spec §Interlink map)', () => {
    const doc = html();
    for (const href of [
      '/insights/how-to-choose-wafer-probe-station-university-lab',
      '/insights/cryogenic-probe-station-buyers-guide',
      '/insights/probe-station-procurement-nsf-doe-funded-projects',
      '/applications/cryogenic-probing',
      '/applications/silicon-photonics-probing',
      '/wafer-probe-stations/semishare',
    ]) {
      expect(doc, `interlink ${href}`).toContain(`href="${href}"`);
    }
  });

  it('keeps the figure figcaption disclaimer adjacent to the matrix figure', () => {
    const doc = html();
    expect(doc).toMatch(/<figcaption[^>]*>[^<]*illustrative comparison/i);
  });

  it('inherits kelvin discipline: no kelvin numbers anywhere in this survey article', () => {
    // #4 stays survey-level; temperature quantification lives in #3.
    const body = outsideReferences(html());
    expect(body).not.toMatch(/\d+(?:\.\d+)?\s?(?:k\b|kelvin\b)/i);
    expect(body).not.toMatch(/\bguaranteed\b/i);
    expect(body).not.toMatch(/installation\s+included/i);
  });
});
```

- [ ] **Step 2: Run to verify the new blocks fail** (article file absent)

Run: `npx vitest run src/pages/probeStations/typesArticle.test.ts`
Expected: Task-1 describes pass; every "types article" test FAILS with ENOENT on `scripts/articles/types-of-wafer-probe-stations.html`.

- [ ] **Step 3: Commit**

```bash
git -C <worktree> add src/pages/probeStations/typesArticle.test.ts
git -C <worktree> commit -m "test(article): structure, guard, sentinel assertions for types article"
```

---

### Task 3: Article HTML — head, framework, profiles 1–3

**Files:**
- Create: `scripts/articles/types-of-wafer-probe-stations.html`

- [ ] **Step 1: Create the document skeleton.** Mirror `scripts/articles/cryogenic-probe-station-buyers-guide.html` head conventions exactly. Locked metadata:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Types of Wafer Probe Stations: Measurement-Environment Guide</title>
  <meta name="article:slug" content="types-of-wafer-probe-stations">
  <meta name="article:title" content="Types of Wafer Probe Stations: Measurement-Environment Guide">
  <meta name="article:category" content="Metrology & Testing">
  <meta name="article:author" content="NineScrolls Engineering">
  <meta name="article:type" content="TechArticle">
  <meta name="article:publish-date" content="SET-AT-PUBLISH">
  <meta name="article:excerpt" content="A measurement-environment map of wafer probe station types — standard ambient, cryogenic, high-temperature, vacuum, RF and microwave, and silicon photonics — with the hardware signatures, datasheet review points, and cost drivers that separate them.">
  <script type="application/json" data-related-products>[{"name":"SEMISHARE Probe Stations","url":"/wafer-probe-stations/semishare"},{"name":"Wafer Probe Stations","url":"/wafer-probe-stations"}]</script>
  <!-- cover imageUrl is set by the publish-time upload (--name cover); initial value only -->
  <meta name="article:image" content="/assets/images/insights/probe-station-types-cover.png">
</head>
<body>
  <h1>Types of Wafer Probe Stations: Measurement-Environment Guide</h1>
  ...
</body>
</html>
```

`article:title` is 60 chars (audited) — the page `<title>` carries NO brand suffix (corrected 2026-07-19: article #3's `<title>` has none either; the production prerender appends " | NineScrolls" at render time, and a hand-written suffix would both duplicate it and push the tag past the test's 70-char bound). Replace `SET-AT-PUBLISH` with the real date during the publish chain (the create-insight step rejects placeholder dates — set it in the same commit as the PR merge if publishing immediately; otherwise before running create-insight).

**h1 requirement (added 2026-07-19, rationale updated with the no-suffix `<title>` correction):** the body MUST open with `<h1>Types of Wafer Probe Stations: Measurement-Environment Guide</h1>` verbatim, matching `article:title` exactly. `parseArticleHtml` derives the canonical DB title from `<h1>` and falls back to `<title>` only when no `<h1>` exists. Verified by grep (2026-07-19): `scripts/articles/cryogenic-probe-station-buyers-guide.html` (article #3) contains no `<h1>` and relies on the `<title>`-fallback path. With this article's `<title>` now suffix-free, the fallback would also produce the correct DB title — but this article keeps the explicit `<h1>` anyway: it makes the canonical title an explicit declaration instead of a fallback side effect, and it is immune to any future `<title>` drift (e.g. someone re-adding a suffix). `typesArticle.test.ts` asserts the `<h1>` content verbatim plus a ≤60-char length bound.

- [ ] **Step 2: Write TL;DR + opening framework (~2 paragraphs + checklist `<ul>`).** Content requirements (author prose to satisfy the guard tests — no unit-numbers, no currency, no kelvin numbers): the environment axis defined; orthogonality sentence — "first fix the measurement environment, then fix the automation level" — with the automation link: `<a href="/insights/how-to-choose-wafer-probe-station-university-lab">automation level decision</a>`. TL;DR is a 6-bullet list, one per type, each bullet = the type's "Buyer's key question" cell text (verbatim from the JSON — reuse, don't paraphrase).

- [ ] **Step 3: Write profiles 1–3** (`<h3>Standard ambient</h3>`, `<h3>Cryogenic</h3>`, `<h3>High-temperature</h3>`), each with the uniform five-part template as `<h4>`-less flowing prose in this order: what it is / distinguishing hardware → typical applications → key specs to review → qualitative cost drivers → when NOT to choose it. Constraints per spec:
  - Cryogenic profile stays survey-level; links `<a href="/insights/cryogenic-probe-station-buyers-guide">…</a>` and `<a href="/applications/cryogenic-probing">…</a>`; NO temperature numbers, no cryogen boiling points (leave them to #3).
  - High-temperature profile carries the first high-power boundary passage using the approved register: "dielectric breakdown thresholds of thermal isolation stacks" (SiC/GaN context, zero V/A digits).
  - "Key specs to review" uses architecture-abstraction wording: leakage-current dynamics, thermal gradient control, transition-loss behavior.

- [ ] **Step 4: Run the structure tests** — expect partial: profile-order test still fails (profiles 4–6 missing), matrix/interlink/figcaption tests fail. That is the expected state; do NOT weaken tests.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add scripts/articles/types-of-wafer-probe-stations.html
git -C <worktree> commit -m "feat(article): types article head, framework, first three profiles"
```

---

### Task 4: Article HTML — profiles 4–6, matrix table, checklist, close

**Files:**
- Modify: `scripts/articles/types-of-wafer-probe-stations.html`

- [ ] **Step 1: Write profiles 4–6** (`Vacuum`, `RF & microwave`, `Silicon photonics`), same template. Constraints:
  - Vacuum profile carries the second high-power boundary passage: "transient current capacity of vacuum feedthroughs".
  - Silicon-photonics profile links `<a href="/applications/silicon-photonics-probing">…</a>`.
  - RF profile: no GHz/frequency digits; calibration workflow emphasis.

- [ ] **Step 2: Insert the matrix figure + HTML table.** Figure block mirrors the cryo article's `<picture>` pattern with CDN URLs `https://cdn.ninescrolls.com/insights/types-of-wafer-probe-stations/type-matrix-{sm,md,lg,xl}.{webp,png}` (img fallback = `type-matrix-lg.png`, `loading="lazy"`), followed by `<figcaption>An illustrative comparison. Configuration determines actual capability; verify each dimension against the quoted system.</figcaption>`, followed by the responsive table: `<div class="table-scroll" style="overflow-x:auto">` wrapping a 7-column table (dimension label column + 6 types), every cell text pasted VERBATIM from `typeMatrixContent.json` (the test enforces byte equality). Mobile defense: give type-column `<td>`/`<th>` cells `min-width:150px` (inline style or the article table class) so narrow viewports scroll horizontally smoothly instead of crushing columns into vertical word-break stacks; verify at 375px in Task 8 Step 2. Alt text for the figure (kelvin-free, unit-free): "Six wafer probe station types compared across environment hardware, best-fit applications, cost drivers, and the buyer's key question: standard ambient, cryogenic, high-temperature, vacuum, RF and microwave, and silicon photonics."

- [ ] **Step 3: Write the Type-selection checklist** (RFQ-ready, acceptance-criteria style: 6–8 `<li>` items phrased as verifiable requests to a vendor — no numbers), then "Where NineScrolls Fits" (registry-safe: US & Canada sales/support framing, link `/wafer-probe-stations/semishare`; NO partner/authorized wording), then Further reading (links to #1, #2, #3) and References wrapped in the exemption markers:

```html
<!-- guard-exempt:references -->
<h2>References</h2>
<ol>
  ...external standards / literature only; no NineScrolls or SEMISHARE mention inside this block...
</ol>
<!-- /guard-exempt:references -->
```

- [ ] **Step 4: Run all tests — everything green except sharp/image assertions (Tasks 6–7)**

Run: `npx vitest run src/pages/probeStations/typesArticle.test.ts`
Expected: all Task-1/Task-2 describes PASS.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add scripts/articles/types-of-wafer-probe-stations.html
git -C <worktree> commit -m "feat(article): complete six profiles, matrix table, checklist, references"
```

---

### Task 5: Mutation meta-test + negative controls

**Files:**
- Modify: `src/pages/probeStations/typesArticle.test.ts` (append)

- [ ] **Step 1: Append the mutation meta-test.** Same architecture as the cryo test's mutation table — every mutation string must be caught by at least the named family, and every negative control must pass ALL families:

```ts
describe('guard families — mutation meta-test', () => {
  const MUTATIONS: Array<{ text: string; family: keyof typeof GUARD_FAMILIES }> = [
    { text: 'resolves features down to 5 nm', family: 'noUnitNumbers' },
    { text: 'operates at 4 K in this configuration', family: 'noUnitNumbers' },
    { text: 'sweeps up to 67 GHz', family: 'noUnitNumbers' },
    { text: 'chamber reaches 1e-6 torr', family: 'noUnitNumbers' },
    { text: 'withstands 3 kV chuck bias', family: 'noUnitNumbers' },
    { text: 'systems start around $45,000', family: 'noCurrency' },
    { text: 'budget tier: $$ – $$$$', family: 'noCurrency' },
    { text: 'priced from 30000 USD', family: 'noCurrency' },
    { text: 'a SEMISHARE cryogenic platform', family: 'noBrandInMatrix' },
    { text: 'comparable to FormFactor systems', family: 'noBrandInMatrix' },
  ];
  const NEGATIVE_CONTROLS = [
    'multi-stage vibration isolation between cryocooler and stage',
    'review leakage-current dynamics across the thermal gradient',
    'dielectric breakdown thresholds of thermal isolation stacks',
    'transient current capacity of vacuum feedthroughs',
    'five decisions determine the platform', // bare digit-free wording
    'Section 3 of the datasheet', // digits without units are allowed
  ];

  it('every mutation is caught by its family', () => {
    for (const m of MUTATIONS) {
      const caught = GUARD_FAMILIES[m.family].some((p) => p.test(m.text));
      expect(caught, `"${m.text}" should trip ${m.family}`).toBe(true);
    }
  });

  it('negative controls pass every family', () => {
    for (const control of NEGATIVE_CONTROLS) {
      for (const [name, family] of Object.entries(GUARD_FAMILIES)) {
        for (const p of family) {
          expect(p.test(control), `"${control}" wrongly tripped ${name}`).toBe(false);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run — expect green.** If a negative control trips (e.g. "Section 3" matched by an over-broad unit regex), fix the REGEX (word boundaries), never delete the control.

- [ ] **Step 3: Sabotage-verify** — temporarily delete the `noCurrency` `[$€£¥]` pattern; rerun; expect exactly the currency mutation rows to fail; restore; green. Do not commit sabotage.

- [ ] **Step 4: Commit**

```bash
git -C <worktree> add src/pages/probeStations/typesArticle.test.ts
git -C <worktree> commit -m "test(article): mutation meta-test with negative controls for guard families"
```

---

### Task 6: Type-matrix figure (deterministic PIL pipeline)

**Files:**
- Create: `scripts/generate-type-matrix-figure.py`
- Create (generated): `public/assets/images/insights/probe-station-type-matrix.png` + 8 variants
- Modify: `src/pages/probeStations/typesArticle.test.ts` (sharp assertions)

- [ ] **Step 1: Write the generator by adapting `scripts/generate-cryo-architecture-figure.py`** (read it first; reuse `convert_font`, `load_font`, `wrap_lines`, `fit_text`, `draw_centered_lines` verbatim). Differences to implement:
  - Content: `CONTENT = json.load(open(ROOT / "src/data/probeStations/typeMatrixContent.json"))` — the JSON is the ONLY copy source; no string literals for cell text in the .py.
  - Layout: 1600×900 sRGB; navy `#1e3a5f` header band 18% with title `Wafer Probe Station Types` / subtitle `Six measurement environments compared for evaluation` (Space Grotesk / Inter); body = 7-column grid (dimension-label column ~180px + 6 type columns ~236px), 4 content rows; light editorial field `#f7fafc`, row label small-caps slate, alternating row tint `#eef3f8`, accent `#3b82f6` for column headers.
  - Glyph assertion GENERALIZED: before drawing, collect `set(ch for s in all_rendered_strings for ch in s)` (title, subtitle, types, dimensions, cells, disclaimer) and assert every codepoint is in the converted fonts' `getBestCmap()`; raise RuntimeError listing missing codepoints.
  - Footer disclaimer (in-image, additive to the HTML figcaption): `Illustrative comparison. Configuration determines actual capability.`
  - Output candidate: `OUT = ROOT / "public/assets/images/insights/probe-station-type-matrix.v1-candidate.png"`; save with `icc_profile=None`, verify 1600×900 on reopen, `print(OUT)`.

- [ ] **Step 2: Generate the candidate**

Run: `cd <worktree> && /Users/harvey/miniforge3/bin/python scripts/generate-type-matrix-figure.py`
Expected: prints the candidate path; no RuntimeError.

- [ ] **Step 3: CHECKPOINT — visual QA with the owner.** Show the candidate. Acceptance list: title/subtitle spelled exactly; 6 columns × 4 rows all cells legible and verbatim; U+2019 renders in "Buyer’s"; no tofu; no brands/digits; colors match palette. Do not proceed until approved.

- [ ] **Step 4: Promote + variants.** `cp` candidate → `public/assets/images/insights/probe-station-type-matrix.png`, delete the candidate, run `node scripts/optimize-images.js public/assets/images/insights/probe-station-type-matrix.png` (single-image mode prints "Single image optimization complete!"), verify 8 variants regenerated (checksums differ from any previous run; `shasum` before/after).

- [ ] **Step 5: Append sharp assertions to the test file** (mirror cryo test lines 78–90):

```ts
describe('type-matrix figure assets', () => {
  const base = 'public/assets/images/insights/probe-station-type-matrix';
  it('source is 1600×900 sRGB with all eight variants present and sRGB', async () => {
    const sharp = (await import('sharp')).default;
    const meta = await sharp(`${base}.png`).metadata();
    expect([meta.width, meta.height]).toEqual([1600, 900]);
    expect(meta.space).toBe('srgb');
    for (const size of ['sm', 'md', 'lg', 'xl']) {
      for (const ext of ['png', 'webp']) {
        const m = await sharp(`${base}-${size}.${ext}`).metadata();
        expect(m.space, `${size}.${ext}`).toBe('srgb');
      }
    }
  });
});
```

- [ ] **Step 6: Run full test file — green. Commit** (generator + 9 assets + test):

```bash
git -C <worktree> add scripts/generate-type-matrix-figure.py public/assets/images/insights/probe-station-type-matrix* src/pages/probeStations/typesArticle.test.ts
git -C <worktree> commit -m "feat(article): deterministic type-matrix figure + asset assertions"
```

---

### Task 7: Cover (two-stage: scene + deterministic typography)

**Files:**
- Create: `scripts/generate-types-cover.mjs`
- Create (generated): `public/assets/images/insights/probe-station-types-cover.png` + 8 variants

- [ ] **Step 1: Produce the text-free scene** (1600×900+): photorealistic multi-environment probe-lab composition — e.g., a probe platform in the foreground with a sealed-chamber system softly blurred behind, cool blue palette. Banned: all text, brands, recognizable OEM likeness, temperature/frequency digits, certification marks. Generate via the image-generation tooling used for the cryo cover; save the raw scene to `tmp/types-cover/scene.png` (not committed).

- [ ] **Step 2: Write `scripts/generate-types-cover.mjs` by adapting `scripts/generate-cryo-buyers-guide-cover.mjs`** (same WOFF2 data-URI embedding, same left copy-field gradient and logo chip). Locked copy — eyebrow `METROLOGY & TESTING`; title lines `Types of Wafer` / `Probe Stations` (title-secondary weight); subtitle `A measurement-environment guide to six system types`. Note the #3 lesson: the eyebrow must NOT duplicate the title. Output default `tmp/types-cover/probe-station-types-cover-v1.png`.

- [ ] **Step 3: Compose the candidate**

Run: `node scripts/generate-types-cover.mjs tmp/types-cover/scene.png`
Expected: candidate written; script asserts 1600×900 and sRGB output (`.toColourspace('srgb')` + final sharp metadata check, as in the cryo script).

- [ ] **Step 4: CHECKPOINT — visual QA with the owner.** Acceptance: spelling exact, no title/eyebrow duplication, clean line breaks (no orphaned word), logo chip legible, scene passes the banned-elements sweep. Iterate scene or overlay until approved.

- [ ] **Step 5: Promote + variants + assertions.** `cp` candidate → `public/assets/images/insights/probe-station-types-cover.png`; `node scripts/optimize-images.js public/assets/images/insights/probe-station-types-cover.png`; append a `types cover assets` describe to the test file mirroring Task 6 Step 5 (base `probe-station-types-cover`); run file — green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add scripts/generate-types-cover.mjs public/assets/images/insights/probe-station-types-cover* src/pages/probeStations/typesArticle.test.ts
git -C <worktree> commit -m "feat(article): types cover via deterministic typography pipeline"
```

---

### Task 8: Full verification + PR

- [ ] **Step 1: Full suite, lint, typecheck** (from the worktree, node_modules symlinked):

```bash
npx vitest run --exclude '**/.claude/**'
npx eslint src/pages/probeStations/typesArticle.test.ts scripts/generate-types-cover.mjs
npx tsc --noEmit
```

Expected: all green. Watch for `no-irregular-whitespace` on any literal typographic character in the test file — use escapes (`’`, `–`) inside regex/string literals where ESLint objects (lesson from PR #327).

- [ ] **Step 2: Browser check (dev).** The article is DDB-driven, so pre-publish there is no live route; instead open the raw HTML through the parse path: run the existing rewrite/sanitize test (`npx vitest run src/pages/InsightsPostPage.rewrite.test.ts`) to confirm the delivery-path contract still holds, and visually inspect `scripts/articles/types-of-wafer-probe-stations.html` rendered in the Browser pane for reading flow and table scroll behavior at mobile width (resize_window mobile).

- [ ] **Step 3: Remove the node_modules symlink; push; open PR**

```bash
rm <worktree>/node_modules   # symlink only
git -C <worktree> push -u origin feature/probe-station-types-article
gh pr create --base main --head feature/probe-station-types-article \
  --title "Insight article: Types of Wafer Probe Stations (measurement-environment guide)" \
  --body "<summary of spec + tasks; note publish chain runs post-merge>"
```

- [ ] **Step 4: Merge gate.** `gh pr checks <n> --watch` and merge ONLY via a command chained on its exit code: `gh pr checks <n> --watch && gh pr merge <n> --merge`.

---

### Task 9: Publish chain + post-deployment hooks (POST-MERGE handoff — not part of the PR)

These steps run after merge, in the established order. They are recorded here as the operational checklist; none of them executes during Tasks 1–8.

1. Set `article:publish-date` to the real date (commit to main) if not already done.
2. `npx tsx scripts/create-insight.ts scripts/articles/types-of-wafer-probe-stations.html` (admin creds from `.env`, `amplify_outputs.json` in root) → draft id.
3. Upload cover: `npx tsx scripts/upload-insights-image.ts types-of-wafer-probe-stations public/assets/images/insights/probe-station-types-cover.png --name cover`
4. Upload matrix: `npx tsx scripts/upload-insights-image.ts types-of-wafer-probe-stations public/assets/images/insights/probe-station-type-matrix.png --name type-matrix --no-update-cover` (BOTH flags mandatory — the article references `type-matrix-*` keys and the default would clobber the hero).
5. Fail-fast CDN verification: curl all 16 keys (`cover|type-matrix` × sm/md/lg/xl × png/webp) expecting 200.
6. Owner reviews and publishes in `/admin/insights/<id>/edit`.
7. llms entries (74→75) in `public/llms.txt` + `public/llms-full.txt`, `npx tsx scripts/check-llms-sync.ts` (expect in-sync), commit to main.
8. GSC URL Inspection → Request Indexing (property `sc-domain:ninescrolls.com`, Chrome profile /u/2/).
9. **LAST — reciprocal backlinks** (spec §Post-deployment hooks): one article at a time, "single change, single test, single sync": edit article #1's HTML → run `probeStationArticle.test.ts` locally on main → commit → `update-insight-from-html.ts`; then repeat for article #3 with `cryoBuyersGuideArticle.test.ts`. Never batch the two edits into one commit; the per-article guard run protects existing KELVIN/brand constraints from being tripped by the new link sentence.

---

## Self-review (completed)

- **Spec coverage:** type roster/order (T3–T4), high-power passages (T3 S3, T4 S1), matrix SSoT + both renderers (T1, T4 S2, T6 S1), responsive defense (T2 assertion + T4 S2), no-unit/no-currency families incl. matrix literals (T1–T2), references sentinel ≥3 sentences (T2), architecture-abstraction register (T3 S3), figures on both pipelines with generalized glyph assertion + sRGB + nine-asset rule (T6–T7), interlink map (T2 + T3–T4), post-deploy backlinks last (T9.9), SEO metadata locked (T3 S1), publish chain (T9). No gaps found.
- **Placeholder scan:** `SET-AT-PUBLISH` is an intentional, test-invisible sentinel resolved in T9.1 — documented, not a TBD. No other placeholders.
- **Type consistency:** `GUARD_FAMILIES` keys (`noUnitNumbers`, `noCurrency`, `noBrandInMatrix`) match across T1/T2/T5; asset basenames `probe-station-type-matrix` / `probe-station-types-cover` consistent across T6/T7/T9; CDN names `type-matrix`/`cover` consistent with the article's picture block (T4 S2) and upload commands (T9.3–9.4).
