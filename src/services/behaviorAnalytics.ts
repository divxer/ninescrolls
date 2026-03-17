// Behavior Analytics Service
// Tracks user behavior signals for intent scoring

// --- Search Query Extraction from Referrer ---

// Different search engines use different query parameters
const SEARCH_QUERY_PARAMS: Record<string, string[]> = {
  'google.': ['q'],
  'bing.com': ['q'],
  'yahoo.': ['p'],
  'baidu.com': ['wd', 'word'],
  'yandex.': ['text'],
  'duckduckgo.com': ['q'],
  'ecosia.org': ['q'],
  'ask.com': ['q'],
  'naver.com': ['query'],
  'sogou.com': ['query'],
};

/**
 * Extract search query from a referrer URL if it contains query parameters.
 * Normally Google strips the query from the referrer (since 2011 HTTPS switch),
 * but some enterprise proxies (e.g. Menlo Security) leak the full referrer URL.
 */
export function extractSearchQuery(referrer: string | undefined): string | undefined {
  if (!referrer) return undefined;
  try {
    const url = new URL(referrer);
    const host = url.hostname.toLowerCase();
    for (const [domain, params] of Object.entries(SEARCH_QUERY_PARAMS)) {
      if (hostMatchesDomain(host, domain)) {
        for (const param of params) {
          const value = url.searchParams.get(param);
          if (value) return value;
        }
        return undefined;
      }
    }
  } catch { /* invalid URL */ }
  return undefined;
}

// --- Traffic Channel Classification ---

export type TrafficChannel =
  | 'paid_search'
  | 'organic_search'
  | 'ai_referral'
  | 'paid_social'
  | 'organic_social'
  | 'email'
  | 'referral'
  | 'direct';

const SEARCH_ENGINE_DOMAINS = [
  'google.', 'bing.com', 'yahoo.', 'baidu.com', 'yandex.',
  'duckduckgo.com', 'ecosia.org', 'ask.com', 'naver.com', 'sogou.com',
];

const AI_REFERRER_DOMAINS = [
  // Google AI
  'gemini.google.com',
  'aistudio.google.com',
  // OpenAI
  'chatgpt.com',
  'chat.openai.com',
  // Other AI platforms
  'perplexity.ai',
  'claude.ai',
  'copilot.microsoft.com',
  'you.com',
  'phind.com',
  'kimi.ai',
  'deepseek.com',
  'poe.com',
];

const SOCIAL_PLATFORM_DOMAINS = [
  'facebook.com', 'fb.com', 'instagram.com', 'twitter.com', 'x.com',
  'linkedin.com', 'youtube.com', 'reddit.com', 'pinterest.com',
  'tiktok.com', 'wechat.com', 'weibo.com', 't.co',
];

// Match domain pattern against a hostname precisely:
// e.g. hostMatchesDomain('www.t.co', 't.co') → true
//      hostMatchesDomain('www.thomasnet.com', 't.co') → false
//      hostMatchesDomain('news.google.com', 'google.') → true
function hostMatchesDomain(host: string, pattern: string): boolean {
  if (pattern.endsWith('.')) {
    // Prefix pattern (e.g. 'google.') — host contains pattern as a domain boundary
    // Match: host === 'google.com' or host includes '.google.'
    const base = pattern.slice(0, -1); // 'google'
    return host === base || host.startsWith(base + '.') || host.includes('.' + base + '.');
  }
  // Exact domain pattern (e.g. 't.co', 'facebook.com')
  return host === pattern || host.endsWith('.' + pattern);
}

