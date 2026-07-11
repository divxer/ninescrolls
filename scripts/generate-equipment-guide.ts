import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { equipmentGuideData } from '../src/data/equipmentGuide';
import { BANNED_CONTENT_PATTERNS } from '../src/data/equipmentGuide/bannedContent';
import { renderEquipmentGuideHtml } from '../src/templates/equipmentGuide/renderEquipmentGuideHtml';
import { parsePdfFonts, assertEmbeddedFontsOutput } from '../src/templates/equipmentGuide/pdfFontsCheck';

// Downscale + JPEG-encode each product image so the PDF embeds compact assets
// instead of full-resolution lossless webp (which Chrome re-encodes losslessly,
// bloating the PDF to ~6MB). sharp is also used by runtime image-processing
// code elsewhere in this repo; this generator must still keep it out of src/ app code.
const IMG_CACHE = resolve(process.cwd(), 'tmp', 'equipment-guide-images');
const JPEG_WIDTH = 1100;
const JPEG_QUALITY = 85;
const MAX_PDF_BYTES = 2_000_000;
const EXPECTED_PAGES = 15;

function cachePathFor(publicRelPath: string): string {
  const base = basename(publicRelPath).replace(/\.[^.]+$/, '');
  return resolve(IMG_CACHE, `${base}.jpg`);
}

async function optimizeImages(): Promise<void> {
  mkdirSync(IMG_CACHE, { recursive: true });
  const uniquePaths = [...new Set(equipmentGuideData.products.map(p => p.image))];
  await Promise.all(
    uniquePaths.map(async publicRelPath => {
      const src = resolve(process.cwd(), 'public', publicRelPath.replace(/^\//, ''));
      await sharp(src)
        .resize({ width: JPEG_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toFile(cachePathFor(publicRelPath));
    }),
  );
}

// Synchronous resolver over the pre-generated JPEG cache — keeps the renderer sync/pure.
function optimizedResolver(publicRelPath: string): string {
  const b64 = readFileSync(cachePathFor(publicRelPath)).toString('base64');
  return `data:image/jpeg;base64,${b64}`;
}

function validatePdf(outPath: string): void {
  const size = statSync(outPath).size;
  if (size < 200_000) {
    throw new Error(`Equipment Guide PDF is suspiciously small: ${size} bytes`);
  }
  if (size > MAX_PDF_BYTES) {
    throw new Error(`Equipment Guide PDF is too large: ${(size / 1024 / 1024).toFixed(2)} MB`);
  }

  const info = execFileSync('pdfinfo', [outPath], { encoding: 'utf8' });
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  if (pages !== EXPECTED_PAGES) {
    throw new Error(`Expected ${EXPECTED_PAGES} PDF pages, got ${pages || 'unknown'}`);
  }

  let fontsOut: string;
  try {
    fontsOut = execFileSync('pdffonts', [outPath], { encoding: 'utf8' });
  } catch {
    throw new Error('pdffonts (poppler) is a REQUIRED build dependency — brew install poppler');
  }
  assertEmbeddedFontsOutput(parsePdfFonts(fontsOut));

  const text = execFileSync('pdftotext', [outPath, '-'], { encoding: 'utf8' });
  const lowerText = text.toLowerCase();
  const required = [
    'Peer-reviewed validation',
    'E-Beam Evaporation Series',
    'MEB-600',
    'Φ6 in x1 flat substrate holder',
    '6.7×10',
    'Equipment Guide · 2026 Edition',
    'Ready to scope your process?',
    'Etch & Ion Beam',
    'Contact NineScrolls',
  ];
  for (const phrase of required) {
    if (!lowerText.includes(phrase.toLowerCase())) {
      throw new Error(`Generated PDF is missing required text: ${phrase}`);
    }
  }

  for (const pattern of BANNED_CONTENT_PATTERNS) {
    if (pattern.test(text)) {
      throw new Error(`Generated PDF contains banned text matching ${pattern}`);
    }
  }
}

async function main() {
  await optimizeImages();
  const html = renderEquipmentGuideHtml(equipmentGuideData, optimizedResolver);
  const outPath = resolve(process.cwd(), 'public', 'NineScrolls-Equipment-Guide.pdf');

  // Chrome renders the print footer in a separate mini-document that does NOT inherit
  // the page's styles — without an inline @font-face it falls back to Times, which the
  // fail-closed pdffonts gate rejects. Embed Inter 400 directly in the footer template.
  const footerFontB64 = readFileSync(
    resolve(process.cwd(), 'src/templates/equipmentGuide/fonts/Inter-Regular.woff2'),
  ).toString('base64');
  const footerTemplate = `<style>@font-face{font-family:'Inter';font-style:normal;font-weight:400;src:url(data:font/woff2;base64,${footerFontB64}) format('woff2');}</style><div style="width:100%;font-family:'Inter',sans-serif;font-size:9px;color:#64748b;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span> &nbsp;·&nbsp; ninescrolls.com</div>`;

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluateHandle('document.fonts.ready');
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.6in', right: '0.6in', bottom: '0.7in', left: '0.6in' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate,
    });
    writeFileSync(outPath, pdf);
    validatePdf(outPath);
    console.log(`Wrote ${outPath} (${(pdf.length / 1024).toFixed(0)} KB)`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
