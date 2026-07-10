# Equipment Guide Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-made, OEM-disclosing `public/NineScrolls-Equipment-Guide.pdf` with a regenerable PDF produced from a canonical TypeScript data source, an HTML/CSS template, and a Puppeteer renderer.

**Architecture:** Canonical TS data (`src/data/equipmentGuide/`) → a pure `renderEquipmentGuideHtml(data)` function that emits a self-contained HTML string (CSS inlined, product images embedded as base64 data URIs) → `scripts/generate-equipment-guide.ts` drives Puppeteer to print that HTML to `public/NineScrolls-Equipment-Guide.pdf`. The render function is pure and unit-tested for brand-integrity and completeness invariants without a browser; Puppeteer runs only in the script.

**Tech Stack:** TypeScript, `tsx` (script runner, already used by all repo scripts), `puppeteer` (new devDependency), Vitest + Testing Library, Node `fs`/`Buffer` for base64 image embedding.

**Spec:** `docs/superpowers/specs/2026-07-09-equipment-guide-generator-design.md`

---

## File Structure

| File | Responsibility |
|---|---|
| `src/data/equipmentGuide/types.ts` | All types: `SpecRow`, `SpecParityCheck`, `GuideProduct`, `EvidenceStudy`, `EquipmentGuideData`, `SubTable` |
| `src/data/equipmentGuide/guideMeta.ts` | About page, represented-platform evidence page (from Task 0), contact page, brand tokens |
| `src/data/equipmentGuide/products.ts` | The 11 `GuideProduct` entries (bullets + spec tables + image map + `websiteSpecParity`) |
| `src/data/equipmentGuide/index.ts` | Assembles + exports the single `EquipmentGuideData` object |
| `src/data/equipmentGuide/equipmentGuide.data.test.ts` | Data invariants: completeness, brand-integrity, evidence integrity, spec-parity |
| `docs/equipment-guide/evidence-verification.md` | Task-0 source notes for the ACS / Scientific Reports evidence studies |
| `src/templates/equipmentGuide/equipmentGuide.css.ts` | Exported CSS string (navy/slate/sky design system) |
| `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` | Pure `(EquipmentGuideData) => string` full HTML doc; embeds images as base64 |
| `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts` | Rendered-output invariants (no OEM, no scale claims, evidence, 11 products, data-URI images) |
| `scripts/generate-equipment-guide.ts` | data → HTML → Puppeteer `page.pdf()` → `public/NineScrolls-Equipment-Guide.pdf` |
| `public/NineScrolls-Equipment-Guide.pdf` | Generated output (committed, replaces current) |
| `package.json` | Add `puppeteer` devDep + `generate-equipment-guide` script |

Run tests with: `npx vitest run <file> --exclude '**/.claude/**'` (nested-worktree exclusion per project convention).

---

### Task 0: Evidence source verification (gates the evidence page)

**Files:**
- Create: `docs/equipment-guide/evidence-verification.md`

This task records verified facts used in Task 2. Do NOT author `guideMeta.ts` evidence until this passes.

- [ ] **Step 1: Verify the two candidate studies via live sources**

Run these lookups (Scholar is fetchable via WebFetch; OpenAlex confirms metadata/DOI):

1. ACS Applied Nano Materials 2025 — RIE-100 SERS (Liu et al.). Confirm exact title, that the journal is "ACS Applied Nano Materials", year 2025, a resolvable DOI, and a current citation count (Google Scholar `Cited by N`, record as-of date).
2. Scientific Reports 2025 — ICP diamond etch (Zhao et al.). Confirm exact title, journal "Scientific Reports", year 2025, a resolvable DOI, and current citation count + as-of date.

Use `WebSearch`/`WebFetch` on `scholar.google.com/scholar?q=<title>` for the count and `api.openalex.org/works/https://doi.org/<doi>` for `cited_by_count` + `title` + `publication_date`.

- [ ] **Step 2: Lock the subtitle journal list**

Decision rule:
- If BOTH studies verify (real title + resolvable DOI): keep subtitle = `Nature Portfolio journals, ACS, Advanced Materials, Materials Today, and Scientific Reports`, and both studies go into `evidence.studies` (studies 5–6).
- If ONLY ACS verifies: drop `Scientific Reports` from the subtitle and omit study 6.
- If ONLY Scientific Reports verifies: drop `ACS` from the subtitle and omit study 5.
- If NEITHER: subtitle = `Nature Portfolio journals, Advanced Materials, and Materials Today` (matches the shipped homepage), omit both.

- [ ] **Step 3: Record and commit the verified facts**

Create `docs/equipment-guide/evidence-verification.md` with:
- date of verification
- query/source URL(s)
- exact title
- journal
- year
- DOI or canonical publisher URL
- Google Scholar citation count + as-of date
- whether the study is included in the final evidence page

This provenance file is committed so the Task-0 gate survives worker/session handoff. Do not leave the only evidence record as an uncommitted plan edit.

```bash
git add docs/equipment-guide/evidence-verification.md
git commit -m "docs(guide): verify evidence-page source studies"
```

---

### Task 1: Scaffold — puppeteer dependency + types

**Files:**
- Modify: `package.json`
- Create: `src/data/equipmentGuide/types.ts`
- Test: `src/data/equipmentGuide/equipmentGuide.data.test.ts`

- [ ] **Step 1: Add the puppeteer devDependency and the generate script**

Run: `npm install --save-dev puppeteer`
Then in `package.json` `scripts`, add:
```json
"generate-equipment-guide": "npx tsx scripts/generate-equipment-guide.ts",
```
Expected: `puppeteer` appears under `devDependencies`; Chromium downloads once.

- [ ] **Step 2: Write the failing type/shape test**

Create `src/data/equipmentGuide/equipmentGuide.data.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import type { GuideProduct, EquipmentGuideData } from './types';

describe('equipmentGuide types', () => {
  it('SpecRow supports one- and two-column values', () => {
    const oneCol: GuideProduct['specs'][number] = { label: 'Vacuum', value: 'TMP&Mechanical Pump' };
    const twoCol: GuideProduct['specs'][number] = { label: 'Wafer Size Range', value: 'up to 6 inch', value2: 'up to 12 inch' };
    expect(oneCol.value).toBeTruthy();
    expect(twoCol.value2).toBe('up to 12 inch');
  });

  it('EquipmentGuideData has the four top sections', () => {
    const keys: (keyof EquipmentGuideData)[] = ['about', 'evidence', 'products', 'contact'];
    expect(keys).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `Cannot find module './types'`.

- [ ] **Step 4: Create `src/data/equipmentGuide/types.ts`**

```ts
export interface SpecRow {
  label: string;
  value: string;
  value2?: string; // second column for two-column spec tables
}

export interface SubTable {
  title: string;        // e.g. 'Hotplate Specifications'
  specs: SpecRow[];     // single-column rows
}

export interface SpecParityCheck {
  guideLabel: string;      // spec row label in THIS guide product
  websiteLabel: string;    // matching label in the website config specifications.items
  guideExpected: string;   // normalized substring expected in the guide value
  websiteExpected: string; // normalized substring expected in the website value
}

export interface GuideProduct {
  id: string;
  series: string;
  order: number;
  image: string;      // repo-relative path under public/
  imageAlt: string;
  footprint?: string;
  bullets: { heading: string; body: string }[];
  specHeaders?: [string, string]; // two-column table headers
  specs: SpecRow[];
  subTable?: SubTable;            // e.g. Coater/Developer hotplate section
  familyOptions?: string[];      // plasma-cleaner family SKUs
  websiteSpecParity?: {
    productSlug: string; // canonical config slug, e.g. 'icp-etcher' / 'ald'
    checks: SpecParityCheck[];
  };
}

