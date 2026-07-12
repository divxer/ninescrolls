# SEMISHARE Probe Stations Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Launch 4 SEO strategy pages (probe-station capability, SEMISHARE brand, cryogenic application, silicon-photonics application), the first insight article, and the supporting SEO infrastructure per the approved spec.

**Architecture:** Independent page components under `src/pages/probeStations/` reusing existing building blocks (`SEO`, `Breadcrumbs`, layout/Tailwind idiom), plus a small probe-station component set under `src/components/probeStations/`. A single data module `src/data/probeStations/semishare.ts` holds the attestation gate (flag + controlled-wording registry) and all product-line performance specs, each spec row carrying a public-source annotation. Numeric product-line specs render ONLY through `SourcedSpecTable`.

**Tech Stack:** React 18 + TypeScript + Tailwind classes, react-helmet-async, react-router-dom, Vitest + Testing Library, Python/PIL for diagrams, sharp (`scripts/optimize-images.js`) for responsive variants.

**Spec:** `docs/superpowers/specs/2026-07-12-semishare-probe-stations-design.md` — read it first. Constraints 3 (public-verifiable specs only), 6 (attestation gate), and 7 (no unverifiable specs) are hard rules.

**Branch:** `feature/semishare-probe-stations` (already created from origin/main; spec commits are on it).

**Verification commands** (used throughout):
- Tests: `npx vitest run <path> --exclude '**/.claude/**'`
- Full suite: `npx vitest run --exclude '**/.claude/**'`
- Lint: `npm run lint` — Build: `npm run build`

---

## File Structure

```
src/data/probeStations/
  semishare.ts                       # attestation gate + wording registry + product lines + spec entries
  semishare.test.ts                  # registry behavior + spec traceability tests
  attestationScan.test.ts            # static forbidden-pattern scan over src/**
src/components/probeStations/
  PartnerAttestationBanner.tsx       # gated partner wording banner
  SourcedSpecTable.tsx               # spec table w/ per-row source + disclaimer
  StationTypeComparison.tsx          # manual/semi/full-auto qualitative comparison
  SchematicFigure.tsx                # figure wrapper w/ mandatory schematic caption
  probeStationComponents.test.tsx    # component unit tests
src/pages/probeStations/
  WaferProbeStationsPage.tsx         # /wafer-probe-stations
  WaferProbeStationsPage.test.tsx
  SemishareBrandPage.tsx             # /wafer-probe-stations/semishare
  SemishareBrandPage.test.tsx
  CryogenicProbingPage.tsx           # /applications/cryogenic-probing
  CryogenicProbingPage.test.tsx
  SiliconPhotonicsProbingPage.tsx    # /applications/silicon-photonics-probing
  SiliconPhotonicsProbingPage.test.tsx
  attestationGate.test.tsx           # flag-OFF assertions across all 4 pages
  attestationGate.on.test.tsx        # flag-ON assertions (vi.mock)
  llmsStaticPages.test.ts            # 4 URLs present in llms.txt + llms-full.txt
Modified:
  src/routes/index.tsx               # 4 lazy routes
  src/components/layout/Layout.tsx   # nav dropdown category "Test & Probing"
  src/components/layout/Layout.test.tsx
  src/pages/ProductsPage.tsx         # 'Probe Stations' family + card
  src/pages/ProductsPage.test.tsx
  scripts/generate-seo.ts            # 4 sitemap entries
  amplify/functions/generate-sitemaps/handler.ts  # 4 sitemap entries
  public/llms.txt, public/llms-full.txt           # probe-station section
  scripts/insightsPostsData.ts       # new article entry
Assets:
  public/assets/images/redesign/products/probe-station-schematic-standardized.png(+webp)
  public/assets/images/insights/probe-station-*.png(+ sm/md/lg/xl webp/png variants)
```

---

### Task 1: Attestation registry + data module

