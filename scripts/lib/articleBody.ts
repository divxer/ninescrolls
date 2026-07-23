/**
 * Resolve an article's body for seeding.
 *
 * HTML-backed articles keep `content: ''` in insightsPostsData.ts and store their
 * body in scripts/articles/<slug>.html (the source of truth, synced to DDB via
 * update-insight-from-html.ts). Fresh-table seeds must load that file so a bulk
 * seed produces complete records, not metadata-only stubs.
 *
 * Cleaning mirrors update-insight-from-html.ts: extract <body> if a full document,
 * drop a leading <h1> (the page renders the title separately), drop a
 * "Table of Contents" block (the page auto-generates its own TOC).
 */
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export function cleanArticleHtml(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let cleaned = bodyMatch ? bodyMatch[1] : html;
  cleaned = cleaned.replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, '');
  cleaned = cleaned.replace(/<h2[^>]*>\s*Table of Contents\s*<\/h2>\s*<ul>[\s\S]*?<\/ul>/i, '');
  return cleaned.trim();
}

/**
 * Returns the article body to seed for `slug`:
 * - the inline content, when present;
 * - otherwise the cleaned scripts/articles/<slug>.html, when the file exists;
 * - otherwise null (caller decides whether that is an error).
 */
export function resolveArticleBody(
  slug: string,
  inlineContent: string | undefined | null,
  articlesDir: string = join(process.cwd(), 'scripts', 'articles'),
): { content: string | null; source: 'inline' | 'html-file' | 'none' } {
  if (inlineContent && inlineContent.trim()) {
    return { content: inlineContent, source: 'inline' };
  }
  const htmlPath = join(articlesDir, `${slug}.html`);
  if (existsSync(htmlPath)) {
    const cleaned = cleanArticleHtml(readFileSync(htmlPath, 'utf-8'));
    if (cleaned) return { content: cleaned, source: 'html-file' };
  }
  return { content: null, source: 'none' };
}