export interface EvidenceStudy {
  journal: string;
  year: number;
  title: string;
  platform: string;       // 'RIE' | 'ICP' | 'PECVD' | ...
  citations?: number;
  citationsAsOf?: string; // e.g. 'Jul 2026'
  doi?: string;
}

export interface EquipmentGuideData {
  about: {
    title: string;
    subtitle: string;
    paragraphs: string[];
    pillars: { heading: string; body: string }[];
  };
  evidence: {
    title: string;
    subtitle: string;
    intro: string;
    studies: EvidenceStudy[];
    disclaimer: string;
  };
  products: GuideProduct[];
  contact: {
    office: string[];
    hours: string[];
    contacts: { label: string; value: string }[];
    support: { label: string; value: string }[];
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/data/equipmentGuide/types.ts src/data/equipmentGuide/equipmentGuide.data.test.ts
git commit -m "feat(guide): scaffold equipment-guide data types + puppeteer devdep"
```
> Note: `package-lock.json` is intentionally staged HERE because we changed dependencies. Do not stage it in any later task.

---

### Task 2: `guideMeta.ts` — about, evidence, contact

**Files:**
- Create: `src/data/equipmentGuide/guideMeta.ts`
- Test: `src/data/equipmentGuide/equipmentGuide.data.test.ts` (extend)

- [ ] **Step 1: Add failing meta tests**

Append to `equipmentGuide.data.test.ts`:
```ts
import { about, evidence, contact } from './guideMeta';

describe('guideMeta content integrity', () => {
  const BANNED_VENDOR = /tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i;
  const BANNED_CLAIMS = /trusted manufacturer partner|1000\+|300\+|30\+ years|years of experience|global installations|research institutions served/i;

  const metaText = JSON.stringify({ about, evidence, contact });

  it('names no OEM/supplier anywhere in meta content', () => {
    expect(metaText).not.toMatch(BANNED_VENDOR);
  });

  it('makes no mis-attributed scale claims', () => {
    expect(metaText).not.toMatch(BANNED_CLAIMS);
  });

  it('backs every journal named in the evidence subtitle with a listed study', () => {
    const named = ['Nature Portfolio', 'ACS', 'Advanced Materials', 'Materials Today', 'Scientific Reports']
      .filter(j => evidence.subtitle.includes(j));
    for (const j of named) {
      const family = j === 'Nature Portfolio'
        ? evidence.studies.some(s => s.journal === 'Nature Communications' || s.journal === 'Light: Science & Applications')
        : evidence.studies.some(s => s.journal.startsWith(j));
      expect(family, `journal "${j}" named in subtitle must have a study`).toBe(true);
    }
  });

  it('never claims flagship Nature and stamps any citation count with an as-of date', () => {
    expect(evidence.studies.some(s => s.journal === 'Nature')).toBe(false);
    for (const s of evidence.studies) {
      if (s.citations !== undefined) expect(s.citationsAsOf, `${s.title} needs citationsAsOf`).toBeTruthy();
    }
  });

  it('ships no Task-0 placeholders and every listed study has a DOI/source', () => {
    const serialized = JSON.stringify(evidence);
    expect(serialized).not.toMatch(/<<|TASK-0|CONFIRMED TITLE|TODO|TBD/i);
    for (const s of evidence.studies) {
      expect(s.title.trim(), `${s.journal} needs a real title`).not.toHaveLength(0);
      expect(s.doi, `${s.title} needs a DOI before shipping`).toMatch(/^10\./);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `Cannot find module './guideMeta'`.

- [ ] **Step 3: Create `src/data/equipmentGuide/guideMeta.ts`**

Studies 1–4 are pre-verified (shipped in the homepage reframe). Studies 5–6 use the values confirmed in **Task 0** — replace the ACS/Scientific Reports entries below with the Task 0 confirmed title/doi/citations/citationsAsOf, or remove them and trim the subtitle per the Task 0 decision rule.

```ts
import type { EquipmentGuideData } from './types';

export const about: EquipmentGuideData['about'] = {
  title: 'About NineScrolls LLC',
  subtitle: 'Leading Innovation in Scientific Research Equipment',
  paragraphs: [
    'NineScrolls LLC is a dynamic start-up company dedicated to advancing innovation and integration in the scientific research equipment industry. Our primary focus is on establishing a comprehensive platform that connects manufacturers, researchers, and industry professionals across the United States.',
    'By fostering collaboration and streamlining access to cutting-edge laboratory equipment, we aim to empower scientific discovery and drive technological advancements. At NineScrolls LLC, we are committed to delivering tailored solutions and creating value for our partners and clients through expertise, efficiency, and innovation.',
  ],
  pillars: [
    { heading: 'Integration', body: 'We create seamless connections between manufacturers, researchers, and industry professionals to advance scientific discovery.' },
    { heading: 'Innovation', body: 'We drive advancement in the scientific equipment industry through innovative solutions and platforms.' },
    { heading: 'Collaboration', body: 'We foster partnerships and facilitate connections across the scientific community to accelerate progress.' },
    { heading: 'Expertise', body: 'We leverage deep industry knowledge to deliver tailored solutions that create value for our partners and clients.' },
  ],
};

export const evidence: EquipmentGuideData['evidence'] = {
  title: 'Peer-Reviewed Validation for the Platforms We Represent',
  subtitle: 'Research using corresponding plasma, deposition, and vacuum process platforms has appeared in Nature Portfolio journals, ACS, Advanced Materials, Materials Today, and Scientific Reports.',
  intro: 'Real published research using corresponding process platforms.',
  studies: [
    { journal: 'Nature Communications', year: 2021, title: 'Near-ideal van der Waals rectifiers based on all-two-dimensional Schottky junctions', platform: 'RIE', citations: 245, citationsAsOf: 'Jul 2026', doi: '10.1038/s41467-021-21861-6' },
    { journal: 'Light: Science & Applications', year: 2026, title: 'On-chip nonlocal metasurface for color router', platform: 'RIE', doi: '10.1038/s41377-025-02146-9' },
    { journal: 'Advanced Materials', year: 2026, title: 'Diffraction-free omnidirectional antireflection binary metasurface', platform: 'ICP', doi: '10.1002/adma.202519943' },
    { journal: 'Materials Today', year: 2026, title: 'Solar-blind deep-UV photodetector based on β-Ga₂O₃/AlN/p-Si', platform: 'PECVD', citations: 9, citationsAsOf: 'Jul 2026', doi: '10.1016/j.mattod.2026.103220' },
    // Study 5 (ACS Applied Nano Materials 2025 RIE SERS) — REPLACE with Task 0 confirmed values or remove + trim subtitle:
    { journal: 'ACS Applied Nano Materials', year: 2025, title: '<<TASK-0 CONFIRMED TITLE>>', platform: 'RIE', doi: '<<TASK-0 DOI>>' },
    // Study 6 (Scientific Reports 2025 ICP diamond) — REPLACE with Task 0 confirmed values or remove + trim subtitle:
    { journal: 'Scientific Reports', year: 2025, title: '<<TASK-0 CONFIRMED TITLE>>', platform: 'ICP', doi: '<<TASK-0 DOI>>' },
  ],
  disclaimer: 'These publications validate represented platform classes and process capabilities. They are not claims of NineScrolls-branded installed-base citations.',
};

export const contact: EquipmentGuideData['contact'] = {
  office: ['12546 Cabezon Pl', 'San Diego, CA 92129', 'United States'],
  hours: ['Monday – Friday', '9:00 AM – 5:00 PM PST'],
  contacts: [
    { label: 'General Inquiries', value: 'info@ninescrolls.com' },
    { label: 'Sales', value: 'sales@ninescrolls.com' },
    { label: 'Urgent Matters', value: '+1 (858) 879-8898' },
  ],
  support: [
    { label: 'Support Email', value: 'support@ninescrolls.com' },
    { label: 'Support Hours', value: 'Monday – Friday, 8:00 AM – 6:00 PM PST' },
    { label: 'Emergency Support', value: '24/7 available for critical issues' },
  ],
};
```
> The `<<TASK-0 …>>` markers MUST be replaced with Task 0's confirmed values before this step is considered done. The tests above reject `<<`, `TASK-0`, `TODO`, `TBD`, blank titles, and missing/non-DOI links, so placeholders cannot pass green. If Task 0 dropped a study, delete that entry AND remove its journal from `evidence.subtitle`.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: PASS (all data tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/equipmentGuide/guideMeta.ts src/data/equipmentGuide/equipmentGuide.data.test.ts
git commit -m "feat(guide): about, represented-platform evidence, and contact meta"
```

---

### Task 3: `products.ts` — the 11 series entries

**Files:**
- Create: `src/data/equipmentGuide/products.ts`
- Test: `src/data/equipmentGuide/equipmentGuide.data.test.ts` (extend)

Author all 11 products in one file. Data below is transcribed verbatim from the current guide PDF (pages 3–13) and, for E-Beam, from `eBeamEvaporatorConfig.ts`. Image paths are the verified standardized assets.

- [ ] **Step 1: Add failing completeness test**

Append to `equipmentGuide.data.test.ts`:
```ts
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { products } from './products';

describe('products completeness', () => {
  it('has exactly 11 series in stable order', () => {
    expect(products).toHaveLength(11);
    const orders = products.map(p => p.order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(new Set(orders).size).toBe(11);
  });

  it('every product has a real standardized image, series, bullets, and specs', () => {
    for (const p of products) {
      expect(p.series, p.id).toBeTruthy();
      expect(p.bullets.length, p.id).toBeGreaterThan(0);
      expect(p.specs.length, p.id).toBeGreaterThan(0);
      expect(p.image, p.id).toMatch(/-standardized\.webp$/);
      expect(existsSync(resolve(process.cwd(), 'public', p.image.replace(/^\//, ''))), `${p.id} image missing`).toBe(true);
    }
  });

  it('names no OEM/supplier and no scale claims in product content', () => {
    const text = JSON.stringify(products);
    expect(text).not.toMatch(/tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i);
    expect(text).not.toMatch(/1000\+|300\+|30\+ years|global installations/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `Cannot find module './products'`.

- [ ] **Step 3: Create `src/data/equipmentGuide/products.ts`**

```ts
import type { GuideProduct } from './types';

const IMG = '/assets/images/redesign/products';

export const products: GuideProduct[] = [
  {
    id: 'rie', series: 'RIE Etcher Series', order: 1,
    image: `${IMG}/rie-standardized.webp`, imageAlt: 'NineScrolls RIE etcher platform',
    footprint: 'ref 1.0m × 1.0m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.0m).' },
      { heading: 'Uniform Chamber Center Pump-down', body: 'Better process performance.' },
      { heading: 'Showerhead Gas Feed-in', body: 'Tuned as a preset parameter dependently.' },
      { heading: 'Configurable Plasma Discharge Gap', body: 'Tuned as a preset parameter dependently.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Etching Materials', value: 'Si-Based (Si/SiO2/SiNx/SiC/Quartz etc.), Compounds (InP/GaN/GaAs/Ga2O3/ZnS etc.), 1D&2D Materials (MoS2/BN/Graphene etc.), Metals (Au/Pt/W/Ta/Mo etc.), Failure Analysis, etc.' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'RF Power', value: 'Full Range 300-1000W, optional' },
      { label: 'Gas System', value: '4 lines (Standard) or customized' },
      { label: 'Wafer Cooling', value: 'Water Cooling or He Backside Cooling optional' },
      { label: 'Wafer Stage Temperature Range', value: 'From -70℃ to 200℃, optional' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'rie-etcher',
      checks: [
        // Author from src/components/products/productDetailConfigs/rieEtcherConfig.ts specifications.items.
        // Example shape (confirm exact website values when authoring):
        // { guideLabel: 'Wafer Stage Temperature Range', websiteLabel: 'Stage Temp', guideExpected: '-70to200c', websiteExpected: '-70to200c' },
      ],
    },
  },
  {
    id: 'icp-rie', series: 'ICP Etcher Series', order: 2,
    image: `${IMG}/icp-rie-standardized.webp`, imageAlt: 'NineScrolls ICP-RIE plasma etching platform',
    footprint: 'ref 1.0m × 1.5m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.5m).' },
      { heading: 'Process Design Kits', body: 'Better process performance.' },
      { heading: 'Chamber Control', body: 'Chamber liner, electrode temperature control suitable for different process application.' },
      { heading: 'Configurable Plasma Discharge Gap', body: 'Tuned as a parameter dependently.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Plasma Specialization', body: 'Low power plasma technology, ion damage-free optional.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Etching Materials', value: 'Si-Based (Si/SiO2/SiNx/SiC/Quartz etc.), Compounds (InP/GaN/GaAs/Ga2O3 etc.), 2D Materials (MoS2/BN/Graphene etc.), Metals (W/Ta/Mo etc.), Diamond, Failure Analysis, etc.' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'RF Power', value: 'Source 1000-3000W, Bias 300-1000W, optional' },
      { label: 'Gas System', value: '5 lines (Standard) and He backside cooling, or customized' },
      { label: 'Wafer Stage Temperature Range', value: 'From -70℃ to 200℃, optional' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'icp-etcher',
      checks: [
        // Website config specifications.items (confirmed from icpEtcherConfig.ts):
        //   Wafer Size '4-12 in' | Gas System '5 lines std.' | Stage Temp '-70 to 200 C' | RF Power '1000-3000 W' | Bias RF '300-1000 W optional'
        { guideLabel: 'Wafer Stage Temperature Range', websiteLabel: 'Stage Temp', guideExpected: '-70to200c', websiteExpected: '-70to200c' },
        { guideLabel: 'RF Power', websiteLabel: 'RF Power', guideExpected: 'source1000-3000w', websiteExpected: '1000-3000w' },
        { guideLabel: 'RF Power', websiteLabel: 'Bias RF', guideExpected: 'bias300-1000w', websiteExpected: '300-1000w' },
        { guideLabel: 'Gas System', websiteLabel: 'Gas System', guideExpected: '5lines', websiteExpected: '5lines' },
      ],
    },
  },
  {
    id: 'stripper', series: 'Plasma Photoresist Stripping Series', order: 3,
    image: `${IMG}/striper-standardized.webp`, imageAlt: 'NineScrolls plasma photoresist stripping platform',
    footprint: 'ref 0.8m × 0.8m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 0.8m × 0.8m).' },
      { heading: 'Uniform Chamber Center Pump-down', body: 'Better process performance.' },
      { heading: 'Uniform Gas Feed-in', body: 'Tuned as a preset parameter dependently.' },
      { heading: 'Configurable Plasma Discharge Gap', body: 'Tuned as a preset parameter dependently.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling', body: 'Open-Load.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Etching Materials', value: 'Organics (PR/PMMA/PS nanosphere etc.), 2D Materials (MoS2/BN/Graphene etc.), Failure Analysis, etc.' },
      { label: 'Vacuum', value: 'Mechanical pump' },
      { label: 'RF Power', value: 'Full range 300-1000W, optional' },
      { label: 'Gas System', value: '2 lines (Standard) or customized' },
      { label: 'Wafer Cooling', value: 'Water cooling' },
      { label: 'Wafer Stage Temperature Range', value: 'From 5℃ to 200℃, optional' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'striper-system',
      checks: [ /* author from striperSystemConfig.ts specifications.items */ ],
    },
  },
  {
    id: 'ibe-ribe', series: 'IBE/RIBE Series', order: 4,
    image: `${IMG}/ibe-ribe-standardized.webp`, imageAlt: 'NineScrolls ion beam etching (IBE/RIBE) platform',
    footprint: 'ref 1.0m × 0.8m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 0.8m).' },
      { heading: 'Maintenance and Sample-handling Friendly', body: 'Sample holder and ion source design for easy-to-use operation.' },
      { heading: 'Flexible Ion Source Design', body: 'Different kinds of ion source easy-to-swap design, depending on customer requirements.' },
      { heading: 'Cost or Performance Orientation', body: 'Ion source, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
    ],
    specHeaders: ['Kaufman ion source', 'RF ion Source'],
    specs: [
      { label: 'Wafer Size Range', value: 'up to 6 inch', value2: 'up to 12 inch' },
      { label: 'Gas System', value: '1 line (standard) or customized', value2: '3 line (standard) or customized' },
      { label: 'Wafer Stage Motion', value: 'Tilt from 0° to 90°, Rotation from 1-10 rpm/min' },
      { label: 'Wafer Stage Cooling', value: 'From 5 to 20℃, Water cooling; He backside cooling optional' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'Base Vacuum', value: 'Better than 7E-7 Torr' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'ibe-ribe-system',
      checks: [ /* author from ibeRibeConfig.ts specifications.items */ ],
    },
  },
  {
    id: 'ald', series: 'ALD Series', order: 5,
    image: `${IMG}/ald-standardized.webp`, imageAlt: 'NineScrolls ALD system',
    footprint: 'ref 0.8m × 1.0m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 0.8m × 1.0m).' },
      { heading: 'Box-in-Box Process Chamber', body: 'Better process performance.' },
      { heading: 'Configurable Gas Feed-in', body: 'Showerhead gas feed-in, tuned as a preset parameter independently.' },
      { heading: 'High-AR Step Coverage', body: 'Excellent high-AR step covering capability with multiple gas inlets and vertical precursor throw.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or Supersize optional' },
      { label: 'Growth Materials', value: 'Oxides (Al2O3/HfO2/SiO2/TiO2/Ga2O3/ZnO etc.), Nitrides (TiN/TaN/SiNx/AlN/GaN etc.), Metals (Pt/Pd/W etc.), etc.' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'Base Vacuum', value: 'Better than 5E-5 Torr' },
      { label: 'RF Power', value: 'Remote Plasma 300-1000W, optional' },
      { label: 'Number of Precursor', value: '2-6 lines or customized' },
      { label: 'Temperature of Source', value: 'From 20℃ to 150℃ (Standard), 200℃ optional' },
      { label: 'Wafer Temperature Range', value: 'From 20℃ to 400℃, higher temperature optional' },
      { label: 'Non-Uniformity', value: 'Less than ±1% (Al2O3)' },
    ],
    websiteSpecParity: {
      productSlug: 'ald-system',
      checks: [ /* author from aldSystemConfig.ts specifications.items */ ],
    },
  },
  {
    id: 'pecvd', series: 'PECVD Series', order: 6,
    image: `${IMG}/pecvd-standardized.webp`, imageAlt: 'NineScrolls PECVD thin film deposition system',
    footprint: 'ref 1.0m × 1.0m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.0m).' },
      { heading: 'Process Design Kits', body: 'Better process performance.' },
      { heading: 'Variable Plasma Discharge Gap', body: 'Better process performance.' },
      { heading: 'Temperature Control', body: 'Chamber liner, electrode temperature control suitable for different process application.' },
      { heading: 'Advanced RF System', body: 'Electrode RF driven (13.56MHz and/or 400KHz) for better process tuning and control, low stress.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Deposition Materials', value: 'Si-Based (α-Si:H/SiO2/SiNx/SiC etc.), etc.' },
      { label: 'Vacuum', value: 'Roots & Mechanical Pump' },
      { label: 'RF Power', value: 'Full Range 500-2000W, optional' },
      { label: 'Gas System', value: '6 lines (Standard) or customized' },
      { label: 'Wafer Stage Temperature Range', value: 'From 20℃ to 400℃, higher temperature optional' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'pecvd-system',
      checks: [ /* author from pecvdSystemConfig.ts specifications.items */ ],
    },
  },
  {
    id: 'hdp-cvd', series: 'HDP-CVD Series', order: 7,
    image: `${IMG}/hdp-cvd-standardized.webp`, imageAlt: 'NineScrolls HDP-CVD system',
    footprint: 'ref 1.0m × 1.5m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.5m).' },
      { heading: 'Process Design Kits', body: 'Better process performance.' },
      { heading: 'Temperature Control', body: 'Chamber liner, electrode temperature control suitable for different process application.' },
      { heading: 'Step Coverage', body: 'Excellent step covering capability, tuned as a parameter dependently.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Deposition Materials', value: 'Si/SiO2/SiNx/SiON/SiC, etc.' },
      { label: 'Vacuum', value: 'TMP & Mechanical Pump' },
      { label: 'RF Power', value: 'Full Range: Source 1000-3000W, Bias 300-1000W, optional' },
      { label: 'Gas System', value: '6 lines (Standard) or customized' },
      { label: 'Wafer Stage Temperature Range', value: 'From 20℃ to 200℃' },
      { label: 'Non-Uniformity', value: 'Less than ±5% (Edge Exclusion)' },
    ],
    websiteSpecParity: {
      productSlug: 'hdp-cvd-system',
      checks: [ /* author from hdpCvdSystemConfig.ts specifications.items */ ],
    },
  },
  {
    id: 'sputter', series: 'PVD Magnetron Sputtering Series', order: 8,
    image: `${IMG}/sputter-standardized.webp`, imageAlt: 'NineScrolls sputtering system',
    footprint: 'ref 1.0m × 1.7m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 1.7m).' },
      { heading: 'Creative Magnetron Design', body: 'Magnetron target structure self-designed, designed and modified based on customer needs.' },
      { heading: 'Flexible Target Configuration', body: 'Magnetron target face-down or face-up optional, angle tiltable and deposition distance tunable.' },
      { heading: 'Advanced Electrode Control', body: 'Electrode rotational and temperature controllable, suitable for different process application.' },
      { heading: 'RF Bias Capability', body: 'Substrate can be RF biased for in-situ clean, and better process tuning and control.' },
      { heading: 'Cost or Performance Orientation', body: 'RF, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling Options', body: 'Open-Load or Load-Lock.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '4, 6, 8, 12 inch or multi-wafers optional' },
      { label: 'Magnetron Sputtering Source', value: '2-6 optional' },
      { label: 'Substrate Temperature', value: 'Water-cooling, 400℃, 800℃, 1200℃, optional' },
      { label: 'Gas System', value: '2 lines (Standard), number of lines customized' },
      { label: 'Power', value: 'DC or RF customized, automatic switcher' },
      { label: 'Non-Uniformity', value: 'Less than ±5%' },
      { label: 'Pre-Cleaning', value: 'Independent chamber or in-situ, RF plasma, optional' },
      { label: 'Base Pressure', value: 'Better than 5E-7 Torr, higher vacuum customized' },
    ],
    websiteSpecParity: {
      productSlug: 'sputter-system',
      checks: [ /* author from sputterSystemConfig.ts specifications.items */ ],
    },
  },
  {
    id: 'coater-developer', series: 'Coater/Developer & Hotplate Series', order: 9,
    image: `${IMG}/coater-developer-standardized.webp`, imageAlt: 'NineScrolls Coater/Developer system for photolithography',
    footprint: 'ref 1.0m × 0.8m',
    bullets: [
      { heading: 'Uni-body Design Concept', body: 'Foot-print outstanding (ref 1.0m × 0.8m).' },
      { heading: 'Flexible Configuration', body: 'Number of coater/developer/hotplate modules customized.' },
      { heading: 'Modular Options', body: 'Wide range of options down to module level, including dispense systems, temperature for developers etc.' },
      { heading: 'Cost or Performance Orientation', body: 'Dispense, pump, valves etc. depending on requirements.' },
      { heading: 'Sample Handling', body: 'Open-Load.' },
    ],
    specHeaders: ['Coater', 'Developer'],
    specs: [
      { label: 'Wafer Size Range', value: 'Small-piece, 2, 4, 6, 8, 12 inch or Square optional' },
      { label: 'Max. Spin Speed', value: '8000 rpm ±1rpm', value2: '5000 rpm ±1rpm' },
      { label: 'Max. Acceleration', value: '8000 rpm/s', value2: '5000 rpm/s' },
      { label: 'Dispense Arm', value: 'Up to 2 photoresist lines', value2: 'Up to 2 developer lines and deionized water line' },
      { label: 'Interlock', value: 'Vacuum pressure, uncover etc.' },
    ],
    subTable: {
      title: 'Hotplate Specifications',
      specs: [
        { label: 'Wafer Size Range', value: 'Small-piece, 2, 4, 6, 8, 12 inch or Square optional' },
        { label: 'Max. Temperature', value: 'Up to 200℃, Higher Temperature optional' },
        { label: 'Lift-Pins', value: '3 lift-pins, minimum compatible 2 inch' },
      ],
    },
    websiteSpecParity: {
      productSlug: 'coater-developer',
      checks: [ /* author from coaterDeveloperConfig.ts specifications.items */ ],
    },
  },
  {
    id: 'plasma-cleaner', series: 'Plasma Cleaner Systems', order: 10,
    image: `${IMG}/hy-20l-standardized.webp`, imageAlt: 'NineScrolls compact RF plasma cleaner system',
    footprint: 'ref 630 mm × 600 mm',
    bullets: [
      { heading: 'Ultra-Compact Footprint', body: 'One-piece integrated design for space-limited laboratories (ref 630 mm × 600 mm).' },
      { heading: 'Maintenance and Sample-handling Friendly', body: 'Simple chamber structure with easy access; designed for fast loading, cleaning, and routine maintenance.' },
      { heading: 'Stable and Cost-Effective Performance', body: 'Optimized RF plasma design for repeatable surface treatment; excellent cost-performance ratio for research and light manufacturing.' },
      { heading: 'Flexible Process Capability', body: 'Supports surface cleaning, activation, and modification; single-wafer or multi-wafer batch processing.' },
      { heading: 'Multi-Gas Plasma Processing', body: 'Compatible with O₂ / N₂ / Ar plasma processes; supports hydrophilic / hydrophobic surface treatments.' },
      { heading: 'Tabletop / Bench-top Design', body: 'Single or multi-wafer batch processing; compatible with 6-inch and smaller wafers.' },
    ],
    specs: [
      { label: 'Wafer Size Range', value: '≤ 6 inch, multi-wafer batch processing' },
      { label: 'RF Power', value: '0 ~ 300 W / 500 W, automatic matching' },
      { label: 'Gas System', value: '2 ~ 3 gas lines' },
      { label: 'Process Gases', value: 'O₂, N₂, Ar' },
      { label: 'Flow Control Range', value: '0 ~ 300 sccm' },
      { label: 'Flow Control', value: 'MFC or manual control' },
      { label: 'Pump System', value: 'Mechanical pump (TMP optional)' },
      { label: 'Operation', value: 'Touchscreen control, fully automated' },
      { label: 'Footprint', value: '630 mm × 600 mm' },
      { label: 'Compatible Materials', value: 'Photoresist (PR); PMMA; PDMS; HMDS; organic films and polymers; semiconductor materials; optical materials; biomedical materials' },
      { label: 'Main Functions', value: 'Surface cleaning; surface activation; hydrophilic / hydrophobic treatment; functional group modification (–OH / –H / –COOH); contact-free plasma processing' },
      { label: 'Typical Applications', value: 'Chemical & biological laboratories; failure analysis; optical components; biomedical and medical devices' },
    ],
    familyOptions: ['HY-4L', 'HY-20L', 'HY-20LRF', 'PLUTO-T', 'PLUTO-M', 'PLUTO-F'],
    // No websiteSpecParity: the guide's cleaner page is a family summary, not a single website SKU.
  },
  {
    id: 'e-beam', series: 'E-Beam Evaporation Series', order: 11,
    image: `${IMG}/e-beam-standardized.webp`, imageAlt: 'NineScrolls e-beam and thermal evaporation system',
    footprint: undefined,
    bullets: [
      { heading: 'Multi-Source E-Beam and Thermal', body: 'E-beam and thermal resistance sources for metals, oxides, fluorides, and IR films.' },
      { heading: 'In-situ Endpoint Control', body: 'In-situ QCM thickness monitoring and endpoint control.' },
      { heading: 'Optical and IR Stack Ready', body: 'High-purity films for photonic crystals, optical multilayers, and IR sensors.' },
      { heading: 'Flexible Operating Modes', body: 'Manual, semi-automatic, or full-automatic operation.' },
      { heading: 'Directional Lift-off Deposition', body: 'Directional deposition suited to lift-off metallization and patterning.' },
    ],
    specs: [
      { label: 'Substrate', value: '1×8 in or 5×4 in' },
      { label: 'E-Gun Crucible', value: '6 pockets, 17 cc each' },
      { label: 'Uniformity', value: '±3-5%' },
      { label: 'Thickness Control', value: 'In-situ QCM endpoint' },
      { label: 'Vacuum', value: '~8×10⁻⁴ Pa' },
      { label: 'Operating Modes', value: 'Manual / semi-auto / full-auto' },
      { label: 'Sources', value: 'E-beam + thermal resistance' },
      { label: 'Materials', value: 'Metals, oxides, fluorides, IR films' },
    ],
    websiteSpecParity: {
      productSlug: 'e-beam-evaporator',
      checks: [
        // Website config specifications.items (confirmed from eBeamEvaporatorConfig.ts):
        //   Substrate '1x8 in or 5x4 in' | Uniformity '+/-3-5%' | Vacuum '~8x10^-4 Pa'
        { guideLabel: 'Substrate', websiteLabel: 'Substrate', guideExpected: '1x8inor5x4in', websiteExpected: '1x8inor5x4in' },
        { guideLabel: 'Uniformity', websiteLabel: 'Uniformity', guideExpected: '3-5%', websiteExpected: '3-5%' },
      ],
    },
  },
];
```
> **Authoring note for `websiteSpecParity.checks`:** for each product that has a website page, open the matching config in `src/components/products/productDetailConfigs/` (e.g. `rieEtcherConfig.ts`), read its `specifications.items`, and add at least **2** `checks` for stable values (wafer size, RF power, gas lines, temperature). ICP and E-Beam are fully worked above as the pattern. This is done values-in-hand from the config — not a guess. The parity TEST (Task 4) will fail if a website-backed product has fewer than 2 checks, so coverage cannot lapse silently.

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: PASS (completeness + brand tests).

- [ ] **Step 5: Commit**

```bash
git add src/data/equipmentGuide/products.ts src/data/equipmentGuide/equipmentGuide.data.test.ts
git commit -m "feat(guide): 11 series product data (specs, bullets, standardized images)"
```

---

### Task 4: `index.ts` assembly + spec-parity guard

**Files:**
- Create: `src/data/equipmentGuide/index.ts`
- Test: `src/data/equipmentGuide/equipmentGuide.data.test.ts` (extend)

- [ ] **Step 1: Add failing assembly + parity test**

Append to `equipmentGuide.data.test.ts`:
```ts
import { equipmentGuideData } from './index';
import { aldSystemConfig } from '../../components/products/productDetailConfigs/aldSystemConfig';
import { coaterDeveloperConfig } from '../../components/products/productDetailConfigs/coaterDeveloperConfig';
import { eBeamEvaporatorConfig } from '../../components/products/productDetailConfigs/eBeamEvaporatorConfig';
import { hdpCvdSystemConfig } from '../../components/products/productDetailConfigs/hdpCvdSystemConfig';
import { ibeRibeSystemConfig } from '../../components/products/productDetailConfigs/ibeRibeSystemConfig';
import { icpEtcherConfig } from '../../components/products/productDetailConfigs/icpEtcherConfig';
import { pecvdSystemConfig } from '../../components/products/productDetailConfigs/pecvdSystemConfig';
import { rieEtcherConfig } from '../../components/products/productDetailConfigs/rieEtcherConfig';
import { sputterSystemConfig } from '../../components/products/productDetailConfigs/sputterSystemConfig';
import { striperSystemConfig } from '../../components/products/productDetailConfigs/striperSystemConfig';

const WEBSITE_CONFIGS = {
  ald: aldSystemConfig,
  'coater-developer': coaterDeveloperConfig,
  'e-beam-evaporator': eBeamEvaporatorConfig,
  'hdp-cvd': hdpCvdSystemConfig,
  'ibe-ribe': ibeRibeSystemConfig,
  'icp-etcher': icpEtcherConfig,
  pecvd: pecvdSystemConfig,
  'rie-etcher': rieEtcherConfig,
  sputter: sputterSystemConfig,
  striper: striperSystemConfig,
} as const;

// Normalize a spec value the same way parity checks declare it.
function norm(v: string): string {
  return v.toLowerCase().replace(/[\s,]/g, '').replace(/optional|full range|:/g, '');
}

describe('assembled EquipmentGuideData', () => {
  it('assembles all four sections and 11 products', () => {
    expect(equipmentGuideData.products).toHaveLength(11);
    expect(equipmentGuideData.about.pillars).toHaveLength(4);
    expect(equipmentGuideData.evidence.studies.length).toBeGreaterThanOrEqual(4);
    expect(equipmentGuideData.contact.contacts.length).toBeGreaterThan(0);
  });
});

describe('spec-parity guard (guide vs website configs)', () => {
  it('requires parity checks for every website-backed guide product', () => {
    const expected = Object.keys(WEBSITE_CONFIGS).sort();
    const actual = equipmentGuideData.products
      .filter(p => p.websiteSpecParity)
      .map(p => p.websiteSpecParity!.productSlug)
      .sort();
    expect(actual).toEqual(expected);
    for (const p of equipmentGuideData.products.filter(p => p.websiteSpecParity)) {
      expect(p.websiteSpecParity!.checks.length, `${p.id} needs at least two parity checks`).toBeGreaterThanOrEqual(2);
    }
  });

  it('every declared websiteSpecParity check matches both sources', () => {
    for (const p of equipmentGuideData.products) {
      if (!p.websiteSpecParity) continue;
      const cfg = WEBSITE_CONFIGS[p.websiteSpecParity.productSlug as keyof typeof WEBSITE_CONFIGS];
      expect(cfg, `config for ${p.websiteSpecParity.productSlug} not found`).toBeTruthy();
      const items: { label: string; value: string }[] = cfg.specifications.items;
      for (const check of p.websiteSpecParity.checks) {
        const guideRow = p.specs.find(s => s.label === check.guideLabel);
        expect(guideRow, `${p.id} missing guide row ${check.guideLabel}`).toBeTruthy();
        const siteItem = items.find(i => i.label === check.websiteLabel);
        expect(siteItem, `${p.websiteSpecParity!.productSlug} missing website row ${check.websiteLabel}`).toBeTruthy();
        expect(norm(guideRow!.value + (guideRow!.value2 ?? '')), `${p.id} ${check.guideLabel} guide value`).toContain(check.guideExpected);
        expect(norm(siteItem!.value), `${p.websiteSpecParity!.productSlug} ${check.websiteLabel} website value`).toContain(check.websiteExpected);
      }
    }
  });
});
```
> The explicit `WEBSITE_CONFIGS` map is intentional. Do not replace it with slug→filename inference; product routes and config filenames are not one-to-one (`ald` → `aldSystemConfig`, `ibe-ribe` → `ibeRibeSystemConfig`, etc.).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Create `src/data/equipmentGuide/index.ts`**

```ts
import type { EquipmentGuideData } from './types';
import { about, evidence, contact } from './guideMeta';
import { products } from './products';

export const equipmentGuideData: EquipmentGuideData = { about, evidence, products, contact };
```

- [ ] **Step 4: Adjust parity checks until green**

Run: `npx vitest run src/data/equipmentGuide/equipmentGuide.data.test.ts --exclude '**/.claude/**'`
Expected: PASS. If a parity check fails, the message names the product + label + which side mismatched — fix `guideExpected` / `websiteExpected` (or the guide value if genuinely wrong) so guide and website agree. Add at least 2 checks for each website-backed product using each config's `specifications.items`.

- [ ] **Step 5: Commit**

```bash
git add src/data/equipmentGuide/index.ts src/data/equipmentGuide/equipmentGuide.data.test.ts src/data/equipmentGuide/products.ts
git commit -m "feat(guide): assemble guide data + deterministic spec-parity guard vs website configs"
```

---

### Task 5: `equipmentGuide.css.ts` — design-system CSS string

**Files:**
- Create: `src/templates/equipmentGuide/equipmentGuide.css.ts`

- [ ] **Step 1: Create the CSS string (navy/slate/sky, print-ready)**

```ts
export const equipmentGuideCss = `
  @page { size: Letter; margin: 0.6in 0.6in 0.7in 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, h3 { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; margin: 0 0 8px; }
  .page { break-after: page; padding-top: 4px; }
  .page:last-child { break-after: auto; }
  .brandbar { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 20px; }
  .brandbar .site { color: #64748b; font-size: 12px; }
  .eyebrow { color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
  .series-title { color: #1e3a5f; font-size: 28px; margin: 6px 0 14px; }
  .product-head { display: flex; gap: 20px; align-items: flex-start; }
  .product-copy { flex: 1 1 55%; }
  .product-img { flex: 0 0 42%; text-align: center; }
  .product-img img { max-width: 100%; height: auto; border-radius: 8px; background: #f4f5f7; padding: 8px; }
  .bullet { break-inside: avoid; margin-bottom: 8px; }
  .bullet .h { color: #0369a1; font-weight: 700; font-size: 13px; }
  .bullet .b { color: #334155; font-size: 12.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; break-inside: auto; }
  th { background: #1e3a5f; color: #fff; text-align: left; font-size: 12.5px; padding: 8px 12px; }
  td { border-bottom: 1px solid #e2e8f0; font-size: 12.5px; padding: 8px 12px; vertical-align: top; }
  td.label { width: 34%; color: #0f172a; font-weight: 600; background: #f8fafc; }
  tr { break-inside: avoid; }
  .evidence { background: #0f172a; color: #e2e8f0; border-radius: 12px; padding: 22px; }
  .evidence h1 { color: #fff; font-size: 26px; }
  .evidence .sub { color: #cbd5e1; font-size: 13px; margin-bottom: 14px; }
  .study { border-top: 1px solid #1e293b; padding: 10px 0; }
  .study .j { color: #7dd3fc; font-weight: 700; font-size: 13px; }
  .study .t { color: #f1f5f9; font-size: 13px; }
  .study .m { color: #94a3b8; font-size: 11.5px; }
  .disclaimer { color: #94a3b8; font-size: 11px; margin-top: 12px; font-style: italic; }
  .pillar { break-inside: avoid; margin-bottom: 10px; }
  .pillar .h { color: #0369a1; font-weight: 700; }
  .family { color: #334155; font-size: 12.5px; margin-top: 10px; }
`;
```

- [ ] **Step 2: Commit**

```bash
git add src/templates/equipmentGuide/equipmentGuide.css.ts
git commit -m "feat(guide): navy/slate/sky print CSS for the guide template"
```

---

### Task 6: `renderEquipmentGuideHtml.ts` — pure data → HTML

**Files:**
- Create: `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts`
- Test: `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts`

- [ ] **Step 1: Write the failing render-invariant test**

Create `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { renderEquipmentGuideHtml } from './renderEquipmentGuideHtml';
import { equipmentGuideData } from '../../data/equipmentGuide';

const html = renderEquipmentGuideHtml(equipmentGuideData);

describe('renderEquipmentGuideHtml', () => {
  it('produces a self-contained HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<link[^>]+href/i); // no external CSS
  });

  it('leaks no OEM/supplier name', () => {
    expect(html).not.toMatch(/tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i);
  });

  it('makes no mis-attributed scale claims and no flagship Nature', () => {
    expect(html).not.toMatch(/trusted manufacturer partner|1000\+|300\+|30\+ years|global installations|research institutions served/i);
    expect(html).not.toContain('class="j">Nature ·'); // no card whose journal is exactly flagship Nature
  });

  it('renders the represented-platform evidence page', () => {
    expect(html).toContain('Peer-Reviewed Validation for the Platforms We Represent');
    expect(html).toContain('Near-ideal van der Waals rectifiers');
    expect(html).toContain('not claims of NineScrolls-branded installed-base citations');
  });

  it('renders all 11 series with their images embedded as base64 data URIs', () => {
    for (const p of equipmentGuideData.products) {
      expect(html, p.id).toContain(p.series);
    }
    const dataUris = html.match(/data:image\/webp;base64,/g) ?? [];
    expect(dataUris.length).toBeGreaterThanOrEqual(11);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `Cannot find module './renderEquipmentGuideHtml'`.

- [ ] **Step 3: Create `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts`**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EquipmentGuideData, GuideProduct, SpecRow } from '../../data/equipmentGuide/types';
import { equipmentGuideCss } from './equipmentGuide.css';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function imageDataUri(publicRelPath: string): string {
  const abs = resolve(process.cwd(), 'public', publicRelPath.replace(/^\//, ''));
  const b64 = readFileSync(abs).toString('base64');
  return `data:image/webp;base64,${b64}`;
}

function specRowsHtml(specs: SpecRow[], twoCol: boolean): string {
  return specs.map(r => {
    if (twoCol && r.value2 !== undefined) {
      return `<tr><td class="label">${esc(r.label)}</td><td>${esc(r.value)}</td><td>${esc(r.value2)}</td></tr>`;
    }
    const span = twoCol ? ' colspan="2"' : '';
    return `<tr><td class="label">${esc(r.label)}</td><td${span}>${esc(r.value)}</td></tr>`;
  }).join('');
}

function productPage(p: GuideProduct): string {
  const twoCol = !!p.specHeaders;
  const bullets = p.bullets.map(b =>
    `<div class="bullet"><span class="h">${esc(b.heading)}</span> <span class="b">${esc(b.body)}</span></div>`).join('');
  const headRow = twoCol
    ? `<tr><th>Specification</th><th>${esc(p.specHeaders![0])}</th><th>${esc(p.specHeaders![1])}</th></tr>`
    : `<tr><th>Specification</th><th>Parameters</th></tr>`;
  const family = p.familyOptions
    ? `<p class="family"><strong>Family options:</strong> ${p.familyOptions.map(esc).join(' · ')}</p>` : '';
  const sub = p.subTable
    ? `<table><tr><th colspan="2">${esc(p.subTable.title)}</th></tr>${specRowsHtml(p.subTable.specs, false)}</table>` : '';
  return `
  <section class="page">
    ${brandbar()}
    <p class="eyebrow">Equipment Platform</p>
    <h1 class="series-title">${esc(p.series)}</h1>
    <div class="product-head">
      <div class="product-copy">${bullets}</div>
      <div class="product-img"><img src="${imageDataUri(p.image)}" alt="${esc(p.imageAlt)}"/></div>
    </div>
    <table>${headRow}${specRowsHtml(p.specs, twoCol)}</table>
    ${sub}${family}
  </section>`;
}

function brandbar(): string {
  return `<div class="brandbar"><strong>NINESCROLLS</strong><span class="site">https://ninescrolls.com&nbsp;&nbsp;&nbsp;info@ninescrolls.com</span></div>`;
}

function aboutPage(d: EquipmentGuideData): string {
  const pillars = d.about.pillars.map(p =>
    `<div class="pillar"><span class="h">${esc(p.heading)}</span><div>${esc(p.body)}</div></div>`).join('');
  const paras = d.about.paragraphs.map(t => `<p>${esc(t)}</p>`).join('');
  return `<section class="page"><h1>${esc(d.about.title)}</h1><p class="eyebrow">${esc(d.about.subtitle)}</p>${paras}${pillars}</section>`;
}

function evidencePage(d: EquipmentGuideData): string {
  const studies = d.evidence.studies.map(s => {
    const cite = s.citations !== undefined ? ` · ${s.citations} citations (as of ${esc(s.citationsAsOf ?? '')})` : '';
    return `<div class="study"><span class="j">${esc(s.journal)} · ${s.year}</span>
      <div class="t">${esc(s.title)}</div>
      <div class="m">Corresponding ${esc(s.platform)} process platform${cite}</div></div>`;
  }).join('');
  return `<section class="page"><div class="evidence">
    <h1>${esc(d.evidence.title)}</h1>
    <div class="sub">${esc(d.evidence.subtitle)}</div>
    <p>${esc(d.evidence.intro)}</p>
    ${studies}
    <p class="disclaimer">${esc(d.evidence.disclaimer)}</p>
  </div></section>`;
}

function contactPage(d: EquipmentGuideData): string {
  const line = (label: string, val: string) => `<p><strong>${esc(label)}:</strong> ${esc(val)}</p>`;
  return `<section class="page">${brandbar()}
    <h2>Office Location</h2><p>${d.contact.office.map(esc).join('<br/>')}</p>
    <h2>Business Hours</h2><p>${d.contact.hours.map(esc).join('<br/>')}</p>
    <h2>Contact Information</h2>${d.contact.contacts.map(c => line(c.label, c.value)).join('')}
    <h2>Technical Support</h2>${d.contact.support.map(c => line(c.label, c.value)).join('')}
  </section>`;
}

export function renderEquipmentGuideHtml(d: EquipmentGuideData): string {
  const products = [...d.products].sort((a, b) => a.order - b.order).map(productPage).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>NineScrolls LLC — Equipment Guide</title>
<style>${equipmentGuideCss}</style></head><body>
${aboutPage(d)}${evidencePage(d)}${products}${contactPage(d)}
</body></html>`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts --exclude '**/.claude/**'`
Expected: PASS (all render invariants). If the flagship-Nature regex is awkward, simplify to `expect(html).not.toMatch(/class="j">Nature ·/)` (asserts no study labeled exactly "Nature ·").

- [ ] **Step 5: Commit**

```bash
git add src/templates/equipmentGuide/renderEquipmentGuideHtml.ts src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts
git commit -m "feat(guide): pure HTML renderer with base64-embedded images + brand-integrity tests"
```

---

### Task 7: `scripts/generate-equipment-guide.ts` — Puppeteer → PDF

**Files:**
- Create: `scripts/generate-equipment-guide.ts`
- Output: `public/NineScrolls-Equipment-Guide.pdf`

- [ ] **Step 1: Create the generator script**

```ts
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { equipmentGuideData } from '../src/data/equipmentGuide';
import { renderEquipmentGuideHtml } from '../src/templates/equipmentGuide/renderEquipmentGuideHtml';

async function main() {
  const html = renderEquipmentGuideHtml(equipmentGuideData);
  const outPath = resolve(process.cwd(), 'public', 'NineScrolls-Equipment-Guide.pdf');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.6in', right: '0.6in', bottom: '0.7in', left: '0.6in' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;font-size:9px;color:#64748b;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span> &nbsp;·&nbsp; ninescrolls.com</div>',
    });
    writeFileSync(outPath, pdf);
    console.log(`Wrote ${outPath} (${(pdf.length / 1024).toFixed(0)} KB)`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Generate the PDF**

Run: `npm run generate-equipment-guide`
Expected: `Wrote …/public/NineScrolls-Equipment-Guide.pdf (NNN KB)` — non-trivial size (> 200 KB, images embedded).

- [ ] **Step 3: Verify the output structurally**

Use Python `pypdf` (available in the local runtime; install only if missing) to assert page count and text invariants:

```bash
python3 - <<'PY'
from pathlib import Path
from pypdf import PdfReader

pdf = Path('public/NineScrolls-Equipment-Guide.pdf')
reader = PdfReader(str(pdf))
text = '\n'.join((page.extract_text() or '') for page in reader.pages)
assert len(reader.pages) == 14, f'expected 14 pages, got {len(reader.pages)}'
assert 'Peer-Reviewed Validation for the Platforms We Represent' in text
assert 'Trusted Manufacturer Partner' not in text
assert 'Tyloong' not in text
assert '1000+' not in text
assert '300+' not in text
assert 'E-Beam Evaporation' in text
print(f'PDF structure OK: {len(reader.pages)} pages, {len(text)} extracted chars')
PY
```

Expected: exits 0 and prints page count + extracted text size.

- [ ] **Step 4: Verify the output visually**

Read the generated PDF: `Read public/NineScrolls-Equipment-Guide.pdf` (all pages). Confirm:
- Page 1 About; Page 2 is the dark **represented-platform evidence** page (title + real studies + disclaimer) — NOT the old "Trusted Manufacturer Partner".
- 11 product pages with the **standardized** images (not the old renders) and correct spec tables.
- No "Tyloong", no 30+/1000+/300+ anywhere.
- Contact page present.

- [ ] **Step 5: Grep the raw PDF for regressions**

Run: `grep -aiE "tyloong|1000\+|300\+|trusted manufacturer" public/NineScrolls-Equipment-Guide.pdf && echo "LEAK" || echo "clean"`
Expected: `clean` (text may be compressed in the PDF stream; the render-invariant tests are the authoritative guard — this is a best-effort double-check).

- [ ] **Step 6: Commit**

```bash
git add scripts/generate-equipment-guide.ts public/NineScrolls-Equipment-Guide.pdf
git commit -m "feat(guide): puppeteer generator + regenerated clean Equipment Guide PDF"
```

---

### Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite (excluding nested worktrees)**

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: PASS — all prior tests plus the new guide data + render tests.

- [ ] **Step 2: Generator smoke (script type/runtime path)**

Run: `npm run generate-equipment-guide`
Expected: succeeds. This is the verification that actually exercises `scripts/generate-equipment-guide.ts`; `tsconfig.json` only includes `src`, so `tsc` alone does not check this script.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: succeeds; no TypeScript errors for app code. This also confirms the Puppeteer devDependency does not enter the web bundle.

- [ ] **Step 4: Confirm the guide download still resolves**

The 7 configs already point to `/NineScrolls-Equipment-Guide.pdf`; we overwrote that same path, so no link change is needed. Spot-check one config still references it:
Run: `grep -l "NineScrolls-Equipment-Guide.pdf" src/components/products/productDetailConfigs/*.ts | head`
Expected: still lists hy4l/hy20l/etc.

- [ ] **Step 5: No stray staging of forbidden files**

Run: `git status --porcelain`
Expected: clean (or only intended files). Confirm `tmp/` and (post-Task-1) `package-lock.json` are NOT modified/staged here.

---

## Self-Review

**1. Spec coverage:**
- Canonical TS SoT under `src/data/equipmentGuide/` → Tasks 1–4. ✓
- Puppeteer HTML→PDF, devDep, self-contained images → Tasks 1, 6, 7. ✓
- Page-2 represented-platform evidence (title/subtitle/studies/disclaimer, subtitle-journals-backed) → Task 2 + tests. ✓
- 11 series incl. E-Beam; plasma cleaner as family page → Task 3. ✓
- July-redesign visual (navy/slate/sky) → Task 5 CSS. ✓
- Attribution/brand rules (no OEM, no scale claims, no flagship Nature) → negative tests in Tasks 2, 3, 6. ✓
- Explicit `websiteSpecParity` mapping + deterministic parity test → types (Task 1), data (Task 3), test (Task 4). ✓
- Task 0 evidence verification gating the subtitle/studies → Task 0. ✓
- Non-goals (datasheets, website reverse-reuse) → not in plan. ✓

**2. Placeholder scan:** The only intentional fill-ins are (a) `<<TASK-0 …>>` in Task 2 evidence studies 5–6 (gated by Task 0, with an explicit manual-gate note), and (b) `websiteSpecParity.checks` for 8 products (authored values-in-hand from each config, with ICP + E-Beam fully worked as the pattern and a loud failing test if wrong). These are dependency-ordered real work, not vague TODOs.

**3. Type consistency:** `EquipmentGuideData`, `GuideProduct`, `SpecRow`, `SpecParityCheck`, `EvidenceStudy`, `SubTable` are defined once (Task 1) and used consistently in `guideMeta.ts`, `products.ts`, `index.ts`, and `renderEquipmentGuideHtml.ts`. `equipmentGuideData` (index export), `renderEquipmentGuideHtml` (render export), `equipmentGuideCss` (css export) names match across tasks.