**Files:**
- Create: `src/data/probeStations/semishare.ts`
- Test: `src/data/probeStations/semishare.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/data/probeStations/semishare.test.ts
import { describe, expect, it } from 'vitest';
import {
  ATTESTATION_CONFIRMED,
  FORBIDDEN_ATTESTATION_PATTERNS,
  PARTNER_BADGE_ASSETS,
  getBrandPageSeoTitle,
  getPartnerBannerText,
  getPartnerJsonLdDescription,
  productLines,
} from './semishare';

describe('attestation registry', () => {
  it('ships with the gate OFF', () => {
    expect(ATTESTATION_CONFIRMED).toBe(false);
  });

  it('returns neutral wording when not confirmed', () => {
    expect(getPartnerBannerText(false)).toBe(
      'NineScrolls provides US & Canada procurement, import, and support for SEMISHARE wafer probe stations.'
    );
    expect(getBrandPageSeoTitle(false)).toBe(
      'SEMISHARE Wafer Probe Stations | US & Canada Sales & Support'
    );
    expect(getPartnerJsonLdDescription(false)).toBe(
      'NineScrolls LLC is a US-based supplier providing procurement, import, and after-sales support for SEMISHARE wafer probe stations in the United States and Canada.'
    );
  });

  it('returns attestation wording only when confirmed', () => {
    expect(getPartnerBannerText(true)).toBe(
      'Authorized channel partner for SEMISHARE wafer probe stations (US & Canada, non-exclusive).'
    );
    expect(getBrandPageSeoTitle(true)).toBe(
      'SEMISHARE Wafer Probe Stations | US & Canada Channel Partner'
    );
    expect(getPartnerJsonLdDescription(true)).toBe(
      'NineScrolls LLC is an authorized, non-exclusive channel partner for SEMISHARE wafer probe stations in the United States and Canada.'
    );
  });

  it('neutral wording does not itself trip the forbidden patterns', () => {
    for (const text of [
      getPartnerBannerText(false),
      getBrandPageSeoTitle(false),
      getPartnerJsonLdDescription(false),
    ]) {
      for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    }
  });

  it('defines no badge assets until written confirmation', () => {
    expect(PARTNER_BADGE_ASSETS).toEqual([]);
  });
});

describe('spec traceability (spec Constraint 3/7)', () => {
  const allSpecs = productLines.flatMap((line) =>
    line.specs.map((spec) => ({ line: line.key, ...spec }))
  );

  it('every spec entry has an https semishareprober.com source URL', () => {
    for (const spec of allSpecs) {
      const url = new URL(spec.source.url); // throws on unparseable
      expect(url.protocol, `${spec.line}/${spec.label}`).toBe('https:');
      expect(
        ['semishareprober.com', 'www.semishareprober.com'],
        `${spec.line}/${spec.label}: ${url.hostname}`
      ).toContain(url.hostname);
    }
  });

  it('every capturedOn is a real, non-future calendar date', () => {
    for (const spec of allSpecs) {
      const s = spec.source.capturedOn;
      expect(s, `${spec.line}/${spec.label}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      const parsed = new Date(`${s}T00:00:00Z`);
      // Round-trip: rejects rollover dates like 2026-02-30
      expect(parsed.toISOString().slice(0, 10), `${spec.line}/${spec.label}`).toBe(s);
      expect(parsed.getTime()).toBeLessThanOrEqual(Date.now());
    }
  });

  it('every product line has either specs or a qualitative positioning', () => {
    for (const line of productLines) {
      expect(line.positioning.length, line.key).toBeGreaterThan(20);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/probeStations/semishare.test.ts --exclude '**/.claude/**'`
Expected: FAIL — cannot resolve `./semishare`.

- [ ] **Step 3: Write the data module**

```ts
// src/data/probeStations/semishare.ts

export interface SpecSource {
  /** Public page the value was captured from (https, semishareprober.com only). */
  url: string;
  /** Capture date, YYYY-MM-DD. */
  capturedOn: string;
}

export interface SpecEntry {
  label: string;
  value: string;
  source: SpecSource;
}

export interface ProductLine {
  key: string;
  name: string;
  /** Qualitative positioning — no numbers attributed to a SEMISHARE model. */
  positioning: string;
  /** Public-verifiable performance specs. Empty ⇒ page renders the
   *  qualitative fallback + "detailed specifications on request" CTA. */
  specs: SpecEntry[];
}

/**
 * Attestation gate (spec Constraint 6). Ships OFF.
 * Flip to true ONLY upon explicit written L2 confirmation from SEMISHARE.
 * Components must pass this flag explicitly to the wording functions below —
 * never rely on a default argument (keeps vi.mock overrides effective).
 */
export const ATTESTATION_CONFIRMED = false;

/** Every gated output lives in this registry. Nothing outside this module may
 *  hardcode partner-relationship phrasing (enforced by attestationScan.test.ts). */
const WORDING = {
  bannerOff:
    'NineScrolls provides US & Canada procurement, import, and support for SEMISHARE wafer probe stations.',
  bannerOn:
    'Authorized channel partner for SEMISHARE wafer probe stations (US & Canada, non-exclusive).',
  seoTitleOff: 'SEMISHARE Wafer Probe Stations | US & Canada Sales & Support',
  seoTitleOn: 'SEMISHARE Wafer Probe Stations | US & Canada Channel Partner',
  jsonLdOff:
    'NineScrolls LLC is a US-based supplier providing procurement, import, and after-sales support for SEMISHARE wafer probe stations in the United States and Canada.',
  jsonLdOn:
    'NineScrolls LLC is an authorized, non-exclusive channel partner for SEMISHARE wafer probe stations in the United States and Canada.',
} as const;

export function getPartnerBannerText(confirmed: boolean): string {
  return confirmed ? WORDING.bannerOn : WORDING.bannerOff;
}

export function getBrandPageSeoTitle(confirmed: boolean): string {
  return confirmed ? WORDING.seoTitleOn : WORDING.seoTitleOff;
}

export function getPartnerJsonLdDescription(confirmed: boolean): string {
  return confirmed ? WORDING.jsonLdOn : WORDING.jsonLdOff;
}

/** Gated visual assets (badges / partner logos). None until SEMISHARE provides
 *  an authorized asset AND written confirmation lands. When populated, the
 *  PartnerAttestationBanner renders every entry — but only while the flag is
 *  ON (enforced by the gate tests, which iterate this list in both states). */
export const PARTNER_BADGE_ASSETS: ReadonlyArray<{ src: string; alt: string }> = [];

/**
 * Static-scan list (spec Constraint 6): phrase-level patterns on purpose —
 * NOT the bare word "authorized", which would false-positive on auth code
 * ("Unauthorized"). attestationScan.test.ts applies these to src/** source
 * text outside this module and test files.
 */
export const FORBIDDEN_ATTESTATION_PATTERNS: RegExp[] = [
  /authori[sz]ed\s+(channel\s+)?(partner|distributor|dealer|reseller)/i,
  /official\s+(partner|distributor|dealer|reseller)/i,
  /channel\s+partner/i,
  /semishare[-_](badge|partner[-_]?logo)/i,
];

/**
 * Product lines. `specs` starts EMPTY and is filled ONLY from live captures of
 * semishareprober.com public pages (Task 5). Do not add a number here from
 * memory, from third-party sites, or from internal documents.
 */
export const productLines: ProductLine[] = [
  {
    key: 'a-series',
    name: 'A Series — Fully Automatic Probe Stations',
    positioning:
      'Production-style fully automatic wafer probing designed to run with ATE for wafer acceptance testing and chip probing at volume.',
    specs: [],
  },
  {
    key: 'x-series',
    name: 'X Series — Semi-Automatic Probe Stations',
    positioning:
      'Recipe-assisted, motorized probing for multi-site device characterization across a wafer — the step up from manual stations when repeatability and throughput start to matter.',
    specs: [],
  },
  {
    key: 'cgx-series',
    name: 'CGX Series — Cryogenic Vacuum Probe Stations',
    positioning:
      'Closed vacuum enclosure with cryogenic cooling for low-temperature device physics, superconducting electronics, and quantum transport measurements.',
    specs: [],
  },
  {
    key: 'manual-series',
    name: 'SM / SE / SH Series — Manual Analytical Probe Stations',
    positioning:
      'Hand-driven analytical stations for university teaching labs, materials research, and single-device characterization where flexibility beats throughput.',
    specs: [],
  },
  {
    key: 'silicon-photonics',
    name: 'Wafer-Level Silicon Photonics Probing',
    positioning:
      'Fiber-alignment stages combined with electrical probing on semi-automatic and fully automatic platforms for wafer-level photonic device testing.',
    specs: [],
  },
  {
    key: 'mask-laser-repair',
    name: 'Mask Laser Repair',
    positioning:
      'Laser-based photomask defect repair systems — a specialty line alongside the probe station families.',
    specs: [],
  },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/probeStations/semishare.test.ts --exclude '**/.claude/**'`
Expected: PASS (traceability tests vacuously pass on empty `specs`; they bite in Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/data/probeStations/
git commit -m "feat(probe-stations): attestation registry + product line data module"
```

---

### Task 2: Static attestation scan test

**TDD exception:** this is a guardrail/characterization test, not red-green TDD —
it asserts a property of the codebase that is already true (no attestation
wording exists yet) so that later tasks cannot regress it. There is no red
phase; the "verify it fails" discipline is replaced by Step 2's sanity check
(`files.length > 100`) proving the scan actually walks the tree.

**Files:**
- Test: `src/data/probeStations/attestationScan.test.ts`

- [ ] **Step 1: Write the test**

```ts
// src/data/probeStations/attestationScan.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FORBIDDEN_ATTESTATION_PATTERNS } from './semishare';

const REGISTRY_FILE = join('src', 'data', 'probeStations', 'semishare.ts');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

describe('attestation wording static scan (spec Constraint 6)', () => {
  it('no forbidden attestation phrase or badge asset pattern appears in src/** outside the registry', () => {
    const files = walk('src').filter(
      (f) =>
        /\.(ts|tsx)$/.test(f) &&
        !/\.test\.(ts|tsx)$/.test(f) &&
        f !== REGISTRY_FILE &&
        !f.split(sep).includes('test-setup.ts')
    );
    expect(files.length).toBeGreaterThan(100); // sanity: the walk actually ran

    const violations: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
        if (pattern.test(text)) violations.push(`${file} matches ${pattern}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test — expected PASS immediately**

Run: `npx vitest run src/data/probeStations/attestationScan.test.ts --exclude '**/.claude/**'`
Expected: PASS (pre-verified: no existing `src/**` file matches the patterns). If it fails, the failure message names the file — inspect it; do NOT weaken the pattern without checking the spec's Constraint 6.

- [ ] **Step 3: Commit**

```bash
git add src/data/probeStations/attestationScan.test.ts
git commit -m "test(probe-stations): static scan forbids attestation wording outside registry"
```

---

### Task 3: Shared probe-station components

**Files:**
- Create: `src/components/probeStations/PartnerAttestationBanner.tsx`
- Create: `src/components/probeStations/SourcedSpecTable.tsx`
- Create: `src/components/probeStations/StationTypeComparison.tsx`
- Create: `src/components/probeStations/SchematicFigure.tsx`
- Test: `src/components/probeStations/probeStationComponents.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/components/probeStations/probeStationComponents.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { getPartnerBannerText } from '../../data/probeStations/semishare';
import { PartnerAttestationBanner } from './PartnerAttestationBanner';
import { SchematicFigure } from './SchematicFigure';
import { SourcedSpecTable } from './SourcedSpecTable';
import { StationTypeComparison } from './StationTypeComparison';

describe('PartnerAttestationBanner', () => {
  it('renders the neutral registry wording and no badge images while the gate is off', () => {
    const { container } = render(<PartnerAttestationBanner />);
    // Expected value comes from the registry getter; the literal string is
    // pinned separately in src/data/probeStations/semishare.test.ts.
    expect(screen.getByText(getPartnerBannerText(false))).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('SourcedSpecTable', () => {
  const specs = [
    {
      label: 'Wafer size',
      value: 'Up to 200 mm',
      source: { url: 'https://www.semishareprober.com/example', capturedOn: '2026-07-12' },
    },
  ];

  it('renders each row with a source reference and the OEM disclaimer', () => {
    render(<SourcedSpecTable specs={specs} caption="X Series" />);
    expect(screen.getByText('Wafer size')).toBeInTheDocument();
    expect(screen.getByText('Up to 200 mm')).toBeInTheDocument();
    const sourceLink = screen.getByRole('link', { name: /source/i });
    expect(sourceLink).toHaveAttribute('href', 'https://www.semishareprober.com/example');
    expect(
      screen.getByText(/from manufacturer public materials.*subject to OEM confirmation/i)
    ).toBeInTheDocument();
  });

  it('renders the request-specs fallback when there are no specs', () => {
    render(<SourcedSpecTable specs={[]} caption="A Series" />);
    expect(screen.getByText(/detailed specifications on request/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});

describe('SchematicFigure', () => {
  it('always renders the schematic disclaimer caption', () => {
    render(<SchematicFigure src="/assets/x.webp" alt="Probe station schematic" caption="Core subsystems" />);
    expect(screen.getByAltText('Probe station schematic')).toBeInTheDocument();
    expect(screen.getByText(/Schematic illustration, not actual product appearance/i)).toBeInTheDocument();
    expect(screen.getByText(/Core subsystems/)).toBeInTheDocument();
  });
});

describe('StationTypeComparison', () => {
  it('compares the three automation levels qualitatively', () => {
    render(<StationTypeComparison />);
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Semi-automatic')).toBeInTheDocument();
    expect(screen.getByText('Fully automatic')).toBeInTheDocument();
    expect(screen.getByText(/Hand-driven micropositioners/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/probeStations/probeStationComponents.test.tsx --exclude '**/.claude/**'`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the four components**

```tsx
// src/components/probeStations/PartnerAttestationBanner.tsx
import {
  ATTESTATION_CONFIRMED,
  PARTNER_BADGE_ASSETS,
  getPartnerBannerText,
} from '../../data/probeStations/semishare';

export function PartnerAttestationBanner() {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 px-6 py-4">
      <p className="m-0 text-sm font-semibold text-slate-900">
        {getPartnerBannerText(ATTESTATION_CONFIRMED)}
      </p>
      {ATTESTATION_CONFIRMED && PARTNER_BADGE_ASSETS.length > 0 && (
        <div className="mt-3 flex items-center gap-4">
          {PARTNER_BADGE_ASSETS.map((badge) => (
            <img key={badge.src} src={badge.src} alt={badge.alt} className="h-10 w-auto" />
          ))}
        </div>
      )}
    </div>
  );
}
```

```tsx
// src/components/probeStations/SourcedSpecTable.tsx
import type { SpecEntry } from '../../data/probeStations/semishare';

interface SourcedSpecTableProps {
  specs: SpecEntry[];
  caption: string;
}

export function SourcedSpecTable({ specs, caption }: SourcedSpecTableProps) {
  if (specs.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        Detailed specifications on request — contact us and we will confirm the
        exact configuration for your application with the manufacturer.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 pr-4 font-semibold text-slate-900">Specification</th>
            <th className="py-2 pr-4 font-semibold text-slate-900">Value</th>
            <th className="py-2 font-semibold text-slate-900">Reference</th>
          </tr>
        </thead>
        <tbody>
          {specs.map((spec) => (
            <tr key={spec.label} className="border-b border-slate-100">
              <td className="py-2 pr-4 text-slate-700">{spec.label}</td>
              <td className="py-2 pr-4 text-slate-900">{spec.value}</td>
              <td className="py-2 text-slate-500">
                <a
                  href={spec.source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-sky-700"
                >
                  source
                </a>{' '}
                ({spec.source.capturedOn})
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        Specifications from manufacturer public materials; subject to OEM confirmation.
      </p>
    </div>
  );
}
```

```tsx
// src/components/probeStations/StationTypeComparison.tsx
const ROWS = [
  {
    aspect: 'Positioning',
    manual: 'Hand-driven micropositioners',
    semi: 'Motorized stage, manual probe setup',
    auto: 'Programmed wafer mapping and auto-alignment',
  },
  {
    aspect: 'Throughput',
    manual: 'One measurement at a time',
    semi: 'Moderate; recipe-assisted stepping',
    auto: 'High; unattended full-wafer runs',
  },
  {
    aspect: 'Best for',
    manual: 'Materials studies, single-device work, teaching',
    semi: 'Multi-site device characterization',
    auto: 'Production-style test with ATE',
  },
] as const;

export function StationTypeComparison() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left">
            <th className="py-2 pr-4 font-semibold text-slate-900"> </th>
            <th className="py-2 pr-4 font-semibold text-slate-900">Manual</th>
            <th className="py-2 pr-4 font-semibold text-slate-900">Semi-automatic</th>
            <th className="py-2 font-semibold text-slate-900">Fully automatic</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.aspect} className="border-b border-slate-100">
              <td className="py-2 pr-4 font-medium text-slate-900">{row.aspect}</td>
              <td className="py-2 pr-4 text-slate-700">{row.manual}</td>
              <td className="py-2 pr-4 text-slate-700">{row.semi}</td>
              <td className="py-2 text-slate-700">{row.auto}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

```tsx
// src/components/probeStations/SchematicFigure.tsx
interface SchematicFigureProps {
  src: string;
  alt: string;
  caption: string;
}

export function SchematicFigure({ src, alt, caption }: SchematicFigureProps) {
  return (
    <figure className="my-6">
      <img src={src} alt={alt} loading="lazy" className="w-full rounded-xl border border-slate-200" />
      <figcaption className="mt-2 text-xs text-slate-500">
        {caption} — Schematic illustration, not actual product appearance.
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/probeStations/probeStationComponents.test.tsx --exclude '**/.claude/**'`
Expected: PASS. Also run `npx vitest run src/data/probeStations/attestationScan.test.ts --exclude '**/.claude/**'` — the new components must not trip the scan (they get wording only via the registry).

- [ ] **Step 5: Commit**

```bash
git add src/components/probeStations/
git commit -m "feat(probe-stations): shared components — attestation banner, sourced spec table, type comparison, schematic figure"
```

---

### Task 4: Schematic diagrams and image assets

Original diagrams only (spec Constraint 4) — never download images from semishareprober.com. Brand colors: navy `#1e3a5f`, accent `#3b82f6`, light gray `#f5f5f5`.

**Files:**
- Create: Python script in scratchpad (throwaway), outputs:
  - `public/assets/images/redesign/products/probe-station-schematic-standardized.png` (ProductsPage card, 1200×900 white background like other standardized cards)
  - `public/assets/images/insights/probe-station-anatomy.png` (page schematic: chuck / micropositioners / microscope / signal path)
  - `public/assets/images/insights/probe-station-temperature-regimes.png` (article Fig: ambient / thermal / cryogenic tiers)
  - `public/assets/images/insights/probe-station-automation-levels.png` (article Fig: manual vs semi vs full-auto)
  - `public/assets/images/insights/probe-station-guide-cover.png` (article cover)

- [ ] **Step 1: Write and run the diagram script**

**This is a visual-iteration step, not run-once code**: the skeleton below is the
required scaffolding (paths, fonts, clip checks); the drawing coordinates WILL
need 2–3 iterations of render → look at the PNG → adjust. Budget for that.
Content rules: no numeric SEMISHARE specs in any diagram; generic physics
numbers like "77 K (liquid nitrogen)" are allowed per spec §3.

Write `<scratchpad>/probe_diagrams.py`:

```python
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

NAVY = "#1e3a5f"; BLUE = "#3b82f6"; GRAY = "#f5f5f5"; WHITE = "#ffffff"
REPO = Path("/Users/harvey/Dev/src/cursor/ninescrolls")
INSIGHTS = REPO / "public/assets/images/insights"
PRODUCTS = REPO / "public/assets/images/redesign/products"
INSIGHTS.mkdir(parents=True, exist_ok=True)
PRODUCTS.mkdir(parents=True, exist_ok=True)

def font(size: int) -> ImageFont.FreeTypeFont:
    """Helvetica on macOS with a portable fallback — never load_default at
    final render (it is tiny and unscalable)."""
    for candidate in ("/System/Library/Fonts/Helvetica.ttc",
                      "/System/Library/Fonts/Supplemental/Arial.ttf"):
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    raise SystemExit("No usable TrueType font found — install one or add a path")

def draw_text_checked(draw: ImageDraw.ImageDraw, xy, text, fnt, fill, canvas_size):
    """Draw and assert the text bbox stays inside the canvas (anti-clip guard)."""
    bbox = draw.textbbox(xy, text, font=fnt)
    assert bbox[0] >= 0 and bbox[1] >= 0, f"clipped at origin: {text!r}"
    assert bbox[2] <= canvas_size[0] and bbox[3] <= canvas_size[1], f"clipped: {text!r}"
    draw.text(xy, text, font=fnt, fill=fill)

# Five outputs (exact filenames, sizes, and label text):
# 1. INSIGHTS/"probe-station-anatomy.png" (1600x1000): four labeled blocks
#    around a wafer-on-chuck sketch — "Chuck (sample stage)",
#    "Micropositioners + probes", "Microscope / camera",
#    "Shielded signal path to instruments".
# 2. INSIGHTS/"probe-station-temperature-regimes.png" (1600x900): three
#    horizontal tiers — "Ambient (room temperature)" / "Thermal chuck
#    (heated / cooled)" / "Cryogenic vacuum (down to liquid-nitrogen and
#    liquid-helium range)" — with example applications per tier:
#    "standard I-V / C-V", "reliability & temperature-dependent
#    characterization", "superconductors, quantum transport, 2D materials".
# 3. INSIGHTS/"probe-station-automation-levels.png" (1600x900): three columns
#    Manual / Semi-automatic / Fully automatic with one-line descriptors
#    matching the StationTypeComparison rows (Task 3).
# 4. INSIGHTS/"probe-station-guide-cover.png" (1600x900): navy title card —
#    "Choosing a Wafer Probe Station" + subtitle "A university lab buyer's guide".
# 5. PRODUCTS/"probe-station-schematic-standardized.png" (1200x900, WHITE
#    background like the other *-standardized.png card thumbnails, centered
#    simplified station outline).
#
# Long labels: wrap manually with textwrap.wrap(...) — draw_text_checked will
# assert-fail on any overflow instead of silently clipping.
```

Run: `python3 <scratchpad>/probe_diagrams.py` — the assertions catch clipped
text; then open each PNG and check readability/spacing at 50% zoom. Iterate
until clean.

- [ ] **Step 2: Generate responsive variants for the insights images**

```bash
for f in probe-station-anatomy probe-station-temperature-regimes probe-station-automation-levels probe-station-guide-cover; do
  node scripts/optimize-images.js "public/assets/images/insights/$f.png"
done
# Base (un-suffixed) webp for the products card — optimize-images.js only
# emits -sm/-md/-lg/-xl variants, so convert the base file explicitly:
node -e "require('sharp')('public/assets/images/redesign/products/probe-station-schematic-standardized.png').webp({ quality: 82 }).toFile('public/assets/images/redesign/products/probe-station-schematic-standardized.webp').then(() => console.log('webp written'))"
test -f public/assets/images/redesign/products/probe-station-schematic-standardized.webp && echo OK

# Verify EVERY expected variant exists — optimize-images.js catches per-file
# errors and exits 0, so a silent failure would otherwise slip through.
# Accumulate failures and exit non-zero so the step cannot false-pass:
missing=0
for f in probe-station-anatomy probe-station-temperature-regimes probe-station-automation-levels probe-station-guide-cover; do
  for s in sm md lg xl; do
    for ext in png webp; do
      test -f "public/assets/images/insights/$f-$s.$ext" || { echo "MISSING: $f-$s.$ext"; missing=1; }
    done
  done
done
if [ "$missing" -ne 0 ]; then echo "variant check FAILED"; exit 1; fi
echo "variant check OK"
```

Expected: the `test -f` prints `OK` for the products-card webp, and the variant
check prints `variant check OK` and exits 0. A non-zero exit with `MISSING:`
lines means optimize-images.js swallowed an error — rerun it for that file and
inspect its output before proceeding.

- [ ] **Step 3: Commit**

```bash
git add public/assets/images/insights/probe-station-* public/assets/images/redesign/products/probe-station-*
git commit -m "assets(probe-stations): original schematic diagrams + responsive variants"
```

---

### Task 5: Capture public specs from semishareprober.com

Fill `productLines[*].specs` with live-verified rows. **Hard rules:** only values readable on a public `https://(www.)semishareprober.com` page; record the exact page URL and today's date; anything you cannot verify → leave out (Constraint 7). Do NOT use partner-archive documents, Google caches, or third-party sites as sources.

**Files:**
- Modify: `src/data/probeStations/semishare.ts` (specs arrays only)

- [ ] **Step 1: Capture**

Use WebFetch on `https://www.semishareprober.com/` and navigate its product menu to each series page (A, X, CGX, manual SM/SE/SH, silicon photonics, mask laser repair). For each series, extract only clearly stated specs (wafer size, temperature range, automation capability, etc.). Note each page's exact URL.

- [ ] **Step 2: Fill the data module**

Entry shape (one worked example — replace value/URL with what you actually captured; delete if not verifiable):

```ts
specs: [
  {
    label: 'Temperature range',
    value: '<verbatim from the CGX public page>',
    source: { url: 'https://www.semishareprober.com/<actual-path>', capturedOn: '<today YYYY-MM-DD>' },
  },
],
```

Lines with no verifiable public specs keep `specs: []` — the UI already renders the qualitative fallback.

- [ ] **Step 3: Run the traceability tests**

Run: `npx vitest run src/data/probeStations/semishare.test.ts --exclude '**/.claude/**'`
Expected: PASS with real entries now exercising the URL/date assertions.

- [ ] **Step 4: Commit**

```bash
git add src/data/probeStations/semishare.ts
git commit -m "data(probe-stations): public-verified SEMISHARE spec captures with per-row sources"
```

---

### Task 6: Capability page `/wafer-probe-stations`

**Files:**
- Create: `src/pages/probeStations/WaferProbeStationsPage.tsx`
- Test: `src/pages/probeStations/WaferProbeStationsPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/probeStations/WaferProbeStationsPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { WaferProbeStationsPage } from './WaferProbeStationsPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/wafer-probe-stations']}>
        <WaferProbeStationsPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('WaferProbeStationsPage', () => {
  it('sets the exact document title and meta description', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.title).toBe(
        'Wafer Probe Stations for Research Labs | Manual, Semi-Automatic & Cryogenic | NineScrolls LLC'
      );
    });
    const metaDescription = document.head.querySelector('meta[name="description"]');
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('probe station'));
    expect(metaDescription).toHaveAttribute('content', expect.stringContaining('university'));
  });

  it('renders the hub content, comparison, FAQ, and internal links', () => {
    renderPage();
    expect(
      screen.getByRole('heading', { level: 1, name: /Wafer probe stations for research labs/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Semi-automatic')).toBeInTheDocument(); // StationTypeComparison
    expect(screen.getByRole('link', { name: /SEMISHARE product lines/i })).toHaveAttribute(
      'href', '/wafer-probe-stations/semishare'
    );
    expect(screen.getByRole('link', { name: /Cryogenic probing guide/i })).toHaveAttribute(
      'href', '/applications/cryogenic-probing'
    );
    expect(screen.getByRole('link', { name: /Silicon photonics probing guide/i })).toHaveAttribute(
      'href', '/applications/silicon-photonics-probing'
    );
    expect(screen.getByRole('link', { name: /Request a quote/i })).toHaveAttribute('href', '/request-quote');
    const faqHeadings = screen.getAllByRole('heading', { level: 3 }).filter((h) => h.textContent?.endsWith('?'));
    expect(faqHeadings.length).toBeGreaterThanOrEqual(4);
  });

  it('emits FAQPage JSON-LD that matches the visible FAQ', () => {
    renderPage();
    const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => JSON.parse(s.textContent || '{}'));
    const faqSchema = jsonLd.find((s) => s['@type'] === 'FAQPage');
    expect(faqSchema).toBeTruthy();
    for (const entry of faqSchema.mainEntity) {
      expect(screen.getByRole('heading', { level: 3, name: entry.name })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/probeStations/WaferProbeStationsPage.test.tsx --exclude '**/.claude/**'`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the page**

```tsx
// src/pages/probeStations/WaferProbeStationsPage.tsx
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../../components/common/SEO';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { StationTypeComparison } from '../../components/probeStations/StationTypeComparison';
import { SchematicFigure } from '../../components/probeStations/SchematicFigure';
import { useScrollToTop } from '../../hooks/useScrollToTop';

const faqs = [
  {
    question: 'What does a wafer probe station do?',
    answer:
      'A probe station holds a wafer or die flat and stable while fine-tipped probes land on bond pads or on-wafer device terminals, carrying electrical or optical signals out to your measurement instruments. It combines a chuck, micropositioners, optics, and shielded signal paths.',
  },
  {
    question: 'Manual or semi-automatic probe station — which should a university lab buy?',
    answer:
      'If your group characterizes a handful of devices per sample, a manual analytical station is usually the correct tool, not a compromise. Semi-automatic stations earn their cost when you step across dozens of sites per wafer and need recipe-driven repeatability.',
  },
  {
    question: 'Can I buy a probe station in the US through NineScrolls?',
    answer:
      'Yes. NineScrolls is a US-based (San Diego, California) research equipment supplier handling quoting, import, delivery, and after-sales support for probe stations across the US and Canada, including SEMISHARE wafer probe stations.',
  },
  {
    question: 'What information do you need for a probe station quote?',
    answer:
      'Largest sample size, measurement type (DC, RF, or optical), temperature requirements, and expected measurement volume. Send those through our request-a-quote form and we confirm the exact configuration with the manufacturer before quoting.',
  },
];

export function WaferProbeStationsPage() {
  useScrollToTop();

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <div className="bg-white text-slate-950">
      <SEO
        title="Wafer Probe Stations for Research Labs | Manual, Semi-Automatic & Cryogenic"
        description="How to choose a wafer probe station for university and industry research: manual vs semi-automatic vs fully automatic, temperature environments, DC/RF/optical signals — with a US procurement path."
        keywords="wafer probe station, probe station university research, manual probe station, semi-automatic probe station, cryogenic probe station"
        url="/wafer-probe-stations"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <Breadcrumbs items={[{ name: 'Wafer Probe Stations', path: '/wafer-probe-stations' }]} />

      <header className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Test & Probing</p>
        <h1 className="mt-3 text-4xl font-bold">Wafer probe stations for research labs</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          Put a probe tip on a bond pad and measure a device before dicing. This hub walks through
          the choices that determine which probe station fits your research — automation level,
          temperature environment, and signal type — and gives US and Canadian labs a clear
          procurement path.
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">What a probe station is made of</h2>
        <p className="mt-3 text-slate-700">
          Every probe station combines four things: a chuck that holds (and often heats or cools)
          the sample, micropositioners that move probe tips with micron-level precision, a
          microscope or camera, and shielded connections that carry the signal to your
          instruments. Everything else — automation, vacuum enclosures, RF calibration, fiber
          alignment — is a layer on top of that core.
        </p>
        <SchematicFigure
          src="/assets/images/insights/probe-station-anatomy.png"
          alt="Probe station core subsystems: chuck, micropositioners, optics, signal path"
          caption="Core subsystems of a wafer probe station"
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Manual, semi-automatic, or fully automatic</h2>
        <p className="mt-3 text-slate-700">
          This single choice moves the price the most, and the right answer is set by how many
          measurements you run — not by how advanced the lab wants to feel.
        </p>
        <div className="mt-5">
          <StationTypeComparison />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Go deeper by application</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <Link to="/applications/cryogenic-probing" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-sky-200 hover:shadow-lg">
            <h3 className="text-lg font-semibold">Cryogenic probing guide</h3>
            <p className="mt-2 text-sm text-slate-600">
              Vacuum cryogenic stations for superconductors, quantum transport, and 2D materials.
            </p>
          </Link>
          <Link to="/applications/silicon-photonics-probing" className="rounded-xl border border-slate-200 p-6 transition-all hover:border-sky-200 hover:shadow-lg">
            <h3 className="text-lg font-semibold">Silicon photonics probing guide</h3>
            <p className="mt-2 text-sm text-slate-600">
              Wafer-level photonic testing with fiber alignment alongside electrical probes.
            </p>
          </Link>
        </div>
        <div className="mt-5 rounded-xl bg-slate-50 p-6">
          <p className="text-slate-700">
            Looking for specific systems?{' '}
            <Link to="/wafer-probe-stations/semishare" className="font-semibold text-sky-700 underline">
              Browse SEMISHARE product lines
            </Link>{' '}
            available through our US procurement channel, or read our{' '}
            <Link to="/insights/how-to-choose-wafer-probe-station-university-lab" className="font-semibold text-sky-700 underline">
              university lab buyer's guide
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-5 space-y-6">
          {faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-lg font-semibold">{f.question}</h3>
              <p className="mt-2 text-slate-700">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl bg-[#1e3a5f] p-8 text-white">
          <h2 className="text-2xl font-bold">Ready to spec a probe station?</h2>
          <p className="mt-2 text-white/80">
            Tell us your sample size, signal type, and temperature needs — we confirm the
            configuration with the manufacturer and quote with US delivery and support included.
          </p>
          <Link to="/request-quote" className="mt-5 inline-flex items-center justify-center rounded-md bg-sky-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400">
            Request a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/probeStations/WaferProbeStationsPage.test.tsx --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/probeStations/
git commit -m "feat(probe-stations): wafer probe stations capability page"
```

---

### Task 7: Brand page `/wafer-probe-stations/semishare`

**Files:**
- Create: `src/pages/probeStations/SemishareBrandPage.tsx`
- Test: `src/pages/probeStations/SemishareBrandPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/pages/probeStations/SemishareBrandPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { productLines } from '../../data/probeStations/semishare';
import { SemishareBrandPage } from './SemishareBrandPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/wafer-probe-stations/semishare']}>
        <SemishareBrandPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('SemishareBrandPage', () => {
  it('sets the exact gated-OFF document title', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.title).toBe(
        'SEMISHARE Wafer Probe Stations | US & Canada Sales & Support | NineScrolls LLC'
      );
    });
  });

  it('renders every product line with a spec table or the request-specs fallback', () => {
    renderPage();
    for (const line of productLines) {
      expect(screen.getByRole('heading', { level: 3, name: line.name })).toBeInTheDocument();
    }
    // Every numeric spec that appears is sourced (rendered by SourcedSpecTable)
    const sourceLinks = screen.queryAllByRole('link', { name: /^source$/i });
    const specCount = productLines.reduce((n, l) => n + l.specs.length, 0);
    expect(sourceLinks).toHaveLength(specCount);
  });

  it('renders the neutral attestation banner, why-NineScrolls section, FAQ, and CTA', () => {
    renderPage();
    expect(
      screen.getByText(/NineScrolls provides US & Canada procurement, import, and support/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /Why buy through NineScrolls/i })).toBeInTheDocument();
    expect(screen.getByText(/SAM\.gov/)).toBeInTheDocument();
    const faqHeadings = screen.getAllByRole('heading', { level: 3 }).filter((h) => h.textContent?.endsWith('?'));
    expect(faqHeadings.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByRole('link', { name: /Request a quote/i })).toHaveAttribute('href', '/request-quote');
  });

  it('emits Organization JSON-LD with the gated-OFF description and FAQPage matching visible FAQ', () => {
    renderPage();
    const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => JSON.parse(s.textContent || '{}'));
    const org = jsonLd.find((s) => s['@type'] === 'Organization');
    expect(org?.description).toBe(
      'NineScrolls LLC is a US-based supplier providing procurement, import, and after-sales support for SEMISHARE wafer probe stations in the United States and Canada.'
    );
    const faqSchema = jsonLd.find((s) => s['@type'] === 'FAQPage');
    for (const entry of faqSchema.mainEntity) {
      expect(screen.getByRole('heading', { level: 3, name: entry.name })).toBeInTheDocument();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/probeStations/SemishareBrandPage.test.tsx --exclude '**/.claude/**'`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the page**

```tsx
// src/pages/probeStations/SemishareBrandPage.tsx
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { SEO } from '../../components/common/SEO';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { PartnerAttestationBanner } from '../../components/probeStations/PartnerAttestationBanner';
import { SourcedSpecTable } from '../../components/probeStations/SourcedSpecTable';
import {
  ATTESTATION_CONFIRMED,
  getBrandPageSeoTitle,
  getPartnerJsonLdDescription,
  productLines,
} from '../../data/probeStations/semishare';
import { useScrollToTop } from '../../hooks/useScrollToTop';

const faqs = [
  {
    question: 'Who is SEMISHARE?',
    answer:
      'SEMISHARE CO., LTD. is a wafer probe station manufacturer headquartered in Shenzhen, China, founded in 2010, with product lines spanning manual, semi-automatic, and fully automatic probe stations plus cryogenic vacuum systems and wafer-level silicon photonics probing.',
  },
  {
    question: 'How do I buy a SEMISHARE probe station in the United States?',
    answer:
      'Request a quote through NineScrolls. We are a US-based (San Diego, California) research equipment supplier: we confirm your configuration with SEMISHARE, quote in USD with import and delivery included, and provide local after-sales support.',
  },
  {
    question: 'Can university and government labs purchase through NineScrolls?',
    answer:
      'Yes. NineScrolls LLC is a registered US federal supplier on SAM.gov (UEI C4BFCTH5L5D1) and has served university procurement systems, including UC-system and Tier-1 research university purchasing, since 2018.',
  },
  {
    question: 'Where are SEMISHARE probe stations used in research?',
    answer:
      'SEMISHARE systems appear in peer-reviewed research worldwide, with published installations at institutions such as the National University of Singapore and Nanyang Technological University.',
  },
  {
    question: 'What about warranty and support in North America?',
    answer:
      'NineScrolls coordinates warranty service and technical support locally, with direct escalation to SEMISHARE engineering — one English-speaking point of contact in a US time zone.',
  },
];

export function SemishareBrandPage() {
  useScrollToTop();

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NineScrolls LLC',
    url: 'https://ninescrolls.com/wafer-probe-stations/semishare',
    description: getPartnerJsonLdDescription(ATTESTATION_CONFIRMED),
    areaServed: ['US', 'CA'],
    knowsAbout: [
      'SEMISHARE wafer probe stations',
      'semi-automatic probe stations',
      'cryogenic vacuum probe stations',
      'wafer-level silicon photonics testing',
    ],
  };
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };

  return (
    <div className="bg-white text-slate-950">
      <SEO
        title={getBrandPageSeoTitle(ATTESTATION_CONFIRMED)}
        description="Buy SEMISHARE wafer probe stations in the US and Canada through NineScrolls: quoting in USD, import and customs handled, local after-sales support, SAM.gov-registered federal supplier."
        keywords="SEMISHARE probe station, SEMISHARE distributor USA, SEMISHARE probe station buy USA, wafer probe station US supplier"
        url="/wafer-probe-stations/semishare"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(orgJsonLd)}</script>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <Breadcrumbs
        items={[
          { name: 'Wafer Probe Stations', path: '/wafer-probe-stations' },
          { name: 'SEMISHARE', path: '/wafer-probe-stations/semishare' },
        ]}
      />

      <header className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">SEMISHARE</p>
        <h1 className="mt-3 text-4xl font-bold">SEMISHARE wafer probe stations — US & Canada procurement</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          SEMISHARE builds manual, semi-automatic, and fully automatic wafer probe stations, plus
          cryogenic vacuum systems and wafer-level silicon photonics probing. NineScrolls gives US
          and Canadian labs a direct procurement path: USD quoting, import and customs handled,
          and local support.
        </p>
        <div className="mt-6">
          <PartnerAttestationBanner />
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Product lines</h2>
        <div className="mt-6 space-y-10">
          {productLines.map((line) => (
            <div key={line.key}>
              <h3 className="text-xl font-semibold">{line.name}</h3>
              <p className="mt-2 text-slate-700">{line.positioning}</p>
              <div className="mt-4">
                <SourcedSpecTable specs={line.specs} caption={line.name} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Why buy through NineScrolls</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">US import, done for you</h3>
            <p className="mt-2 text-sm text-slate-600">
              Customs, tariffs, and freight handled end-to-end — your PO is in USD with delivered
              pricing, not an overseas wire and a customs broker to find.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">Federal-ready procurement</h3>
            <p className="mt-2 text-sm text-slate-600">
              NineScrolls LLC is SAM.gov-registered (UEI C4BFCTH5L5D1), supporting NSF/DOE-funded
              and other federally funded purchases.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-6">
            <h3 className="text-lg font-semibold">Local support since 2018</h3>
            <p className="mt-2 text-sm text-slate-600">
              8+ years supplying North American research labs — installation coordination,
              warranty handling, and a US time-zone contact.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Frequently asked questions</h2>
        <div className="mt-5 space-y-6">
          {faqs.map((f) => (
            <div key={f.question}>
              <h3 className="text-lg font-semibold">{f.question}</h3>
              <p className="mt-2 text-slate-700">{f.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl bg-[#1e3a5f] p-8 text-white">
          <h2 className="text-2xl font-bold">Get a US quote for a SEMISHARE probe station</h2>
          <p className="mt-2 text-white/80">
            Send your application details — we confirm the exact configuration with SEMISHARE and
            quote with delivery and support included. New to probe stations? Start with the{' '}
            <Link to="/wafer-probe-stations" className="text-sky-300 underline">
              probe station selection hub
            </Link>
            .
          </p>
          <Link to="/request-quote" className="mt-5 inline-flex items-center justify-center rounded-md bg-sky-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400">
            Request a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/probeStations/SemishareBrandPage.test.tsx --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 5: Run the static scan — brand page must not trip it**

Run: `npx vitest run src/data/probeStations/attestationScan.test.ts --exclude '**/.claude/**'`
Expected: PASS (the page gets all gated wording via registry functions).

- [ ] **Step 6: Commit**

```bash
git add src/pages/probeStations/SemishareBrandPage.tsx src/pages/probeStations/SemishareBrandPage.test.tsx
git commit -m "feat(probe-stations): SEMISHARE brand page with gated attestation and sourced specs"
```

---

### Task 8: Application pages (cryogenic + silicon photonics)

**Files:**
- Create: `src/pages/probeStations/CryogenicProbingPage.tsx`
- Create: `src/pages/probeStations/SiliconPhotonicsProbingPage.tsx`
- Test: `src/pages/probeStations/CryogenicProbingPage.test.tsx`
- Test: `src/pages/probeStations/SiliconPhotonicsProbingPage.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// src/pages/probeStations/CryogenicProbingPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { CryogenicProbingPage } from './CryogenicProbingPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/applications/cryogenic-probing']}>
        <CryogenicProbingPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('CryogenicProbingPage', () => {
  it('sets the exact document title', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.title).toBe(
        'Cryogenic Probe Stations: Low-Temperature Wafer Probing Guide | NineScrolls LLC'
      );
    });
  });

  it('covers the temperature regimes and links back to the hub and brand page', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /Cryogenic probe stations/i })).toBeInTheDocument();
    expect(screen.getByText(/liquid nitrogen/i)).toBeInTheDocument();
    expect(screen.getByText(/liquid helium/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /probe station selection hub/i })).toHaveAttribute('href', '/wafer-probe-stations');
    expect(screen.getByRole('link', { name: /SEMISHARE product lines/i })).toHaveAttribute('href', '/wafer-probe-stations/semishare');
    expect(screen.getByRole('link', { name: /Request a quote/i })).toHaveAttribute('href', '/request-quote');
  });
});
```

```tsx
// src/pages/probeStations/SiliconPhotonicsProbingPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { SiliconPhotonicsProbingPage } from './SiliconPhotonicsProbingPage';

