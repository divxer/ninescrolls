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
