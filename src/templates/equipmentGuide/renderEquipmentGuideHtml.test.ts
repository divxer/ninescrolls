import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderEquipmentGuideHtml, logoDataUri, defaultImageDataUri } from './renderEquipmentGuideHtml';
import { equipmentGuideData } from '../../data/equipmentGuide';
import { PRODUCT_ROUTES } from '../../data/equipmentGuide/products';

const fixTrim = (f: string): string =>
  readFileSync(resolve(process.cwd(), 'src/data/equipmentGuide/__fixtures__', f), 'utf8').trim();

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
  it('keeps the Evidence page string-identical to the v1 fixture', () => {
    const ev = chunks.map(c => '<section class="page' + c).find(c => c.includes('Peer-Reviewed Validation'))!.trim();
    // note: split() dropped the delimiter; re-prepend it, then compare to the committed chunk
    expect(ev).toBe(fixTrim('v1-evidence-chunk.html'));
  });
});