function renderPage() {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={['/applications/silicon-photonics-probing']}>
        <SiliconPhotonicsProbingPage />
      </MemoryRouter>
    </HelmetProvider>
  );
}

describe('SiliconPhotonicsProbingPage', () => {
  it('sets the exact document title', async () => {
    renderPage();
    await waitFor(() => {
      expect(document.title).toBe(
        'Silicon Photonics Wafer-Level Testing: Probe Station Guide | NineScrolls LLC'
      );
    });
  });

  it('covers fiber coupling and links back to the hub and brand page', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: /Silicon photonics/i })).toBeInTheDocument();
    expect(screen.getByText(/fiber/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /probe station selection hub/i })).toHaveAttribute('href', '/wafer-probe-stations');
    expect(screen.getByRole('link', { name: /SEMISHARE product lines/i })).toHaveAttribute('href', '/wafer-probe-stations/semishare');
    expect(screen.getByRole('link', { name: /Request a quote/i })).toHaveAttribute('href', '/request-quote');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/probeStations/CryogenicProbingPage.test.tsx src/pages/probeStations/SiliconPhotonicsProbingPage.test.tsx --exclude '**/.claude/**'`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement both pages**

Both follow the capability-page layout idiom (SEO → Breadcrumbs → header → sections → CTA). No FAQ block ⇒ no FAQPage JSON-LD (spec §2). Educational content only; generic physics numbers are allowed, SEMISHARE-attributed numbers are NOT (they live in the brand page's spec tables).

```tsx
// src/pages/probeStations/CryogenicProbingPage.tsx
import { Link } from 'react-router-dom';
import { SEO } from '../../components/common/SEO';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { SchematicFigure } from '../../components/probeStations/SchematicFigure';
import { useScrollToTop } from '../../hooks/useScrollToTop';

