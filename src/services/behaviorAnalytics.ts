// Behavior Analytics Service
// Tracks user behavior signals for intent scoring

interface BehaviorSignal {
  event: string;
  timestamp: number;
  value?: number;
  metadata?: Record<string, any>;
}

interface BehaviorScore {
  productPagesViewed: number;      // 浏览的产品页数量
  highValuePagesViewed: number;    // 高价值页面（如 ns-plasma-20r）
  timeOnSite: number;              // 总停留时间（秒）
  pdfDownloads: number;            // PDF 下载次数
  returnVisits: number;            // 回访次数（7天内）
  isPaidTraffic: boolean;          // 是否来自付费广告
  behaviorScore: number;            // 综合行为得分 (0-1)
}

class BehaviorAnalyticsService {
  private static instance: BehaviorAnalyticsService;
  private behaviorSignals: BehaviorSignal[] = [];
  private readonly SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
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

  // Load behavior signals from localStorage
  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          // Filter out old signals (older than 7 days)
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
  trackSignal(event: string, value?: number, metadata?: Record<string, any>) {
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

  // Track product page view
  trackProductView(productId: string, productName: string) {
    const isHighValue = productId.includes('ns-plasma-20r') || 
                        productId.includes('ns-plasma-20r-i') ||
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
    if (seconds > 90) {  // Only track significant time
      this.trackSignal('time_on_page', seconds, { pagePath });
    }
  }

  // Track traffic source
  trackTrafficSource(source: string, medium: string, campaign?: string) {
    const isPaid = medium === 'cpc' || medium === 'paid' || 
                   (campaign && campaign.toLowerCase().includes('ads'));
    
    this.trackSignal('traffic_source', isPaid ? 1 : 0, {
      source,
      medium,
      campaign,
      isPaid
    });
  }

  // Calculate behavior score
  calculateBehaviorScore(): BehaviorScore {
    const cutoff = Date.now() - this.SESSION_DURATION;
    const recentSignals = this.behaviorSignals.filter(s => s.timestamp > cutoff);
    
    const productViews = recentSignals.filter(s => s.event === 'product_view');
    const highValueViews = productViews.filter(s => s.metadata?.isHighValue);
    const pdfDownloads = recentSignals.filter(s => s.event === 'pdf_download');
    const timeSignals = recentSignals.filter(s => s.event === 'time_on_page');
    const trafficSignals = recentSignals.filter(s => s.event === 'traffic_source');
    
    // Calculate total time on site
    const totalTime = timeSignals.reduce((sum, s) => sum + (s.value || 0), 0);
    
    // Check for return visits (multiple sessions)
    const uniqueDays = new Set(
      recentSignals.map(s => new Date(s.timestamp).toDateString())
    ).size;
    const returnVisits = uniqueDays > 1 ? uniqueDays - 1 : 0;
    
    // Check if paid traffic
    const isPaidTraffic = trafficSignals.some(s => s.metadata?.isPaid === true);
    
    // Calculate behavior score (weighted)
    let behaviorScore = 0;
    
    // Product pages viewed (max +0.15)
    if (productViews.length >= 2) {
      behaviorScore += 0.15;
    } else if (productViews.length === 1) {
      behaviorScore += 0.05;
    }
    
    // High-value pages (max +0.2)
    if (highValueViews.length > 0) {
      behaviorScore += 0.2;
    }
    
    // Time on site (max +0.1)
    if (totalTime > 90) {
      behaviorScore += 0.1;
    } else if (totalTime > 30) {
      behaviorScore += 0.05;
    }
    
    // PDF downloads (max +0.2)
    if (pdfDownloads.length > 0) {
      behaviorScore += Math.min(0.2, pdfDownloads.length * 0.1);
    }
    
    // Return visits (max +0.25)
    if (returnVisits > 0) {
      behaviorScore += Math.min(0.25, returnVisits * 0.1);
    }
    
    // Paid traffic bonus (max +0.1)
    if (isPaidTraffic) {
      behaviorScore += 0.1;
    }
    
    // Cap at 1.0
    behaviorScore = Math.min(1.0, behaviorScore);
    
    return {
      productPagesViewed: productViews.length,
      highValuePagesViewed: highValueViews.length,
      timeOnSite: totalTime,
      pdfDownloads: pdfDownloads.length,
      returnVisits,
      isPaidTraffic,
      behaviorScore
    };
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
