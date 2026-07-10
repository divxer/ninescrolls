import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import puppeteer from 'puppeteer';
import sharp from 'sharp';
import { equipmentGuideData } from '../src/data/equipmentGuide';
import { renderEquipmentGuideHtml } from '../src/templates/equipmentGuide/renderEquipmentGuideHtml';

// Downscale + JPEG-encode each product image so the PDF embeds compact assets
// instead of full-resolution lossless webp (which Chrome re-encodes losslessly,
// bloating the PDF to ~6MB). sharp is a generator-only devDependency; it must
// never be imported by src/ app code.
const IMG_CACHE = resolve(process.cwd(), 'tmp', 'equipment-guide-images');
const JPEG_WIDTH = 1100;
const JPEG_QUALITY = 85;

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

async function main() {
  await optimizeImages();
  const html = renderEquipmentGuideHtml(equipmentGuideData, optimizedResolver);
  const outPath = resolve(process.cwd(), 'public', 'NineScrolls-Equipment-Guide.pdf');

  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0.6in', right: '0.6in', bottom: '0.7in', left: '0.6in' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: '<div style="width:100%;font-size:9px;color:#64748b;text-align:center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span> &nbsp;·&nbsp; ninescrolls.com</div>',
    });
    writeFileSync(outPath, pdf);
    console.log(`Wrote ${outPath} (${(pdf.length / 1024).toFixed(0)} KB)`);
  } finally {
    await browser.close();
  }
}

main().catch(err => { console.error(err); process.exit(1); });