export function CryogenicProbingPage() {
  useScrollToTop();
  return (
    <div className="bg-white text-slate-950">
      <SEO
        title="Cryogenic Probe Stations: Low-Temperature Wafer Probing Guide"
        description="When your science lives at low temperature — superconductors, quantum transport, 2D materials — the cryogenic stage is the most important part of the probe station. A buyer's guide for research labs."
        keywords="cryogenic probe station, low temperature probe station, vacuum probe station, quantum transport measurement"
        url="/applications/cryogenic-probing"
      />
      <Breadcrumbs items={[{ name: 'Cryogenic Probing', path: '/applications/cryogenic-probing' }]} />

      <header className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Applications</p>
        <h1 className="mt-3 text-4xl font-bold">Cryogenic probe stations for low-temperature research</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          Ambient probing covers most electrical characterization. But if your devices only show
          their physics cold — superconducting electronics, quantum transport, 2D material
          devices — the temperature stage becomes the defining (and most expensive) part of the
          system. Here is how to think about it.
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">The three temperature regimes</h2>
        <p className="mt-3 text-slate-700">
          Probing setups fall into three tiers. An ambient station measures at room temperature.
          A thermal-chuck station adds a heated or cooled chuck for reliability and
          temperature-dependent I–V work. A cryogenic-vacuum station encloses the sample in
          vacuum and cools it with liquid nitrogen (reaching the ~77 K range) or a liquid-helium /
          closed-cycle system (reaching single-digit kelvin) — the regime where superconductivity
          and quantum transport phenomena become measurable.
        </p>
        <SchematicFigure
          src="/assets/images/insights/probe-station-temperature-regimes.png"
          alt="Ambient, thermal-chuck, and cryogenic-vacuum probing regimes with example applications"
          caption="Temperature regimes and the research that maps to each"
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Why vacuum matters</h2>
        <p className="mt-3 text-slate-700">
          Below the dew point, any surface in open air ices over. Cryogenic stations therefore
          probe inside an evacuated chamber: the vacuum prevents condensation, improves thermal
          stability, and reduces convective heat load on the chuck. Optical windows and
          magnetic-field options extend the same platform to spintronics and optoelectronic
          studies.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">What to check before you buy</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
          <li>Base temperature under real probing load — not just the bare-chuck figure.</li>
          <li>Cooldown time and liquid-cryogen consumption per run, which set your daily cadence.</li>
          <li>Probe-arm thermal anchoring, so the tips do not heat your device.</li>
          <li>Optical access, magnet options, and RF feedthroughs if your roadmap needs them.</li>
        </ul>
        <p className="mt-4 text-slate-700">
          Start from the{' '}
          <Link to="/wafer-probe-stations" className="font-semibold text-sky-700 underline">
            probe station selection hub
          </Link>{' '}
          for the full decision framework, or browse{' '}
          <Link to="/wafer-probe-stations/semishare" className="font-semibold text-sky-700 underline">
            SEMISHARE product lines
          </Link>{' '}
          — including cryogenic vacuum systems — available with US procurement and support.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl bg-[#1e3a5f] p-8 text-white">
          <h2 className="text-2xl font-bold">Planning a low-temperature setup?</h2>
          <p className="mt-2 text-white/80">
            Tell us your target temperature, sample size, and signal type — we will confirm a
            configuration with the manufacturer and quote with US delivery and support.
          </p>
          <Link to="/request-quote" className="mt-5 inline-flex items-center justify-center rounded-md bg-sky-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400">
            Request a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
```

```tsx
// src/pages/probeStations/SiliconPhotonicsProbingPage.tsx
import { Link } from 'react-router-dom';
import { SEO } from '../../components/common/SEO';
import { Breadcrumbs } from '../../components/common/Breadcrumbs';
import { useScrollToTop } from '../../hooks/useScrollToTop';

export function SiliconPhotonicsProbingPage() {
  useScrollToTop();
  return (
    <div className="bg-white text-slate-950">
      <SEO
        title="Silicon Photonics Wafer-Level Testing: Probe Station Guide"
        description="Wafer-level photonic testing needs fiber alignment alongside electrical probes. What silicon photonics groups should look for in a probe station: coupling method, alignment automation, and mixed-signal probing."
        keywords="silicon photonics testing, wafer-level photonic testing, fiber alignment probe station, photonics probe station"
        url="/applications/silicon-photonics-probing"
      />
      <Breadcrumbs items={[{ name: 'Silicon Photonics Probing', path: '/applications/silicon-photonics-probing' }]} />

      <header className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-sm font-bold uppercase tracking-[0.22em] text-sky-600">Applications</p>
        <h1 className="mt-3 text-4xl font-bold">Silicon photonics probing at wafer level</h1>
        <p className="mt-4 max-w-3xl text-lg text-slate-600">
          Photonic chips have to be tested before dicing just like electronic ones — but the
          signal is light. Wafer-level photonic testing adds fiber alignment stages next to the
          electrical probes, so you can couple light into on-chip waveguides while driving and
          reading the device electrically.
        </p>
      </header>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">What makes photonic probing different</h2>
        <p className="mt-3 text-slate-700">
          Electrical probes tolerate a few microns of placement error; optical coupling does not.
          Grating couplers accept fiber from above with sub-micron alignment tolerance, while
          edge coupling needs polished facets and even tighter control. A photonics-capable probe
          station therefore adds piezo-driven fiber positioners, alignment optimization (peak
          search on transmitted power), and stable mechanics so alignment holds during the sweep.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">Mixed-signal reality: photonics is also electronics</h2>
        <p className="mt-3 text-slate-700">
          Modulators, photodetectors, and tuning heaters mean most photonic measurements are
          electro-optical: DC bias plus RF drive plus optical input and output on the same die.
          Plan the station for all three from the start — retrofitting fiber stages onto an
          electrical-only platform is rarely satisfying.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-10">
        <h2 className="text-2xl font-bold">What to check before you buy</h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-slate-700">
          <li>Coupling method support: grating (vertical) vs edge coupling, or both.</li>
          <li>Alignment automation: manual peak-up is fine for a few devices, painful for a wafer.</li>
          <li>Simultaneous electrical probing: enough positioners around the fiber stages.</li>
          <li>Upgrade path to semi-automatic stepping if your device counts will grow.</li>
        </ul>
        <p className="mt-4 text-slate-700">
          The{' '}
          <Link to="/wafer-probe-stations" className="font-semibold text-sky-700 underline">
            probe station selection hub
          </Link>{' '}
          covers the base-platform decisions; wafer-level silicon photonics probing configurations
          are available through{' '}
          <Link to="/wafer-probe-stations/semishare" className="font-semibold text-sky-700 underline">
            SEMISHARE product lines
          </Link>{' '}
          with US procurement and support.
        </p>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-16">
        <div className="rounded-xl bg-[#1e3a5f] p-8 text-white">
          <h2 className="text-2xl font-bold">Building a photonic test setup?</h2>
          <p className="mt-2 text-white/80">
            Tell us your coupling method, wavelength range, and electrical probing needs — we will
            scope a configuration and quote with US delivery and support.
          </p>
          <Link to="/request-quote" className="mt-5 inline-flex items-center justify-center rounded-md bg-sky-500 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-sky-400">
            Request a quote
          </Link>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/probeStations/ --exclude '**/.claude/**'`
Expected: PASS (all page tests so far).

- [ ] **Step 5: Commit**

```bash
git add src/pages/probeStations/CryogenicProbingPage.tsx src/pages/probeStations/CryogenicProbingPage.test.tsx src/pages/probeStations/SiliconPhotonicsProbingPage.tsx src/pages/probeStations/SiliconPhotonicsProbingPage.test.tsx
git commit -m "feat(probe-stations): cryogenic and silicon photonics application pages"
```

---

### Task 9: Attestation gate tests across all pages (OFF + ON)

**Files:**
- Test: `src/pages/probeStations/attestationGate.test.tsx`
- Test: `src/pages/probeStations/attestationGate.on.test.tsx`

- [ ] **Step 1: Write the flag-OFF test (all 4 routes, all output categories)**

```tsx
// src/pages/probeStations/attestationGate.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  FORBIDDEN_ATTESTATION_PATTERNS,
  getBrandPageSeoTitle,
  getPartnerBannerText,
  getPartnerJsonLdDescription,
} from '../../data/probeStations/semishare';
import { WaferProbeStationsPage } from './WaferProbeStationsPage';
import { SemishareBrandPage } from './SemishareBrandPage';
import { CryogenicProbingPage } from './CryogenicProbingPage';
import { SiliconPhotonicsProbingPage } from './SiliconPhotonicsProbingPage';

// The production badge list is EMPTY (pinned by semishare.test.ts). To prove
// the gate actually controls badge rendering — not just that nothing renders
// because nothing is configured — these tests mock a non-empty fixture list.
// Flag stays at its real value (OFF) here.
const TEST_BADGE = vi.hoisted(() => ({ src: '/test-partner-badge.svg', alt: 'Test partner badge' }));

vi.mock('../../data/probeStations/semishare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/probeStations/semishare')>();
  return { ...actual, PARTNER_BADGE_ASSETS: [TEST_BADGE] };
});

// Expected values below come from the registry getters (getPartnerBannerText
// etc.) — real implementations, since the mock spreads the actual module.
// This is NOT circular: the getters' literal outputs are pinned in
// src/data/probeStations/semishare.test.ts; these tests verify the pages
// actually render what the registry resolves for each flag state.

const PAGES = [
  ['/wafer-probe-stations', WaferProbeStationsPage],
  ['/wafer-probe-stations/semishare', SemishareBrandPage],
  ['/applications/cryogenic-probing', CryogenicProbingPage],
  ['/applications/silicon-photonics-probing', SiliconPhotonicsProbingPage],
] as const;

function renderPage(path: string, Page: (typeof PAGES)[number][1]) {
  return render(
    <HelmetProvider>
      <MemoryRouter initialEntries={[path]}>
        <Page />
      </MemoryRouter>
    </HelmetProvider>
  );
}

function cleanupHead() {
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
}

describe('attestation gate OFF (default)', () => {
  it.each(PAGES)('%s emits no gated wording in body, title, JSON-LD, or image attrs', async (path, Page) => {
    const { container, unmount } = renderPage(path, Page);

    // Flush react-helmet-async head commits before reading document.title/head
    await waitFor(() => expect(document.title).toContain('NineScrolls LLC'));

    const jsonLdText = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => s.textContent ?? '')
      .join('\n');
    const imgAttrs = Array.from(container.querySelectorAll('img'))
      .map((img) => `${img.getAttribute('alt') ?? ''} ${img.getAttribute('src') ?? ''}`)
      .join('\n');
    const surfaces: Array<[string, string]> = [
      ['body', container.textContent ?? ''],
      ['title', document.title],
      ['json-ld', jsonLdText],
      ['images', imgAttrs],
    ];

    for (const [surface, text] of surfaces) {
      for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
        expect(text, `${path} ${surface} vs ${pattern}`).not.toMatch(pattern);
      }
    }
    // Badge gate: the mocked fixture list is non-empty, so this actually
    // proves the OFF flag suppresses configured badges (not merely that no
    // badge is configured).
    expect(imgAttrs, `${path} badge src`).not.toContain(TEST_BADGE.src);
    expect(screen.queryByAltText(TEST_BADGE.alt), `${path} badge alt`).toBeNull();
    unmount();
    cleanupHead();
  });

  it('brand page renders exactly the neutral registry outputs: banner, title, Organization JSON-LD', async () => {
    const { unmount } = renderPage('/wafer-probe-stations/semishare', SemishareBrandPage);

    expect(screen.getByText(getPartnerBannerText(false))).toBeInTheDocument();
    await waitFor(() => {
      expect(document.title).toBe(`${getBrandPageSeoTitle(false)} | NineScrolls LLC`);
    });
    const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => JSON.parse(s.textContent || '{}'));
    const org = jsonLd.find((s) => s['@type'] === 'Organization');
    expect(org?.description).toBe(getPartnerJsonLdDescription(false));
    unmount();
    cleanupHead();
  });
});
```

- [ ] **Step 2: Write the flag-ON test (vi.mock the flag)**

```tsx
// src/pages/probeStations/attestationGate.on.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import {
  FORBIDDEN_ATTESTATION_PATTERNS,
  getBrandPageSeoTitle,
  getPartnerBannerText,
  getPartnerJsonLdDescription,
} from '../../data/probeStations/semishare';
import { WaferProbeStationsPage } from './WaferProbeStationsPage';
import { SemishareBrandPage } from './SemishareBrandPage';
import { CryogenicProbingPage } from './CryogenicProbingPage';
import { SiliconPhotonicsProbingPage } from './SiliconPhotonicsProbingPage';

