# Equipment Guide Visual Polish v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the generated Equipment Guide PDF real brand identity — the NineScrolls logo on all 14 pages, a unified brand header, refined tables, and uniform product-image wells — with no content/data/structure changes and the page count held at 14.

**Architecture:** All changes live in the pure renderer (`renderEquipmentGuideHtml.ts`), its CSS string (`equipmentGuide.css.ts`), and its unit test; plus one new committed asset (`logo-with-text.svg`) and the regenerated committed PDF. The generator script and canonical data are untouched. The renderer stays a pure `data → HTML string` function (unit-tested without a browser); the PDF is produced by the existing Puppeteer generator.

**Tech Stack:** TypeScript, Vitest, Node `fs`/`Buffer` (SVG base64), the existing `scripts/generate-equipment-guide.ts` (Puppeteer) + local `pypdf` for verification.

**Spec:** `docs/superpowers/specs/2026-07-10-equipment-guide-visual-polish-v1-design.md`

## PDF regeneration & artifact policy

`public/NineScrolls-Equipment-Guide.pdf` is a committed generated artifact that multiple product pages link to. **Task 1 ends by regenerating the PDF and committing it in the SAME commit as the renderer/CSS changes** — so no commit ever lands renderer changes with a stale PDF. Task 2 (visual iteration) likewise regenerates + commits the PDF together with any CSS tweak. The branch is not merged until the committed PDF matches the final renderer.

## File Structure

| File | Change |
|---|---|
| `public/assets/images/logo-with-text.svg` | **New** committed asset (copied from the company logo dir) |
| `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` | `logoDataUri()` (exported, memoized); `brandbar(variant)`; About/Evidence gain headers; `.section-accent`, `.image-well`, `.spec-table` wrapper, `.page-foot`, `page--product` markup |
| `src/templates/equipmentGuide/equipmentGuide.css.ts` | `.brand-logo`, dark brandbar, `.section-accent`, `.image-well`, `.spec-table`, refined `th`/`td`/zebra, `.page--product`, `.page-foot` |
| `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts` | Structural logo + image-well assertions |
| `public/NineScrolls-Equipment-Guide.pdf` | **Regenerated** (committed with the code) |

`scripts/generate-equipment-guide.ts` is **NOT** modified.

---

### Task 1: Branding + visual polish (renderer, CSS, tests, regenerated PDF)

**Files:**
- Create: `public/assets/images/logo-with-text.svg`
- Modify: `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts`
- Modify: `src/templates/equipmentGuide/equipmentGuide.css.ts`
- Test: `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts`
- Regenerate: `public/NineScrolls-Equipment-Guide.pdf`

**Before Step 1 — record the implementation baseline (do NOT hardcode a SHA, do NOT use a shared `/tmp` file):**
```bash
git rev-parse HEAD                          # the immutable IMPLEMENTATION_BASE_SHA
git status --porcelain -- package-lock.json # initial package-lock state (empty = clean)
```
Do this **now, before any file change**, and record both values:
- **`IMPLEMENTATION_BASE_SHA`** (the 40-char HEAD SHA). Do NOT hardcode a SHA in this plan (the spec/plan doc commits shift it) and do NOT persist it to a global path like `/tmp/…` (another worktree/session could overwrite it). Instead, **Task 1 MUST print `IMPLEMENTATION_BASE_SHA=<sha>` verbatim in its completion report**, and Task 2's final audit consumes that exact reported value directly.
- **Initial `package-lock.json` state** — whether it was already dirty before you started. After `npm run build` (which may run `npm install`), this lets you tell whether a package-lock change is pre-existing or build-induced. Build-induced churn is left **unstaged and un-reverted** (never auto-`checkout`); it is simply not part of the five committed files.

- [ ] **Step 1: Copy the logo asset into the repo**

Run:
```bash
cp "$HOME/MyDocuments/Company_Registration/NineScrolls LLC/logo/logo_dragon_with_text.svg" \
   public/assets/images/logo-with-text.svg
```
Verify it is single-fill navy and vector:
```bash
grep -oiE 'fill="#[0-9a-f]+"' public/assets/images/logo-with-text.svg | sort -u
```
Expected: only `fill="#243959"`.

- [ ] **Step 2: Write the failing structural tests**

