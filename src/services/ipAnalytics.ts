// IP Analytics Service
// Calls the backend /ip-lookup Lambda to get IP info and target customer analysis
// Server-side lookups avoid CORS restrictions and rate limits on third-party IP services

import outputs from '../../amplify_outputs.json';
import { classifyOrganization, type AIClassification } from './aiClassificationService';

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
  private aiClassification: AIClassification | null = null;
  private fetchPromise: Promise<void> | null = null;
  private aiPromise: Promise<void> | null = null;

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

        // Fire off AI classification in parallel (non-blocking)
        if (this.ipInfo?.org) {
          this.aiPromise = this.fetchAIClassification();
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

  /**
   * Fetch AI classification from the classify-org Lambda.
   * Updates this.analysis with AI-enhanced results when available.
   */
  private async fetchAIClassification(): Promise<void> {
    if (!this.ipInfo?.org) return;

    try {
      const result = await classifyOrganization(
        this.ipInfo.org,
        this.ipInfo.country,
        this.ipInfo.city,
        this.ipInfo.isp
      );

      if (result) {
        this.aiClassification = result;

        // Enrich the existing analysis with AI results if AI is more confident
        // Never override backend L0 rejects (confidence 0, isTargetCustomer false)
        const isL0Reject = this.analysis && this.analysis.confidence === 0 && !this.analysis.isTargetCustomer;
        if (this.analysis && !isL0Reject && result.confidence > this.analysis.confidence) {
          this.analysis = {
            ...this.analysis,
            isTargetCustomer: result.isTargetCustomer,
            organizationType: result.organizationType as TargetCustomerAnalysis['organizationType'],
            confidence: result.confidence,
            // Recompute lead tier based on AI confidence and target customer status
            leadTier: this.computeLeadTier(result.confidence, result.organizationType, result.isTargetCustomer),
            details: {
              ...this.analysis.details,
              orgType: result.organizationType,
              keywords: [result.reason],
            },
          };
        }
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('AI classification failed:', error);
      }
      // Silently fail — keyword-based analysis remains
    }
  }

  private computeLeadTier(confidence: number, orgType: string, isTargetCustomer?: boolean): 'A' | 'B' | 'C' | undefined {
    // Non-target customers should never get a lead tier
    if (isTargetCustomer === false) return undefined;
    const isResearchOrg = orgType === 'university' || orgType === 'research_institute';
    if (confidence >= 0.7 && isResearchOrg) return 'A';
    if (confidence >= 0.9) return 'A'; // Any org type with very high confidence
    if (confidence >= 0.5 && orgType !== 'unknown') return 'B';
    if (confidence >= 0.3) return 'C';
    return undefined;
  }

  // Get AI classification result (may be null if not yet completed)
  getAIClassification(): AIClassification | null {
    return this.aiClassification;
  }

  // Wait for AI classification to complete (with timeout)
  async waitForAIClassification(timeoutMs = 5000): Promise<AIClassification | null> {
    if (this.aiClassification) return this.aiClassification;
    if (!this.aiPromise) return null;

    try {
      await Promise.race([
        this.aiPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
      ]);
    } catch {
      // Timeout or error — return whatever we have
    }
    return this.aiClassification;
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
    this.aiClassification = null;
    this.fetchPromise = null;
    this.aiPromise = null;
  }
}

export const ipAnalytics = IPAnalyticsService.getInstance();
export type { IPInfo, TargetCustomerAnalysis, AIClassification };
