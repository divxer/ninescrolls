# Equipment Guide Content Optimization v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each Equipment Guide product page a benefit `lead`, a real `applications` strip, and a per-product CTA, rewrite the mechanical bullets into plain-English benefits, and rewrite the About page — all copy/data, no spec/evidence/layout change, hard 14 pages.

**Architecture:** Extend the canonical `GuideProduct` with a nested all-or-none `content` block; drive the CTA from a canonical `PRODUCT_ROUTES` map rendered as an absolute link; protect the untouched spec/evidence data with committed fixtures captured from the immutable v1 baseline `f76765a8`. Author the copy pilot-first (RIE + E-Beam in an isolated worktree → review → batch all 11).

**Tech Stack:** TypeScript, Vitest, the existing Puppeteer generator + `pdftoppm`/`pypdf`.

**Spec:** `docs/superpowers/specs/2026-07-10-equipment-guide-content-v2-design.md`

## Baseline & branch

- **Immutable protection baseline:** `f76765a8` (its guide data == v1-final). Fixtures are captured from it and never regenerated.
- This plan is executed on branch `feature/equipment-guide-content-v2` (stacked on v1). **Do not open a PR until the final state (Task 6) is complete** — 11/11 required content, About, fixtures, traceability, tests, PDF, in one branch.
- The **pilot (Task 3)** runs in an **isolated throwaway worktree that is never pushed** and is discarded after review.

## Ground data (used verbatim by the content tasks)

`PRODUCT_ROUTES` (guide `id` → site-relative route) and `applications = config.applications.items.slice(0, 4)` (config order preserved):

| id | route | applications (first 4, verbatim) | config slug |
|---|---|---|---|
| `rie` | `/products/rie-etcher` | Semiconductor R&D · Dielectric patterning · Polymer removal · Surface activation | rie-etcher |
| `icp-rie` | `/products/icp-etcher` | MEMS fabrication · Advanced packaging · Photonics · Power electronics | icp-etcher |
| `stripper` | `/products/striper` | Photoresist stripping · Plasma ashing · Post-etch residue cleaning · Organic contamination removal | striper |
| `ibe-ribe` | `/products/ibe-ribe` | Magnetic materials · Noble metal patterning · Optical device fabrication · MEMS / NEMS | ibe-ribe |
| `ald` | `/products/ald` | Gate dielectrics · Passivation layers · MEMS coatings · Energy storage materials | ald |
| `pecvd` | `/products/pecvd` | Passivation layers · Interlayer dielectrics · Optical coatings · MEMS membranes | pecvd |
| `hdp-cvd` | `/products/hdp-cvd` | STI gap-fill · IMD / PMD dielectrics · Advanced packaging dielectrics · TSV isolation workflows | hdp-cvd |
| `sputter` | `/products/sputter` | Metal contacts · Magnetic films · Optical coatings · Compound semiconductors | sputter |
| `coater-developer` | `/products/coater-developer` | Photoresist coating · HMDS priming · Developer processing · Lift-off preparation | coater-developer |
| `e-beam` | `/products/e-beam-evaporator` | Infrared image sensors · Ge/ZnS photonic crystals · UV down-conversion films · Optical AR coatings | e-beam-evaporator |
| `plasma-cleaner` | `/products/plasma-cleaner` | Surface activation · Surface cleaning · Failure analysis · Optical & biomedical device prep (pinned literals) | _(none)_ |

Each product's **`lead`** is rewritten from that config's `hero.description` (listed per product in Task 5); **`bullets`** are rewritten from the product's existing guide bullets + `specs` rows. No new performance numbers, no superlatives.

---

### Task 1: Baseline protection fixtures (from `f76765a8`)

**Files:**
- Create: `src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json`
- Create: `src/data/equipmentGuide/__fixtures__/v1-evidence.json`
- Create: `src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html`

- [ ] **Step 1: Capture the data fixtures from the immutable baseline**