Replace `src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts` with:
```ts
import { describe, it, expect } from 'vitest';
import { renderEquipmentGuideHtml, logoDataUri, defaultImageDataUri } from './renderEquipmentGuideHtml';
import { equipmentGuideData } from '../../data/equipmentGuide';

const html = renderEquipmentGuideHtml(equipmentGuideData);

// Mirror the renderer's HTML-escaping EXACTLY (including "), so series/alt
// strings (e.g. "Coater/Developer & Hotplate Series") are matched as they
// actually render — the renderer's esc() escapes &, <, >, and ".
const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const navyLogo = logoDataUri('navy');
const whiteLogo = logoDataUri('white');
const count = (hay: string, needle: string): number => hay.split(needle).length - 1;

describe('renderEquipmentGuideHtml', () => {
  it('produces a self-contained HTML document', () => {
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<style>');
    expect(html).not.toMatch(/<link[^>]+href/i);
  });

  it('leaks no OEM/supplier name', () => {
    expect(html).not.toMatch(/tyloong|zhongke|tailong|中科泰隆|chuangshi|创世威纳|peiyuan|沛沅|advanstech|埃德万斯/i);
  });

  it('makes no mis-attributed scale claims and no flagship Nature', () => {
    expect(html).not.toMatch(/trusted manufacturer partner|1000\+|300\+|30\+ years|global installations|research institutions served/i);
    expect(html).not.toContain('class="j">Nature ·');
  });

  it('renders the represented-platform evidence page', () => {
    expect(html).toContain('Peer-Reviewed Validation for the Platforms We Represent');
    expect(html).toContain('Near-ideal van der Waals rectifiers');
    expect(html).toContain('not claims of NineScrolls-branded installed-base citations');
  });

  it('renders all 11 series with their images embedded as base64 data URIs', () => {
    for (const p of equipmentGuideData.products) {
      expect(html, p.id).toContain(esc(p.series));
    }
    const dataUris = html.match(/data:image\/webp;base64,/g) ?? [];
    expect(dataUris.length).toBeGreaterThanOrEqual(11);
  });
});

describe('branding — logo on all 14 pages', () => {
  it('embeds the navy logo on 13 pages and the white logo on the evidence page', () => {
    expect(count(html, navyLogo)).toBe(13);
    expect(count(html, whiteLogo)).toBe(1);
  });

  it('brands every page section exactly once with the correct variant', () => {
    // Split on the class-attr PREFIX (no closing quote) so product sections
    // (class="page page--product") match alongside class="page".
    const chunks = html.split('<section class="page').slice(1);
    expect(chunks).toHaveLength(14);
    for (const chunk of chunks) {
      expect(count(chunk, 'src="data:image/svg+xml;base64,')).toBe(1);
    }
    const about = chunks.find(c => c.includes('About NineScrolls LLC'))!;
    expect(count(about, navyLogo)).toBe(1);
    const evidence = chunks.find(c => c.includes('Peer-Reviewed Validation'))!;
    expect(count(evidence, whiteLogo)).toBe(1);
    const contact = chunks.find(c => c.includes('Office Location'))!;
    expect(count(contact, navyLogo)).toBe(1);
    for (const p of equipmentGuideData.products) {
      const chunk = chunks.find(c => c.includes(esc(p.series)))!;
      expect(chunk, p.id).toBeDefined();
      expect(count(chunk, navyLogo), p.id).toBe(1);
    }
  });

  it('recolors the white variant (no navy fill remains)', () => {
    const svg = Buffer.from(whiteLogo.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
    expect(svg).toContain('#ffffff');
    expect(svg).not.toContain('#243959');
  });

  it('removed the plain-text NINESCROLLS header wordmark', () => {
    expect(html).not.toContain('<strong>NINESCROLLS</strong>');
  });
});

describe('visual polish', () => {
  it('wraps each product image in exactly one well with THAT product image inside', () => {
    const chunks = html.split('<section class="page').slice(1);
    for (const p of equipmentGuideData.products) {
      const chunk = chunks.find(c => c.includes(esc(p.series)))!;
      expect(chunk, p.id).toBeDefined();
      // Exactly one image well in this product's section.
      expect(count(chunk, 'class="image-well"'), p.id).toBe(1);
      // Capture the well's INNER markup and assert THIS product's image is the
      // one inside it — bound by both the exact rendered src (data URI) and alt.
      const well = chunk.match(/<div class="image-well">([\s\S]*?)<\/div>/);
      expect(well, p.id).not.toBeNull();
      const inner = well![1];
      expect(inner, p.id).toContain(`src="${defaultImageDataUri(p.image)}"`);
      expect(inner, p.id).toContain(`alt="${esc(p.imageAlt)}"`);
    }
    // Non-product pages must NOT have an image well.
    const about = chunks.find(c => c.includes('About NineScrolls LLC'))!;
    expect(count(about, 'class="image-well"')).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts --exclude '**/.claude/**'`
