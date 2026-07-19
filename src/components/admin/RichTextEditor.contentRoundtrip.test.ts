/**
 * Regression guard for the admin insights editor content pipeline.
 *
 * Background (2026-07-18 investigation): a published article's DDB content
 * matched no repo revision and the byte delta (~1092 chars) was suspected to
 * be a stripped responsive <picture> block. Reproduction against a real
 * TinyMCE instance showed the editor round-trip reproduced the DDB content
 * exactly (23103 chars) and the delta was ONLY cosmetic normalization
 * (indentation collapse, entity decoding, "/>"-removal, style reformatting) —
 * <picture>/<source srcset media> markup survives intact.
 *
 * This test locks that contract at the layer where stripping would happen:
 * tinymce's Schema + DomParser + Serializer configured with the exact
 * production settings from richTextEditorContentSettings.ts. If a TinyMCE
 * upgrade or a settings change ever starts dropping responsive-image markup
 * (the failure mode the delivery path's ADD_TAGS: ['picture','source'] in
 * InsightsPostPage.tsx exists to render), this fails.
 */
import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseArticleHtml } from '../../../scripts/lib/parseArticleHtml';
import { RICH_TEXT_EDITOR_CONTENT_SETTINGS } from './richTextEditorContentSettings';

// tinymce's published typings don't expose the runtime `tinymce.html.*`
// factories, so describe just the surface this test uses.
interface TinyMceHtmlApi {
  html: {
    Schema: (settings: Record<string, unknown>) => unknown;
    DomParser: (
      settings: Record<string, unknown>,
      schema: unknown,
    ) => { parse: (html: string, args: Record<string, unknown>) => unknown };
    Serializer: (
      settings: Record<string, unknown>,
      schema: unknown,
    ) => { serialize: (node: unknown) => string };
  };
}

// tinymce touches window.matchMedia and CSS.escape at import/parse time;
// jsdom lacks matchMedia, so polyfill before the dynamic import below.
let tinymce: TinyMceHtmlApi;

beforeAll(async () => {
  if (!window.matchMedia) {
    (window as any).matchMedia = () => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    });
  }
  if (typeof CSS === 'undefined' || !CSS.escape) {
    (globalThis as any).CSS = {
      ...(globalThis as any).CSS,
      escape: (s: string) => s.replace(/([^a-zA-Z0-9_-])/g, '\\$1'),
    };
  }
  const mod = await import('tinymce/tinymce');
  tinymce = (mod.default ?? (window as any).tinymce) as unknown as TinyMceHtmlApi;
});

/** Parse + serialize with the production editor settings — the transformation
 *  an article's HTML undergoes between editor load and save. */
function editorRoundtrip(content: string): string {
  const settings = { validate: true, ...RICH_TEXT_EDITOR_CONTENT_SETTINGS };
  const schema = tinymce.html.Schema(settings);
  const parser = tinymce.html.DomParser(settings, schema);
  const node = parser.parse(content, { context: 'body', isRootContent: true, insert: false });
  const serializer = tinymce.html.Serializer(
    { entity_encoding: RICH_TEXT_EDITOR_CONTENT_SETTINGS.entity_encoding },
    schema,
  );
  // Mirror RichTextEditor's onEditorChange nbsp replacement.
  return serializer.serialize(node).replace(/\u00A0/g, ' ');
}

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

describe('admin editor round-trip preserves responsive-image markup', () => {
  it('keeps a minimal <picture> block with every source/srcset/media/type attribute', () => {
    const block =
      '<figure class="post-figure"><picture>' +
      '<source srcset="https://cdn.example.com/a-xl.webp" media="(min-width: 1280px)" type="image/webp" />' +
      '<source srcset="https://cdn.example.com/a-sm.webp" media="(max-width: 767px)" type="image/webp" />' +
      '<img src="https://cdn.example.com/a-lg.png" alt="alt text" loading="lazy" decoding="async" style="width:100%" />' +
      '</picture><figcaption>Caption</figcaption></figure>';

    const out = editorRoundtrip(block);

    expect(out).toContain('<picture>');
    expect(out).toContain('srcset="https://cdn.example.com/a-xl.webp"');
    expect(out).toContain('srcset="https://cdn.example.com/a-sm.webp"');
    expect(out).toContain('media="(min-width: 1280px)"');
    expect(out).toContain('media="(max-width: 767px)"');
    expect(count(out, /<source\b/g)).toBe(2);
    expect(count(out, /type="image\/webp"/g)).toBe(2);
    expect(out).toContain('src="https://cdn.example.com/a-lg.png"');
    expect(out).toContain('loading="lazy"');
    expect(out).toContain('decoding="async"');
    expect(out).toContain('<figcaption>Caption</figcaption>');
  });

  it('round-trips the probe-station article without dropping any element', () => {
    const html = readFileSync(
      'scripts/articles/probe-station-procurement-nsf-doe-funded-projects.html',
      'utf8',
    );
    const content = parseArticleHtml(html).content;
    const out = editorRoundtrip(content);

    // Responsive figure survives with all four breakpoint sources.
    expect(count(out, /<picture\b/g)).toBe(count(content, /<picture\b/g));
    expect(count(out, /<source\b/g)).toBe(count(content, /<source\b/g));
    expect(count(out, /\bsrcset="/g)).toBe(count(content, /\bsrcset="/g));
    expect(count(out, /<figure\b/g)).toBe(count(content, /<figure\b/g));
    expect(count(out, /<img\b/g)).toBe(count(content, /<img\b/g));

    // No element type disappears wholesale: the multiset of tag names in the
    // output matches the input (cosmetic whitespace/entity/style changes are
    // allowed; structural drops are not).
    const tagCounts = (s: string) => {
      const m = new Map<string, number>();
      for (const [, name] of s.matchAll(/<([a-z][a-z0-9]*)\b/g)) {
        m.set(name, (m.get(name) ?? 0) + 1);
      }
      return Object.fromEntries([...m.entries()].sort());
    };
    expect(tagCounts(out)).toEqual(tagCounts(content));
  });
});
