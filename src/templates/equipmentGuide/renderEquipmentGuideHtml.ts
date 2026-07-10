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
