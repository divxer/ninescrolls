import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { buildInsightRecord, HERO_IMAGES_MAP, STANDALONE_COMPONENT_SLUGS, DEFAULT_RELATED_PRODUCTS } from './insightRecord';
import { insightsPosts } from '../insightsPostsData';

const BASE = {
  title: 'T', author: 'A', publishDate: '2026-01-01', category: 'C',
  readTime: 5, imageUrl: '/img.png', tags: ['x'],
};

describe('buildInsightRecord', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'rec-'));
    writeFileSync(join(dir, 'html-post.html'), '<p>from file</p>\n');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('fails closed: throws when no body is resolvable', () => {
    expect(() => buildInsightRecord({ ...BASE, slug: 'nope', content: '' }, dir))
      .toThrow(/No body for "nope"/);
  });

  it('carries full structured metadata (faqs, articleType, relatedProducts)', () => {
    const record = buildInsightRecord({
      ...BASE, slug: 'html-post', content: '',
      articleType: 'guide',
      faqs: [{ question: 'q1', answer: 'a1' }],
      relatedProducts: [{ href: '/p', label: 'P' }],
    }, dir);
    expect(record.content).toBe('<p>from file</p>');
    expect(record.articleType).toBe('guide');
    expect(JSON.parse(record.faqs!)).toHaveLength(1);
    expect(JSON.parse(record.relatedProducts)).toEqual([{ href: '/p', label: 'P' }]);
  });

  it('falls back to slug map then defaults for relatedProducts', () => {
    const record = buildInsightRecord({ ...BASE, slug: 'html-post', content: '<p>inline</p>' }, dir);
    expect(JSON.parse(record.relatedProducts)).toEqual(DEFAULT_RELATED_PRODUCTS);
    expect(record.faqs).toBeNull();
    expect(record.articleType).toBeNull();
  });

  it('applies heroImages and isStandaloneComponent from the slug maps', () => {
    const heroSlug = Object.keys(HERO_IMAGES_MAP)[0];
    const rec = buildInsightRecord({ ...BASE, slug: heroSlug, content: '<p>x</p>' }, dir);
    expect(JSON.parse(rec.heroImages!)).toEqual(HERO_IMAGES_MAP[heroSlug]);
    const standaloneSlug = [...STANDALONE_COMPONENT_SLUGS][0];
    const rec2 = buildInsightRecord({ ...BASE, slug: standaloneSlug, content: '<p>x</p>' }, dir);
    expect(rec2.isStandaloneComponent).toBe(true);
  });
});

describe('metadata parity across the real data file', () => {
  it('every insightsPostsData entry builds a complete record (no stub is possible)', () => {
    for (const post of insightsPosts) {
      const record = buildInsightRecord(post);
      expect(record.content, post.slug).toBeTruthy();
      expect(record.content!.length, post.slug).toBeGreaterThan(1000);
      // structured metadata must round-trip, not be dropped
      if (post.faqs) expect(JSON.parse(record.faqs!)).toHaveLength(post.faqs.length);
      if (post.articleType) expect(record.articleType).toBe(post.articleType);
      expect(record.relatedProducts, post.slug).toBeTruthy();
    }
  });

  it('the #342 FAQ articles keep their JSON-LD source when seeded individually', () => {
    const hdp = buildInsightRecord(insightsPosts.find((p) => p.slug === 'hdp-cvd-in-depth-guide-practical-handbook')!);
    expect(JSON.parse(hdp.faqs!)).toHaveLength(5);
    const icp = buildInsightRecord(insightsPosts.find((p) => p.slug === 'understanding-differences-pe-rie-icp-rie-plasma-etching')!);
    expect(JSON.parse(icp.faqs!)).toHaveLength(6);
  });
});
