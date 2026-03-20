// IP Analytics Service
// Calls the backend /geo Lambda to get IP info and org type classification.
// AI classification (classify-org Lambda) provides numeric confidence and refined org type.

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

interface TargetCustomerAnalysis {
  isTargetCustomer: boolean;
  organizationType: 'education' | 'business' | 'government' | 'isp' | 'hosting' | 'university' | 'research_institute' | 'enterprise' | 'hospital' | 'telecom_isp' | 'unknown';
  confidence: number;  // AI-sourced (0 if AI unavailable)
  leadTier?: 'A' | 'B' | 'C';
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
        const response = await fetch(`${apiEndpoint}/geo`, {
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
          // Lambda returns only organizationType + details (no confidence/isTargetCustomer).
          // Set defaults — AI classification will populate confidence and isTargetCustomer.
          this.analysis = {
            organizationType: data.analysis.organizationType || 'unknown',
            confidence: 0,
            isTargetCustomer: false,
            details: {
              orgName: data.analysis.details?.orgName || 'Unknown',
              orgType: data.analysis.details?.orgType || 'Unknown',
              location: data.analysis.details?.location || 'Unknown',
              keywords: [],
            },
          };
        }

        // Fire off AI classification only when IP org type is ambiguous.
        // Skip for: education/government (IP already reliable), hosting (almost always bots).
        // Call for: business (AI refines to enterprise/hospital), isp/unknown (AI identifies org).
        const needsAI = this.ipInfo?.org
          && ['business', 'isp', 'telecom_isp', 'unknown'].includes(this.analysis?.organizationType || 'unknown');
        if (needsAI) {
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
   * AI is the sole source of numeric confidence and target customer determination.
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

        // AI is the authority for confidence, org type, and target customer status
        if (this.analysis) {
          if (import.meta.env.DEV && result.isTargetCustomer) {
            console.info(`[IPAnalytics] AI classified ${this.ipInfo?.org}: ${result.organizationType} (${(result.confidence * 100).toFixed(0)}%)`);
          }
          this.analysis = {
            ...this.analysis,
            isTargetCustomer: result.isTargetCustomer,
            organizationType: result.organizationType as TargetCustomerAnalysis['organizationType'],
            confidence: result.confidence,
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
      // AI unavailable: confidence stays 0, isTargetCustomer stays false
      // organizationType from IP lookup is still available as categorical data
    }
  }

  private computeLeadTier(confidence: number, orgType: string, isTargetCustomer?: boolean): 'A' | 'B' | 'C' | undefined {
    if (isTargetCustomer === false) return undefined;
    // Confidence is a trust gate — do we believe this classification?
    // Tier A only comes from behavioral boost (applyBehavioralTierBoost).
    const isIdentifiedOrg = ['education', 'business', 'government', 'university', 'research_institute', 'enterprise', 'hospital'].includes(orgType);
    if (isIdentifiedOrg && confidence >= 0.5) return 'B';
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

  // Get cached IP info synchronously (for page_time_flush enrichment)
  getIPInfoSync(): IPInfo | null {
    return this.ipInfo;
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
