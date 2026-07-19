/**
 * Last line of defense: OEM brand names and internal model/series strings that
 * must NEVER appear in an anonymous-facing Evidence payload. Extend as new
 * models are catalogued. Matching is case-insensitive substring — the brand
 * token also catches OEM-identifying slugs (e.g. "pub-tailong-…").
 */
export const BANNED_OEM_TOKENS: string[] = [
  // brand / legal names + abbreviations — Tailong platform (etch/depo/sputter)
  'Tailong', '泰龙', '中科泰龙', 'Zhongke Tailong', 'Beijing Zhongke Tailong',
  'Nano-Promiso', 'Shanghai Peiyuan', '芯微诺达', 'Anxing Tailong',
  // brand / legal names — PLUTOVAC platform (plasma cleaners; OEM = 上海沛沅).
  // NOTE: only the OEM BRAND is banned. The PLUTO-T/F/M/30 model strings are NOT
  // banned — they are NineScrolls's own public product names (URLs /products/pluto-*,
  // page titles "PLUTO-F …"), and are used as public per-model Evidence product
  // slugs. The OEM link (PLUTOVAC/Peiyuan) is what must never appear.
  'PLUTOVAC', 'Peiyuan', '沛沅', '上海沛沅',
  // internal model / series strings — Tailong
  'ICP-100A', 'ICP-100', 'ICP-200', 'ICP-S-150', 'ICP-M-100', 'ICP-PECVD-150',
  'ICP-I', 'ICP-RIE', 'RIE-100M', 'RIE-150A', 'RIE-150', 'RIE-100',
  'STRIPER-100', 'PECVD-150LL', 'Sputter 100', 'HighThroughput100-6A',
];

export function findBannedTokens(text: string): string[] {
  const lower = text.toLowerCase();
  return BANNED_OEM_TOKENS.filter((token) => lower.includes(token.toLowerCase()));
}
