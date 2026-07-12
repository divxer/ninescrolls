import DOMPurify from 'dompurify';
import { describe, expect, it } from 'vitest';
import { insightsPosts } from '../../scripts/insightsPostsData';
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

  it('routes BOTH src and srcset of the probe-station article through the CDN after rewrite + sanitize', () => {
    const post = insightsPosts.find(
      (p) => p.slug === 'how-to-choose-wafer-probe-station-university-lab'
    );
    expect(post).toBeTruthy();

    const delivered = DOMPurify.sanitize(
      rewriteContentImages(post!.content!, CDN),
      SANITIZE_OPTIONS
    );

    // No local asset path may survive on any image attribute — browsers
    // prefer <source srcset> over the <img src> fallback, so both delivery
    // paths must point at the CDN.
    expect(delivered).not.toMatch(/(?:src|srcset)\s*=\s*"\/assets\/images\//i);

    // The article's two figures deliver via CDN on both paths.
    for (const base of ['probe-station-temperature-regimes', 'probe-station-automation-levels']) {
      expect(delivered).toMatch(new RegExp(`srcset="${CDN}/insights/${base}-sm\\.webp`));
      expect(delivered).toMatch(new RegExp(`src="${CDN}/insights/${base}\\.png"`));
    }
    // Sanitizer kept the responsive markup (picture/source/srcset survive).
    expect(delivered).toContain('<picture>');
  });
});