Expected: FAIL — the suite errors at **module load** because `logoDataUri` is not exported yet, so the test's `import { logoDataUri }` can't resolve and **no assertions execute**. This module-load error IS the RED phase. (The renderer is replaced wholesale in Step 4, which adds the exported `logoDataUri` plus the full markup, so this is a single RED → GREEN transition; the individual branding/image-well assertions only become exercisable once the import resolves in Step 6.)

- [ ] **Step 4: Update the renderer**

Replace `src/templates/equipmentGuide/renderEquipmentGuideHtml.ts` with:
```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EquipmentGuideData, GuideProduct, SpecRow } from '../../data/equipmentGuide/types';
import { equipmentGuideCss } from './equipmentGuide.css';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Default image resolver: reads the full-resolution webp from public/ and
 * inlines it as a base64 data URI. Kept pure so the renderer's unit tests
 * exercise the real embedding path. The generator injects an optimized
 * (downscaled JPEG) resolver at PDF-build time.
 */
export function defaultImageDataUri(publicRelPath: string): string {
  const abs = resolve(process.cwd(), 'public', publicRelPath.replace(/^\//, ''));
  const b64 = readFileSync(abs).toString('base64');
  return `data:image/webp;base64,${b64}`;
}

// Logo: read the source SVG at most once, memoize each variant's data URI.
const LOGO_PATH = resolve(process.cwd(), 'public', 'assets/images/logo-with-text.svg');
let logoSvgSource: string | null = null;
const logoCache = new Map<'navy' | 'white', string>();

export function logoDataUri(variant: 'navy' | 'white'): string {
  const cached = logoCache.get(variant);
  if (cached) return cached;
  if (logoSvgSource === null) logoSvgSource = readFileSync(LOGO_PATH, 'utf8');
  const svg = variant === 'white' ? logoSvgSource.replace(/#243959/gi, '#ffffff') : logoSvgSource;
  const uri = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
  logoCache.set(variant, uri);
  return uri;
}

function brandbar(variant: 'navy' | 'white' = 'navy'): string {
  const cls = variant === 'white' ? 'brandbar brandbar--dark' : 'brandbar';
  return `<div class="${cls}"><img class="brand-logo" src="${logoDataUri(variant)}" alt="NineScrolls LLC"/><span class="site">https://ninescrolls.com&nbsp;&nbsp;&nbsp;info@ninescrolls.com</span></div>`;
}

