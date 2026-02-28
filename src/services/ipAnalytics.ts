// IP Analytics Service
// Calls the backend /ip-lookup Lambda to get IP info and target customer analysis
// Server-side lookups avoid CORS restrictions and rate limits on third-party IP services

import outputs from '../../amplify_outputs.json';

interface IPInfo {
  ip: string;
  country: string;
  region: string;
  city: string;
  org: string;
  isp: string;
  timezone: string;
  latitude?: number;
  longitude?: number;
  privacy?: {
    vpn?: boolean;
    proxy?: boolean;
    hosting?: boolean;
    tor?: boolean;
    relay?: boolean;
  };
  company?: {
    type?: string;
    domain?: string;
    name?: string;
  };
}

interface ConfidenceBreakdown {
  orgMatch: number;      // 组织关键词匹配得分
  geo: number;           // 地理位置得分
  ispPenalty: number;    // ISP/噪音惩罚（负数）
  whitelist: number;     // 白名单加成
  total: number;          // 总分
}

interface TargetCustomerAnalysis {
  isTargetCustomer: boolean;
  organizationType: 'university' | 'research_institute' | 'enterprise' | 'unknown';
  confidence: number;
  confidenceBreakdown?: ConfidenceBreakdown;  // 子评分详情
  leadTier?: 'A' | 'B' | 'C';  // 线索等级
  details: {
    orgName: string;
    orgType: string;
    location: string;
    keywords: string[];
  };
}

/**
 * Get API Gateway endpoint from Amplify outputs (same pattern as stripeService.ts)
 */
function getApiEndpoint(): string {
  if (outputs?.custom?.API?.['ninescrolls-api']?.endpoint) {
    return outputs.custom.API['ninescrolls-api'].endpoint.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://api.ninescrolls.com';
}

class IPAnalyticsService {
  private static instance: IPAnalyticsService;
  private ipInfo: IPInfo | null = null;
  private analysis: TargetCustomerAnalysis | null = null;
  private fetchPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): IPAnalyticsService {
    if (!IPAnalyticsService.instance) {
      IPAnalyticsService.instance = new IPAnalyticsService();
    }
    return IPAnalyticsService.instance;
  }

  /**
   * Fetch IP info and analysis from the backend Lambda in a single call.
   * Results are cached for the session lifetime.
   */
  private async fetchFromBackend(): Promise<void> {
    // Deduplicate concurrent calls
    if (this.fetchPromise) {
      return this.fetchPromise;
    }

    this.fetchPromise = (async () => {
      try {
        const apiEndpoint = getApiEndpoint();
        const response = await fetch(`${apiEndpoint}/ip-lookup`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!response.ok) {
          if (import.meta.env.DEV) {
            console.warn(`IP lookup API returned ${response.status}`);
          }
          return;
        }

        const data = await response.json();

        if (data.ipInfo) {
          this.ipInfo = data.ipInfo;
        }
        if (data.analysis) {
          this.analysis = data.analysis;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('IP lookup API error:', error);
        }
        // Silently fail - ipInfo and analysis remain null
      }
    })();

    try {
      await this.fetchPromise;
    } finally {
      // Allow retry on next call if this attempt failed
      if (!this.ipInfo) {
        this.fetchPromise = null;
      }
    }
  }

  // Get user IP address and geolocation information
  async getIPInfo(): Promise<IPInfo | null> {
    if (this.ipInfo) {
      return this.ipInfo;
    }

    await this.fetchFromBackend();
    return this.ipInfo;
  }

  // Analyze if it's a target customer
  async analyzeTargetCustomer(): Promise<TargetCustomerAnalysis> {
    if (this.analysis) {
      return this.analysis;
    }

    await this.fetchFromBackend();

    if (this.analysis) {
      return this.analysis;
    }

    // Fallback when backend is unreachable
    return {
      isTargetCustomer: false,
      organizationType: 'unknown',
      confidence: 0,
      details: {
        orgName: 'Unknown',
        orgType: 'Unknown',
        location: 'Unknown',
        keywords: []
      }
    };
  }

  // Get analysis result (synchronous, from cache)
  getAnalysis(): TargetCustomerAnalysis | null {
    return this.analysis;
  }

  // Reset analysis result
  reset(): void {
    this.ipInfo = null;
    this.analysis = null;
    this.fetchPromise = null;
  }
}

export const ipAnalytics = IPAnalyticsService.getInstance();
export type { IPInfo, TargetCustomerAnalysis };