export function classifyTrafficChannel(params: {
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmTerm?: string | null;
  referrer?: string;
  gclid?: string | null;
  msclkid?: string | null;
  gadSource?: string | null;
  gbraid?: string | null;
  wbraid?: string | null;
}): TrafficChannel {
  const { utmSource, utmMedium, utmCampaign, utmTerm, referrer, gclid, msclkid, gadSource, gbraid, wbraid } = params;
  const medium = (utmMedium || '').toLowerCase();
  const source = (utmSource || '').toLowerCase();

  // 1. Paid search: gclid/msclkid/gad_source/gbraid/wbraid present, or medium is cpc/ppc
  if (gclid || msclkid || gadSource || gbraid || wbraid || medium === 'cpc' || medium === 'ppc') {
    return 'paid_search';
  }

  // 2. Email
  if (medium === 'email' || source === 'email') {
    return 'email';
  }

  // Parse referrer hostname
  let referrerHost = '';
  if (referrer) {
    try { referrerHost = new URL(referrer).hostname.toLowerCase(); } catch { /* ignore */ }
  }

  // 3. AI referral (check before search engines — gemini.google.com would otherwise match 'google.')
  const isAIReferrer = AI_REFERRER_DOMAINS.some(d => hostMatchesDomain(referrerHost, d));
  if (isAIReferrer) {
    return 'ai_referral';
  }

  const isPaidMedium = medium.includes('paid') ||
    (utmCampaign || '').toLowerCase().includes('ads');
  const isSearchReferrer = SEARCH_ENGINE_DOMAINS.some(d => hostMatchesDomain(referrerHost, d));
  const isSocialReferrer = SOCIAL_PLATFORM_DOMAINS.some(d => hostMatchesDomain(referrerHost, d));

  // 3. Paid social
  if (isPaidMedium && (isSocialReferrer || SOCIAL_PLATFORM_DOMAINS.some(d => source.includes(d.split('.')[0])))) {
    return 'paid_social';
  }

  // 4. Organic social
  if (isSocialReferrer) {
    return 'organic_social';
  }

  // 5. Paid search (utm_term + search engine referrer):
  //    Google organic search stopped passing search queries to sites in 2011 (HTTPS).
  //    If utm_term is present with a search engine referrer, it's from paid ads.
  if (utmTerm && isSearchReferrer) {
    return 'paid_search';
  }

  // 6. Organic search
  if (isSearchReferrer) {
    return 'organic_search';
  }

  // 6. Referral (has referrer or UTM source)
  if (referrerHost || utmSource) {
    return 'referral';
  }

  // 7. Direct
  return 'direct';
}

// --- Behavior Signals ---

interface BehaviorSignal {
  event: string;
  timestamp: number;
  value?: number;
  metadata?: Record<string, unknown>;
}

interface BehaviorScore {
  productPagesViewed: number;      // 浏览的产品页数量
  highValuePagesViewed: number;    // 高价值页面（如 hy-20l）
  timeOnSite: number;              // 总停留时间（秒）
  pdfDownloads: number;            // PDF 下载次数
  returnVisits: number;            // 回访次数（14天内）
  isPaidTraffic: boolean;          // 是否来自付费广告（向后兼容）
  trafficChannel: TrafficChannel;  // 流量渠道分类
  formInteractions: number;        // 表单交互信号计数
  maxScrollDepth: number;          // 最高滚动里程碑 (0/25/50/75/100)
  behaviorScore: number;            // 综合行为得分 (0-1)
}

export type LifecycleStage = 'awareness' | 'interest' | 'consideration' | 'intent';

