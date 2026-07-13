import { CDN_BASE_URL } from '../config/imageConfig';

/**
 * Rewrite /assets/images/ paths inside article HTML to CDN URLs.
 * Only active when a CDN base is configured; otherwise returns content as-is.
 * Case-insensitive on the attribute name: stored article HTML uses standard
 * lowercase `srcset` (browsers prefer <source srcset> over the <img src>
 * fallback, so missing it would ship un-CDN'd URLs on the primary delivery
 * path).
 */
export function rewriteContentImages(html: string, cdnBase: string = CDN_BASE_URL): string {
  if (!cdnBase) return html;
  return html.replace(
    /((?:src|srcset)\s*=\s*")\/assets\/images\//gi,
    `$1${cdnBase}/`,
  );
}
