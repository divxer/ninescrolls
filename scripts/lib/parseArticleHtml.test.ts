import { describe, expect, it } from 'vitest';
import { parseArticleHtml } from './parseArticleHtml';

const FULL = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Head Title Should Lose To H1</title>
  <meta name="article:slug" content="explicit-canonical-slug">
  <meta name="article:excerpt" content="A short summary with an &amp; ampersand.">
  <meta name="article:category" content="Metrology &amp; Testing">
  <meta name="article:tags" content="alpha, beta , gamma">
  <meta name="article:article-type" content="TechArticle">
  <meta name="article:image-url" content="/assets/images/insights/cover.png">
  <meta name="article:publish-date" content="2026-07-12">
  <meta name="article:author" content="NineScrolls Engineering">
  <script type="application/json" data-related-products>
  [
    { "href": "/a", "label": "Product A", "subtitle": "First" },
    { "href": "/b", "label": "Product B" }
  ]
  </script>
</head>
<body>
  <h1>Real Title From H1</h1>
  <h2>Table of Contents</h2>
  <ul><li><a href="#one">One</a></li></ul>
  <h2>One</h2>
  <p>Body paragraph.</p>
</body>
</html>`;

describe('parseArticleHtml', () => {
  it('extracts the title from <h1> in preference to <title>', () => {
    expect(parseArticleHtml(FULL).title).toBe('Real Title From H1');
  });

  it('falls back to <title> when there is no <h1>', () => {
    const html = '<html><head><title>Only Title</title></head><body><p>x</p></body></html>';
    expect(parseArticleHtml(html).title).toBe('Only Title');
  });

  it('extracts body content, stripping the first h1 and the hand-written TOC', () => {
    const { content } = parseArticleHtml(FULL);
    expect(content).toContain('<p>Body paragraph.</p>');
    expect(content).toContain('<h2>One</h2>');
    expect(content).not.toContain('Real Title From H1');
    expect(content).not.toMatch(/table of contents/i);
    expect(content).not.toContain('href="#one"');
  });

  it('uses the whole file as content when there is no <body>', () => {
    const html = '<div><p>no body wrapper</p></div>';
    expect(parseArticleHtml(html).content).toContain('<p>no body wrapper</p>');
  });

  it('reads the explicit slug meta', () => {
    expect(parseArticleHtml(FULL).slug).toBe('explicit-canonical-slug');
  });

  it('reads all article: meta tags and decodes entities', () => {
    const parsed = parseArticleHtml(FULL);
    expect(parsed.excerpt).toBe('A short summary with an & ampersand.');
    expect(parsed.category).toBe('Metrology & Testing');
    expect(parsed.articleType).toBe('TechArticle');
    expect(parsed.imageUrl).toBe('/assets/images/insights/cover.png');
    expect(parsed.publishDate).toBe('2026-07-12');
    expect(parsed.author).toBe('NineScrolls Engineering');
  });

  it('splits and trims the tags meta into an array', () => {
    expect(parseArticleHtml(FULL).tags).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('parses related products from the data-related-products JSON script', () => {
    const { relatedProducts } = parseArticleHtml(FULL);
    expect(relatedProducts).toEqual([
      { href: '/a', label: 'Product A', subtitle: 'First' },
      { href: '/b', label: 'Product B' },
    ]);
  });

  it('rejects an invalid publish-date (not YYYY-MM-DD)', () => {
    const html = FULL.replace('content="2026-07-12"', 'content="July 12, 2026"');
    expect(parseArticleHtml(html).publishDate).toBeUndefined();
  });

  it('drops related-product items missing href or label', () => {
    const html = FULL.replace(
      '{ "href": "/b", "label": "Product B" }',
      '{ "href": "/b" }'
    );
    expect(parseArticleHtml(html).relatedProducts).toEqual([
      { href: '/a', label: 'Product A', subtitle: 'First' },
    ]);
  });

  it('returns undefined related products when the JSON is malformed', () => {
    const html = FULL.replace(
      '{ "href": "/a", "label": "Product A", "subtitle": "First" },',
      '{ this is not json',
    );
    expect(parseArticleHtml(html).relatedProducts).toBeUndefined();
  });

  it('leaves optional metadata undefined when the tags are absent', () => {
    const html =
      '<html><head><title>Bare</title></head><body><p>content here</p></body></html>';
    const parsed = parseArticleHtml(html);
    expect(parsed.slug).toBeUndefined();
    expect(parsed.excerpt).toBeUndefined();
    expect(parsed.category).toBeUndefined();
    expect(parsed.tags).toBeUndefined();
    expect(parsed.articleType).toBeUndefined();
    expect(parsed.imageUrl).toBeUndefined();
    expect(parsed.publishDate).toBeUndefined();
    expect(parsed.author).toBeUndefined();
    expect(parsed.relatedProducts).toBeUndefined();
  });
});
