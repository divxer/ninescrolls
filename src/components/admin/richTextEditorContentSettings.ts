/**
 * The subset of the TinyMCE init options that determines what markup survives
 * an admin-editor load/save round-trip (schema, parser, and serializer
 * settings).
 *
 * Kept in a standalone module (no tinymce import) so that
 * RichTextEditor.contentRoundtrip.test.ts can exercise the exact production
 * settings against tinymce's Schema/DomParser/Serializer without the two
 * copies drifting apart.
 *
 * Investigation note (2026-07-18): an admin-editor save rewrites article
 * content cosmetically — pretty-printed indentation collapses, named entities
 * decode to literal characters (entity_encoding: 'raw'), void-element "/>"
 * slashes drop, and style attributes are reformatted — so the saved content
 * will not byte-match any repo revision of a standalone article. That is
 * expected. Responsive-image markup (<picture>/<source srcset media>) is NOT
 * stripped; the round-trip test guards that contract.
 */
export const RICH_TEXT_EDITOR_CONTENT_SETTINGS = {
  relative_urls: false,
  convert_urls: false,
  entity_encoding: 'raw' as const,
  valid_elements: '*[*]',
  extended_valid_elements: 'th[*],td[*],tr[*],thead[*],tbody[*],table[*]',
  forced_root_block: 'p' as const,
};