// Non-empty badge fixture (production list is empty, pinned by
// semishare.test.ts) — proves the ON flag actually renders configured badges.
const TEST_BADGE = vi.hoisted(() => ({ src: '/test-partner-badge.svg', alt: 'Test partner badge' }));

vi.mock('../../data/probeStations/semishare', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../data/probeStations/semishare')>();
  return { ...actual, ATTESTATION_CONFIRMED: true, PARTNER_BADGE_ASSETS: [TEST_BADGE] };
});

// NOTE: everything imported from the mocked module except ATTESTATION_CONFIRMED
// and PARTNER_BADGE_ASSETS is the actual implementation (the mock spreads the
// original), so the getters and pattern list used as expected values below are
// real. The getters' literal outputs are pinned in semishare.test.ts — using
// them here is not circular.

const NON_BRAND_PAGES = [
  ['/wafer-probe-stations', WaferProbeStationsPage],
  ['/applications/cryogenic-probing', CryogenicProbingPage],
  ['/applications/silicon-photonics-probing', SiliconPhotonicsProbingPage],
] as const;

function collectSurfaces(container: HTMLElement): Array<[string, string]> {
  const jsonLdText = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
    .map((s) => s.textContent ?? '')
    .join('\n');
  const imgAttrs = Array.from(container.querySelectorAll('img'))
    .map((img) => `${img.getAttribute('alt') ?? ''} ${img.getAttribute('src') ?? ''}`)
    .join('\n');
  return [
    ['body', container.textContent ?? ''],
    ['title', document.title],
    ['json-ld', jsonLdText],
    ['images', imgAttrs],
  ];
}