function specTable(inner: string): string {
  return `<div class="spec-table"><table>${inner}</table></div>`;
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

function productPage(p: GuideProduct, imageDataUri: (publicRelPath: string) => string): string {
  const twoCol = !!p.specHeaders;
  const bullets = p.bullets.map(b =>
    `<div class="bullet"><span class="h">${esc(b.heading)}</span> <span class="b">${esc(b.body)}</span></div>`).join('');
  const headRow = twoCol
    ? `<tr><th>Specification</th><th>${esc(p.specHeaders![0])}</th><th>${esc(p.specHeaders![1])}</th></tr>`
    : `<tr><th>Specification</th><th>Parameters</th></tr>`;
  const family = p.familyOptions
    ? `<p class="family"><strong>Family options:</strong> ${p.familyOptions.map(esc).join(' · ')}</p>` : '';
  const sub = p.subTable
    ? specTable(`<tr><th colspan="2">${esc(p.subTable.title)}</th></tr>${specRowsHtml(p.subTable.specs, false)}`) : '';
  return `
  <section class="page page--product">
    ${brandbar('navy')}
    <p class="eyebrow">Equipment Platform</p>
    <div class="section-accent"></div>
    <h1 class="series-title">${esc(p.series)}</h1>
    <div class="product-head">
      <div class="product-copy">${bullets}</div>
      <div class="image-well"><img src="${imageDataUri(p.image)}" alt="${esc(p.imageAlt)}"/></div>
    </div>
    ${specTable(`${headRow}${specRowsHtml(p.specs, twoCol)}`)}
    ${sub}${family}
    <div class="page-foot"></div>
  </section>`;
}

function aboutPage(d: EquipmentGuideData): string {
  const pillars = d.about.pillars.map(p =>
    `<div class="pillar"><span class="h">${esc(p.heading)}</span><div>${esc(p.body)}</div></div>`).join('');
  const paras = d.about.paragraphs.map(t => `<p>${esc(t)}</p>`).join('');
  return `<section class="page">${brandbar('navy')}<h1>${esc(d.about.title)}</h1><div class="section-accent"></div><p class="eyebrow">${esc(d.about.subtitle)}</p>${paras}${pillars}</section>`;
}

function evidencePage(d: EquipmentGuideData): string {
  const studies = d.evidence.studies.map(s => {
    const cite = s.citations !== undefined ? ` · ${s.citations} citations (as of ${esc(s.citationsAsOf ?? '')})` : '';
    return `<div class="study"><span class="j">${esc(s.journal)} · ${s.year}</span>
      <div class="t">${esc(s.title)}</div>
      <div class="m">Corresponding ${esc(s.platform)} process platform${cite}</div></div>`;
  }).join('');
  return `<section class="page"><div class="evidence">${brandbar('white')}
    <h1>${esc(d.evidence.title)}</h1><div class="section-accent"></div>
    <div class="sub">${esc(d.evidence.subtitle)}</div>
    <p>${esc(d.evidence.intro)}</p>
    ${studies}
    <p class="disclaimer">${esc(d.evidence.disclaimer)}</p>
  </div></section>`;
}

function contactPage(d: EquipmentGuideData): string {
  const line = (label: string, val: string) => `<p><strong>${esc(label)}:</strong> ${esc(val)}</p>`;
  return `<section class="page">${brandbar('navy')}
    <h2>Office Location</h2><p>${d.contact.office.map(esc).join('<br/>')}</p>
    <h2>Business Hours</h2><p>${d.contact.hours.map(esc).join('<br/>')}</p>
    <h2>Contact Information</h2>${d.contact.contacts.map(c => line(c.label, c.value)).join('')}
    <h2>Technical Support</h2>${d.contact.support.map(c => line(c.label, c.value)).join('')}
  </section>`;
}

export function renderEquipmentGuideHtml(
  d: EquipmentGuideData,
  imageDataUri: (publicRelPath: string) => string = defaultImageDataUri,
): string {
  const products = [...d.products]
    .sort((a, b) => a.order - b.order)
    .map(p => productPage(p, imageDataUri))
    .join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>NineScrolls LLC — Equipment Guide</title>
<style>${equipmentGuideCss}</style></head><body>
${aboutPage(d)}${evidencePage(d)}${products}${contactPage(d)}
</body></html>`;
}
```

- [ ] **Step 5: Update the CSS**

Replace `src/templates/equipmentGuide/equipmentGuide.css.ts` with:
```ts
export const equipmentGuideCss = `
  @page { size: Letter; margin: 0.6in 0.6in 0.7in 0.6in; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  h1, h2, h3 { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; margin: 0 0 8px; }
  .page { break-after: page; padding-top: 4px; }
  .page:last-child { break-after: auto; }
  .page--product { display: flex; flex-direction: column; min-height: 9.1in; }
  .page-foot { margin-top: auto; border-top: 1px solid #eef2f7; }
  .brandbar { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #1e3a5f; padding-bottom: 8px; margin-bottom: 20px; }
  .brandbar .site { color: #64748b; font-size: 12px; }
  .brandbar--dark { border-bottom: 1px solid rgba(255,255,255,0.14); }
  .brandbar--dark .site { color: #cbd5e1; }
  .brand-logo { height: 30px; width: auto; }
  .section-accent { width: 40px; height: 3px; background: #0284c7; border-radius: 2px; margin: 8px 0 14px; }
  .eyebrow { color: #0284c7; font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
  .series-title { color: #1e3a5f; font-size: 28px; margin: 6px 0 14px; }
  .product-head { display: flex; gap: 20px; align-items: flex-start; }
  .product-copy { flex: 1 1 55%; }
  .image-well { flex: 0 0 42%; height: 200px; padding: 14px; border: 1px solid #eef2f7; border-radius: 10px; box-shadow: 0 6px 24px rgba(15,23,42,0.06); background: linear-gradient(180deg, #ffffff 0%, #f4f6f9 100%); display: flex; align-items: center; justify-content: center; }
  .image-well img { object-fit: contain; max-width: 100%; max-height: 100%; }
  .bullet { break-inside: avoid; margin-bottom: 8px; }
  .bullet .h { color: #0369a1; font-weight: 700; font-size: 13px; }
  .bullet .b { color: #334155; font-size: 12.5px; }
  .spec-table { margin-top: 16px; border: 1px solid #e8edf3; border-radius: 8px; overflow: hidden; }
  table { width: 100%; border-collapse: collapse; break-inside: auto; }
  th { background: #1e3a5f; color: #fff; text-align: left; font-size: 12.5px; padding: 11px 14px; letter-spacing: 0.04em; text-transform: uppercase; }
  td { border-bottom: 1px solid #eef2f7; font-size: 12.5px; padding: 10px 14px; vertical-align: top; }
  td.label { width: 34%; color: #0f172a; font-weight: 600; background: #f5f8fc; }
  tr:nth-child(even) td:not(.label) { background: #fafbfc; }
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

- [ ] **Step 6: Run to verify tests pass**

Run: `npx vitest run src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts --exclude '**/.claude/**'`
Expected: PASS (all invariants + branding + image-well: navy ×13, white ×1, 14 sections each with one logo, white recolor, wordmark gone, ≥11 image wells).

- [ ] **Step 7: Regenerate the PDF**

Run: `npm run generate-equipment-guide`
Expected: `Wrote …/public/NineScrolls-Equipment-Guide.pdf (NNN KB)` — under the generator's `MAX_PDF_BYTES = 2_000_000` (it hard-fails otherwise).

- [ ] **Step 8: Confirm page count is still 14**

Run:
```bash
python3 -c "from pypdf import PdfReader; print('pages:', len(PdfReader('public/NineScrolls-Equipment-Guide.pdf').pages))"
```
Expected: `pages: 14`.

**If it is > 14, diagnose the actual cause before changing anything — do NOT assume `min-height` is to blame.** An extra page can come from `min-height` too tall, `.image-well { height }`, table cell padding, a margin, or a genuinely tall product's intrinsic content.
1. Render to images and find the overflowing page: `pdftoppm -jpeg -r 80 public/NineScrolls-Equipment-Guide.pdf /tmp/eqg-page` then read the `/tmp/eqg-page-*.jpg` files to see which page spilled to a second sheet and which section caused it.
2. Identify the causal CSS on that specific section — e.g. a near-empty overflow sheet after a product page ⇒ `.page--product { min-height }` too tall (lower it, e.g. 8.8in); a dense product whose *table* spilled ⇒ trim `td`/`th` padding or `.image-well { height }` for that content; an image pushing height ⇒ `.image-well { height }`.
3. Change only the causal value in `equipmentGuide.css.ts`, re-run Steps 6–8 (focused test → regen → page count), and repeat until exactly 14. Record what changed and why in the Step 9 commit body.

- [ ] **Step 9: Full pre-commit verification, then commit code + regenerated PDF together**

Complete the entire gate below before committing — and re-run it after **every** pagination adjustment from Step 8, so the committed state (not just an intermediate one) is fully verified:
1. `npx vitest run src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts --exclude '**/.claude/**'` — focused render test green.
2. `npx vitest run --exclude '**/.claude/**'` — full suite green (no regressions elsewhere).
3. `npm run build` — typecheck + bundle succeed.
4. Page count is 14 (Step 8) and the generator reported a size under `MAX_PDF_BYTES` (Step 7).
5. Read `public/NineScrolls-Equipment-Guide.pdf` — visual sanity: a logo on every page (white on the Evidence card), image wells present, no plain-text `NINESCROLLS` wordmark.
6. `git status --short` — only the five feature files (plus the pre-existing untracked `tmp/` + research-validation docs) appear. If `npm run build` left `package-lock.json` modified in the working tree with **no real dependency change** (none is expected — nothing in `package.json` changed), leave it in the working tree but do NOT stage it.

Only once all six pass, commit exactly the five files (the explicit `git add` excludes everything else):
```bash
git add public/assets/images/logo-with-text.svg \
        src/templates/equipmentGuide/renderEquipmentGuideHtml.ts \
        src/templates/equipmentGuide/equipmentGuide.css.ts \
        src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts \
        public/NineScrolls-Equipment-Guide.pdf
git commit -m "$(cat <<'EOF'
feat(guide): brand the Equipment Guide — logo on all 14 pages + visual polish

Adds the NineScrolls logo lockup on every page (navy on white pages, white
recolor on the dark evidence card), unified brand headers on the previously
bare About + Evidence pages, refined spec tables (rounded card, softer
borders, zebra, taller header), uniform framed product image wells, and a
bottom-pinned page-foot hairline on product pages. No content/data/structure
changes; page count stays 14. Regenerated PDF committed with the code.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
EOF
)"
```
> Stage `package-lock.json`? No. Only the five files above. Do not stage `tmp/` or unrelated untracked docs.

---

### Task 2: Visual verification + iteration

**Files:** possibly `src/templates/equipmentGuide/equipmentGuide.css.ts` (value tweaks only) + regenerated `public/NineScrolls-Equipment-Guide.pdf`.

- [ ] **Step 1: Read the regenerated PDF and check against the design**

Read `public/NineScrolls-Equipment-Guide.pdf` (all 14 pages). Confirm:
- Page 1 (About): navy logo top-left, section accent under the title.
- Page 2 (Evidence, dark card): **white** logo top-left inside the card, URL/email legible (`#cbd5e1`), accent visible.
- Pages 3–13 (products): navy logo top-left, uniform framed image well (not a raw pasted image), elevated spec table (rounded, zebra), a hairline near the page bottom.
- Page 14 (Contact): navy logo top-left.
- No plain-text `NINESCROLLS` wordmark anywhere; URL/email right-aligned on every page.

- [ ] **Step 2: Confirm no regressions**

Run: `npx vitest run --exclude '**/.claude/**'`
Expected: full suite passes.

- [ ] **Step 3: If a visual value needs tuning, iterate — with full re-verification after EVERY tweak**

Only if Step 1 surfaced a visual issue (e.g. image well too tall, table too tight, evidence contrast): adjust the specific value in `equipmentGuide.css.ts`, then run the **complete re-verification loop after every change** (not just regeneration):
1. `npx vitest run src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts --exclude '**/.claude/**'` — focused render test green.
2. `npx vitest run --exclude '**/.claude/**'` — full suite green.
3. `npm run build` — typecheck + bundle succeed on the tweaked CSS.
4. `npm run generate-equipment-guide` — regenerate (auto-fails if the PDF exceeds `MAX_PDF_BYTES = 2_000_000`).
5. `python3 -c "from pypdf import PdfReader; print(len(PdfReader('public/NineScrolls-Equipment-Guide.pdf').pages))"` — must print `14`.
6. Re-read the affected PDF page(s) to confirm the fix landed and introduced no new regression.
7. `git status --short` — confirm only `equipmentGuide.css.ts` + `NineScrolls-Equipment-Guide.pdf` changed for this tweak; if `npm run build` left `package-lock.json` modified with no real dependency change, leave it in the working tree but do NOT stage it (the explicit `git add` below excludes it).

Repeat with the user until the look is approved. Each iteration commits ONLY the CSS tweak + regenerated PDF together:
```bash
git add src/templates/equipmentGuide/equipmentGuide.css.ts public/NineScrolls-Equipment-Guide.pdf
git commit -m "polish(guide): tune <what> after visual review"
```
If no tweak is needed, no commit here — proceed straight to Step 4, which runs the same complete verification against the committed state either way.

- [ ] **Step 4: Final verification (runs on BOTH paths) + hard-failing file audit**

Run the COMPLETE verification against the current committed state **whether or not Task 2 made a tweak** — if the first render needed no adjustment, this is the full final gate on Task 1's committed state; if tweaks happened, it re-confirms the last committed one. All checks here are **non-mutating** — do NOT regenerate the PDF (Puppeteer stamps a creation timestamp, so a re-render would create a spurious PDF diff); verify the already-committed PDF.

1. `npx vitest run src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts --exclude '**/.claude/**'` — focused render test green.
2. `npx vitest run --exclude '**/.claude/**'` — full suite green.
3. `npm run build` — typecheck + bundle succeed.
4. Committed-PDF checks (no regen): `python3 -c "import os; from pypdf import PdfReader; print('pages', len(PdfReader('public/NineScrolls-Equipment-Guide.pdf').pages), 'bytes', os.path.getsize('public/NineScrolls-Equipment-Guide.pdf'))"` → must print `pages 14` and `bytes` < 2000000.
5. Read `public/NineScrolls-Equipment-Guide.pdf` — final visual confirmation.
6. **Exact five-file audit against Task 1's reported `IMPLEMENTATION_BASE_SHA`** (the value Task 1 printed; not a hardcoded SHA, not a `/tmp` file). This block **exits non-zero on any mismatch**, so it actually blocks a bad state:
   ```bash
   BASE=<the IMPLEMENTATION_BASE_SHA reported by Task 1>
   git rev-parse --verify --quiet "${BASE}^{commit}" >/dev/null || { echo "FAIL: baseline ${BASE} is not a valid commit"; exit 1; }
   ACTUAL="$(git diff --name-only "${BASE}..HEAD" | sort)"
   EXPECTED="$(printf '%s\n' \
     public/NineScrolls-Equipment-Guide.pdf \
     public/assets/images/logo-with-text.svg \
     src/templates/equipmentGuide/equipmentGuide.css.ts \
     src/templates/equipmentGuide/renderEquipmentGuideHtml.test.ts \
     src/templates/equipmentGuide/renderEquipmentGuideHtml.ts | sort)"
   if [ "${ACTUAL}" = "${EXPECTED}" ]; then
     echo "EXACT 5-FILE MATCH"
   else
     echo "FAIL: committed file set is not exactly the five allowed files:"
     diff <(printf '%s\n' "${EXPECTED}") <(printf '%s\n' "${ACTUAL}")
     exit 1
   fi
   ```
   `git status --short` alone is insufficient (it hides already-committed files). If this fails on an extra `package-lock.json`, inspect whether it reflects a real dependency change (none is expected; `package.json` is untouched); if it is spurious `npm install` churn, drop it from this branch's history (amend/rebase the offending commit). Do **NOT** blindly `git checkout -- package-lock.json` — that could clobber unrelated working-tree edits.
7. **Preserve pre-existing untracked files** — leave `tmp/` and the untracked `docs/superpowers/**/2026-07-09-research-validation-claim-reframe*` files exactly as they are; do not add, remove, or revert them.

The committed PDF already matches the renderer (committed atomically with the code in Task 1 / the last Step-3 iteration), so post-audit `git status` shows a clean tree apart from any pre-existing untracked files.

---

## Self-Review

**1. Spec coverage:**
- A. Logo on all 14 pages (exported memoized `logoDataUri`, navy/white, wordmark removed) → Task 1 Steps 1,4,5 + tests. ✓
- B. Unified brand header incl. About + Evidence, `#cbd5e1` dark URL/email, `.section-accent` (40×3, #0284c7) → Task 1 renderer (`brandbar`, about/evidence wiring) + CSS. ✓
- C. Refined tables (`.spec-table` wrapper, `td` 10×14 / `th` 11×14, softer `#eef2f7` borders, zebra `:not(.label)`, uppercase header) → Task 1 CSS + `specTable()`. ✓
- D. `.image-well` (200px, 14px, gradient, border, shadow, contain) → Task 1 renderer + CSS. ✓
- E. `.page-foot` text-free, `margin-top:auto` on flex-column `.page--product` (min-height 9.1in), no script change → Task 1 renderer + CSS + Step 8 page-count guard. ✓
- Testing: navy ×13 / white ×1, per-section single logo via `split('<section class="page').slice(1)`, product match via `esc(p.series)`, white recolor, wordmark gone, image-well ≥11 → Task 1 Step 2. ✓
- Files list + PDF-artifact contract (regen+commit together) → File Structure + PDF policy + Task 1 Step 9. ✓
- Size guard = generator's `MAX_PDF_BYTES` → Task 1 Step 7. ✓

**2. Placeholder scan:** No TBD/TODO; every step shows the full file content or exact command. Task 2 Step 3 is a conditional iteration (only if a visual issue is found) with the exact commit command — not a placeholder.

**3. Type/name consistency:** `logoDataUri` (exported) used in renderer + test; `brandbar(variant)`, `specTable()`, `.image-well`, `.section-accent`, `.page-foot`, `.page--product`, `.spec-table`, `.brandbar--dark` are consistent between the renderer markup and the CSS. The test's split delimiter `'<section class="page'` matches both `class="page"` and `class="page page--product"`. `count()` helper and `esc()` mirror match the render output.
