import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EquipmentGuideData, GuideProduct, SpecRow } from '../../data/equipmentGuide/types';
import { equipmentGuideCss } from './equipmentGuide.css';
import { equipmentGuideFontsCss } from './fontsCss';

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SITE_ORIGIN = 'https://ninescrolls.com';

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
  const lead = `<p class="lead">${esc(p.content.lead)}</p>`;
  const apps = `<div class="apps"><p class="lab">Typical applications</p><div class="chips">${p.content.applications.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div></div>`;
  const cta = `<div class="cta"><a class="btn" href="${SITE_ORIGIN}${p.content.href}">Explore configurations &amp; request a quote <span class="arr">→</span></a><span class="cta-url">ninescrolls.com${p.content.href}</span></div>`;
  return `
  <section class="page page--product" data-product-id="${p.id}">
    ${brandbar('navy')}
    <p class="eyebrow">Equipment Platform</p>
    <div class="section-accent"></div>
    <h1 class="series-title">${esc(p.series)}</h1>
    ${lead}
    <div class="product-head">
      <div class="product-copy">${bullets}</div>
      <div class="image-well"><img src="${imageDataUri(p.image)}" alt="${esc(p.imageAlt)}"/></div>
    </div>
    ${specTable(`${headRow}${specRowsHtml(p.specs, twoCol)}`)}
    ${sub}${family}
    ${apps}${cta}
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
<style>${equipmentGuideFontsCss()}\n${equipmentGuideCss}</style></head><body>
${aboutPage(d)}${evidencePage(d)}${products}${contactPage(d)}
</body></html>`;
}