class BehaviorAnalyticsService {
  private static instance: BehaviorAnalyticsService;
  private behaviorSignals: BehaviorSignal[] = [];
  private readonly SESSION_DURATION = 14 * 24 * 60 * 60 * 1000; // 14 days (extended for decay)
  private readonly DAY_MS = 24 * 60 * 60 * 1000;
  private readonly STORAGE_KEY = 'ninescrolls_behavior_signals';

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): BehaviorAnalyticsService {
    if (!BehaviorAnalyticsService.instance) {
      BehaviorAnalyticsService.instance = new BehaviorAnalyticsService();
    }
    return BehaviorAnalyticsService.instance;
  }

  // Compute decay multiplier based on signal age
  // 0-3 days: 1.0, 3-7 days: 0.5, 7-14 days: 0.25, >14 days: 0
  private getDecayMultiplier(signalTimestamp: number, now: number): number {
    const ageDays = (now - signalTimestamp) / this.DAY_MS;
    if (ageDays < 3) return 1.0;
    if (ageDays < 7) return 0.5;
    if (ageDays < 14) return 0.25;
    return 0;
  }

  // Load behavior signals from localStorage
  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Filter out old signals (older than 14 days)
          const cutoff = Date.now() - this.SESSION_DURATION;
          this.behaviorSignals = parsed.filter((s: BehaviorSignal) => s.timestamp > cutoff);
          this.saveToStorage();
        }
      }
    } catch (error) {
      console.error('Error loading behavior signals:', error);
    }
  }

  // Save behavior signals to localStorage
  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.behaviorSignals));
      }
    } catch (error) {
      console.error('Error saving behavior signals:', error);
    }
  }

  // Track a behavior signal
  trackSignal(event: string, value?: number, metadata?: Record<string, unknown>) {
    const signal: BehaviorSignal = {
      event,
      timestamp: Date.now(),
      value,
      metadata
    };

    this.behaviorSignals.push(signal);
    
    // Clean up old signals
    const cutoff = Date.now() - this.SESSION_DURATION;
    this.behaviorSignals = this.behaviorSignals.filter(s => s.timestamp > cutoff);
    
    this.saveToStorage();
  }

  // Track product page view (deduplicated within 30s per product)
  trackProductView(productId: string, productName: string) {
    const recentCutoff = Date.now() - 30000;
    const alreadyTracked = this.behaviorSignals.some(
      s => s.event === 'product_view' && s.timestamp > recentCutoff &&
           (s.metadata as Record<string, unknown>)?.productId === productId
    );
    if (alreadyTracked) return;

    const isHighValue = productId.includes('hy-20l') ||
                        productId.includes('hy-20lrf') ||
                        productId.includes('compact-rie');

    this.trackSignal('product_view', isHighValue ? 1 : 0.5, {
      productId,
      productName,
      isHighValue
    });
  }

  // Track PDF download
  trackPDFDownload(productId?: string) {
    this.trackSignal('pdf_download', 1, { productId });
  }

  // Track time on page
  trackTimeOnPage(pagePath: string, seconds: number) {
    if (seconds > 5) {  // Track any meaningful visit (>5s filters bots/misclicks)
      this.trackSignal('time_on_page', seconds, { pagePath });
    }
  }

  // Track traffic source
  trackTrafficSource(source: string, medium: string, campaign?: string, trafficChannel?: TrafficChannel) {
    const channel = trafficChannel || 'direct';
    const isPaid = channel === 'paid_search' || channel === 'paid_social';

    this.trackSignal('traffic_source', isPaid ? 1 : 0, {
      source,
      medium,
      campaign,
      isPaid,
      trafficChannel: channel,
    });
  }

  // Track form field interaction (RFQ or contact form)
  // Deduplicates: only records if fieldsEngaged increased for same formType within 60s
  trackFormInteraction(formType: 'rfq' | 'contact', fieldsEngaged: number, totalFields: number) {
    const recentCutoff = Date.now() - 60000;
    const alreadyTracked = this.behaviorSignals.some(
      s => s.event === 'form_interaction' && s.timestamp > recentCutoff &&
           (s.metadata as Record<string, unknown>)?.formType === formType &&
           ((s.metadata as Record<string, unknown>)?.fieldsEngaged as number) >= fieldsEngaged
    );
    if (alreadyTracked) return;

    const fillRatio = totalFields > 0 ? fieldsEngaged / totalFields : 0;
    this.trackSignal('form_interaction', fillRatio, {
      formType,
      fieldsEngaged,
      totalFields,
    });
  }

  // Track form lifecycle: started (first field engagement)
  // Deduplicates per formType within the entire signal window
  trackFormStarted(formType: 'rfq' | 'contact') {
    const alreadyStarted = this.behaviorSignals.some(
      s => s.event === 'form_started' &&
           (s.metadata as Record<string, unknown>)?.formType === formType
    );
    if (alreadyStarted) return;
    this.trackSignal('form_started', 0, { formType });
  }

  // Track form lifecycle: completed (successful submission)
  trackFormCompleted(formType: 'rfq' | 'contact') {
    this.trackSignal('form_completed', 1, { formType });
  }

  // Track form lifecycle: abandoned (component unmount without completion)
  // Includes fieldsEngaged/totalFields for dropout analysis
  trackFormAbandoned(formType: 'rfq' | 'contact', fieldsEngaged: number, totalFields: number) {
    const wasStarted = this.behaviorSignals.some(
      s => s.event === 'form_started' &&
           (s.metadata as Record<string, unknown>)?.formType === formType
    );
    const wasCompleted = this.behaviorSignals.some(
      s => s.event === 'form_completed' &&
           (s.metadata as Record<string, unknown>)?.formType === formType
    );
    if (wasStarted && !wasCompleted) {
      const fillRatio = totalFields > 0 ? fieldsEngaged / totalFields : 0;
      this.trackSignal('form_abandoned', fillRatio, { formType, fieldsEngaged, totalFields });
    }
  }

  // Track content engagement (scroll depth milestones)
  // Only records at 25/50/75/100% thresholds, deduplicates per page+milestone
  trackContentEngagement(pagePath: string, scrollDepthPercent: number) {
    const milestone = Math.floor(scrollDepthPercent / 25) * 25;
    if (milestone < 25) return;

    const alreadyTracked = this.behaviorSignals.some(
      s => s.event === 'content_engagement' &&
           (s.metadata as Record<string, unknown>)?.pagePath === pagePath &&
           (s.value || 0) >= milestone
    );
    if (alreadyTracked) return;

    this.trackSignal('content_engagement', milestone, { pagePath });
  }

  // Calculate behavior score with decay mechanism
  calculateBehaviorScore(): BehaviorScore {
    const now = Date.now();
    const cutoff = now - this.SESSION_DURATION;
    const recentSignals = this.behaviorSignals.filter(s => s.timestamp > cutoff);

    // --- Categorize signals ---
    const productViews = recentSignals.filter(s => s.event === 'product_view');
    const highValueViews = productViews.filter(s => s.metadata?.isHighValue);
    const pdfDownloads = recentSignals.filter(s => s.event === 'pdf_download');
    const timeSignals = recentSignals.filter(s => s.event === 'time_on_page');
    const trafficSignals = recentSignals.filter(s => s.event === 'traffic_source');
    const formSignals = recentSignals.filter(s => s.event === 'form_interaction');
    const scrollSignals = recentSignals.filter(s => s.event === 'content_engagement');

    // --- Decay-weighted score calculation ---
    let behaviorScore = 0;

    // Product pages viewed (max +0.15) — decay-weighted count
    let decayedProductCount = 0;
    let decayedHighValueCount = 0;
    for (const s of productViews) {
      const decay = this.getDecayMultiplier(s.timestamp, now);
      decayedProductCount += decay;
      if (s.metadata?.isHighValue) decayedHighValueCount += decay;
    }
    if (decayedProductCount >= 2) {
      behaviorScore += 0.15;
    } else if (decayedProductCount >= 0.5) {
      behaviorScore += 0.05;
    }

    // High-value pages (max +0.2)
    if (decayedHighValueCount > 0) {
      behaviorScore += Math.min(0.2, decayedHighValueCount * 0.2);
    }

    // Time on site (max +0.1) — decay-weighted total seconds
    let decayedTime = 0;
    for (const s of timeSignals) {
      decayedTime += (s.value || 0) * this.getDecayMultiplier(s.timestamp, now);
    }
    if (decayedTime > 90) {
      behaviorScore += 0.1;
    } else if (decayedTime > 30) {
      behaviorScore += 0.05;
    }

    // PDF downloads (max +0.2) — decay-weighted count
    let decayedPdfCount = 0;
    for (const s of pdfDownloads) {
      decayedPdfCount += this.getDecayMultiplier(s.timestamp, now);
    }
    if (decayedPdfCount > 0) {
      behaviorScore += Math.min(0.2, decayedPdfCount * 0.1);
    }

    // Return visits (max +0.25) — no decay (unique days is the signal itself)
    const uniqueDays = new Set(
      recentSignals.map(s => new Date(s.timestamp).toDateString())
    ).size;
    const returnVisits = uniqueDays > 1 ? uniqueDays - 1 : 0;
    if (returnVisits > 0) {
      behaviorScore += Math.min(0.25, returnVisits * 0.1);
    }

    // Traffic intent bonus (max +0.1) — no decay (channel doesn't age)
    const trafficChannel = (trafficSignals[0]?.metadata?.trafficChannel as TrafficChannel) || 'direct';
    const isPaidTraffic = trafficChannel === 'paid_search' || trafficChannel === 'paid_social';
    if (isPaidTraffic || trafficChannel === 'organic_search' || trafficChannel === 'ai_referral') {
      behaviorScore += 0.1;
    }

    // Form interaction (max +0.2) — decay-weighted
    let decayedFormScore = 0;
    for (const s of formSignals) {
      const decay = this.getDecayMultiplier(s.timestamp, now);
      const fillRatio = s.value || 0;
      const formWeight = (s.metadata as Record<string, unknown>)?.formType === 'rfq' ? 0.2 : 0.15;
      decayedFormScore += decay * fillRatio * formWeight;
    }
    if (decayedFormScore > 0) {
      behaviorScore += Math.min(0.2, decayedFormScore);
    }

    // Content engagement / scroll depth (max +0.1) — decay-weighted, page-type weight
    let decayedScrollScore = 0;
    for (const s of scrollSignals) {
      const decay = this.getDecayMultiplier(s.timestamp, now);
      const depth = (s.value || 0) / 100;
      const pagePath = (s.metadata as Record<string, unknown>)?.pagePath as string || '';
      const pageWeight = pagePath.startsWith('/products/') ? 0.06 : 0.04;
      decayedScrollScore += decay * depth * pageWeight;
    }
    if (decayedScrollScore > 0) {
      behaviorScore += Math.min(0.1, decayedScrollScore);
    }

    // Combined engagement bonus: deep scroll + substantial time = active explorer
    const hasDeepScroll = scrollSignals.some(s => (s.value || 0) >= 50);
    const hasSubstantialTime = decayedTime >= 60;
    if (hasDeepScroll && hasSubstantialTime) {
      behaviorScore += 0.05;
    }

    // Cap at 1.0
    behaviorScore = Math.min(1.0, behaviorScore);

    // Raw time for dashboard display
    const totalTime = timeSignals.reduce((sum, s) => sum + (s.value || 0), 0);

    return {
      productPagesViewed: productViews.length,
      highValuePagesViewed: highValueViews.length,
      timeOnSite: totalTime,
      pdfDownloads: pdfDownloads.length,
      returnVisits,
      isPaidTraffic,
      trafficChannel,
      formInteractions: formSignals.length,
      maxScrollDepth: scrollSignals.length > 0
        ? Math.max(...scrollSignals.map(s => s.value || 0))
        : 0,
      behaviorScore,
    };
  }

  // Compute customer lifecycle stage from behavior signals
  computeLifecycleStage(): LifecycleStage {
    const now = Date.now();
    const cutoff = now - this.SESSION_DURATION;
    const signals = this.behaviorSignals.filter(s => s.timestamp > cutoff);

    // Stage 4: Intent — RFQ form with high fill ratio OR any form completed
    const hasRfqIntent = signals.some(s =>
      s.event === 'form_interaction' &&
      (s.metadata as Record<string, unknown>)?.formType === 'rfq' &&
      (s.value || 0) >= 0.7
    );
    const hasFormCompleted = signals.some(s => s.event === 'form_completed');
    if (hasRfqIntent || hasFormCompleted) return 'intent';

    // Stage 3: Consideration — PDF download or form interaction
    const hasPdf = signals.some(s => s.event === 'pdf_download');
    const hasFormEngagement = signals.some(s => s.event === 'form_interaction');
    if (hasPdf || hasFormEngagement) return 'consideration';

    // Stage 2: Interest — return visit or product page view
    const uniqueDays = new Set(signals.map(s => new Date(s.timestamp).toDateString())).size;
    const hasProductView = signals.some(s => s.event === 'product_view');
    if (uniqueDays > 1 || hasProductView) return 'interest';

    // Stage 1: Awareness — default
    return 'awareness';
  }

  // Get all behavior signals (for debugging)
  getSignals(): BehaviorSignal[] {
    return [...this.behaviorSignals];
  }

  // Reset all signals
  reset() {
    this.behaviorSignals = [];
    this.saveToStorage();
  }
}

export const behaviorAnalytics = BehaviorAnalyticsService.getInstance();
export type { BehaviorSignal, BehaviorScore };
