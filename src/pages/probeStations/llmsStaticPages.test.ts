import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const URLS = [
  'https://ninescrolls.com/wafer-probe-stations',
  'https://ninescrolls.com/wafer-probe-stations/semishare',
  'https://ninescrolls.com/applications/cryogenic-probing',
  'https://ninescrolls.com/applications/silicon-photonics-probing',
];

describe.each(['public/llms.txt', 'public/llms-full.txt'])('%s', (file) => {
  const text = readFileSync(file, 'utf8');
  it.each(URLS)('lists %s', (url) => {
    expect(text).toContain(url);
  });
});
