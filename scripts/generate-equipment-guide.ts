import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer';
import { equipmentGuideData } from '../src/data/equipmentGuide';
import { renderEquipmentGuideHtml } from '../src/templates/equipmentGuide/renderEquipmentGuideHtml';

async function main() {
  const html = renderEquipmentGuideHtml(equipmentGuideData);
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
