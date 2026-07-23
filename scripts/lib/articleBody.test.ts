import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { cleanArticleHtml, resolveArticleBody } from './articleBody';

describe('cleanArticleHtml', () => {
  it('extracts <body> content from a full document', () => {
    expect(cleanArticleHtml('<html><head><title>x</title></head><body><p>hi</p></body></html>')).toBe('<p>hi</p>');
  });

  it('passes bare-body HTML through', () => {
    expect(cleanArticleHtml('<p>hi</p>')).toBe('<p>hi</p>');
  });

  it('drops a leading <h1> and a Table of Contents block', () => {
    const html = '<h1>Title</h1><h2>Table of Contents</h2><ul><li>a</li></ul><p>body</p>';
    expect(cleanArticleHtml(html)).toBe('<p>body</p>');
  });
});

describe('resolveArticleBody', () => {
  let dir: string;
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'articles-'));
    writeFileSync(join(dir, 'my-post.html'), '<h1>T</h1><p>file body</p>\n');
    writeFileSync(join(dir, 'empty-post.html'), '   \n');
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('prefers inline content when present', () => {
    expect(resolveArticleBody('my-post', '<p>inline</p>', dir)).toEqual({ content: '<p>inline</p>', source: 'inline' });
  });

  it('falls back to the cleaned HTML file when inline content is blank', () => {
    expect(resolveArticleBody('my-post', '', dir)).toEqual({ content: '<p>file body</p>', source: 'html-file' });
  });

  it('returns none when neither inline content nor a usable file exists', () => {
    expect(resolveArticleBody('missing-post', '', dir)).toEqual({ content: null, source: 'none' });
    expect(resolveArticleBody('empty-post', null, dir)).toEqual({ content: null, source: 'none' });
  });
});