function cleanupHead() {
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach((s) => s.remove());
}

describe('attestation gate ON (mocked written confirmation)', () => {
  it('brand page renders each gated output from the registry: banner, title, JSON-LD, badges', async () => {
    const { unmount } = render(
      <HelmetProvider>
        <MemoryRouter initialEntries={['/wafer-probe-stations/semishare']}>
          <SemishareBrandPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    // Banner — expected value resolved by the registry getter for ON
    expect(screen.getByText(getPartnerBannerText(true))).toBeInTheDocument();

    // Title (gated variant + SEO suffix)
    await waitFor(() => {
      expect(document.title).toBe(`${getBrandPageSeoTitle(true)} | NineScrolls LLC`);
    });

    // Organization JSON-LD claim
    const jsonLd = Array.from(document.head.querySelectorAll('script[type="application/ld+json"]'))
      .map((s) => JSON.parse(s.textContent || '{}'));
    const org = jsonLd.find((s) => s['@type'] === 'Organization');
    expect(org?.description).toBe(getPartnerJsonLdDescription(true));

    // Badge gate: the mocked fixture MUST render with its exact src and alt —
    // proves ON actually flows registry assets to the DOM.
    expect(screen.getByAltText(TEST_BADGE.alt)).toHaveAttribute('src', TEST_BADGE.src);
    // And nothing badge-shaped outside the registry list may render.
    const strayBadgeImgs = Array.from(document.images).filter(
      (img) =>
        /badge|partner-?logo/i.test(`${img.src} ${img.alt}`) &&
        img.getAttribute('src') !== TEST_BADGE.src
    );
    expect(strayBadgeImgs).toEqual([]);
    unmount();
    cleanupHead();
  });

  it.each(NON_BRAND_PAGES)(
    '%s still emits NO gated wording or badge assets even when ON',
    async (path, Page) => {
      const { container, unmount } = render(
        <HelmetProvider>
          <MemoryRouter initialEntries={[path]}>
            <Page />
          </MemoryRouter>
        </HelmetProvider>
      );
      await waitFor(() => expect(document.title).toContain('NineScrolls LLC'));

      for (const [surface, text] of collectSurfaces(container)) {
        for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
          expect(text, `${path} ${surface} vs ${pattern}`).not.toMatch(pattern);
        }
      }
      // The badge fixture's src/alt do not match FORBIDDEN patterns, so its
      // absence must be asserted explicitly: only the brand page may render
      // registry badges, even with the flag ON.
      expect(container.querySelector(`img[src="${TEST_BADGE.src}"]`), `${path} badge src`).toBeNull();
      expect(screen.queryByAltText(TEST_BADGE.alt), `${path} badge alt`).toBeNull();
      unmount();
      cleanupHead();
    }
  );
});
```

Note: `PartnerAttestationBanner` and `SemishareBrandPage` pass `ATTESTATION_CONFIRMED` explicitly into the registry functions — that is what makes this mock effective. If either ever calls a wording function without the explicit flag argument, this test regresses to OFF behavior and fails.

- [ ] **Step 3: Run both, expected PASS**

Run: `npx vitest run src/pages/probeStations/attestationGate.test.tsx src/pages/probeStations/attestationGate.on.test.tsx --exclude '**/.claude/**'`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/probeStations/attestationGate.test.tsx src/pages/probeStations/attestationGate.on.test.tsx
git commit -m "test(probe-stations): attestation gate verified per output category in both flag states"
```

---

### Task 10: Routing, nav, ProductsPage entry

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/components/layout/Layout.tsx` (~line 111, `productCategories`)
- Modify: `src/components/layout/Layout.test.tsx`
- Modify: `src/pages/ProductsPage.tsx` (family union ~line 9, tabs ~line 26, products array)
- Modify: `src/pages/ProductsPage.test.tsx`

- [ ] **Step 1: Extend Layout.test.tsx (failing first)**

Add to the existing `describe('Layout navigation')` block:

```tsx
  it('includes the probe station pages in the Products menu', () => {
    const { container } = renderLayout();
    const productsMenu = container.querySelector('.products-dropdown-wrapper');
    fireEvent.mouseEnter(productsMenu as Element);

    expect(screen.getByRole('link', { name: /Wafer Probe Stations/i })).toHaveAttribute(
      'href', '/wafer-probe-stations'
    );
    expect(screen.getByRole('link', { name: /SEMISHARE Probe Stations/i })).toHaveAttribute(
      'href', '/wafer-probe-stations/semishare'
    );
  });
```

Run: `npx vitest run src/components/layout/Layout.test.tsx --exclude '**/.claude/**'` — expected FAIL.

- [ ] **Step 2: Add the nav category in Layout.tsx**

Append to `productCategories` (after the `cleaning` entry):

```ts
    {
      key: 'probing',
      label: 'Test & Probing',
      items: [
        { to: '/wafer-probe-stations', label: 'Wafer Probe Stations', desc: 'Selection hub & buying guide' },
        { to: '/wafer-probe-stations/semishare', label: 'SEMISHARE Probe Stations', desc: 'US & Canada procurement' },
        { to: '/applications/cryogenic-probing', label: 'Cryogenic Probing', desc: 'Low-temperature measurement' },
        { to: '/applications/silicon-photonics-probing', label: 'Silicon Photonics Probing', desc: 'Wafer-level photonic test' },
      ]
    },
