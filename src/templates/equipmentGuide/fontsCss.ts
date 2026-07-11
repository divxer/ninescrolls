import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DIR = resolve(process.cwd(), 'src/templates/equipmentGuide/fonts');
const face = (family: string, weight: string, file: string): string => {
  const b64 = readFileSync(resolve(DIR, file)).toString('base64');
  return `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; src: url(data:font/woff2;base64,${b64}) format('woff2'); }`;
};
let cached: string | null = null;
export function equipmentGuideFontsCss(): string {
  if (cached) return cached;
  cached = [
    face('Space Grotesk', '300 700', 'SpaceGrotesk-Variable.woff2'),
    face('Inter', '400', 'Inter-Regular.woff2'),
    face('Inter', '500', 'Inter-Medium.woff2'),
    face('Inter', '600', 'Inter-SemiBold.woff2'),
  ].join('\n');
  return cached;
}
