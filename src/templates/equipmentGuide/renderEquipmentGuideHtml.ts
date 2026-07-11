import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { EquipmentGuideData, GuideProduct, SpecRow } from '../../data/equipmentGuide/types';
import { cover } from '../../data/equipmentGuide/guideMeta';
import { equipmentGuideCss } from './equipmentGuide.css';
import { equipmentGuideFontsCss } from './fontsCss';

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

function coverPage(d: EquipmentGuideData): string {
  const groups = (Object.keys(CATEGORY_META) as GuideCategory[]).map(cat => {
    const entries = PAGE_ORDER
      .map((e, i) => ({ e, page: i + 1 }))
      .filter(x => x.e.kind === 'product' && (x.e as { category: GuideCategory }).category === cat)
      .map(x => {
        const p = d.products.find(pp => pp.id === (x.e as { id: string }).id)!;
        return `<li><span class="toc-name">${esc(p.series)}</span><span class="toc-dots"></span><span class="toc-page">${x.page}</span></li>`;
      }).join('');
    return `<div class="toc-col" data-toc-category="${cat}"><p class="toc-cat" style="color:${CATEGORY_META[cat].color};border-color:${CATEGORY_META[cat].color}">${esc(CATEGORY_META[cat].label)}</p><ul>${entries}</ul></div>`;
  }).join('');
  const pageOf = (kind: string) => PAGE_ORDER.findIndex(e => e.kind === kind) + 1;
  const frontMatter = `<div class="toc-front"><span>About&nbsp;<b>${pageOf('about')}</b></span><span>Peer-Reviewed Validation&nbsp;<b>${pageOf('evidence')}</b></span><span>Contact&nbsp;<b>${pageOf('contact')}</b></span></div>`;
  return `
  <section class="page page--cover" data-page="cover">
    ${brandbar('navy')}
    <div class="cover-main">
      <p class="eyebrow">${esc(cover.eyebrow)}</p>
      <h1 class="cover-title">${esc(cover.title)}</h1>
      <div class="section-accent"></div>
      <p class="cover-tagline">${esc(cover.tagline)}</p>
    </div>
    <div class="toc">${groups}</div>
    ${frontMatter}
    <p class="cover-edition">${esc(cover.edition)}</p>
    <div class="page-foot"></div>
  </section>`;
}

function productPage(p: GuideProduct, imageDataUri: (publicRelPath: string) => string, category: GuideCategory): string {
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
  <section class="page page--product" data-page="product" data-product-id="${p.id}" data-category="${category}">
    ${brandbar('navy')}
    <p class="eyebrow eyebrow--cat">${esc(CATEGORY_META[category].label)}</p>
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

const PILLAR_ICONS = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8h10M18 8h2M4 16h2M10 16h10"/><circle cx="16" cy="8" r="2"/><circle cx="8" cy="16" r="2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.1 7-11a7 7 0 0 0-14 0c0 5.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5.5C10.5 4 8.5 3.5 6 3.5v14c2.5 0 4.5.5 6 2 1.5-1.5 3.5-2 6-2v-14c-2.5 0-4.5.5-6 2z"/><path d="M12 5.5v14"/></svg>',
];

function aboutPage(d: EquipmentGuideData): string {
  const pillars = d.about.pillars.map((p, i) =>
    `<div class="pillar-card"><span class="pi">${PILLAR_ICONS[i]}</span><span class="h">${esc(p.heading)}</span><div>${esc(p.body)}</div></div>`).join('');
  const paras = d.about.paragraphs.map(t => `<p>${esc(t)}</p>`).join('');
  return `<section class="page" data-page="about">${brandbar('navy')}<h1>${esc(d.about.title)}</h1><div class="section-accent"></div><p class="eyebrow">${esc(d.about.subtitle)}</p>${paras}<div class="pillars-grid">${pillars}</div></section>`;
}

function evidencePage(d: EquipmentGuideData): string {
  const studies = d.evidence.studies.map((s, i) => {
    const cite = s.citations !== undefined
      ? ` · <span class="cite">${s.citations} citations (as of ${esc(s.citationsAsOf ?? '')})</span>` : '';
    const doi = s.doi ? ` · <a class="doi" href="https://doi.org/${esc(s.doi)}">doi.org/${esc(s.doi)}</a>` : '';
    return `<article data-study-index="${i}" class="study"><span class="j">${esc(s.journal)}</span> · <span class="y">${s.year}</span>
      <div class="t">${esc(s.title)}</div>
      <div class="m">Corresponding <span class="pf">${esc(s.platform)}</span> process platform${cite}${doi}</div></article>`;
  }).join('');
  return `<section class="page" data-page="evidence">${brandbar('navy')}
    <p class="eyebrow">${esc(d.evidence.intro)}</p>
    <h1>${esc(d.evidence.title)}</h1><div class="section-accent"></div>
    <p class="ev-sub">${esc(d.evidence.subtitle)}</p>
    ${studies}
    <p class="disclaimer">${esc(d.evidence.disclaimer)}</p>
  </section>`;
}

// Inline stroke icons for the contact card grid: map-pin, clock, mail, headset.
const CONTACT_ICONS = [
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s7-5.1 7-11a7 7 0 0 0-14 0c0 5.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>',
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 13a8 8 0 0 1 16 0"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19v1a2 2 0 0 1-2 2h-4"/></svg>',
];

function contactPage(d: EquipmentGuideData): string {
  const line = (label: string, val: string) => `<p><strong>${esc(label)}:</strong> ${esc(val)}</p>`;
  const band = `<div class="cta-band"><span class="cta-band-h">Ready to scope your process? Request a quote</span><span class="sub">ninescrolls.com/products · sales@ninescrolls.com</span></div>`;
  const card = (i: number, label: string, body: string) =>
    `<div class="pillar-card contact-card"><span class="pi">${CONTACT_ICONS[i]}</span><span class="h">${esc(label)}</span><div>${body}</div></div>`;
  const cards = [
    card(0, 'Office Location', `<p>${d.contact.office.map(esc).join('<br/>')}</p>`),
    card(1, 'Business Hours', `<p>${d.contact.hours.map(esc).join('<br/>')}</p>`),
    card(2, 'Contact Information', d.contact.contacts.map(c => line(c.label, c.value)).join('')),
    card(3, 'Technical Support', d.contact.support.map(c => line(c.label, c.value)).join('')),
  ].join('');
  const footerBar = `<div class="footer-bar"><span class="fb-left"><img class="fb-logo" src="${logoDataUri('navy')}" alt="NineScrolls LLC"/><span>NineScrolls LLC · Equipment Guide</span></span><span class="fb-right"><span class="fb-slogan">Powered by Precision · U.S. Operations</span><span>ninescrolls.com · info@ninescrolls.com</span></span></div>`;
  return `<section class="page page--contact" data-page="contact">${brandbar('navy')}
    <p class="eyebrow">General Inquiries</p>
    <h1>Contact NineScrolls</h1>
    <div class="section-accent"></div>
    ${band}
    <div class="contact-grid">${cards}</div>
    ${footerBar}
    <div class="page-foot"></div>
  </section>`;
}

export function renderEquipmentGuideHtml(
  d: EquipmentGuideData,
  imageDataUri: (publicRelPath: string) => string = defaultImageDataUri,
): string {
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
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<title>NineScrolls LLC — Equipment Guide</title>
<style>${equipmentGuideFontsCss()}\n${equipmentGuideCss}</style></head><body>
${body}
</body></html>`;
}