```

Run the Layout test again — expected PASS.

- [ ] **Step 3: Register the routes**

In `src/routes/index.tsx`, add with the other lazy page declarations:

```ts
const WaferProbeStationsPage = lazyWithReload(() => import('../pages/probeStations/WaferProbeStationsPage').then(m => ({ default: m.WaferProbeStationsPage })));
const SemishareBrandPage = lazyWithReload(() => import('../pages/probeStations/SemishareBrandPage').then(m => ({ default: m.SemishareBrandPage })));
const CryogenicProbingPage = lazyWithReload(() => import('../pages/probeStations/CryogenicProbingPage').then(m => ({ default: m.CryogenicProbingPage })));
const SiliconPhotonicsProbingPage = lazyWithReload(() => import('../pages/probeStations/SiliconPhotonicsProbingPage').then(m => ({ default: m.SiliconPhotonicsProbingPage })));
```

And in the `<Routes>` block (before the `*` catch-all):

```tsx
        <Route path="/wafer-probe-stations" element={<WaferProbeStationsPage />} />
        <Route path="/wafer-probe-stations/semishare" element={<SemishareBrandPage />} />
        <Route path="/applications/cryogenic-probing" element={<CryogenicProbingPage />} />
        <Route path="/applications/silicon-photonics-probing" element={<SiliconPhotonicsProbingPage />} />
```

- [ ] **Step 4: ProductsPage — failing test, then card**

Add to `src/pages/ProductsPage.test.tsx` (match the file's existing render helper):

```tsx
  it('lists the wafer probe stations category card linking to the capability hub', () => {
    renderProductsPage();
    const card = screen.getByRole('link', { name: /Wafer Probe Stations/i });
    expect(card).toHaveAttribute('href', '/wafer-probe-stations');
  });
```

Run: `npx vitest run src/pages/ProductsPage.test.tsx --exclude '**/.claude/**'` — expected FAIL.

Then in `src/pages/ProductsPage.tsx`:
1. Extend the family union: `type ProductFamily = 'Etching' | 'Deposition' | 'Lithography' | 'Plasma Cleaning' | 'Probe Stations';`
2. Extend tabs: `const tabs: ProductTab[] = ['All', 'Etching', 'Deposition', 'Lithography', 'Plasma Cleaning', 'Probe Stations'];`
3. Append to `products`:

```ts
  {
    name: 'Wafer Probe Stations',
    route: '/wafer-probe-stations',
    family: 'Probe Stations',
    eyebrow: 'Test & Probing',
    image: '/assets/images/redesign/products/probe-station-schematic-standardized.webp',
    alt: 'Wafer probe station schematic — chuck, micropositioners, and optics',
    description: 'Manual, semi-automatic, and cryogenic wafer probe stations with a US procurement path — selection hub, buying guides, and SEMISHARE product lines.',
    chips: ['Device characterization', 'Cryogenic probing', 'Silicon photonics'],
    buyingMode: 'RFQ Platform',
  },
