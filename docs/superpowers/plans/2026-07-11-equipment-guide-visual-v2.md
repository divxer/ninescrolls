# Equipment Guide Visual v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the approved Claude Design visual language into the PDF generator: 15-page guide (typographic cover + categorized page-numbered TOC), category color coding, Space Grotesk/Inter embedded fonts, About pillar cards, closing CTA band — with zero modification to existing content-v2 data/copy.

**Architecture:** Keep the pure data-driven renderer. Add `PAGE_ORDER` as the single source of page sequence/categories/TOC numbers; add a `cover` data object; vendor fonts deterministically (committed woff2 + SHA-256 provenance); replace the evidence markup fixture with per-block strong parity tests.

**Tech Stack:** TypeScript, Vitest, Puppeteer generator, `pdftoppm`/`pdfinfo`/`pdftotext`/**`pdffonts`** (Poppler), `pypdf`.

**Spec:** `docs/superpowers/specs/2026-07-11-equipment-guide-visual-v2-design.md` (review-hardened; §ref cited per task)

**Branch:** `feature/equipment-guide-visual-v2` (already created, spec committed).

---

## Ground rules (bind every task)

- **Copy freeze:** the ONLY new user-visible strings are the spec §4 cover literals and the §6 CTA-band literal. Every other string ships byte-identical. `products.ts`, `index.ts`, `v1-specs-subtable.json`, `v1-evidence.json`, `package-lock.json` must show NO diff (final audit enforces).
- **Suite green at every commit.** Tests are updated in the same task as the change that breaks them (the 14→15 sweep lives in Task 5, the evidence-fixture retirement in Task 6).
- Vitest: `npx vitest run src/data/equipmentGuide src/templates/equipmentGuide --exclude '**/.claude/**'`; typecheck: `npx tsc --noEmit -p tsconfig.json`.
- Commits: index-empty guard → explicit `git add` → staged-set two-way `diff` guard (pattern below), message + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- PDF working-tree safety: any temp regeneration uses the refuse-dirty → `mktemp` byte-backup → hash-verified restore → `trap - EXIT` pattern (Task 8 Step 4 shows it verbatim); the tracked PDF is committed ONLY in Task 9.

Commit guard template (fill FILES per task):
```bash
test -z "$(git diff --cached --name-only)" || { echo "FAIL: index not empty — unstage before this commit"; exit 1; }
git add $FILES
diff <(git diff --cached --name-only | sort) <(printf '%s\n' $FILES | sort) \
  || { echo "FAIL: staged set != intended files"; exit 1; }
git commit -m "<message>

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 1: Preflight + state dir

- [ ] **Step 1: Verify branch + clean baseline**

```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
set -euo pipefail
[ "$(git branch --show-current)" = "feature/equipment-guide-visual-v2" ] || { echo "FAIL: wrong branch"; exit 1; }
git fetch origin --quiet
git merge-base --is-ancestor origin/main HEAD || { echo "FAIL: branch not on top of origin/main — rebase first"; exit 1; }
command -v pdffonts >/dev/null || { echo "FAIL: pdffonts missing — install poppler (brew install poppler)"; exit 1; }
test -z "$(git status --porcelain --untracked-files=no)" || { echo "FAIL: dirty tracked tree"; exit 1; }
```

- [ ] **Step 2: Record state (unique mktemp dir, atomic writes, NUL manifest — content-v2 pattern)**

```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
set -euo pipefail
S=$(mktemp -d)
w(){ local d; d=$(mktemp "$S/.wXXXXXX"); cat > "$d"; mv -f "$d" "$S/$1"; }
git rev-parse HEAD                    | w base_sha
git hash-object package-lock.json     | w lockfile_hash
git ls-files --others --exclude-standard -z | sort -z \
  | while IFS= read -r -d '' f; do
      case "$f" in tmp/equipment-guide-images/*) continue;; esac
      printf '%s\0%s\0%s\0' "$(git hash-object "$f")" "$(stat -f '%p' "$f")" "$f"
    done | w untracked-manifest
git ls-files --others --exclude-standard -z | sort -z | w untracked-paths
# evidence data fixture: pre-redesign SHA-256 must match the spec §7 pin
EV=$(shasum -a 256 src/data/equipmentGuide/__fixtures__/v1-evidence.json | cut -d' ' -f1)
[ "$EV" = "c56fbe1f698313f100cd72dc30aa0066362cd94d95da3ddf880bb659ebe8badc" ] || { echo "FAIL: v1-evidence.json hash drifted"; exit 1; }
echo "STATE_DIR=$S"; cat "$S/base_sha"
```
Report `STATE_DIR` to the controller; Task 9 reads it (plain files, never sourced).

---

### Task 2: Fonts — deterministic vendoring + `fontsCss.ts` (spec §5)

**Files:** Create `src/templates/equipmentGuide/fonts/{SpaceGrotesk-SemiBold.woff2, SpaceGrotesk-Bold.woff2, Inter-Regular.woff2, Inter-Medium.woff2, Inter-SemiBold.woff2, OFL-SpaceGrotesk.txt, OFL-Inter.txt, PROVENANCE.md}`, `src/templates/equipmentGuide/fontsCss.ts`; Modify `renderEquipmentGuideHtml.ts` (inject font CSS into `<style>`), `renderEquipmentGuideHtml.test.ts`.

- [ ] **Step 0: USER PERMISSION GATE — downloads (STOP until granted)**

Vendoring needs two one-time downloads from official upstream releases. Ask the user before downloading, stating exactly:
- `space-grotesk-2.0.0.zip` from `https://github.com/floriankarsten/space-grotesk/releases/tag/2.0.0` (~1 MB) — extract `SpaceGrotesk-SemiBold.woff2`, `SpaceGrotesk-Bold.woff2`
- `Inter-4.1.zip` from `https://github.com/rsms/inter/releases/tag/v4.1` (~10 MB) — extract `web/Inter-Regular.woff2`, `web/Inter-Medium.woff2`, `web/Inter-SemiBold.woff2`
- Each repo's `OFL.txt` (from the same archive) → committed as `OFL-SpaceGrotesk.txt` / `OFL-Inter.txt`

If exact filenames inside an archive differ (e.g. `InterVariable` naming), pick the static-weight woff2 files matching Regular/Medium/SemiBold and record the actual archive paths in PROVENANCE.md. Download to the session scratchpad (never the repo's `tmp/`), extract only the 7 files into `src/templates/equipmentGuide/fonts/`.

- [ ] **Step 1: Write PROVENANCE.md with real SHA-256 values**

```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls/src/templates/equipmentGuide/fonts
shasum -a 256 *.woff2
```
`PROVENANCE.md` lists, per woff2: upstream project, release version, release URL, archive-internal path, SHA-256 (paste real values). Plus: "Licenses: SIL OFL 1.1, committed alongside. Refresh policy: only via an explicit spec change; generation and tests never download."

- [ ] **Step 2: Write the failing font tests FIRST**

Append to `renderEquipmentGuideHtml.test.ts`:
```ts
import { createHash } from 'node:crypto';
import { readdirSync } from 'node:fs';

describe('visual-v2 fonts (deterministic, embedded)', () => {
  const FONT_DIR = resolve(process.cwd(), 'src/templates/equipmentGuide/fonts');
  const WOFF2 = ['SpaceGrotesk-SemiBold.woff2', 'SpaceGrotesk-Bold.woff2', 'Inter-Regular.woff2', 'Inter-Medium.woff2', 'Inter-SemiBold.woff2'];
  it('every committed woff2 matches its PROVENANCE.md SHA-256', () => {
    const prov = readFileSync(resolve(FONT_DIR, 'PROVENANCE.md'), 'utf8');
    for (const f of WOFF2) {
      const sha = createHash('sha256').update(readFileSync(resolve(FONT_DIR, f))).digest('hex');
      expect(prov, f).toContain(sha);
    }
  });
  it('renders one base64 @font-face per committed woff2 (no network sources)', () => {
    const faces = [...html.matchAll(/@font-face\s*{[^}]*}/g)].map(m => m[0]);
    expect(faces).toHaveLength(WOFF2.length);
    for (const face of faces) {
      expect(face).toContain('data:font/woff2;base64,');
      expect(face).not.toMatch(/https?:\/\//);
    }
    expect(faces.filter(f => f.includes("'Space Grotesk'"))).toHaveLength(2);
    expect(faces.filter(f => f.includes("'Inter'"))).toHaveLength(3);
  });
  it('licenses and provenance are committed', () => {
    const files = readdirSync(FONT_DIR);
    for (const req of ['OFL-SpaceGrotesk.txt', 'OFL-Inter.txt', 'PROVENANCE.md']) expect(files).toContain(req);
  });
});
```
Run → **FAIL** (no fonts dir / no @font-face in HTML).

- [ ] **Step 3: Implement `fontsCss.ts` (→ green)**

```ts
// src/templates/equipmentGuide/fontsCss.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(process.cwd(), 'src/templates/equipmentGuide/fonts');
const face = (family: string, weight: number, file: string): string => {
  const b64 = readFileSync(resolve(DIR, file)).toString('base64');
  return `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
};
let cached: string | null = null;
export function equipmentGuideFontsCss(): string {
  if (cached) return cached;
  cached = [
    face('Space Grotesk', 600, 'SpaceGrotesk-SemiBold.woff2'),
    face('Space Grotesk', 700, 'SpaceGrotesk-Bold.woff2'),
    face('Inter', 400, 'Inter-Regular.woff2'),
    face('Inter', 500, 'Inter-Medium.woff2'),
    face('Inter', 600, 'Inter-SemiBold.woff2'),
  ].join('\n');
  return cached;
}
```
In `renderEquipmentGuideHtml.ts`: `import { equipmentGuideFontsCss } from './fontsCss';` and change the head style to `<style>${equipmentGuideFontsCss()}\n${equipmentGuideCss}</style>`. (Font FAMILIES are not applied yet — Task 7 switches the stacks; declaring faces is inert and keeps this task minimal.)

- [ ] **Step 4: Run tests + typecheck** → font tests green, all existing tests still green.

- [ ] **Step 5: Commit** with FILES = the 8 font files + `fontsCss.ts` + `renderEquipmentGuideHtml.ts` + `renderEquipmentGuideHtml.test.ts` (guard template). Message: `feat(guide): vendor Space Grotesk + Inter (OFL, SHA-256 provenance) and embed @font-face data URIs`

---

### Task 3: Cover data — `cover` object + literals tests (spec §4)

**Files:** Modify `types.ts`, `guideMeta.ts`, `src/data/equipmentGuide/index.ts`? — **NO**: `index.ts` is frozen. The renderer imports `cover` directly from `guideMeta` — keeping `EquipmentGuideData` and `index.ts` untouched. Modify `equipmentGuide.data.test.ts`.

- [ ] **Step 1: Write the failing cover tests FIRST**

Append to `equipmentGuide.data.test.ts` (import `cover` from `./guideMeta` alongside the existing `about` import):
```ts
describe('visual-v2 cover', () => {
  it('pins the user-approved cover literals verbatim', () => {
    expect(cover.eyebrow).toBe('Precision Instrumentation');
    expect(cover.title).toBe('Equipment Guide');
    expect(cover.tagline).toBe('Etching, thin-film deposition, lithography, and surface-processing platforms for university, national laboratory, institute, and corporate R&D facilities.');
    expect(cover.edition).toBe('Equipment Guide · 2026 Edition · ninescrolls.com · info@ninescrolls.com');
  });
  it('cover copy passes the banned-claims scan', () => {
    const t = JSON.stringify(cover);
    expect(t).not.toMatch(/\d+\+\s*years|years of experience|installations|research institutions served|research-grade|industry-leading|world-class|state-of-the-art/i);
    expect(t).not.toMatch(/tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i);
  });
});
```
Run → **FAIL** (`cover` not exported).

- [ ] **Step 2: Add the type + data (→ green)**

`types.ts` — add (standalone interface; `EquipmentGuideData` unchanged):
```ts
export interface GuideCover {
  eyebrow: string;
  title: string;
  tagline: string;
  edition: string;
}
```
`guideMeta.ts` — add:
```ts
export const cover: GuideCover = {
  eyebrow: 'Precision Instrumentation',
  title: 'Equipment Guide',
  tagline: 'Etching, thin-film deposition, lithography, and surface-processing platforms for university, national laboratory, institute, and corporate R&D facilities.',
  edition: 'Equipment Guide · 2026 Edition · ninescrolls.com · info@ninescrolls.com',
};
```
(with `import type { GuideCover } from './types';` adjusted to the file's existing import style.)

- [ ] **Step 3: Run tests + typecheck → green. Commit** FILES = `types.ts guideMeta.ts equipmentGuide.data.test.ts`. Message: `feat(guide): visual-v2 cover data — pinned literals + banned-claims scan`

---

### Task 4: PILOT — full 15-page build in an isolated worktree (spec §9; STOP for sign-off)

**Files (throwaway worktree only):** renderer/CSS/generator — no tests, no commits, never pushed.

- [ ] **Step 1: Worktree + node_modules link**

```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
set -euo pipefail
git worktree add .claude/worktrees/eqg-visual-v2-pilot -b eqg-visual-v2-pilot-throwaway HEAD
ln -s /Users/harvey/Dev/src/cursor/ninescrolls/node_modules .claude/worktrees/eqg-visual-v2-pilot/node_modules
```

- [ ] **Step 2: Implement the full visual skeleton in the worktree** — PAGE_ORDER + cover page + category colors + font families applied + About cards + CTA band + evidence blocks + generator `EXPECTED_PAGES = 15`, using the exact code from Tasks 5–8 below as the reference (the pilot is the integration rehearsal; anything learned here — pagination budgets, plasma-cleaner tier values — feeds back into those tasks' values before they run).

- [ ] **Step 3: Generate + inspect ALL 15 pages**

```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls/.claude/worktrees/eqg-visual-v2-pilot
SHOT=$(mktemp -d)
npm run generate-equipment-guide
pdffonts public/NineScrolls-Equipment-Guide.pdf
pdftoppm -jpeg -r 100 public/NineScrolls-Equipment-Guide.pdf "$SHOT/p"; echo "SHOT=$SHOT"
```
**Pilot acceptance (spec §9):** 15 pages; visual focus = cover + RIE + plasma-cleaner, BUT all other 12 pages checked for pagination breaks, clipped tables, font fallback (`pdffonts` shows SpaceGrotesk + Inter embedded, no Helvetica/Arial/Times/Liberation/DejaVu/Noto).

- [ ] **Step 4: Save the pilot diff as reference, present, STOP**

```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls/.claude/worktrees/eqg-visual-v2-pilot
git diff > /private/tmp/claude-501/-Users-harvey-Dev-src-cursor-ninescrolls/bb23dd09-e6fb-474e-bc60-2f14978aa465/scratchpad/visual-v2-pilot.patch
```
Present all 15 page images to the user; **do not proceed until sign-off**. Then:
```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
rm -f .claude/worktrees/eqg-visual-v2-pilot/node_modules
git worktree remove --force .claude/worktrees/eqg-visual-v2-pilot
git branch -D eqg-visual-v2-pilot-throwaway
```

---

### Task 5: Structure — `PAGE_ORDER`, cover page, sequence, categories, 14→15 sweep (spec §3–§4)

**Files:** `renderEquipmentGuideHtml.ts`, `renderEquipmentGuideHtml.test.ts`

- [ ] **Step 1: Write the failing structure tests FIRST**

Append to `renderEquipmentGuideHtml.test.ts` (import `PAGE_ORDER`, `CATEGORY_META` from the renderer, `cover` from `../../data/equipmentGuide/guideMeta`):
```ts
describe('visual-v2 structure — PAGE_ORDER single source of truth', () => {
  it('PAGE_ORDER shape: cover, about, evidence, 11 unique products, contact', () => {
    expect(PAGE_ORDER).toHaveLength(15);
    expect(PAGE_ORDER[0]).toEqual({ kind: 'cover' });
    expect(PAGE_ORDER[1]).toEqual({ kind: 'about' });
    expect(PAGE_ORDER[2]).toEqual({ kind: 'evidence' });
    expect(PAGE_ORDER[14]).toEqual({ kind: 'contact' });
    const ids = PAGE_ORDER.filter(e => e.kind === 'product').map(e => (e as { id: string }).id);
    expect(ids.sort()).toEqual(equipmentGuideData.products.map(p => p.id).sort());
  });
  it('rendered section sequence equals PAGE_ORDER', () => {
    const kinds = chunks.map(c => {
      const m = c.match(/data-page="([a-z-]+)"/);
      return m![1];
    });
    expect(kinds).toEqual(PAGE_ORDER.map(e => e.kind === 'product' ? `product:${(e as { id: string }).id}`.replace(/^product:/, 'product-') : e.kind).map((k, i) => {
      const e = PAGE_ORDER[i];
      return e.kind === 'product' ? 'product' : e.kind;
    }));
    const productIds = chunks.filter(c => c.includes('data-product-id=')).map(c => c.match(/data-product-id="([a-z-]+)"/)![1]);
    expect(productIds).toEqual(PAGE_ORDER.filter(e => e.kind === 'product').map(e => (e as { id: string }).id));
  });
  it('stamps data-category per PAGE_ORDER on every product section', () => {
    for (const e of PAGE_ORDER) {
      if (e.kind !== 'product') continue;
      const chunk = chunks.find(c => c.includes(`data-product-id="${(e as { id: string }).id}"`))!;
      expect(chunk).toContain(`data-category="${(e as { category: string }).category}"`);
    }
  });
  it('cover TOC: 11 entries, series verbatim, page number = PAGE_ORDER index + 1, grouped under CATEGORY_META labels', () => {
    const coverChunk = chunks[0];
    for (const [i, e] of PAGE_ORDER.entries()) {
      if (e.kind !== 'product') continue;
      const p = equipmentGuideData.products.find(x => x.id === (e as { id: string }).id)!;
      const re = new RegExp(`<span class="toc-name">${p.series.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span><span class="toc-page">${i + 1}</span>`);
      expect(coverChunk, p.id).toMatch(re);
    }
    for (const meta of Object.values(CATEGORY_META)) expect(coverChunk).toContain(`>${meta.label}<`);
    expect([...coverChunk.matchAll(/class="toc-name"/g)]).toHaveLength(11);
  });
  it('cover renders the pinned literals and the navy logo', () => {
    const coverChunk = chunks[0];
    for (const s of [cover.eyebrow, cover.title, cover.edition]) expect(coverChunk).toContain(s);
    expect(coverChunk).toContain(cover.tagline);
    expect(count(coverChunk, navyLogo)).toBe(1);
  });
});
```
Also update (in the SAME step — they red the moment the cover exists) the **14→15 sweep** (spec §7, all known hits):
- `renderEquipmentGuideHtml.test.ts:54–57`: describe renamed `branding — logo on all 15 pages`; navy count `13→14`, white stays `1`.
- `:64`: `expect(chunks).toHaveLength(14)` → `15`.
- `:69–77`: per-section logo loop unchanged (about/evidence/products/contact) + covered by the new cover-logo assertion above.
- `:50` (`dataUris.length ≥ 11`) — not page-related; unchanged.
Run → **FAIL** (no PAGE_ORDER export, no cover section; sweep updates fail against current 14-page output — expected; they go green together in Step 2).

- [ ] **Step 2: Implement (→ green)**

In `renderEquipmentGuideHtml.ts`:
```ts
export type GuideCategory = 'plasma-etch' | 'thin-film' | 'litho-surface';
export const CATEGORY_META: Record<GuideCategory, { label: string; color: string }> = {
  'plasma-etch':   { label: 'Etch & Ion Beam',            color: '#0066cc' },
  'thin-film':     { label: 'Thin-Film Deposition',       color: '#022448' },
  'litho-surface': { label: 'Litho & Surface Processing', color: '#0d7ea8' },
};
export type PageEntry =
  | { kind: 'cover' } | { kind: 'about' } | { kind: 'evidence' } | { kind: 'contact' }
  | { kind: 'product'; id: string; category: GuideCategory };
export const PAGE_ORDER: ReadonlyArray<PageEntry> = [
  { kind: 'cover' }, { kind: 'about' }, { kind: 'evidence' },
  { kind: 'product', id: 'rie', category: 'plasma-etch' },
  { kind: 'product', id: 'icp-rie', category: 'plasma-etch' },
  { kind: 'product', id: 'ibe-ribe', category: 'plasma-etch' },
  { kind: 'product', id: 'ald', category: 'thin-film' },
  { kind: 'product', id: 'pecvd', category: 'thin-film' },
  { kind: 'product', id: 'hdp-cvd', category: 'thin-film' },
  { kind: 'product', id: 'sputter', category: 'thin-film' },
  { kind: 'product', id: 'e-beam', category: 'thin-film' },
  { kind: 'product', id: 'coater-developer', category: 'litho-surface' },
  { kind: 'product', id: 'stripper', category: 'litho-surface' },
  { kind: 'product', id: 'plasma-cleaner', category: 'litho-surface' },
  { kind: 'contact' },
];
```
Cover builder (import `cover` from `../../data/equipmentGuide/guideMeta`):
```ts
function coverPage(d: EquipmentGuideData): string {
  const groups = (Object.keys(CATEGORY_META) as GuideCategory[]).map(cat => {
    const entries = PAGE_ORDER
      .map((e, i) => ({ e, page: i + 1 }))
      .filter(x => x.e.kind === 'product' && (x.e as { category: GuideCategory }).category === cat)
      .map(x => {
        const p = d.products.find(pp => pp.id === (x.e as { id: string }).id)!;
        return `<li><span class="toc-name">${esc(p.series)}</span><span class="toc-page">${x.page}</span></li>`;
      }).join('');
    return `<div class="toc-col" data-toc-category="${cat}"><p class="toc-cat" style="color:${CATEGORY_META[cat].color};border-color:${CATEGORY_META[cat].color}">${esc(CATEGORY_META[cat].label)}</p><ul>${entries}</ul></div>`;
  }).join('');
  return `
  <section class="page page--cover" data-page="cover">
    ${brandbar('navy')}
    <div class="cover-main">
      <p class="eyebrow">${esc(cover.eyebrow)}</p>
      <h1 class="cover-title">${esc(cover.title)}</h1>
      <div class="section-accent"></div>
      <p class="cover-tagline">${esc(cover.tagline)}</p>
      <p class="cover-edition">${esc(cover.edition)}</p>
    </div>
    <div class="toc">${groups}</div>
    <div class="page-foot"></div>
  </section>`;
}
```
Assembly: replace the body composition with a `PAGE_ORDER` walk. Stamp `data-page` on every section (`cover|about|evidence|product|contact`) and keep existing markers:
```ts
export function renderEquipmentGuideHtml(d: EquipmentGuideData, imageDataUri = defaultImageDataUri): string {
  const byId = new Map(d.products.map(p => [p.id, p]));
  const body = PAGE_ORDER.map(e => {
    switch (e.kind) {
      case 'cover': return coverPage(d);
      case 'about': return aboutPage(d);
      case 'evidence': return evidencePage(d);
      case 'contact': return contactPage(d);
      case 'product': {
        const p = byId.get(e.id);
        if (!p) throw new Error(`PAGE_ORDER references unknown product id: ${e.id}`);
        return productPage(p, imageDataUri, e.category);
      }
    }
  }).join('');
  return `<!DOCTYPE html>…<style>${equipmentGuideFontsCss()}\n${equipmentGuideCss}</style></head><body>${body}</body></html>`;
}
```
`productPage(p, imageDataUri, category)`: section tag becomes `<section class="page page--product" data-page="product" data-product-id="${p.id}" data-category="${category}">`; eyebrow becomes `<p class="eyebrow eyebrow--cat">${esc(CATEGORY_META[category].label)}</p>` — NOTE: eyebrow text changes from the constant `Equipment Platform` to the category label; this is data-derived labeling (CATEGORY_META), not new authored copy. `aboutPage`/`evidencePage`/`contactPage`: add `data-page="about|evidence|contact"` to their section tags (no other change in this task). The old `.sort((a,b) => a.order - b.order)` walk is deleted — `products` data stays untouched.
Minimal CSS for this task (appended; full token port is Task 7): `.page--cover`, `.cover-title` (46px Space Grotesk 700 — falls back until Task 7 applies stacks; fine), `.cover-tagline` (14px), `.cover-edition` (11px), `.toc` (3-col flex), `.toc-cat` (11px uppercase, 2px bottom border), `.toc li` (12.5px, flex space-between), `.toc-page` (11px, tabular numerals).

- [ ] **Step 3: Run full guide suites + tsc** → all green (including the sweep updates). **Commit** FILES = `renderEquipmentGuideHtml.ts renderEquipmentGuideHtml.test.ts equipmentGuide.css.ts`. Message: `feat(guide): visual-v2 structure — PAGE_ORDER, typographic cover with categorized TOC, category stamping; 15-page sweep`

---

### Task 6: Evidence rework — per-block markup + STRONG parity; retire the chunk fixture (spec §7)

**Files:** `renderEquipmentGuideHtml.ts`, `renderEquipmentGuideHtml.test.ts`; Delete `src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html`

- [ ] **Step 1: Write the failing parity tests FIRST; delete the fixture test in the same edit**

DELETE the `keeps the Evidence page string-identical to the v1 fixture` test and the `fixTrim` helper (if now unused). Append:
```ts
describe('visual-v2 evidence strong parity (markup-free content lock)', () => {
  const section = chunks.find(c => c.includes('data-page="evidence"'))!;
  const studies = equipmentGuideData.evidence.studies;
  const blocks = [...section.matchAll(/<article data-study-index="(\d+)">([\s\S]*?)<\/article>/g)];
  const occurrences = (hay: string, needle: string) => hay.split(needle).length - 1;
  it('renders exactly one block per study, indices ascending', () => {
    expect(blocks).toHaveLength(studies.length);
    expect(blocks.map(b => Number(b[1]))).toEqual(studies.map((_, i) => i));
  });
  it('each block contains its own title/journal/year/platform exactly once (scoped)', () => {
    for (const [i, s] of studies.entries()) {
      const b = blocks[i][2];
      expect(occurrences(b, esc(s.title)), `title ${i}`).toBe(1);
      expect(occurrences(b, esc(s.journal)), `journal ${i}`).toBe(1);
      expect(occurrences(b, String(s.year)), `year ${i}`).toBeGreaterThanOrEqual(1); // year may appear in citationsAsOf
      expect(occurrences(b, esc(s.platform)), `platform ${i}`).toBeGreaterThanOrEqual(1);
      if (s.citations !== undefined) {
        expect(occurrences(b, `${s.citations} citations`), `citations ${i}`).toBe(1);
        expect(occurrences(b, esc(s.citationsAsOf!)), `citationsAsOf ${i}`).toBe(1);
      } else {
        expect(b).not.toMatch(/\d+ citations/);
      }
    }
  });
  it('each block links its DOI exactly once (when present)', () => {
    for (const [i, s] of studies.entries()) {
      const anchors = [...blocks[i][2].matchAll(/<a class="doi" href="([^"]+)"/g)];
      if (s.doi) {
        expect(anchors, `doi ${i}`).toHaveLength(1);
        expect(anchors[0][1]).toBe(`https://doi.org/${s.doi}`);
      } else {
        expect(anchors).toHaveLength(0);
      }
    }
  });
  it('title, subtitle, disclaimer each exactly once, verbatim', () => {
    for (const s of [equipmentGuideData.evidence.title, equipmentGuideData.evidence.subtitle, equipmentGuideData.evidence.disclaimer]) {
      expect(occurrences(section, esc(s)), s.slice(0, 30)).toBe(1);
    }
  });
});
```
(A local `esc` copy in the test file mirrors the renderer's four-entity escaper — add it next to `count`.) Run → **FAIL** (no `data-study-index` articles, no `.doi` anchors).

- [ ] **Step 2: Rework `evidencePage` (→ green)**

```ts
function evidencePage(d: EquipmentGuideData): string {
  const studies = d.evidence.studies.map((s, i) => {
    const cite = s.citations !== undefined ? ` · ${s.citations} citations (as of ${esc(s.citationsAsOf ?? '')})` : '';
    const doi = s.doi ? `<a class="doi" href="https://doi.org/${esc(s.doi)}">doi.org/${esc(s.doi)}</a>` : '';
    return `<article data-study-index="${i}" class="study"><span class="j">${esc(s.journal)} · ${s.year}</span>
      <div class="t">${esc(s.title)}</div>
      <div class="m">Corresponding ${esc(s.platform)} process platform${cite}${doi ? ' · ' : ''}${doi}</div></article>`;
  }).join('');
  // section wrapper + title/subtitle/intro/disclaimer unchanged apart from data-page="evidence"
  …
}
```
Delete the fixture:
```bash
git rm src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html
```

- [ ] **Step 3: Run suites + tsc → green. Commit** FILES = `renderEquipmentGuideHtml.ts renderEquipmentGuideHtml.test.ts` plus the deletion (`git rm` stages it; include the fixture path in the staged-set guard list). Message: `feat(guide): visual-v2 evidence — per-study blocks with DOI links; retire markup fixture for strong parity tests`

---

### Task 7: Visual token port — typography, category colors, About cards, CTA band, font-size allowlist (spec §6)

**Files:** `equipmentGuide.css.ts`, `renderEquipmentGuideHtml.ts` (About cards markup, CTA band markup), `renderEquipmentGuideHtml.test.ts`

- [ ] **Step 1: Write the failing tests FIRST**

```ts
describe('visual-v2 tokens', () => {
  it('contact page renders the pinned CTA band exactly once', () => {
    const contact = chunks.find(c => c.includes('data-page="contact"'))!;
    const BAND = 'Ready to scope your process? Request a quote — ninescrolls.com/products · sales@ninescrolls.com';
    expect(count(contact, esc(BAND))).toBe(1);
    expect(contact).toContain('class="cta-band"');
  });
  it('about pillars render as icon cards (one svg per pillar)', () => {
    const about = chunks.find(c => c.includes('data-page="about"'))!;
    expect([...about.matchAll(/class="pillar-card"/g)]).toHaveLength(4);
    expect([...about.matchAll(/<svg[\s>]/g)].length).toBeGreaterThanOrEqual(4);
  });
  it('every sub-12.5px font-size in the CSS belongs to the spec exception allowlist', () => {
    const ALLOW = ['.eyebrow', '.apps .lab', '.cover-edition', '.toc-page', '.toc-cat', '.study .m', '.disclaimer', '.page-foot', '.brandbar .site', '.cta-band .sub', '.family-label'];
    const rules = [...equipmentGuideCss.matchAll(/([^{}]+){[^}]*font-size:\s*([\d.]+)px/g)];
    for (const [, selector, size] of rules) {
      if (parseFloat(size) >= 12.5) continue;
      const sel = selector.trim().split(',').map(s => s.trim());
      for (const s of sel) expect(ALLOW.some(a => s.endsWith(a) || s.includes(a)), `${s} @ ${size}px`).toBe(true);
    }
  });
  it('category color is applied via data-category rules', () => {
    for (const meta of Object.values(CATEGORY_META)) expect(equipmentGuideCss).toContain(meta.color);
  });
});
```
Run → **FAIL** (no band/cards/colors yet; allowlist test may already pass — acceptable, the other three provide the red).

- [ ] **Step 2: Implement markup (→ partially green)**

`contactPage`: prepend inside the section (after brandbar):
```ts
const band = `<div class="cta-band">Ready to scope your process? Request a quote — ninescrolls.com/products · sales@ninescrolls.com</div>`;
```
`aboutPage` pillar cards (icons: 4 inline stroke SVGs, brand color, 18×18 — sliders/target/map-pin/book-open paths; any simple 1–2 path stroke icon set is fine, no external assets):
```ts
const ICONS = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.1 7-11a7 7 0 0 0-14 0c0 5.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5.5C10.5 4 8.5 3.5 6 3.5v14c2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2v-14c-2.5 0-4.5.5-6 2z"/><path d="M12 5.5v14"/></svg>',
];
const pillars = d.about.pillars.map((p, i) =>
  `<div class="pillar-card"><span class="pi">${ICONS[i]}</span><span class="h">${esc(p.heading)}</span><div>${esc(p.body)}</div></div>`).join('');
// wrapped in <div class="pillars-grid">…</div>
```

- [ ] **Step 3: Port the CSS tokens (→ green)**

Rewrite `equipmentGuide.css.ts` values (structure preserved; every selector keeps its role):
- `body { font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif; }`; `h1,h2,h3,.series-title,.cover-title { font-family: 'Space Grotesk', 'Helvetica Neue', Arial, sans-serif; }`
- `.series-title` 26px / 700; `.lead` 13px; bullets/body/chips/CTA unchanged at 12.5–13px
- Category coding: `section[data-category="plasma-etch"] .eyebrow { color: #0066cc; } section[data-category="plasma-etch"] .section-accent { background: #0066cc; }` — same pair for `thin-film` → `#022448` and `litho-surface` → `#0d7ea8`
- Image well: `flex-basis 215px; height 200px` (keep border/radius/gradient); plasma-cleaner tier keeps its td/th/apps/cta overrides + `section[data-product-id="plasma-cleaner"] .image-well { height: 170px; }`
- Cover styles (full): `.page--cover { display:flex; flex-direction:column; min-height: 9.1in; } .cover-main { margin-top: 90px; } .cover-title { font-size: 46px; letter-spacing: -0.01em; margin: 4px 0 10px; } .cover-tagline { font-size: 14px; color: #334155; max-width: 58ch; } .cover-edition { font-size: 11px; color: #64748b; letter-spacing: .06em; margin-top: 10px; } .toc { display:flex; gap: 28px; margin-top: auto; padding-top: 24px; border-top: 1px solid #eef2f7; } .toc-col { flex: 1; } .toc-cat { font-size: 11px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; border-bottom: 2px solid; padding-bottom: 5px; margin-bottom: 8px; } .toc ul { list-style:none; margin:0; padding:0; } .toc li { display:flex; justify-content:space-between; font-size: 12.5px; color:#0f172a; padding: 3px 0; } .toc-page { color:#64748b; font-size: 11px; font-variant-numeric: tabular-nums; }`
- Pillar cards: `.pillars-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 14px; } .pillar-card { break-inside: avoid; background:#f4f5fb; border:1px solid #e7e9f4; border-radius: 10px; padding: 12px 14px; } .pillar-card .pi { color:#1e3a5f; display:inline-block; width:18px; height:18px; margin-bottom:4px; } .pillar-card .pi svg { width:18px; height:18px; } .pillar-card .h { display:block; font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:13px; color:#1e3a5f; margin-bottom:3px; } .pillar-card div { font-size:12.5px; color:#334155; }` (drop the old `.pillar` rules)
- CTA band: `.cta-band { background:#0f2440; color:#fff; border-radius: 10px; padding: 14px 18px; font-family:'Space Grotesk', sans-serif; font-weight:600; font-size:13.5px; margin-bottom: 18px; -webkit-print-color-adjust: exact; }`
- Evidence `.doi { color:#7dd3fc; font-size: 11.5px; text-decoration: none; }` (metadata role, in allowlist as `.study .m` context — keep the anchor inside `.m`)
- Print robustness kept/extended: `.page { break-after: page; }` unchanged; `tr, .bullet, .pillar-card { break-inside: avoid; }`; add `.apps, .cta, .cta-band { break-inside: avoid; }`
Update the old `.pillar` usages in `aboutPage` (done in Step 2). Run suites + tsc → all green.

- [ ] **Step 4: Commit** FILES = `equipmentGuide.css.ts renderEquipmentGuideHtml.ts renderEquipmentGuideHtml.test.ts`. Message: `feat(guide): visual-v2 token port — Space Grotesk/Inter, category colors, About icon cards, closing CTA band, font-size allowlist test`

---

### Task 8: Generator — 15 pages, required strings, fail-closed `pdffonts` (spec §5, §7)

**Files:** `scripts/generate-equipment-guide.ts`

- [ ] **Step 1: Edit the generator**

- `EXPECTED_PAGES = 15`
- `required` gains: `'Equipment Guide · 2026 Edition'`, `'Ready to scope your process?'`, `'Etch & Ion Beam'`
- New font validation inside `validatePdf` (after the pages check):
```ts
function assertEmbeddedFonts(outPath: string): void {
  let out: string;
  try {
    out = execFileSync('pdffonts', [outPath], { encoding: 'utf8' });
  } catch {
    throw new Error('pdffonts (poppler) is a required build dependency — install it (brew install poppler)');
  }
  const rows = out.split('\n').slice(2).filter(l => l.trim());
  const fonts = rows.map(l => {
    const cols = l.trim().split(/\s+/);
    // columns: name type encoding emb sub uni object ID — emb/sub are 3rd/4th from the end offsets vary, so read by header index instead:
    return { raw: l, name: cols[0] };
  });
  const norm = (n: string) => n.replace(/^[A-Z]{6}\+/, '').replace(/[-_ ].*$/, '').toLowerCase();
  const embedded = rows.filter(l => /\byes\b\s+\byes\b/.test(l)); // emb + sub columns both 'yes'
  const names = embedded.map(l => norm(l.trim().split(/\s+/)[0]));
  if (!names.some(n => n.startsWith('spacegrotesk'))) throw new Error('Space Grotesk not embedded+subset in PDF (font fallback?)');
  if (!names.some(n => n === 'inter' || n.startsWith('inter'))) throw new Error('Inter not embedded+subset in PDF (font fallback?)');
  const banned = /helvetica|arial|times|liberationsans|dejavu|noto/;
  for (const f of fonts) if (banned.test(norm(f.name))) throw new Error(`Fallback font detected in PDF: ${f.name}`);
}
```
Call `assertEmbeddedFonts(outPath)` from `validatePdf`. (Exact column parsing may be tuned against real `pdffonts` output during implementation — the CONTRACT is fixed: fail-closed when pdffonts missing; subset-prefix-stripped, case-folded names; Space Grotesk AND Inter with emb=yes,sub=yes; zero fallback-family rows.)

- [ ] **Step 2: Typecheck** (`npx tsc --noEmit -p tsconfig.json` covers scripts if in tsconfig scope — otherwise `npx tsx --check` equivalent: run the generator in Step 4).

- [ ] **Step 3: Commit the generator change alone** FILES = `scripts/generate-equipment-guide.ts`. Message: `feat(guide): generator visual-v2 — 15 pages, cover/CTA required strings, fail-closed pdffonts embedding check`

- [ ] **Step 4: Temp-PDF verify (do NOT stage the PDF)** — exact safe pattern:

```bash
cd /Users/harvey/Dev/src/cursor/ninescrolls
set -euo pipefail
PROD=public/NineScrolls-Equipment-Guide.pdf
git diff --quiet -- "$PROD" && git diff --cached --quiet -- "$PROD" \
  || { echo "FAIL: $PROD has uncommitted changes"; exit 1; }
ORIG=$(git hash-object "$PROD")
SHOT=$(mktemp -d)
BK=$(mktemp -d)/before.pdf; cp "$PROD" "$BK"
trap 'cp "$BK" "'"$PROD"'" 2>/dev/null' EXIT
npm run generate-equipment-guide
GEN=$(git hash-object "$PROD")
cp "$PROD" "$SHOT/check.pdf"
[ "$(git hash-object "$PROD")" = "$GEN" ] || { echo "FAIL: changed mid-verify"; exit 1; }
cp "$BK" "$PROD"
[ "$(git hash-object "$PROD")" = "$ORIG" ] || { echo "FAIL: not restored"; exit 1; }
git diff --quiet -- "$PROD" || { echo "FAIL: still modified"; exit 1; }
trap - EXIT
PAGES=$(python3 -c "from pypdf import PdfReader; print(len(PdfReader('$SHOT/check.pdf').pages))")
[ "$PAGES" = "15" ] || { echo "FAIL: $PAGES pages (want 15)"; exit 1; }
pdffonts "$SHOT/check.pdf"
pdftoppm -jpeg -r 100 "$SHOT/check.pdf" "$SHOT/p"; echo "SHOT=$SHOT"
```
Inspect ALL 15 images: cover TOC page numbers correct; every product single-page in the NEW category order; plasma-cleaner holds one page; Evidence dark panel + DOI links legible; About cards 2×2; CTA band on Contact. If a page overflows: adjust ONLY spacing/image-well/scoped density tiers (never copy, never <12.5px body, never the plasma-cleaner chips) and re-run; fold any tier change back into Task 7's committed CSS via an amend-free follow-up commit (FILES = `equipmentGuide.css.ts`).

---

### Task 9: Finalize — full verification + atomic PDF commit + hygiene audit + PR

- [ ] **Step 1: Tests + build (fail hard)**

```bash
npx vitest run --exclude '**/.claude/**' || { echo "FAIL: tests"; exit 1; }
npm run build || { echo "FAIL: build"; exit 1; }
```

- [ ] **Step 2: Final regen + hard asserts**

Same refuse-dirty guard as Task 8 Step 4, then regenerate FOR REAL (no restore — Task 9 intentionally writes the production PDF):
```bash
set -euo pipefail
PROD=public/NineScrolls-Equipment-Guide.pdf
git diff --quiet -- "$PROD" && git diff --cached --quiet -- "$PROD" || { echo "FAIL: PDF dirty"; exit 1; }
SHOT=$(mktemp -d)
npm run generate-equipment-guide || { echo "FAIL: generate"; exit 1; }   # internal validatePdf: 15p, size, strings, pdffonts
PAGES=$(python3 -c "from pypdf import PdfReader; print(len(PdfReader('$PROD').pages))")
[ "$PAGES" = "15" ] || { echo "FAIL: $PAGES pages"; exit 1; }
BYTES=$(python3 -c "import os; print(os.path.getsize('$PROD'))")
[ "$BYTES" -lt 2000000 ] || { echo "FAIL: $BYTES >= 2MB"; exit 1; }
pdftoppm -jpeg -r 100 "$PROD" "$SHOT/p"; echo "SHOT=$SHOT"
```
Read all 15 page images (final gate: no clipping, category colors on the right pages, spec tables intact).

- [ ] **Step 3: Commit the PDF (stage only the PDF)**

```bash
test -z "$(git diff --cached --name-only)" || { echo "FAIL: index not empty"; exit 1; }
git add public/NineScrolls-Equipment-Guide.pdf
[ "$(git diff --cached --name-only)" = "public/NineScrolls-Equipment-Guide.pdf" ] || { echo "FAIL: staged set"; exit 1; }
git commit -m "feat(guide): regenerate Equipment Guide PDF with visual-v2 design

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Hygiene audit (STATE_DIR from Task 1; every breach exits 1)**

```bash
set -euo pipefail
S="${STATE_DIR:?set STATE_DIR from Task 1}"
rdsha(){ local v; v=$(cat "$1"); [[ "$v" =~ ^[0-9a-f]{40}$ ]] && printf '%s' "$v"; }
BASE=$(rdsha "$S/base_sha")      || { echo "FAIL: base_sha"; exit 1; }
LOCK=$(rdsha "$S/lockfile_hash") || { echo "FAIL: lockfile_hash"; exit 1; }
git cat-file -e "${BASE}^{commit}" 2>/dev/null || { echo "FAIL: base unreachable"; exit 1; }
[ "$(git hash-object package-lock.json)" = "$LOCK" ] || { echo "FAIL: lockfile changed"; exit 1; }
test -z "$(git status --porcelain --untracked-files=no)" || { echo "FAIL: uncommitted tracked changes"; exit 1; }
# frozen-data direct checks (spec §7): fixture SHA-256 + products/index untouched
EV=$(shasum -a 256 src/data/equipmentGuide/__fixtures__/v1-evidence.json | cut -d' ' -f1)
[ "$EV" = "c56fbe1f698313f100cd72dc30aa0066362cd94d95da3ddf880bb659ebe8badc" ] || { echo "FAIL: v1-evidence.json changed"; exit 1; }
git diff --quiet "${BASE}..HEAD" -- src/data/equipmentGuide/products.ts src/data/equipmentGuide/index.ts src/data/equipmentGuide/__fixtures__/v1-specs-subtable.json src/data/equipmentGuide/__fixtures__/v1-evidence.json \
  || { echo "FAIL: frozen data files changed"; exit 1; }
# untracked protection (content-hash manifest, tmp/equipment-guide-images excluded)
git ls-files --others --exclude-standard -z | sort -z \
  | while IFS= read -r -d '' f; do
      case "$f" in tmp/equipment-guide-images/*) continue;; esac
      printf '%s\0%s\0%s\0' "$(git hash-object "$f")" "$(stat -f '%p' "$f")" "$f"
    done > "$S/untracked-now"
cmp -s "$S/untracked-manifest" "$S/untracked-now" || { echo "FAIL: protected untracked changed"; exit 1; }
git ls-files --others --exclude-standard -z | sort -z > "$S/untracked-paths-now"
cmp -s "$S/untracked-paths" "$S/untracked-paths-now" || { echo "FAIL: untracked path set changed"; exit 1; }
# two-way allowlist (16 files incl. the deletion; spec/plan docs live in BASE)
git diff --name-only "${BASE}..HEAD" | sort -u > "$S/changed"
printf '%s\n' \
  public/NineScrolls-Equipment-Guide.pdf \
  scripts/generate-equipment-guide.ts \
  src/data/equipmentGuide/__fixtures__/v1-evidence-chunk.html \
  src/data/equipmentGuide/equipmentGuide.data.test.ts \
  src/data/equipmentGuide/guideMeta.ts \
  src/data/equipmentGuide/types.ts \
  src/templates/equipmentGuide/equipmentGuide.css.ts \
  src/templates/equipmentGuide/fonts/Inter-Medium.woff2 \
  src/templates/equipmentGuide/fonts/Inter-Regular.woff2 \
  src/templates/equipmentGuide/fonts/Inter-SemiBold.woff2 \
  src/templates/equipmentGuide/fonts/OFL-Inter.txt \
  src/templates/equipmentGuide/fonts/OFL-SpaceGrotesk.txt \
  src/templates/equipmentGuide/fonts/PROVENANCE.md \
  src/templates/equipmentGuide/fonts/SpaceGrotesk-Bold.woff2 \
  src/templates/equipmentGuide/fonts/SpaceGrotesk-SemiBold.woff2 \
  src/templates/equipmentGuide/fontsCss.ts \
  src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts \
  src/templates/equipmentGuide/renderEquipmentGuideHtml.ts | sort -u > "$S/allow"
diff "$S/allow" "$S/changed" || { echo "FAIL: change set != allowlist"; exit 1; }
echo "hygiene OK — ready for PR"
```

- [ ] **Step 5: Push + PR** (one complete PR; body summarizes D1–D5, the pilot sign-off, and verification evidence). Do NOT merge without user direction.

---

## Self-Review

**1. Spec coverage:** D1–D5 ✓ (15p, typographic cover, fonts, direct replace, token port). §3 PAGE_ORDER single source + shape/sequence/TOC/data-category tests (Task 5) ✓; §4 cover literals + banned scan as data tests (Task 3) with approved tagline ✓; §5 vendored fonts + SHA-256 provenance tests + fail-closed pdffonts with normalization (Tasks 2, 8) + download permission gate ✓; §6 tokens: category colors incl. "Etch & Ion Beam" label, type scale, image wells 215×200 (170 plasma-cleaner), pillar cards, CTA band literal, print robustness, 12.5px exception allowlist test (Task 7) ✓; §7 evidence strong parity per-block with optional-DOI branches + fixture retirement in-step (Task 6), evidence-fixture SHA pinned & directly compared (Tasks 1, 9), 14→15 sweep enumerated at the real line numbers (Task 5) ✓; §8 hard asserts (Task 9) ✓; §9 pilot = full 15-page worktree build with all-page regression check + STOP (Task 4) ✓; §10 allowlist == Task 9 list (16 paths incl. deletion) ✓.

**2. Placeholder scan:** all copy literals pinned; pdffonts parsing marked tunable-against-real-output with a fixed contract (intentional — column layout varies by poppler version); pilot Step 2 references Tasks 5–8 code as its source (repeat-reading is acceptable for a rehearsal task). No TBDs.

**3. Type/name consistency:** `GuideCover` (types) ↔ `cover` (guideMeta) ↔ Task 5 cover builder; `PAGE_ORDER`/`CATEGORY_META`/`PageEntry` exported from the renderer and imported by tests; `data-page`/`data-category`/`data-study-index`/`.toc-name`/`.toc-page`/`.pillar-card`/`.cta-band`/`.doi` used consistently across Tasks 5–7 tests and implementations; `equipmentGuideFontsCss()` wired in Task 2 and reused in Task 5's assembly snippet.
