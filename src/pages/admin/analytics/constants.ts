import type { DateRange } from './types';

export const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

export const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last7', label: 'Last 7 Days' },
  { value: 'last30', label: 'Last 30 Days' },
  { value: 'all', label: 'All Time' },
  { value: 'custom', label: 'Custom' },
];

export const SEARCH_ENGINE_NAMES: Record<string, string> = {
  'google.': 'Google',
  'bing.com': 'Bing',
  'yahoo.': 'Yahoo',
  'baidu.com': 'Baidu',
  'yandex.': 'Yandex',
  'duckduckgo.com': 'DuckDuckGo',
  'ecosia.org': 'Ecosia',
  'ask.com': 'Ask',
  'naver.com': 'Naver',
  'sogou.com': 'Sogou',
};

// Ordered list of known bot signatures. Multi-word entries (e.g. "Sogou web spider")
// must precede their single-word substrings so the longer match wins.
export const KNOWN_BOT_SIGNATURES = [
  // Search engines
  'Googlebot-Image', 'Googlebot-News', 'Googlebot-Video', 'Googlebot',
  'Storebot-Google', 'AdsBot-Google-Mobile', 'AdsBot-Google', 'Mediapartners-Google', 'GoogleOther',
  'bingbot', 'adidxbot', 'BingPreview', 'MicrosoftPreview',
  'Baiduspider-render', 'Baiduspider', 'YandexImages', 'YandexBot', 'DuckDuckBot', 'Slurp',
  'Sogou web spider', 'Sogou inst spider', 'Sogou Pic Spider', 'Sogou News Spider',
  'Yisouspider', 'Bytespider', 'PetalBot', 'Applebot', 'Amazonbot',
  // SEO / scrapers
  'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'BLEXBot',
  'DataForSeoBot', 'SerpstatBot', 'BarkrowlerBot', 'MegaIndex',
  'CCBot', 'archive.org_bot', 'ia_archiver',
  // AI / LLM crawlers
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', 'ClaudeBot', 'anthropic-ai', 'Claude-Web',
  'PerplexityBot', 'YouBot', 'cohere-ai', 'Diffbot',
  // Social previewers
  'facebookexternalhit', 'meta-externalagent', 'Twitterbot', 'LinkedInBot',
  'Pinterestbot', 'Discordbot', 'TelegramBot', 'WhatsApp', 'Slackbot',
  // Misc
  'SEBot-WA', 'SEBot',
];