```

Run the ProductsPage test — expected PASS.

- [ ] **Step 5: Full test sweep + build**

Run: `npx vitest run --exclude '**/.claude/**'` — expected PASS.
Run: `npm run build` — expected success; confirm the four new pages land in lazy chunks (no growth of the main entry chunk beyond a few KB — compare `dist/assets/index-*.js` size before/after if in doubt).

- [ ] **Step 6: Commit**

```bash
git add src/routes/index.tsx src/components/layout/ src/pages/ProductsPage.tsx src/pages/ProductsPage.test.tsx
git commit -m "feat(probe-stations): routes, nav category, and products page entry"
```

---

### Task 11: Sitemaps + llms files

**Files:**
- Modify: `scripts/generate-seo.ts` (STATIC_URLS-style list, after the `/products/*` entries)
- Modify: `amplify/functions/generate-sitemaps/handler.ts` (`STATIC_PAGES`, same position)
- Modify: `public/llms.txt`, `public/llms-full.txt`
- Test: `src/pages/probeStations/llmsStaticPages.test.ts`

- [ ] **Step 1: Write the failing llms test**

```ts
// src/pages/probeStations/llmsStaticPages.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const URLS = [
  'https://ninescrolls.com/wafer-probe-stations',
  'https://ninescrolls.com/wafer-probe-stations/semishare',
  'https://ninescrolls.com/applications/cryogenic-probing',
  'https://ninescrolls.com/applications/silicon-photonics-probing',
];

describe.each(['public/llms.txt', 'public/llms-full.txt'])('%s', (file) => {
  const text = readFileSync(file, 'utf8');
  it.each(URLS)('lists %s', (url) => {
    expect(text).toContain(url);
  });
});
```

Run: `npx vitest run src/pages/probeStations/llmsStaticPages.test.ts --exclude '**/.claude/**'` — expected FAIL (4×2 missing).

- [ ] **Step 2: Add the llms sections**

In `public/llms.txt`, after the "Products — Plasma Cleaners" section, add:

```markdown
## Products — Wafer Probe Stations

- [Wafer Probe Stations Hub](https://ninescrolls.com/wafer-probe-stations): Selection guide — manual vs semi-automatic vs fully automatic, temperature regimes, signal types
- [SEMISHARE Probe Stations](https://ninescrolls.com/wafer-probe-stations/semishare): SEMISHARE product lines with US & Canada procurement, import, and support through NineScrolls
- [Cryogenic Probing Guide](https://ninescrolls.com/applications/cryogenic-probing): Low-temperature vacuum probing for superconductors, quantum transport, 2D materials
- [Silicon Photonics Probing Guide](https://ninescrolls.com/applications/silicon-photonics-probing): Wafer-level photonic testing with fiber alignment
```

In `public/llms-full.txt`, add the same four links in its corresponding products section, each followed by a 2–3 sentence summary consistent with the page content (write them from the page copy above; no SEMISHARE-attributed numbers).

Run the test again — expected PASS.

- [ ] **Step 3: Add the sitemap entries to BOTH lists**

In `scripts/generate-seo.ts` after the last `/products/*` entry AND in `amplify/functions/generate-sitemaps/handler.ts` `STATIC_PAGES` at the same position, add identical entries:

```ts
  { loc: '/wafer-probe-stations', lastmod: '2026-07-12', changefreq: 'weekly', priority: '0.9' },
  { loc: '/wafer-probe-stations/semishare', lastmod: '2026-07-12', changefreq: 'weekly', priority: '0.9' },
  { loc: '/applications/cryogenic-probing', lastmod: '2026-07-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/applications/silicon-photonics-probing', lastmod: '2026-07-12', changefreq: 'monthly', priority: '0.8' },
```

- [ ] **Step 4: Write the sitemap-sources consistency test**

```ts
// src/pages/probeStations/sitemapStaticEntries.test.ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The full expected entries, lastmod included. When a launch-page lastmod is
// intentionally bumped later, update it HERE too — the test forces both
// generators and this expectation to move together.
const ENTRIES = [
  { loc: '/wafer-probe-stations', lastmod: '2026-07-12', changefreq: 'weekly', priority: '0.9' },
  { loc: '/wafer-probe-stations/semishare', lastmod: '2026-07-12', changefreq: 'weekly', priority: '0.9' },
  { loc: '/applications/cryogenic-probing', lastmod: '2026-07-12', changefreq: 'monthly', priority: '0.8' },
  { loc: '/applications/silicon-photonics-probing', lastmod: '2026-07-12', changefreq: 'monthly', priority: '0.8' },
];
const GENERATORS = [
  'scripts/generate-seo.ts',
  'amplify/functions/generate-sitemaps/handler.ts',
];

describe.each(GENERATORS)('%s', (file) => {
  const text = readFileSync(file, 'utf8');
  it.each(ENTRIES)('contains $loc with the exact expected metadata', ({ loc, lastmod, changefreq, priority }) => {
    const entry = new RegExp(
      `\\{\\s*loc:\\s*'${loc.replace(/[/]/g, '\\/')}',\\s*lastmod:\\s*'${lastmod}',\\s*changefreq:\\s*'${changefreq}',\\s*priority:\\s*'${priority}'\\s*\\}`
    );
    expect(text).toMatch(entry);
  });
});
```

Run: `npx vitest run src/pages/probeStations/sitemapStaticEntries.test.ts --exclude '**/.claude/**'` — expected PASS (fails precisely if either generator misses an entry or metadata drifts).
Run: `npx vitest run amplify/functions/generate-sitemaps/handler.test.ts --exclude '**/.claude/**'` — expected PASS (Lambda's own tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-seo.ts amplify/functions/generate-sitemaps/handler.ts public/llms.txt public/llms-full.txt src/pages/probeStations/llmsStaticPages.test.ts src/pages/probeStations/sitemapStaticEntries.test.ts
git commit -m "seo(probe-stations): sitemap entries (script + lambda) with consistency test, llms.txt sections"
```

---

### Task 12: Insight article entry

**Files:**
- Modify: `scripts/insightsPostsData.ts` (append one entry to `insightsPosts`)
- Test: `src/pages/probeStations/probeStationArticle.test.ts`

Source: `/Users/harvey/MyDocuments/Company_Registration/NineScrolls LLC/合作厂家/深圳森美协尔科技有限公司/官网内容/how-to-choose-wafer-probe-station-university-lab.md`

- [ ] **Step 1: Write the failing article data test**

```ts
// src/pages/probeStations/probeStationArticle.test.ts
import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { insightsPosts } from '../../../scripts/insightsPostsData';
import { FORBIDDEN_ATTESTATION_PATTERNS } from '../../data/probeStations/semishare';

const SLUG = 'how-to-choose-wafer-probe-station-university-lab';

describe('probe station buyer-guide article entry', () => {
  const post = insightsPosts.find((p) => p.slug === SLUG);

  it('exists with full content and no hand-written TOC', () => {
    expect(post).toBeTruthy();
    expect(post!.content!.length).toBeGreaterThan(10_000); // full conversion, not a stub
    // The page auto-generates the TOC — the content must not carry one in any
    // of the forms the site (or a naive conversion) could produce:
    expect(post!.content).not.toMatch(/table of contents/i);
    expect(post!.content).not.toMatch(/\bid="toc"|class="[^"]*\btoc\b[^"]*"/i);
    expect(post!.content).not.toMatch(/<nav[^>]*toc/i);
    expect(post!.content).not.toMatch(/<h[23][^>]*>\s*(contents|in this (article|guide))\s*<\/h[23]>/i);
  });

  it('embeds each figure as its own complete <picture> block with caption and on-disk assets', () => {
    const pictureBlocks = post!.content!.match(/<picture>[\s\S]*?<\/picture>/g) ?? [];

    for (const base of ['probe-station-temperature-regimes', 'probe-station-automation-levels']) {
      // The block DEDICATED to this figure — not just any <picture> plus a bare URL
      const block = pictureBlocks.find((b) => b.includes(`/assets/images/insights/${base}`));
      expect(block, `<picture> block for ${base}`).toBeTruthy();

      // Responsive webp srcset + png fallback, all inside THIS block
      for (const size of ['sm', 'md', 'lg', 'xl']) {
        expect(block, `${base}-${size}.webp in srcset`).toContain(`/assets/images/insights/${base}-${size}.webp`);
        expect(existsSync(`public/assets/images/insights/${base}-${size}.webp`), `${base}-${size}.webp on disk`).toBe(true);
        expect(existsSync(`public/assets/images/insights/${base}-${size}.png`), `${base}-${size}.png on disk`).toBe(true);
      }
      expect(block, `${base}.png fallback <img>`).toMatch(
        new RegExp(`<img[^>]+src="/assets/images/insights/${base}\\.png"`)
      );
      expect(existsSync(`public/assets/images/insights/${base}.png`), `${base}.png on disk`).toBe(true);

      // The IMMEDIATELY ADJACENT caption element (allowing only closing
      // wrapper tags in between) must be a post-figure-caption carrying the
      // schematic disclaimer — proximity alone is not enough.
      const afterBlock = post!.content!.slice(
        post!.content!.indexOf(block!) + block!.length,
        post!.content!.indexOf(block!) + block!.length + 400
      );
      const captionMatch = afterBlock.match(
        /^\s*(?:<\/[a-z]+>\s*)*<p class="post-figure-caption">([\s\S]*?)<\/p>/i
      );
      expect(captionMatch, `adjacent post-figure-caption after ${base}`).toBeTruthy();
      expect(captionMatch![1], `schematic disclaimer in ${base} caption`).toMatch(/Schematic illustration/i);
    }
    expect(existsSync('public/assets/images/insights/probe-station-guide-cover.png')).toBe(true);
  });

  it('links to the capability hub and the brand page', () => {
    expect(post!.content).toContain('href="/wafer-probe-stations"');
    expect(post!.content).toContain('href="/wafer-probe-stations/semishare"');
  });

  it('carries no attestation wording and no SEMISHARE-attributed numbers (Constraint 7 tripwire)', () => {
    for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
      expect(post!.content).not.toMatch(pattern);
    }
    // Heuristic tripwire, not proof: a number within 60 chars after "SEMISHARE"
    // flags a potentially product-attributed spec. On a hit, either source the
    // value from src/data/probeStations/semishare.ts (and render it there, not
    // here) or cut the sentence — do not weaken this regex.
    expect(post!.content).not.toMatch(/SEMISHARE[^<.]{0,60}\d+\s?(K\b|mm|inch|"|µm|um)/i);
  });
});
```

Run: `npx vitest run src/pages/probeStations/probeStationArticle.test.ts --exclude '**/.claude/**'`
Expected: FAIL — `post` is undefined (entry not added yet).

- [ ] **Step 2: Convert the draft to an InsightsPost entry**

Conversion rules:
- Content: full HTML conversion of the draft, faithful to the text. **No TOC** (the page auto-generates one). Match the HTML conventions already used in `insightsPostsData.ts` — before writing, copy the exact `<picture>` block and table/figure class patterns from an existing entry (`grep -n -m1 -A8 '<picture>' scripts/insightsPostsData.ts` and `grep -n -m2 'post-figure-caption\|<table' scripts/insightsPostsData.ts`).
- Replace the draft's two "Figure Suggestion" placeholders with `<picture>` blocks for `/assets/images/insights/probe-station-temperature-regimes` and `/assets/images/insights/probe-station-automation-levels` (sm/md/lg/xl webp srcset + png fallback `<img>`). Immediately after each `</picture>` (only closing wrapper tags in between), place a `<p class="post-figure-caption">` whose text includes "Schematic illustration" — the article test asserts this exact adjacency.
- Keep the draft's sourced cost discussion as written; if any sentence attributes a spec to SEMISHARE specifically, either source it from the brand-page data module values or cut it (Constraint 7). Generic market prose is fine.
- Internal links: add links to `/wafer-probe-stations` (in the introduction or "what a probe station does" section) and `/wafer-probe-stations/semishare` (in the procurement/buying section).

Entry fields (append to `insightsPosts`):

```ts
  {
    id: 'how-to-choose-wafer-probe-station-university-lab',
    slug: 'how-to-choose-wafer-probe-station-university-lab',
    title: 'How to Choose a Wafer Probe Station for Your University Research Lab',
    excerpt: 'The five choices that determine which probe station fits your research — automation level, temperature, signal type, sample size, and positioning — plus real cost ranges and the university procurement angles that trip up first-time buyers.',
    author: 'NineScrolls Engineering',
    publishDate: '2026-07-12',
    category: 'Metrology & Testing',
    readTime: 14,
    imageUrl: '/assets/images/insights/probe-station-guide-cover.png',
    tags: ['probe station', 'wafer probing', 'university lab', 'equipment procurement', 'device characterization'],
    articleType: 'TechArticle',
    relatedProducts: [
      { href: '/wafer-probe-stations', label: 'Wafer Probe Stations Hub', subtitle: 'Selection guide: manual, semi-automatic, cryogenic' },
      { href: '/wafer-probe-stations/semishare', label: 'SEMISHARE Probe Stations', subtitle: 'US & Canada procurement through NineScrolls' },
    ],
    content: `<!-- The complete HTML conversion of the source draft (path above),
      produced per the conversion rules in Step 1. This is NOT optional filler:
      the entry is only committed once the full converted article HTML is in
      this field. -->`,
  },
```

- [ ] **Step 3: Run the article test, type-check, and lint**

Run: `npx vitest run src/pages/probeStations/probeStationArticle.test.ts --exclude '**/.claude/**'` — expected: PASS.
Run: `npx tsc --noEmit -p tsconfig.json` — expected: exit 0, no errors (do not pipe through grep; a clean run must be visible as a clean exit).
Run: `npm run lint` — expected: no new errors.

- [ ] **Step 4: Local render check**

Publishing to DynamoDB happens post-deploy (deployment checklist) — the article's internal links would 404 in production until the new routes deploy. For a local check, start the dev server (`.claude/launch.json` name for `npm run dev`, port 5173, requires `amplify_outputs.json`) and confirm existing insights pages still render (`/insights`).

- [ ] **Step 5: Commit**

```bash
git add scripts/insightsPostsData.ts src/pages/probeStations/probeStationArticle.test.ts
git commit -m "content(probe-stations): university lab probe station buyer's guide article entry + data-level tests"
```

---

### Task 13: Full verification, browser pass, PR

- [ ] **Step 1: Full quality gates**

```bash
npx vitest run --exclude '**/.claude/**'   # all tests pass
npm run lint                                # no new errors (pre-existing `as any` warnings OK)
npm run build                               # builds clean
```

- [ ] **Step 2: Browser verification (dev server)**

Using the browser preview against the dev server, verify each of:
- `/wafer-probe-stations`, `/wafer-probe-stations/semishare`, `/applications/cryogenic-probing`, `/applications/silicon-photonics-probing` render with correct titles (note: check in a FOREGROUND tab — react-helmet-async commits head updates via rAF, which a hidden tab freezes; a missing title in a background tab is a probe artifact, not a bug).
- Nav dropdown shows "Test & Probing"; ProductsPage shows the probe-station card and tab.
- Every spec row on the brand page shows a source link; product lines without specs show the request-specs fallback.
- Mobile breakpoint (375px) screenshots of all 4 pages — no horizontal overflow.
- Console: no NEW errors (pre-existing: Segment fetch failures, fetchPriority warning).

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feature/semishare-probe-stations
gh pr create --title "SEMISHARE probe stations: 4 strategy pages, first article, SEO infrastructure" --body "$(cat <<'EOF'
Implements docs/superpowers/specs/2026-07-12-semishare-probe-stations-design.md.

## What
- /wafer-probe-stations (capability hub), /wafer-probe-stations/semishare (brand page, attestation-gated wording), /applications/cryogenic-probing, /applications/silicon-photonics-probing
- Attestation gate: controlled-wording registry + static scan + two-state render tests; ships OFF (neutral wording) until written L2 confirmation
- All SEMISHARE-attributed specs carry per-row public-source annotations (semishareprober.com + capture date), enforced by test
- Original schematic diagrams only (no OEM images)
- Nav "Test & Probing" category, ProductsPage card, sitemap entries (script + Lambda), llms.txt/llms-full.txt
- New insight article entry (publish to DDB post-deploy)

## Deployment checklist (after merge/deploy)

All publish steps run with admin env prefixed: `ADMIN_EMAIL=$ADMIN_EMAIL ADMIN_PASSWORD=$ADMIN_PASSWORD` (see each script header) and require `amplify_outputs.json` in the repo root.

- [ ] Direct-load all 4 URLs in production (fresh tab). If any 404s, add an Amplify Console rewrite rule for that path only.
- [ ] **Create the DDB record (DRAFT):** `npm run create-insight -- scripts/articles/how-to-choose-wafer-probe-station-university-lab.html` (slug resolved from the `<meta name="article:slug">`; the article is created unpublished). This is first-time-only and NOT idempotent — re-running aborts on the existing slug.
- [ ] **Upload the two inline figures** (base image → Lambda regenerates sm/md/lg/xl PNG+WebP under `insights/<slug>/<name>-*`; `--no-update-cover` so the article's `imageUrl` is left for the cover step):
  - `npx tsx scripts/upload-insights-image.ts how-to-choose-wafer-probe-station-university-lab public/assets/images/insights/probe-station-temperature-regimes.png --name temperature-regimes --no-update-cover`
  - `npx tsx scripts/upload-insights-image.ts how-to-choose-wafer-probe-station-university-lab public/assets/images/insights/probe-station-automation-levels.png --name automation-levels --no-update-cover`
- [ ] **Upload the cover** (this run rewrites the DDB `imageUrl` to the responsive extension-less `-lg` CDN form): `npx tsx scripts/upload-insights-image.ts how-to-choose-wafer-probe-station-university-lab public/assets/images/insights/probe-station-guide-cover.png --name cover`
- [ ] **HTTP-verify every referenced image is live before publishing** — all must return 200:
  ```bash
  BASE=https://cdn.ninescrolls.com/insights/how-to-choose-wafer-probe-station-university-lab
  for name in temperature-regimes automation-levels; do
    for size in sm md lg xl; do curl -sf -o /dev/null "$BASE/$name-$size.webp" || echo "MISSING $name-$size.webp"; done
    curl -sf -o /dev/null "$BASE/$name-lg.png" || echo "MISSING $name-lg.png"
  done
  curl -sf -o /dev/null "$BASE/cover-lg.webp" || echo "MISSING cover-lg.webp"
  ```
- [ ] **Publish:** open `/admin/insights/<id>/edit` and publish the draft. `create-insight` is first-time creation only; all subsequent content edits go through the admin editor, never a re-run of `create-insight`.
- [ ] Verify https://ninescrolls.com/insights/how-to-choose-wafer-probe-station-university-lab renders (hero + both inline figures load, no broken images).
- [ ] Run `npx tsx scripts/check-llms-sync.ts` (with admin env) — no MISSING/STALE.
- [ ] Verify the production sitemap.xml includes the 4 new URLs.
- [ ] Google Search Console: request indexing for the 4 URLs + article.

## Post-launch follow-ups (tracked in spec)
- Re-verify specs against the official SEMISHARE datasheet pack when it arrives.
- Replace hero/card schematics with authorized product photos (keep schematics for principles).
- Flip ATTESTATION_CONFIRMED upon explicit written L2 confirmation.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Request code review**

Use the superpowers:requesting-code-review skill against the branch diff before merging.

---

## Task Order & Dependencies

1 → 2 → 3 → (4 assets ∥ 5 spec capture) → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13.
Task 4 (assets) must complete before Task 6 (capability page references `probe-station-anatomy.png`) and Task 10 Step 4 (ProductsPage card image). Task 5 must complete before Task 7's spec-count assertion is meaningful (it passes either way — the count adapts).