Run a one-off extraction against `f76765a8` (uses the baseline's own data, not current):
```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
mkdir -p src/data/equipmentGuide/__fixtures__
git stash --include-untracked 2>/dev/null || true   # ensure a clean tree for the checkout dance is NOT needed; we use `git show`
npx tsx -e '
  // Load the BASELINE data by importing from a temp checkout is overkill; instead
  // the current products.ts specs/subTable/evidence are still == baseline at Task 1
  // start (no content edits yet). Assert that below before trusting it.
  import("./src/data/equipmentGuide/index.ts").then(({ equipmentGuideData }) => {
    const fs = require("node:fs");
    const specs = equipmentGuideData.products.map(p => ({ id: p.id, specs: p.specs, subTable: p.subTable ?? null }));
    fs.writeFileSync("src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json", JSON.stringify(specs, null, 2) + "\n");
    fs.writeFileSync("src/data/equipmentGuide/__fixtures__/v1-evidence.json", JSON.stringify(equipmentGuideData.evidence, null, 2) + "\n");
  });
'
```
Then **verify the captured specs/evidence equal the baseline** (guards against capturing an already-mutated state):
```bash
git show f76765a8:src/data/equipmentGuide/products.ts > /tmp/base-products.ts
git show f76765a8:src/data/equipmentGuide/guideMeta.ts > /tmp/base-guidemeta.ts
diff <(git show HEAD:src/data/equipmentGuide/products.ts) /tmp/base-products.ts && echo "products == baseline ✓"
diff <(git show HEAD:src/data/equipmentGuide/guideMeta.ts) /tmp/base-guidemeta.ts && echo "guideMeta == baseline ✓"
```
Expected: both `== baseline ✓` (Task 1 runs before any data edit, so current == `f76765a8`).

- [ ] **Step 2: Capture the rendered Evidence HTML chunk from the baseline**

```bash
npx tsx -e '
  import("./src/templates/equipmentGuide/renderEquipmentGuideHtml.ts").then(async (m) => {
    const { equipmentGuideData } = await import("./src/data/equipmentGuide/index.ts");
    const html = m.renderEquipmentGuideHtml(equipmentGuideData);
    // the Evidence page is the section containing "Peer-Reviewed Validation"
    const chunks = html.split("<section class=\"page").map(c => "<section class=\"page" + c);
    const ev = chunks.find(c => c.includes("Peer-Reviewed Validation"));
    require("node:fs").writeFileSync("src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html", ev.trim() + "\n");
  });
'
```

- [ ] **Step 3: Commit the fixtures (before any content edit exists to contaminate them)**

```bash
git add src/data/equipmentGuide/__fixtures__/
git commit -m "test(guide): capture v1 baseline protection fixtures from f76765a8"
```

---

### Task 2: Scaffolding — `content` type, `PRODUCT_ROUTES`, renderer, CSS

**Files:**
- Modify: `src/data/equipmentGuide/types.ts`
- Modify: `src/data/equipmentGuide/products.ts` (add `PRODUCT_ROUTES` only; no content yet)
- Modify: `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts`
- Modify: `src/templates/equipmentGuide/equipmentGuide.css.ts`
- Test: `src/data/equipmentGuide/equipmentGuide.data.test.ts`, `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts`

- [ ] **Step 1: Add the `content` type (optional for the pilot) + `SITE_ORIGIN`**

In `types.ts`, add:
```ts
export interface GuideProductContent {
  lead: string;
  applications: string[];
  applicationCount: 3 | 4;
  href: string; // site-relative, e.g. '/products/rie-etcher'
}
```
and add `content?: GuideProductContent;` to `GuideProduct` (optional during the pilot/batch; tightened to required in Task 6).

- [ ] **Step 2: Add `PRODUCT_ROUTES` + protection & route tests (RED)**

In `products.ts`, above the `products` array, add:
```ts
export const PRODUCT_ROUTES: Record<string, string> = {
  rie: '/products/rie-etcher',
  'icp-rie': '/products/icp-etcher',
  stripper: '/products/striper',
  'ibe-ribe': '/products/ibe-ribe',
  ald: '/products/ald',
  pecvd: '/products/pecvd',
  'hdp-cvd': '/products/hdp-cvd',
  sputter: '/products/sputter',
  'coater-developer': '/products/coater-developer',
  'plasma-cleaner': '/products/plasma-cleaner',
  'e-beam': '/products/e-beam-evaporator',
};
```
Append to `equipmentGuide.data.test.ts`:
```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PRODUCT_ROUTES } from './products';

const FIX = (f: string) => readFileSync(resolve(process.cwd(), 'src/data/equipmentGuide/__fixtures__', f), 'utf8');

describe('content-v2 scaffolding', () => {
  it('PRODUCT_ROUTES covers every product id with a /products/<slug> route', () => {
    for (const p of equipmentGuideData.products) {
      expect(PRODUCT_ROUTES[p.id], p.id).toMatch(/^\/products\/[a-z0-9-]+$/);
    }
    expect(Object.keys(PRODUCT_ROUTES).sort()).toEqual(equipmentGuideData.products.map(p => p.id).sort());
  });

  it('protects v1 specs + subTable (deep-equal committed fixture)', () => {
    const expected = JSON.parse(FIX('v1-specs-subtable.json'));
    const actual = equipmentGuideData.products.map(p => ({ id: p.id, specs: p.specs, subTable: p.subTable ?? null }));
    expect(actual).toEqual(expected);
  });

  it('protects the v1 evidence object (deep-equal committed fixture)', () => {
    expect(equipmentGuideData.evidence).toEqual(JSON.parse(FIX('v1-evidence.json')));
  });
});
```
Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `PRODUCT_ROUTES` import unresolved until the export is added; then the protection tests pass (data unchanged) and the route test passes once the map is present.

- [ ] **Step 3: Renderer — `data-product-id`, lead/apps/cta, absolute CTA (RED test first)**

Append to `renderEquipmentGuideHtml.test.ts`:
```ts
import { PRODUCT_ROUTES } from '../../data/equipmentGuide/products';

const evidenceChunkFixture = readFileSyncTrim('v1-evidence-chunk.html'); // helper defined in test setup

describe('content-v2 render', () => {
  it('stamps data-product-id on every product section', () => {
    for (const p of equipmentGuideData.products) {
      expect(html, p.id).toContain(`data-product-id="${p.id}"`);
    }
  });

  it('renders exactly one CTA per content product, absolute href matching that product route', () => {
    const chunks = html.split('<section class="page').slice(1);
    for (const p of equipmentGuideData.products) {
      const chunk = chunks.find(c => c.includes(`data-product-id="${p.id}"`))!;
      const ctas = (chunk.match(/Explore configurations &amp; request a quote/g) ?? []).length;
      if (p.content) {
        expect(ctas, p.id).toBe(1);
        expect(chunk, p.id).toContain(`href="https://ninescrolls.com${PRODUCT_ROUTES[p.id]}"`);
      } else {
        expect(ctas, p.id).toBe(0);
      }
    }
  });

  it('keeps the Evidence page byte-identical to the v1 fixture', () => {
    const chunks = html.split('<section class="page').map(c => '<section class="page' + c);
    const ev = chunks.find(c => c.includes('Peer-Reviewed Validation'))!.trim();
    expect(ev).toBe(evidenceChunkFixture);
  });
});
```
(Add a small `readFileSyncTrim` helper at the top of the test that reads `src/data/equipmentGuide/__fixtures__/<f>` and `.trim()`s it.)

Run: expect FAIL (no `data-product-id`, no CTA markup yet).

- [ ] **Step 4: Implement the renderer changes**

In `renderEquipmentGuideHtml.ts`: add `const SITE_ORIGIN = 'https://ninescrolls.com';` and import `PRODUCT_ROUTES`. In `productPage(p, imageDataUri)`:
- Add `data-product-id="${p.id}"` to the `<section class="page page--product" ...>` open tag.
- After the series title / section accent, if `p.content`, render the lead: `<p class="lead">${esc(p.content.lead)}</p>`.
- After the spec table(s), if `p.content`, render the applications strip and CTA:
```ts
const apps = p.content ? `<div class="apps"><p class="lab">Typical applications</p><div class="chips">${p.content.applications.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>` : '';
const cta = p.content ? `<div class="cta"><a class="btn" href="${SITE_ORIGIN}${PRODUCT_ROUTES[p.id]}">Explore configurations &amp; request a quote <span class="arr">→</span></a></div>` : '';
```
Place `${apps}${cta}` before the `.page-foot`. Leave the Evidence/About/Contact functions untouched. Run tests → GREEN.

- [ ] **Step 5: CSS — `.lead`, `.apps`/`.chip`, `.cta`/`.btn`**

In `equipmentGuide.css.ts` add (mirrors the approved mockup; body copy stays ≥12.5px):
```css
.lead { font-size: 13px; color: #334155; margin: 0 0 12px; max-width: 52ch; }
.apps { margin: 14px 0 0; padding: 10px 12px; border-radius: 9px; background: #f7f9fc; border: 1px solid #eef2f7; }
.apps .lab { font-size: 9.5px; letter-spacing: .16em; text-transform: uppercase; font-weight: 700; color: #8a97a6; margin: 0 0 6px; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip { font-size: 11px; font-weight: 600; color: #1e3a5f; background: #fff; border: 1px solid #e6ebf1; border-radius: 999px; padding: 3px 10px; }
.cta { margin-top: 12px; }
.cta .btn { display: inline-flex; align-items: center; gap: 7px; text-decoration: none; background: #0284c7; color: #fff; font-weight: 700; font-size: 12.5px; padding: 8px 14px; border-radius: 8px; }
```

- [ ] **Step 6: Run + commit scaffolding**

Run: `npx vitest run src/data/equipmentGuide src/templates/equipmentGuide --exclude '**/.claude/**'` → all green (CTA tests trivially pass — no product has `content` yet, so every product asserts 0 CTAs; protection + route + data-product-id pass).
```bash
git add src/data/equipmentGuide/types.ts src/data/equipmentGuide/products.ts \
        src/data/equipmentGuide/equipmentGuide.data.test.ts \
        src/templates/equipmentGuide/renderEquipmentGuideHtml.ts \
        src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts \
        src/templates/equipmentGuide/equipmentGuide.css.ts
git commit -m "feat(guide): content-v2 scaffolding — content type, PRODUCT_ROUTES, lead/apps/cta renderer + guards"
```

---

### Task 3: Pilot (RIE + E-Beam) — ISOLATED worktree, review-only

**Files (in a throwaway worktree, never pushed):** `products.ts` (add `content` for `rie` + `e-beam` only, rewrite their bullets).

- [ ] **Step 1: Create an isolated pilot worktree**

```bash
git worktree add .claude/worktrees/eqg-v2-pilot -b eqg-v2-pilot-throwaway HEAD
cd .claude/worktrees/eqg-v2-pilot
```

- [ ] **Step 2: Author RIE + E-Beam content (final wording below)**

In this worktree's `products.ts`, set `content` and rewrite `bullets` for the two products:

```ts
// rie
content: {
  lead: 'Reliable anisotropic plasma etching for university and R&D labs — dielectric patterning, polymer removal, surface activation, and device prototyping across silicon, compound, and 2D materials.',
  applications: ['Semiconductor R&D', 'Dielectric patterning', 'Polymer removal', 'Surface activation'],
  applicationCount: 4,
  href: '/products/rie-etcher',
},
bullets: [
  { heading: 'Broad material range.', body: 'Si-based films, compounds (InP/GaN/GaAs), 2D materials, and metals — plus failure-analysis work — in one chamber.' },
  { heading: 'Wide, repeatable process window.', body: '300–1000 W RF, 4 gas lines, and a −70 to 200 °C stage; non-uniformity under ±5% (edge exclusion).' },
  { heading: 'Low-damage by design.', body: 'Showerhead gas feed and a configurable discharge gap give gentle, tunable etch profiles.' },
  { heading: 'Lab-ready and configurable.', body: '1.0 × 1.0 m footprint; open-load or load-lock; cost- or performance-optimized builds.' },
],

// e-beam
content: {
  lead: 'Multi-source e-beam and thermal evaporation for optical and IR research — photonic crystals, optical multilayers, IR sensors, and lift-off metallization at research-grade purity.',
  applications: ['Infrared image sensors', 'Ge/ZnS photonic crystals', 'UV down-conversion films', 'Optical AR coatings'],
  applicationCount: 4,
  href: '/products/e-beam-evaporator',
},
bullets: [
  { heading: 'Two evaporation sources.', body: 'E-beam plus thermal resistance for metals, oxides, fluorides, and IR films.' },
  { heading: 'Precise thickness control.', body: 'In-situ QCM monitoring and endpoint; ±3–5% uniformity across the substrate.' },
  { heading: 'Optical and IR stacks ready.', body: 'High-purity films for photonic crystals, optical multilayers, and IR sensors.' },
  { heading: 'Flexible operation.', body: 'Manual, semi-automatic, or full-automatic; suited to lift-off metallization and patterning.' },
],
```

- [ ] **Step 3: Regenerate + screenshot the two pilot pages**

Run: `npm run generate-equipment-guide`
Then: page count must be 14; render to images and read the RIE + E-Beam pages:
```bash
python3 -c "from pypdf import PdfReader; print('pages', len(PdfReader('public/NineScrolls-Equipment-Guide.pdf').pages))"
mkdir -p /tmp/eqg-v2-pages && pdftoppm -jpeg -r 100 public/NineScrolls-Equipment-Guide.pdf /tmp/eqg-v2-pages/p
```
Read the RIE page (p3) and E-Beam page (p13) images. **Pilot acceptance:** both single-page, guide == 14 pages, no crowding, no table compressed below legibility, no body text < 12.5px.

- [ ] **Step 4: Review checkpoint (STOP)**

Present the two pilot pages to the user. Get voice/format sign-off. **Do not commit/push/merge this worktree.** After approval, discard it:
```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
git worktree remove --force .claude/worktrees/eqg-v2-pilot
git branch -D eqg-v2-pilot-throwaway
```

---

### Task 4: Batch — all 11 products' content + rewritten bullets (real branch)

**Files:** `src/data/equipmentGuide/products.ts`, `docs/equipment-guide/content-v2-traceability.md`

- [ ] **Step 1: Author `content` + rewritten bullets for all 11 products**

On `feature/equipment-guide-content-v2`, add the (now voice-locked) RIE + E-Beam content from Task 3, and author the remaining 9 the same way. For each product: `content.lead` = rewritten from its `hero.description` (below), `content.applications` = the first-4 list from the Ground-data table (verbatim, config order), `content.applicationCount` = 4 (use 3 only if Step 3 shows overflow), `content.href` = `PRODUCT_ROUTES[id]`; `bullets` = 3–4 benefits rewritten from that product's existing guide bullets + `specs` rows.

Source `hero.description` for the 9 (rewrite into ≤2-line leads; no new numbers/superlatives):
- **icp-rie:** "High-density plasma etching for silicon, MEMS, diamond, compound semiconductors, and process development where independent plasma density and ion energy control are critical."
- **stripper:** "Dedicated plasma stripping and ashing for photoresist removal, post-etch residue cleaning, organic contamination removal, and damage-sensitive semiconductor process flows."
- **ibe-ribe:** "Directional ion beam etching and reactive ion beam etching for magnetic films, noble metals, optical materials, multilayer stacks, and difficult-to-etch research materials."
- **ald:** "Atomic-level thin film deposition for conformal coatings, high-k dielectrics, passivation layers, 3D structures, and research material stacks."
- **pecvd:** "Low-temperature plasma-enhanced CVD for dielectric films, passivation layers, optical coatings, MEMS stacks, and research thin-film process development."
- **hdp-cvd:** "High-density plasma CVD for dense dielectric films, void-free trench fill, STI, IMD, PMD, and advanced packaging process development."
- **sputter:** "Physical vapor deposition for metal, dielectric, nitride, oxide, magnetic, optical, and compound thin films using configurable DC/RF magnetron sputtering sources."
- **coater-developer:** "Modular spin coating, development, hotplate, HMDS, and EBR process control for repeatable photolithography workflows from research wafers to pilot-line substrates."
- **plasma-cleaner:** author from the guide's own `plasma-cleaner` Main Functions / Typical Applications rows (no config); `content.applications` = the pinned literals `['Surface activation', 'Surface cleaning', 'Failure analysis', 'Optical & biomedical device prep']`.

- [ ] **Step 2: Fill the traceability record**

Create `docs/equipment-guide/content-v2-traceability.md`. For every product, one row per `lead` and per `bullet`, citing its source (config `hero.description`, an original guide bullet, or a `specs`/`subTable` row). Example (RIE):
```
## rie
- lead ← rieEtcherConfig.hero.description
- bullet "Broad material range" ← specs row "Etching Materials"
- bullet "Wide, repeatable process window" ← specs rows RF Power / Gas System / Wafer Stage Temp / Non-Uniformity
- bullet "Low-damage by design" ← original bullets "Showerhead Gas Feed-in" + "Configurable Plasma Discharge Gap"
- bullet "Lab-ready and configurable" ← original bullets "Uni-body … footprint" + "Sample Handling" + "Cost or Performance"
```

- [ ] **Step 3: Add the applications-parity + bullets + CTA-format tests (they now have data to check)**

Append to `equipmentGuide.data.test.ts`:
```ts
const PLASMA_CLEANER_APPS = ['Surface activation', 'Surface cleaning', 'Failure analysis', 'Optical & biomedical device prep'];

describe('content-v2 content integrity', () => {
  it('applications = config.applications.items.slice(0, applicationCount), verbatim & ordered', () => {
    for (const p of equipmentGuideData.products) {
      if (!p.content) continue;
      expect([3, 4]).toContain(p.content.applicationCount);
      expect(p.content.applications).toHaveLength(p.content.applicationCount);
      if (p.id === 'plasma-cleaner') {
        expect(p.content.applications).toEqual(PLASMA_CLEANER_APPS.slice(0, p.content.applicationCount));
        continue;
      }
      const slug = p.websiteSpecParity!.productSlug;
      const cfg = WEBSITE_CONFIGS[slug as keyof typeof WEBSITE_CONFIGS];
      expect(p.content.applications).toEqual(cfg.applications.items.slice(0, p.content.applicationCount));
    }
  });

  it('content.href equals the canonical route and is site-relative', () => {
    for (const p of equipmentGuideData.products) {
      if (!p.content) continue;
      expect(p.content.href).toBe(PRODUCT_ROUTES[p.id]);
      expect(p.content.href).toMatch(/^\/products\/[a-z0-9-]+$/);
    }
  });

  it('every product has 3–4 bullets', () => {
    for (const p of equipmentGuideData.products) {
      expect(p.bullets.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.bullets.length, p.id).toBeLessThanOrEqual(4);
    }
  });
});
```
Run tests → green (applications match config slices; note the config `applications.items` must be exported/available via the existing `WEBSITE_CONFIGS` map — it is, from v1).

- [ ] **Step 4: Regenerate, confirm 14 pages, commit**

Run: `npm run generate-equipment-guide` → 14 pages; `pdftoppm` all pages to `/tmp/eqg-v2-pages/` and inspect **all 14** for clipping/overflow. If any product overflows, apply the spec's reduction order (compress bullets → shorten lead → applicationCount 4→3 → tighten spacing; never <12.5px body, never spill). Then:
```bash
git add src/data/equipmentGuide/products.ts src/data/equipmentGuide/equipmentGuide.data.test.ts \
        docs/equipment-guide/content-v2-traceability.md public/NineScrolls-Equipment-Guide.pdf
git commit -m "feat(guide): content-v2 — leads, applications, CTAs, rewritten bullets for all 11 products"
```

---

### Task 5: About page rewrite

**Files:** `src/data/equipmentGuide/guideMeta.ts`, `equipmentGuide.data.test.ts`

- [ ] **Step 1: Add the About integrity test (RED)**

Append to `equipmentGuide.data.test.ts`:
```ts
describe('content-v2 about', () => {
  const aboutText = JSON.stringify(about);
  it('uses the four fixed pillar headings', () => {
    expect(about.pillars.map(p => p.heading)).toEqual([
      'Process-first platform selection',
      'Configured around your lab',
      'U.S.-based project coordination and support',
      'Peer-reviewed validation for represented platforms',
    ]);
  });
  it('carries the represented-platform qualifier and no forbidden claims', () => {
    expect(about.pillars[3].body.toLowerCase()).toMatch(/not.*ninescrolls|represented|corresponding/);
    expect(aboutText).not.toMatch(/\d+\+\s*years|years of experience|installations|research institutions served|customers/i);
    expect(aboutText).not.toMatch(/tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i);
  });
});
```

- [ ] **Step 2: Rewrite `about` in `guideMeta.ts`**

```ts
export const about: EquipmentGuideData['about'] = {
  title: 'About NineScrolls LLC',
  subtitle: 'U.S.-based process-equipment selection, configuration, and support',
  paragraphs: [
    'NineScrolls LLC helps universities, national laboratories, and R&D and advanced-manufacturing teams across the United States select, configure, and support semiconductor process equipment. We start from the work — your materials, target process window, sample size, and facility conditions — and match the platform to it, rather than starting from a catalog.',
    'As a U.S.-based partner, we coordinate selection, configuration, quoting, delivery, and after-sales support so a research team gets a process-ready platform and a local point of contact.',
  ],
  pillars: [
    { heading: 'Process-first platform selection', body: 'We confirm materials, process window, sample size, and facility conditions first, then match the platform — not the other way around.' },
    { heading: 'Configured around your lab', body: 'Platforms are specified to your throughput, wafer sizes, gases, and space, rather than sold as a fixed SKU.' },
    { heading: 'U.S.-based project coordination and support', body: 'Selection, configuration, quoting, delivery, and after-sales support are coordinated locally.' },
    { heading: 'Peer-reviewed validation for represented platforms', body: 'The corresponding platform classes appear in real peer-reviewed research — validating the process capability, not NineScrolls-owned equipment or NineScrolls-authored papers.' },
  ],
};
```
Run tests → green. Regenerate the PDF (About page reflow — confirm still 14 pages, About fits one page). Commit:
```bash
git add src/data/equipmentGuide/guideMeta.ts src/data/equipmentGuide/equipmentGuide.data.test.ts public/NineScrolls-Equipment-Guide.pdf
git commit -m "feat(guide): rewrite About page to NineScrolls' real value (process-first, U.S. support)"
```

---

### Task 6: Tighten `content` to required + finalize

**Files:** `src/data/equipmentGuide/types.ts`, `equipmentGuide.data.test.ts`, regenerated PDF

- [ ] **Step 1: Make `content` required + 11/11 completeness test**

In `types.ts` change `content?: GuideProductContent;` → `content: GuideProductContent;`. Append the completeness test:
```ts
it('all 11 products have a complete content block', () => {
  expect(equipmentGuideData.products).toHaveLength(11);
  for (const p of equipmentGuideData.products) {
    expect(p.content.lead.length, p.id).toBeGreaterThan(0);
    expect(p.content.applications.length, p.id).toBe(p.content.applicationCount);
    expect(p.content.href, p.id).toBe(PRODUCT_ROUTES[p.id]);
  }
});
```
Run `tsc`/tests → any product missing `content` now fails to compile. Green after all 11 authored.

- [ ] **Step 2: Full final verification (all 14 pages)**

Run in order:
```bash
npx vitest run --exclude '**/.claude/**'                    # full suite green
npm run build                                               # typecheck + bundle
npm run generate-equipment-guide                            # regenerate
python3 -c "from pypdf import PdfReader; import os; print('pages', len(PdfReader('public/NineScrolls-Equipment-Guide.pdf').pages), 'bytes', os.path.getsize('public/NineScrolls-Equipment-Guide.pdf'))"
```
Expected: full suite green; build OK; `pages 14`, `bytes` < 2000000. `pdftoppm` all 14 pages → read them: every product page single, no clipping/overflow, no body text < 12.5px, Evidence + Contact + spec tables unchanged.

- [ ] **Step 3: Commit the final tightening + regenerated PDF**

```bash
git add src/data/equipmentGuide/types.ts src/data/equipmentGuide/equipmentGuide.data.test.ts public/NineScrolls-Equipment-Guide.pdf
git commit -m "feat(guide): require content on all 11 products + 11/11 completeness test"
```

---

## Self-Review

**1. Spec coverage:**
- Data model (`GuideProductContent`, optional→required) → Task 2 Step 1, Task 6 Step 1. ✓
- Copy rules (lead from hero.description, applications = slice, bullets 3–4, specs untouched) → Task 3/4 content + Task 4 Step 3 tests. ✓
- Applications ordered deep-equality + plasma-cleaner literals (contract 1) → Task 4 Step 3. ✓
- CTA absolute + canonical route + `data-product-id` per section (contract 2) → Task 2 Steps 2–4. ✓
- All-or-none nested content + pilot review-only isolated worktree + one-complete-PR (contract 3) → Task 2/3/6. ✓
- Protection fixtures from `f76765a8`, committed, no auto-snapshot (#1) → Task 1 + Task 2 Steps 2–3. ✓
- About rewrite + evidence-pillar qualifier (#7) → Task 5. ✓
- Traceability doc (#4) → Task 4 Step 2. ✓
- Page policy: hard 14, budget, overflow order, ≥12.5px, all-14 screenshots → Task 3 Step 3, Task 4 Step 4, Task 6 Step 2. ✓
- Files list → matches the six task files + fixtures + traceability. ✓

**2. Placeholder scan:** The 9 non-pilot leads/bullets are authored during Task 4 execution *from the exact `hero.description` + specs listed inline* — this is intentional (pilot-first locks the voice before the 9 are written), not a vague TODO; the source inputs and rules are fully specified. RIE + E-Beam are authored verbatim in the plan.

**3. Type/name consistency:** `GuideProductContent` (lead/applications/applicationCount/href), `PRODUCT_ROUTES`, `SITE_ORIGIN`, `data-product-id`, `content?`→`content`, `WEBSITE_CONFIGS` (reused from v1), the `<section class="page` split helper, and `esc()` are consistent across tasks.
