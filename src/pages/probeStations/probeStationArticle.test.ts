import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { insightsPosts } from '../../../scripts/insightsPostsData';
import { FORBIDDEN_ATTESTATION_PATTERNS } from '../../data/probeStations/semishare';

const SLUG = 'how-to-choose-wafer-probe-station-university-lab';

describe('probe station buyer-guide article entry', () => {
  const post = insightsPosts.find((p) => p.slug === SLUG);

  it('exists with full content and no hand-written TOC', () => {
    expect(post).toBeTruthy();
    expect(post!.content!.length).toBeGreaterThan(10_000); // full conversion, not a stub
    // The page auto-generates the TOC — the content must not carry one in any
    // of the forms the site (or a naive conversion) could produce:
    expect(post!.content).not.toMatch(/table of contents/i);
    expect(post!.content).not.toMatch(/\bid="toc"|class="[^"]*\btoc\b[^"]*"/i);
    expect(post!.content).not.toMatch(/<nav[^>]*toc/i);
    expect(post!.content).not.toMatch(/<h[23][^>]*>\s*(contents|in this (article|guide))\s*<\/h[23]>/i);
  });

  it('embeds each figure as its own complete <picture> block with caption and on-disk assets', () => {
    const pictureBlocks = post!.content!.match(/<picture>[\s\S]*?<\/picture>/g) ?? [];

    for (const base of ['probe-station-temperature-regimes', 'probe-station-automation-levels']) {
      // The block DEDICATED to this figure — not just any <picture> plus a bare URL
      const block = pictureBlocks.find((b) => b.includes(`/assets/images/insights/${base}`));
      expect(block, `<picture> block for ${base}`).toBeTruthy();

      // Responsive webp srcset + png fallback, all inside THIS block
      for (const size of ['sm', 'md', 'lg', 'xl']) {
        expect(block, `${base}-${size}.webp in srcset`).toContain(`/assets/images/insights/${base}-${size}.webp`);
        expect(existsSync(`public/assets/images/insights/${base}-${size}.webp`), `${base}-${size}.webp on disk`).toBe(true);
        expect(existsSync(`public/assets/images/insights/${base}-${size}.png`), `${base}-${size}.png on disk`).toBe(true);
      }
      expect(block, `${base}.png fallback <img>`).toMatch(
        new RegExp(`<img[^>]+src="/assets/images/insights/${base}\\.png"`)
      );
      expect(existsSync(`public/assets/images/insights/${base}.png`), `${base}.png on disk`).toBe(true);

      // The IMMEDIATELY ADJACENT caption element (allowing only closing
      // wrapper tags in between) must be a post-figure-caption carrying the
      // schematic disclaimer — proximity alone is not enough.
      const afterBlock = post!.content!.slice(
        post!.content!.indexOf(block!) + block!.length,
        post!.content!.indexOf(block!) + block!.length + 400
      );
      const captionMatch = afterBlock.match(
        /^\s*(?:<\/[a-z]+>\s*)*<p class="post-figure-caption">([\s\S]*?)<\/p>/i
      );
      expect(captionMatch, `adjacent post-figure-caption after ${base}`).toBeTruthy();
      expect(captionMatch![1], `schematic disclaimer in ${base} caption`).toMatch(/Schematic illustration/i);
    }
    expect(existsSync('public/assets/images/insights/probe-station-guide-cover.png')).toBe(true);
  });

  it('links to the capability hub and the brand page', () => {
    expect(post!.content).toContain('href="/wafer-probe-stations"');
    expect(post!.content).toContain('href="/wafer-probe-stations/semishare"');
  });

  it('carries no attestation wording and no SEMISHARE-attributed numbers (Constraint 7 tripwire)', () => {
    for (const pattern of FORBIDDEN_ATTESTATION_PATTERNS) {
      expect(post!.content).not.toMatch(pattern);
    }
    // Heuristic tripwire, not proof: a number within 60 chars after "SEMISHARE"
    // flags a potentially product-attributed spec. On a hit, either source the
    // value from src/data/probeStations/semishare.ts (and render it there, not
    // here) or cut the sentence — do not weaken this regex.
    expect(post!.content).not.toMatch(/SEMISHARE[^<.]{0,60}\d+\s?(K\b|mm|inch|"|µm|um)/i);
  });
});
