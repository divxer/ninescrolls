import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { renderEquipmentGuideHtml, logoDataUri, defaultImageDataUri, PAGE_ORDER, CATEGORY_META } from './renderEquipmentGuideHtml';
import { equipmentGuideData } from '../../data/equipmentGuide';
import { PRODUCT_ROUTES } from '../../data/equipmentGuide/products';
import { cover } from '../../data/equipmentGuide/guideMeta';

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

describe('branding — logo on all 15 pages (evidence is now a light page)', () => {
  it('embeds the navy logo on every page and no white logo (evidence went light, cover added)', () => {
    expect(count(html, navyLogo)).toBe(16); // 15 brandbars + 1 contact footer-bar logo
    expect(count(html, whiteLogo)).toBe(0);
  });

  it('brands every page section with the navy logo', () => {
    // Split on the class-attr PREFIX (no closing quote) so product sections
    // (class="page page--product") match alongside class="page".
    const chunks = html.split('<section class="page').slice(1);
    expect(chunks).toHaveLength(15);
    for (const chunk of chunks) {
      expect(count(chunk, 'src="data:image/svg+xml;base64,')).toBeGreaterThanOrEqual(1);
    }
    const about = chunks.find(c => c.includes('data-page="about"'))!;
    expect(count(about, navyLogo)).toBe(1);
    const evidence = chunks.find(c => c.includes('data-page="evidence"'))!;
    expect(count(evidence, navyLogo)).toBe(1);
    const contact = chunks.find(c => c.includes('data-page="contact"'))!;
    expect(count(contact, navyLogo)).toBe(2); // brandbar + footer bar
    for (const p of equipmentGuideData.products) {
      const chunk = chunks.find(c => c.includes(`data-product-id="${p.id}"`))!;
      expect(chunk, p.id).toBeDefined();
      expect(count(chunk, navyLogo), p.id).toBe(1);
    }
  });

  it('recolors the white variant (util still available, no navy fill remains)', () => {
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
      const chunk = chunks.find(c => c.includes(`data-product-id="${p.id}"`))!;
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

describe('content-v2 render', () => {
  const chunks = html.split('<section class="page').slice(1);
  it('stamps data-product-id on every product section', () => {
    for (const p of equipmentGuideData.products) {
      expect(chunks.some(c => c.includes(`data-product-id="${p.id}"`)), p.id).toBe(true);
    }
  });
  const CTA_ANCHOR = /<a class="btn" href="([^"]+)">([\s\S]*?)<\/a>/g;
  const CTA_TEXT = 'Explore configurations &amp; request a quote <span class="arr">→</span>';

  it('CTA path (synthetic, reds first): a product WITH content renders exactly one correct anchor', () => {
    const first = equipmentGuideData.products[0];
    const withContent = {
      ...equipmentGuideData,
      products: equipmentGuideData.products.map((p, i) => i === 0
        ? { ...p, content: { lead: 'L', applications: ['A', 'B', 'C'], applicationCount: 3 as const, href: PRODUCT_ROUTES[p.id] } }
        : p),
    };
    const chunk = renderEquipmentGuideHtml(withContent).split('<section class="page').find(c => c.includes(`data-product-id="${first.id}"`))!;
    const anchors = [...chunk.matchAll(CTA_ANCHOR)];
    expect(anchors).toHaveLength(1);
    expect(anchors[0][1]).toBe(`https://ninescrolls.com${PRODUCT_ROUTES[first.id]}`); // canonical route, not any /products/…
    expect(anchors[0][2]).toBe(CTA_TEXT);                                            // exact text, not toContain
  });

  it('renders exactly one CTA per product (content required), canonical route + exact text', () => {
    for (const p of equipmentGuideData.products) {
      const chunk = chunks.find(c => c.includes(`data-product-id="${p.id}"`))!;
      const anchors = [...chunk.matchAll(CTA_ANCHOR)];
      expect(anchors.length, p.id).toBe(1);
      expect(anchors[0][1], p.id).toBe(`https://ninescrolls.com${PRODUCT_ROUTES[p.id]}`);
      expect(anchors[0][2], p.id).toBe(CTA_TEXT);
    }
  });
  it('prints a visible short URL beside every CTA (print readers cannot follow the button link)', () => {
    for (const p of equipmentGuideData.products) {
      const chunk = chunks.find(c => c.includes(`data-product-id="${p.id}"`))!;
      const urls = [...chunk.matchAll(/<span class="cta-url">([^<]+)<\/span>/g)];
      expect(urls.length, p.id).toBe(1);
      expect(urls[0][1], p.id).toBe(`ninescrolls.com${PRODUCT_ROUTES[p.id]}`); // no scheme — compact print form
    }
  });
});

// ── Task 6: evidence strong parity (element-scoped, markup-free content lock) ──
const studyBlocks = (sectionHtml: string) =>
  [...sectionHtml.matchAll(/<article data-study-index="(\d+)"[^>]*>([\s\S]*?)<\/article>/g)];
const fieldOnce = (block: string, cls: string, value: string, label: string) => {
  const matches = [...block.matchAll(new RegExp(`<(?:span|div|a)[^>]*class="${cls}"[^>]*>([\\s\\S]*?)</(?:span|div|a)>`, 'g'))];
  expect(matches, `${label}: element count`).toHaveLength(1);
  expect(matches[0][1], label).toBe(value);
};

describe('visual-v2 evidence strong parity (element-scoped content lock)', () => {
  const section = html.split('<section class="page').slice(1).find(c => c.includes('data-page="evidence"'))!;
  const studies = equipmentGuideData.evidence.studies;
  const blocks = studyBlocks(section);
  const occurrences = (hay: string, needle: string) => hay.split(needle).length - 1;
  it('renders exactly one block per study, indices ascending', () => {
    expect(blocks).toHaveLength(studies.length);
    expect(blocks.map(b => Number(b[1]))).toEqual(studies.map((_, i) => i));
  });
  it('each block renders each field in its own element, exactly once, exact value', () => {
    for (const [i, s] of studies.entries()) {
      const b = blocks[i][2];
      fieldOnce(b, 'j', esc(s.journal), `journal ${i}`);
      fieldOnce(b, 'y', String(s.year), `year ${i}`);
      fieldOnce(b, 't', esc(s.title), `title ${i}`);
      fieldOnce(b, 'pf', esc(s.platform), `platform ${i}`);
      if (s.citations !== undefined) {
        fieldOnce(b, 'cite', `${s.citations} citations (as of ${esc(s.citationsAsOf!)})`, `cite ${i}`);
      } else {
        expect(occurrences(b, 'class="cite"'), `no cite element ${i}`).toBe(0);
      }
      const anchors = [...b.matchAll(/<a class="doi" href="([^"]+)"/g)];
      if (s.doi) {
        expect(anchors, `doi ${i}`).toHaveLength(1);
        expect(anchors[0][1]).toBe(`https://doi.org/${s.doi}`);
      } else {
        expect(anchors, `no doi ${i}`).toHaveLength(0);
      }
    }
  });
  it('title, subtitle, disclaimer each exactly once, verbatim', () => {
    for (const s of [equipmentGuideData.evidence.title, equipmentGuideData.evidence.subtitle, equipmentGuideData.evidence.disclaimer]) {
      expect(occurrences(section, esc(s)), s.slice(0, 30)).toBe(1);
    }
  });
  it('SYNTHETIC branches: no-DOI, no-citations, HTML-escaping, colliding values across studies', () => {
    const synthetic = {
      ...equipmentGuideData,
      evidence: {
        ...equipmentGuideData.evidence,
        studies: [
          { journal: 'J & Sons <Test>', year: 2026, title: 'A & B <C> "D"', platform: 'RIE', citations: 7, citationsAsOf: 'Jul 2026', doi: '10.1000/x&y' },
          { journal: 'J & Sons <Test>', year: 2026, title: 'A & B <C> "D" second', platform: 'RIE' },
        ],
      },
    };
    const sec = renderEquipmentGuideHtml(synthetic).split('<section class="page').slice(1).find(c => c.includes('data-page="evidence"'))!;
    const bl = studyBlocks(sec);
    expect(bl).toHaveLength(2);
    fieldOnce(bl[0][2], 'j', 'J &amp; Sons &lt;Test&gt;', 'escaped journal');
    fieldOnce(bl[0][2], 'y', '2026', 'year exactly once despite "Jul 2026" in cite');
    fieldOnce(bl[0][2], 't', 'A &amp; B &lt;C&gt; &quot;D&quot;', 'escaped title');
    fieldOnce(bl[0][2], 'pf', 'RIE', 'platform');
    fieldOnce(bl[0][2], 'cite', '7 citations (as of Jul 2026)', 'cite present');
    expect([...bl[0][2].matchAll(/<a class="doi" href="([^"]+)"/g)][0][1]).toBe('https://doi.org/10.1000/x&amp;y');
    expect(bl[1][2]).not.toContain('class="cite"');
    expect(bl[1][2]).not.toContain('class="doi"');
    fieldOnce(bl[1][2], 'j', 'J &amp; Sons &lt;Test&gt;', 'colliding journal still exactly once per block');
    fieldOnce(bl[1][2], 'y', '2026', 'colliding year, element-scoped');
    fieldOnce(bl[1][2], 'pf', 'RIE', 'colliding platform, element-scoped');
  });
});

describe('visual-v2 fonts (deterministic, embedded)', () => {
  const FONT_DIR = resolve(process.cwd(), 'src/templates/equipmentGuide/fonts');
  const WOFF2 = ['SpaceGrotesk-Variable.woff2', 'Inter-Regular.woff2', 'Inter-Medium.woff2', 'Inter-SemiBold.woff2'];
  it('every committed woff2 matches the SHA-256 on ITS OWN PROVENANCE.md row (filename-bound, swap-proof)', () => {
    const prov = readFileSync(resolve(FONT_DIR, 'PROVENANCE.md'), 'utf8');
    const rows = new Map(
      [...prov.matchAll(/^\|\s*(\S+\.woff2)\s*\|.*\|\s*([0-9a-f]{64})\s*\|\s*$/gm)].map(m => [m[1], m[2]]),
    );
    expect([...rows.keys()].sort()).toEqual([...WOFF2].sort());
    for (const f of WOFF2) {
      const sha = createHash('sha256').update(readFileSync(resolve(FONT_DIR, f))).digest('hex');
      expect(sha, f).toBe(rows.get(f));
    }
  });
  it('renders one base64 @font-face per committed woff2 (no network sources); Space Grotesk is a variable face 300 700', () => {
    const faces = [...html.matchAll(/@font-face\s*{[^}]*}/g)].map(m => m[0]);
    expect(faces).toHaveLength(WOFF2.length);
    for (const face of faces) {
      expect(face).toContain('data:font/woff2;base64,');
      expect(face).not.toMatch(/https?:\/\//);
    }
    const sg = faces.filter(f => f.includes("'Space Grotesk'"));
    expect(sg).toHaveLength(1);
    expect(sg[0]).toContain('font-weight: 300 700');
    expect(faces.filter(f => f.includes("'Inter'"))).toHaveLength(3);
  });
  it('committed licenses are genuine SIL OFL 1.1 texts with their own provenance rows (filename-bound SHA)', () => {
    const prov = readFileSync(resolve(FONT_DIR, 'PROVENANCE.md'), 'utf8');
    const rows = new Map(
      [...prov.matchAll(/^\|\s*(\S+\.txt)\s*\|.*\|\s*([0-9a-f]{64})\s*\|\s*$/gm)].map(m => [m[1], m[2]]),
    );
    for (const lic of ['OFL-SpaceGrotesk.txt', 'OFL-Inter.txt']) {
      const t = readFileSync(resolve(FONT_DIR, lic), 'utf8');
      expect(t, lic).toMatch(/SIL OPEN FONT LICENSE/i);
      expect(t, lic).toMatch(/Version 1\.1/);
      const sha = createHash('sha256').update(readFileSync(resolve(FONT_DIR, lic))).digest('hex');
      expect(sha, `${lic} provenance row`).toBe(rows.get(lic));
    }
  });
  it('licenses and provenance are committed', () => {
    const files = readdirSync(FONT_DIR);
    for (const req of ['OFL-SpaceGrotesk.txt', 'OFL-Inter.txt', 'PROVENANCE.md']) expect(files).toContain(req);
  });
});

describe('visual-v2 structure — PAGE_ORDER single source of truth', () => {
  const chunks = html.split('<section class="page').slice(1);

  it('PAGE_ORDER shape: cover, about, evidence, 11 unique products, contact', () => {
    expect(PAGE_ORDER).toHaveLength(15);
    expect(PAGE_ORDER[0]).toEqual({ kind: 'cover' });
    expect(PAGE_ORDER[1]).toEqual({ kind: 'about' });
    expect(PAGE_ORDER[2]).toEqual({ kind: 'evidence' });
    expect(PAGE_ORDER[14]).toEqual({ kind: 'contact' });
    const ids = PAGE_ORDER.filter(e => e.kind === 'product').map(e => (e as { id: string }).id);
    expect(ids.sort()).toEqual(equipmentGuideData.products.map(p => p.id).sort());
  });

  it('rendered section sequence equals PAGE_ORDER (kinds + product order)', () => {
    const kinds = chunks.map(c => (c.match(/data-page="([a-z-]+)"/) as RegExpMatchArray)[1]);
    expect(kinds).toEqual(PAGE_ORDER.map(e => e.kind));
    const productIds = chunks
      .filter(c => c.includes('data-page="product"'))
      .map(c => (c.match(/data-product-id="([a-z0-9-]+)"/) as RegExpMatchArray)[1]);
    expect(productIds).toEqual(PAGE_ORDER.filter(e => e.kind === 'product').map(e => (e as { id: string }).id));
  });

  it('stamps data-category per PAGE_ORDER on every product section', () => {
    for (const e of PAGE_ORDER) {
      if (e.kind !== 'product') continue;
      const chunk = chunks.find(c => c.includes(`data-product-id="${(e as { id: string }).id}"`))!;
      expect(chunk, (e as { id: string }).id).toContain(`data-category="${(e as { category: string }).category}"`);
    }
  });

  it('cover TOC: 11 entries, series verbatim, page number = PAGE_ORDER index + 1, under CATEGORY_META labels', () => {
    const coverChunk = chunks[0];
    expect(coverChunk).toContain('data-page="cover"');
    for (const [i, e] of PAGE_ORDER.entries()) {
      if (e.kind !== 'product') continue;
      const p = equipmentGuideData.products.find(x => x.id === (e as { id: string }).id)!;
      const re = new RegExp(`<span class="toc-name">${esc(p.series).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span><span class="toc-dots"></span><span class="toc-page">${i + 1}</span>`);
      expect(coverChunk, p.id).toMatch(re);
    }
    for (const meta of Object.values(CATEGORY_META)) expect(coverChunk).toContain(`>${esc(meta.label)}<`);
    expect([...coverChunk.matchAll(/class="toc-name"/g)]).toHaveLength(11);
    expect([...coverChunk.matchAll(/class="toc-dots"/g)]).toHaveLength(11); // leader dots on every entry
  });

  it('cover front-matter row lists About/Evidence/Contact with their PAGE_ORDER page numbers', () => {
    const coverChunk = chunks[0];
    const pageOf = (kind: string) => PAGE_ORDER.findIndex(e => e.kind === kind) + 1;
    expect(coverChunk).toContain('class="toc-front"');
    expect(coverChunk).toContain(`About&nbsp;<b>${pageOf('about')}</b>`);
    expect(coverChunk).toContain(`Peer-Reviewed Validation&nbsp;<b>${pageOf('evidence')}</b>`);
    expect(coverChunk).toContain(`Contact&nbsp;<b>${pageOf('contact')}</b>`);
  });

  it('cover renders the pinned literals and one navy logo', () => {
    const coverChunk = chunks[0];
    for (const s of [cover.eyebrow, cover.title, cover.edition]) expect(coverChunk).toContain(esc(s));
    expect(coverChunk).toContain(esc(cover.tagline)); // tagline has "R&D" → escaped to R&amp;D
    expect(count(coverChunk, navyLogo)).toBe(1);
  });
});

// ── Task 7: sub-12.5px font-size allowlist (shared scanner, self-tested) ──
import { equipmentGuideCss } from './equipmentGuide.css';
const scanFontSizes = (cssText: string, floorPx: number): { below: Array<{ selector: string; size: number }>; total: number } => {
  const css = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  if (css.includes('@media')) throw new Error('scanFontSizes: nested @media not supported — flat rule set required');
  const below: Array<{ selector: string; size: number }> = [];
  let total = 0;
  for (const [, rawSelector, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (rawSelector.trim().startsWith('@page')) continue;
    for (const m of body.matchAll(/font-size:\s*([\d.]+)px/g)) {
      total++;
      const size = parseFloat(m[1]);
      if (size < floorPx) for (const s of rawSelector.trim().split(',').map(x => x.trim())) below.push({ selector: s, size });
    }
  }
  return { below, total };
};
describe('visual-v2 font-size floor', () => {
  it('every sub-12.5px font-size belongs to the spec §6 exception allowlist (exact selectors)', () => {
    const ALLOW = new Set(['.eyebrow', '.apps .lab', '.cover-edition', '.toc-page', '.toc-cat', '.study .m', '.study .m .doi', '.disclaimer', '.page-foot', '.brandbar .site', '.cta-band .sub', '.footer-bar', '.fb-slogan', '.toc-front']);
    const { below, total } = scanFontSizes(equipmentGuideCss, 12.5);
    for (const { selector, size } of below) {
      expect(ALLOW.has(selector), `${selector} @ ${size}px not in spec exception list`).toBe(true);
    }
    expect(total).toBeGreaterThan(10);
  });
  it('scanFontSizes self-test: comma selectors, duplicate declarations, decimals, comments, @media guard', () => {
    const sample = `/* x */ .a, .bad { font-size: 13px; font-size: 10.5px; } .eyebrow { font-size: 10px; }`;
    expect(scanFontSizes(sample, 12.5).below).toEqual([
      { selector: '.a', size: 10.5 }, { selector: '.bad', size: 10.5 }, { selector: '.eyebrow', size: 10 },
    ]);
    expect(scanFontSizes(sample, 12.5).total).toBe(3);
    expect(() => scanFontSizes('@media print { .x { font-size: 9px; } }', 12.5)).toThrow(/@media/);
  });
});

describe('visual-v2 contact page matches the design', () => {
  const contact = html.split('<section class="page').slice(1).find(c => c.includes('data-page="contact"'))!;
  it('has the General Inquiries eyebrow, then heading, then the CTA band below it', () => {
    const iEyebrow = contact.indexOf('>General Inquiries<');
    const iHeading = contact.indexOf('Contact NineScrolls');
    const iBand = contact.indexOf('class="cta-band"');
    expect(iEyebrow).toBeGreaterThan(-1);
    expect(iHeading).toBeGreaterThan(iEyebrow);
    expect(iBand).toBeGreaterThan(iHeading); // band is BELOW the heading, per design
  });
  it('renders the CTA band as headline + contact sub-line exactly once', () => {
    expect(count(contact, 'class="cta-band"')).toBe(1);
    expect(contact).toContain('<span class="cta-band-h">Ready to scope your process? Request a quote</span>');
    expect(contact).toContain('<span class="sub">ninescrolls.com/products · sales@ninescrolls.com</span>');
  });
  it('footer bar carries the Powered by Precision slogan and site identifiers', () => {
    expect(contact).toContain('class="fb-slogan">Powered by Precision · U.S. Operations<');
    expect(contact).toContain('ninescrolls.com · info@ninescrolls.com');
  });
});
