import { readFileSync } from 'node:fs';
import DOMPurify from 'dompurify';
import { describe, expect, it } from 'vitest';
import { parseArticleHtml } from '../../scripts/lib/parseArticleHtml';
import { rewriteContentImages } from '../utils/rewriteContentImages';

const CDN = 'https://cdn.example.com';

// Must mirror the sanitize options used by InsightsPostPage's
// dangerouslySetInnerHTML call — this test guards the real delivery path.
const SANITIZE_OPTIONS = {
  ADD_TAGS: ['picture', 'source'],
  ADD_ATTR: ['srcset', 'media', 'loading', 'decoding', 'fetchpriority'],
};

describe('rewriteContentImages', () => {
  it('rewrites src, lowercase srcset, and camelCase srcSet to the CDN base', () => {
    const html =
      '<img src="/assets/images/insights/a.png">' +
      '<source srcset="/assets/images/insights/a-sm.webp 640w">' +
      '<source srcSet="/assets/images/insights/a-lg.webp 1024w">';
    const out = rewriteContentImages(html, CDN);
    expect(out).toContain(`src="${CDN}/insights/a.png"`);
    expect(out).toContain(`srcset="${CDN}/insights/a-sm.webp 640w"`);
    expect(out).toContain(`srcSet="${CDN}/insights/a-lg.webp 1024w"`);
    expect(out).not.toContain('"/assets/images/');
  });

  it('returns html unchanged when no CDN base is configured', () => {
    const html = '<img src="/assets/images/insights/a.png">';
    expect(rewriteContentImages(html, '')).toBe(html);
  });

  it('delivers the probe-station standalone article via absolute CDN URLs through sanitize + rewrite', () => {
    const html = readFileSync(
      'scripts/articles/how-to-choose-wafer-probe-station-university-lab.html',
      'utf8'
    );
    const content = parseArticleHtml(html).content;
    const ABS_CDN = 'https://cdn.ninescrolls.com/insights';

    // (a) The standalone article ships absolute CDN URLs only — no local asset
    // path may appear on any image attribute (browsers prefer <source srcset>
    // over the <img src> fallback, so both paths must already be absolute).
    expect(content).not.toMatch(/(?:src|srcset)\s*=\s*"\/assets\/images\//i);

    // (b) After the real delivery-path sanitize, the CDN srcset/src URLs
    // survive and the responsive <picture> markup is preserved.
    const delivered = DOMPurify.sanitize(content, SANITIZE_OPTIONS);
    for (const base of ['probe-station-temperature-regimes', 'probe-station-automation-levels']) {
      expect(delivered).toMatch(new RegExp(`srcset="${ABS_CDN}/${base}-sm\\.webp`));
      expect(delivered).toMatch(new RegExp(`src="${ABS_CDN}/${base}\\.png"`));
    }
    expect(delivered).toContain('<picture>');

    // (c) rewriteContentImages only rewrites /assets/images/ paths, so for this
    // already-absolute article it is a no-op (idempotent).
    expect(rewriteContentImages(content, CDN)).toBe(content);
  });
});
