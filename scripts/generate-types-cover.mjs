import { Buffer } from 'node:buffer';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import sharp from 'sharp';

const WIDTH = 1600;
const HEIGHT = 900;
const inputPath = process.argv[2];
const outputPath = process.argv[3] ?? 'tmp/types-cover/probe-station-types-cover-v1.png';

if (!inputPath) {
  throw new Error('Usage: node scripts/generate-types-cover.mjs <scene.png> [output.png]');
}

// Locked copy. Eyebrow deliberately shares no word with the title lines.
const EYEBROW = 'METROLOGY & TESTING';
const TITLE_PRIMARY = 'Types of Wafer';
const TITLE_SECONDARY = 'Probe Stations';
const SUBTITLE_LINE_1 = 'A measurement-environment guide';
const SUBTITLE_LINE_2 = 'to six system types';

// Minimal glyph coverage check: every rendered string must be printable ASCII,
// which both embedded font families (Space Grotesk, Inter) fully cover.
const renderedStrings = [EYEBROW, TITLE_PRIMARY, TITLE_SECONDARY, SUBTITLE_LINE_1, SUBTITLE_LINE_2];
for (const str of renderedStrings) {
  if (!/^[\x20-\x7E]+$/.test(str)) {
    throw new Error(`Rendered string contains non-printable-ASCII characters: ${JSON.stringify(str)}`);
  }
}

const escapeXml = (str) =>
  str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const asset = (relativePath) => path.resolve(process.cwd(), relativePath);
const toDataUri = async (relativePath, mime) => {
  const data = await fs.readFile(asset(relativePath));
  return `data:${mime};base64,${data.toString('base64')}`;
};

const [spaceGrotesk, interRegular, interSemiBold] = await Promise.all([
  toDataUri('src/templates/equipmentGuide/fonts/SpaceGrotesk-Variable.woff2', 'font/woff2'),
  toDataUri('src/templates/equipmentGuide/fonts/Inter-Regular.woff2', 'font/woff2'),
  toDataUri('src/templates/equipmentGuide/fonts/Inter-SemiBold.woff2', 'font/woff2'),
]);

const overlay = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="copyField" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#071b31" stop-opacity="1"/>
      <stop offset="72%" stop-color="#071b31" stop-opacity="0.98"/>
      <stop offset="100%" stop-color="#071b31" stop-opacity="0"/>
    </linearGradient>
    <style>
      @font-face { font-family: 'Space Grotesk'; src: url('${spaceGrotesk}') format('woff2'); font-weight: 300 700; }
      @font-face { font-family: 'Inter'; src: url('${interRegular}') format('woff2'); font-weight: 400; }
      @font-face { font-family: 'Inter'; src: url('${interSemiBold}') format('woff2'); font-weight: 600; }
      .title-primary { font-family: 'Space Grotesk', sans-serif; font-size: 55px; font-weight: 600; fill: #f8fbff; letter-spacing: -1.1px; }
      .title-secondary { font-family: 'Space Grotesk', sans-serif; font-size: 70px; font-weight: 600; fill: #f8fbff; letter-spacing: -1.4px; }
      .eyebrow { font-family: 'Inter', sans-serif; font-size: 24px; font-weight: 600; fill: #4aa8f5; letter-spacing: 3px; }
      .subtitle { font-family: 'Inter', sans-serif; font-size: 28px; font-weight: 400; fill: #c8d8eb; }
    </style>
  </defs>
  <rect width="790" height="900" fill="url(#copyField)"/>
  <rect x="58" y="46" width="284" height="108" rx="14" fill="#f8fbff" fill-opacity="0.94" stroke="#d6e5f5" stroke-opacity="0.55"/>
  <text x="70" y="230" class="eyebrow">${escapeXml(EYEBROW)}</text>
  <rect x="70" y="252" width="118" height="6" rx="3" fill="#4aa8f5"/>
  <text x="70" y="390" class="title-primary">${escapeXml(TITLE_PRIMARY)}</text>
  <text x="70" y="490" class="title-secondary">${escapeXml(TITLE_SECONDARY)}</text>
  <text x="72" y="603" class="subtitle">${escapeXml(SUBTITLE_LINE_1)}</text>
  <text x="72" y="643" class="subtitle">${escapeXml(SUBTITLE_LINE_2)}</text>
</svg>`);

const logo = await sharp(asset('public/assets/images/logo-with-text.svg'))
  .resize({
    width: 244,
    height: 82,
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .png()
  .toBuffer();

await fs.mkdir(path.dirname(asset(outputPath)), { recursive: true });

await sharp(asset(inputPath))
  .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'centre' })
  .composite([
    { input: overlay, left: 0, top: 0 },
    { input: logo, left: 78, top: 59 },
  ])
  .toColourspace('srgb')
  .png({ compressionLevel: 9 })
  .toFile(asset(outputPath));

const metadata = await sharp(asset(outputPath)).metadata();
if (metadata.width !== WIDTH || metadata.height !== HEIGHT || metadata.space !== 'srgb') {
  throw new Error(`Unexpected output metadata: ${JSON.stringify(metadata)}`);
}

console.log(`Generated ${outputPath} (${metadata.width}x${metadata.height}, ${metadata.space})`);
