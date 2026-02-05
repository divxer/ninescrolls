// Segment Analytics Service
// This service provides a unified interface for tracking events with Segment

import { ipAnalytics, type IPInfo, type TargetCustomerAnalysis } from './ipAnalytics';
import { simpleIPAnalytics, type SimpleIPInfo, type SimpleTargetCustomerAnalysis } from './simpleIPAnalytics';
import { behaviorAnalytics } from './behaviorAnalytics';

type SegmentAnalyticsClient = {
  track: (event: string, properties?: Record<string, unknown>) => void;
  identify: (userId: string, traits?: Record<string, unknown>) => void;
  page: (name?: string, properties?: Record<string, unknown>) => void;
  group: (groupId: string, traits?: Record<string, unknown>) => void;
  alias: (userId: string, previousId?: string) => void;
  reset: () => void;
};

declare global {
  interface Window {
    analytics?: SegmentAnalyticsClient;
  }
}

class SegmentAnalyticsService {
  private static instance: SegmentAnalyticsService;
  private isInitialized: boolean = false;
  private lastTrackedEvents: Map<string, number> = new Map(); // Prevent duplicate sending
  private readonly DEBOUNCE_TIME = 1000; // 1 second debounce

  private constructor() {}

  static getInstance(): SegmentAnalyticsService {
    if (!SegmentAnalyticsService.instance) {
      SegmentAnalyticsService.instance = new SegmentAnalyticsService();
      SegmentAnalyticsService.instance.initialize();
    }
    return SegmentAnalyticsService.instance;
  }

  initialize() {
    if (this.isInitialized) return;
    
    // Check if Segment is already loaded
    if (typeof window !== 'undefined' && window.analytics) {
      this.isInitialized = true;
      console.log('Segment Analytics already initialized');
      return;
    }
    
    console.log('Segment Analytics service initialized');
    this.isInitialized = true;
  }

  // Track custom events with debouncing to prevent duplicates
  track(event: string, properties?: Record<string, unknown>) {
    if (!this.isInitialized) {
      console.warn('Segment Analytics not initialized');
      return;
    }

    // Create a unique key for this event
    const eventKey = `${event}_${JSON.stringify(properties || {})}`;
    const now = Date.now();
    const lastTracked = this.lastTrackedEvents.get(eventKey);

    // Check if this event was recently tracked
    if (lastTracked && (now - lastTracked) < this.DEBOUNCE_TIME) {
      console.log('Segment event debounced (duplicate):', event);
      return;
    }

    // Track the event
    if (typeof window !== 'undefined' && window.analytics && window.analytics.track) {
      window.analytics.track(event, properties);
      this.lastTrackedEvents.set(eventKey, now);
      console.log('Segment Track Event:', event, properties);
    }

    // Clean up old entries (older than 5 minutes)
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    for (const [key, timestamp] of this.lastTrackedEvents.entries()) {
      if (timestamp < fiveMinutesAgo) {
        this.lastTrackedEvents.delete(key);
      }
    }
  }

  // Identify users
  identify(userId: string, traits?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.identify) {
      window.analytics.identify(userId, traits);
      console.log('Segment Identify User:', userId, traits);
    }
  }

  // Track page views
  page(name?: string, properties?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
      window.analytics.page(name, properties);
      console.log('Segment Page View:', name, properties);
    }
  }

  // Track group events
  group(groupId: string, traits?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.group) {
      window.analytics.group(groupId, traits);
      console.log('Segment Group Event:', groupId, traits);
    }
  }

  // Alias users
  alias(userId: string, previousId?: string) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.alias) {
      window.analytics.alias(userId, previousId);
      console.log('Segment Alias User:', userId, previousId);
    }
  }

  // Reset user
  reset() {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.reset) {
      window.analytics.reset();
      console.log('Segment Reset User');
    }
  }

  // Product-specific tracking methods
  trackProductView(productId: string, productName: string) {
    this.track('Product Viewed', {
      productId,
      productName,
      category: 'Product'
    });
  }

  trackProductDownload(productId: string, productName: string) {
    // Track behavior signal for PDF download
    behaviorAnalytics.trackPDFDownload(productId);
    
    this.track('Product Downloaded', {
      productId,
      productName,
      category: 'Product',
      fileType: 'pdf'
    });
  }

  trackContactFormSubmit(productId?: string, productName?: string) {
    this.track('Contact Form Submitted', {
      productId,
      productName,
      formName: 'contact_form'
    });
  }

  trackDatasheetDownload(productId: string, productName: string) {
    this.track('Datasheet Downloaded', {
      productId,
      productName,
      fileType: 'datasheet',
      fileName: `${productName}_datasheet.pdf`
    });
  }

  trackSearch(searchTerm: string) {
    this.track('Search Performed', {
      searchTerm
    });
  }

  // E-commerce events
  trackAddToCart(productId: string, productName: string, value: number = 0) {
    this.track('Product Added to Cart', {
      productId,
      productName,
      value,
      currency: 'USD'
    });
  }

  trackPurchase(orderId: string, products: Array<{id: string, name: string, price: number}>, total: number) {
    this.track('Purchase Completed', {
      orderId,
      products,
      total,
      currency: 'USD'
    });
  }

  // IP Analytics and Target Customer Analysis
  async trackWithIPAnalysis(event: string, properties?: Record<string, unknown>) {
    try {
      // Get IP information and analysis results
      const ipInfo = await ipAnalytics.getIPInfo();
      const analysis = await ipAnalytics.analyzeTargetCustomer();
      
      // Get behavior score
      const behaviorScore = behaviorAnalytics.calculateBehaviorScore();
      
      // Calculate final confidence with smart weighting
      // For first-time visitors with high IP confidence, rely more on IP analysis
      // For returning visitors with behavior data, use balanced weighting
      let finalConfidence: number;
      
      if (analysis) {
        const isHighConfidenceIP = analysis.confidence >= 0.5;
        const isTargetOrgType = analysis.organizationType === 'university' || 
                                analysis.organizationType === 'research_institute' ||
                                analysis.organizationType === 'enterprise';
        const hasBehaviorData = behaviorScore.behaviorScore > 0;
        
        if (isHighConfidenceIP && isTargetOrgType && !hasBehaviorData) {
          // First-time visitor from high-confidence target organization
          // Use IP confidence directly (don't penalize for lack of behavior data)
          finalConfidence = analysis.confidence;
        } else if (hasBehaviorData) {
          // Returning visitor with behavior data - use balanced weighting
          finalConfidence = (analysis.confidence * 0.4) + (behaviorScore.behaviorScore * 0.6);
        } else {
          // Low IP confidence or unknown org - still use weighted average
          finalConfidence = (analysis.confidence * 0.4) + (behaviorScore.behaviorScore * 0.6);
        }
      } else {
        // No IP analysis - rely on behavior only
        finalConfidence = behaviorScore.behaviorScore;
      }
      
      // Determine final lead tier with behavior
      let finalLeadTier: 'A' | 'B' | 'C' | undefined = analysis?.leadTier;
      
      // Tier A: High confidence + University/Research Institute
      if (finalConfidence >= 0.7 && (analysis?.organizationType === 'university' || analysis?.organizationType === 'research_institute')) {
        finalLeadTier = 'A';
      } 
      // Tier A: Very high IP confidence (>= 0.9) for any target org type
      else if (analysis && analysis.confidence >= 0.9 && 
               (analysis.organizationType === 'university' || analysis.organizationType === 'research_institute' || analysis.organizationType === 'enterprise')) {
        finalLeadTier = 'A';
      }
      // Tier B: Medium-high confidence + any target org type
      else if (finalConfidence >= 0.5 && analysis && analysis.organizationType !== 'unknown') {
        finalLeadTier = 'B';
      } 
      // Tier C: Lower confidence but still target customer
      else if (finalConfidence >= 0.3) {
        finalLeadTier = 'C';
      }
      
      // Use dynamic threshold: lower for high-confidence IP analysis of target organizations
      const threshold = (analysis && analysis.confidence >= 0.5 && 
                        (analysis.organizationType === 'university' || 
                         analysis.organizationType === 'research_institute' || 
                         analysis.organizationType === 'enterprise'))
        ? 0.25  // Lower threshold for target organizations with high IP confidence
        : 0.3;  // Standard threshold
      
      const isTargetCustomer = finalConfidence > threshold;

      // Merge event properties
      const enhancedProperties = {
        ...properties,
        ipInfo: ipInfo ? {
          ip: ipInfo.ip,
          country: ipInfo.country,
          region: ipInfo.region,
          city: ipInfo.city,
          org: ipInfo.org,
          isp: ipInfo.isp,
          timezone: ipInfo.timezone,
          latitude: ipInfo.latitude,
          longitude: ipInfo.longitude,
          privacy: ipInfo.privacy,
          company: ipInfo.company
        } : null,
        targetCustomerAnalysis: analysis ? {
          isTargetCustomer,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          finalConfidence,
          leadTier: finalLeadTier,
          confidenceBreakdown: analysis.confidenceBreakdown,
          orgName: analysis.details.orgName,
          orgType: analysis.details.orgType,
          location: analysis.details.location,
          keywords: analysis.details.keywords
        } : null,
        behaviorScore: {
          productPagesViewed: behaviorScore.productPagesViewed,
          highValuePagesViewed: behaviorScore.highValuePagesViewed,
          timeOnSite: behaviorScore.timeOnSite,
          pdfDownloads: behaviorScore.pdfDownloads,
          returnVisits: behaviorScore.returnVisits,
          isPaidTraffic: behaviorScore.isPaidTraffic,
          behaviorScore: behaviorScore.behaviorScore
        }
      };

      // Send to Segment with enhanced properties
      this.track(event, enhancedProperties);

      // If it's a target customer, send additional event (not duplicate)
      if (isTargetCustomer) {
        this.track('Target Customer Detected', {
          // Event context
          originalEvent: event,
          timestamp: new Date().toISOString(),
          
          // Organization information
          organizationType: analysis?.organizationType || 'unknown',
          orgName: analysis?.details.orgName || 'Unknown',
          orgType: analysis?.details.orgType || 'Unknown',
          location: analysis?.details.location || 'Unknown',
          keywords: analysis?.details.keywords || [],
          
          // Confidence scores
          confidence: analysis?.confidence || 0,
          finalConfidence,
          confidenceBreakdown: analysis?.confidenceBreakdown,
          
          // Lead qualification
          leadTier: finalLeadTier || 'C',
          
          // Behavior signals
          behaviorScore: behaviorScore.behaviorScore,
          behaviorDetails: {
            productPagesViewed: behaviorScore.productPagesViewed,
            highValuePagesViewed: behaviorScore.highValuePagesViewed,
            timeOnSite: behaviorScore.timeOnSite,
            pdfDownloads: behaviorScore.pdfDownloads,
            returnVisits: behaviorScore.returnVisits,
            isPaidTraffic: behaviorScore.isPaidTraffic
          },
          
          // IP information (for sales team context)
          ipInfo: ipInfo ? {
            ip: ipInfo.ip,
            country: ipInfo.country,
            region: ipInfo.region,
            city: ipInfo.city,
            org: ipInfo.org,
            isp: ipInfo.isp,
            privacy: ipInfo.privacy,
            company: ipInfo.company
          } : null,
          
          // Page context
          pagePath: properties?.pathname || properties?.pagePath || 'unknown',
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          pageTitle: typeof window !== 'undefined' ? document.title : undefined
        });
      }

      console.log('Event tracked with IP analysis:', {
        event,
        ipInfo,
        analysis
      });

    } catch (error) {
      console.error('Error tracking with IP analysis:', error);
      // If IP analysis fails, send the original event without IP data
      if (properties) {
        this.track(event, properties);
      } else {
        this.track(event);
      }
    }
  }

  // Perform IP analysis on page view
  async trackPageViewWithAnalysis(pageName?: string, properties?: Record<string, unknown>) {
    try {
      // Get IP information and analysis results
      const ipInfo = await ipAnalytics.getIPInfo();
      const analysis = await ipAnalytics.analyzeTargetCustomer();
      
      // Get behavior score (includes timeOnSite)
      const behaviorScore = behaviorAnalytics.calculateBehaviorScore();
      
      // Calculate final confidence with smart weighting
      // For first-time visitors with high IP confidence, rely more on IP analysis
      // For returning visitors with behavior data, use balanced weighting
      let finalConfidence: number;
      
      if (analysis) {
        const isHighConfidenceIP = analysis.confidence >= 0.5;
        const isTargetOrgType = analysis.organizationType === 'university' || 
                                analysis.organizationType === 'research_institute' ||
                                analysis.organizationType === 'enterprise';
        const hasBehaviorData = behaviorScore.behaviorScore > 0;
        
        if (isHighConfidenceIP && isTargetOrgType && !hasBehaviorData) {
          // First-time visitor from high-confidence target organization
          // Use IP confidence directly (don't penalize for lack of behavior data)
          finalConfidence = analysis.confidence;
        } else if (hasBehaviorData) {
          // Returning visitor with behavior data - use balanced weighting
          finalConfidence = (analysis.confidence * 0.4) + (behaviorScore.behaviorScore * 0.6);
        } else {
          // Low IP confidence or unknown org - still use weighted average
          finalConfidence = (analysis.confidence * 0.4) + (behaviorScore.behaviorScore * 0.6);
        }
      } else {
        // No IP analysis - rely on behavior only
        finalConfidence = behaviorScore.behaviorScore;
      }
      
      // Determine final lead tier with behavior
      let finalLeadTier: 'A' | 'B' | 'C' | undefined = analysis?.leadTier;
      
      // Tier A: High confidence + University/Research Institute
      if (finalConfidence >= 0.7 && (analysis?.organizationType === 'university' || analysis?.organizationType === 'research_institute')) {
        finalLeadTier = 'A';
      } 
      // Tier A: Very high IP confidence (>= 0.9) for any target org type
      else if (analysis && analysis.confidence >= 0.9 && 
               (analysis.organizationType === 'university' || analysis.organizationType === 'research_institute' || analysis.organizationType === 'enterprise')) {
        finalLeadTier = 'A';
      }
      // Tier B: Medium-high confidence + any target org type
      else if (finalConfidence >= 0.5 && analysis && analysis.organizationType !== 'unknown') {
        finalLeadTier = 'B';
      } 
      // Tier C: Lower confidence but still target customer
      else if (finalConfidence >= 0.3) {
        finalLeadTier = 'C';
      }
      
      // Use dynamic threshold: lower for high-confidence IP analysis of target organizations
      const threshold = (analysis && analysis.confidence >= 0.5 && 
                        (analysis.organizationType === 'university' || 
                         analysis.organizationType === 'research_institute' || 
                         analysis.organizationType === 'enterprise'))
        ? 0.25  // Lower threshold for target organizations with high IP confidence
        : 0.3;  // Standard threshold
      
      const isTargetCustomer = finalConfidence > threshold;

      // Merge event properties with IP info and behavior
      const pathname = properties?.pathname || pageName || '';
      const enhancedProperties = {
        ...properties,
        path: pathname,  // Segment expects 'path' property
        pathname: pathname,
        search: properties?.search || '',
        hash: properties?.hash || '',
        title: typeof window !== 'undefined' ? document.title : '',
        url: typeof window !== 'undefined' ? window.location.href : '',
        ipInfo: ipInfo ? {
          ip: ipInfo.ip,
          country: ipInfo.country,
          region: ipInfo.region,
          city: ipInfo.city,
          org: ipInfo.org,
          isp: ipInfo.isp,
          timezone: ipInfo.timezone,
          latitude: ipInfo.latitude,
          longitude: ipInfo.longitude,
          privacy: ipInfo.privacy,
          company: ipInfo.company
        } : null,
        targetCustomerAnalysis: analysis ? {
          isTargetCustomer,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          finalConfidence,
          leadTier: finalLeadTier,
          confidenceBreakdown: analysis.confidenceBreakdown,
          orgName: analysis.details.orgName,
          orgType: analysis.details.orgType,
          location: analysis.details.location,
          keywords: analysis.details.keywords
        } : null,
        behaviorScore: {
          productPagesViewed: behaviorScore.productPagesViewed,
          highValuePagesViewed: behaviorScore.highValuePagesViewed,
          timeOnSite: behaviorScore.timeOnSite,  // 停留时间（秒）
          pdfDownloads: behaviorScore.pdfDownloads,
          returnVisits: behaviorScore.returnVisits,
          isPaidTraffic: behaviorScore.isPaidTraffic,
          behaviorScore: behaviorScore.behaviorScore
        }
      };

      // Send PAGE event with enhanced properties (instead of TRACK event)
      if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
        window.analytics.page(pageName, enhancedProperties);
        console.log('Segment Page View with IP + Behavior analysis:', enhancedProperties);
      }

      // If it's a target customer, send additional TRACK event with enhanced data
      if (isTargetCustomer) {
        this.track('Target Customer Detected', {
          // Event context
          originalEvent: 'Page Viewed',
          timestamp: new Date().toISOString(),
          
          // Organization information
          organizationType: analysis?.organizationType || 'unknown',
          orgName: analysis?.details.orgName || 'Unknown',
          orgType: analysis?.details.orgType || 'Unknown',
          location: analysis?.details.location || 'Unknown',
          keywords: analysis?.details.keywords || [],
          
          // Confidence scores
          confidence: analysis?.confidence || 0,
          finalConfidence,
          confidenceBreakdown: analysis?.confidenceBreakdown,
          
          // Lead qualification
          leadTier: finalLeadTier || 'C',
          
          // Behavior signals
          behaviorScore: behaviorScore.behaviorScore,
          behaviorDetails: {
            productPagesViewed: behaviorScore.productPagesViewed,
            highValuePagesViewed: behaviorScore.highValuePagesViewed,
            timeOnSite: behaviorScore.timeOnSite,
            pdfDownloads: behaviorScore.pdfDownloads,
            returnVisits: behaviorScore.returnVisits,
            isPaidTraffic: behaviorScore.isPaidTraffic
          },
          
          // IP information (for sales team context)
          ipInfo: ipInfo ? {
            ip: ipInfo.ip,
            country: ipInfo.country,
            region: ipInfo.region,
            city: ipInfo.city,
            org: ipInfo.org,
            isp: ipInfo.isp,
            privacy: ipInfo.privacy,
            company: ipInfo.company
          } : null,
          
          // Page context
          pagePath: properties?.pathname || pageName || 'unknown',
          pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
          pageTitle: typeof window !== 'undefined' ? document.title : undefined
        });
      }

    } catch (error) {
      console.error('Error tracking page view with IP analysis:', error);
      // If IP analysis fails, send the basic page event without IP data
      if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
        window.analytics.page(pageName, {
          ...properties,
          pathname: properties?.pathname || pageName,
          search: properties?.search || '',
          hash: properties?.hash || '',
          title: typeof window !== 'undefined' ? document.title : '',
          url: typeof window !== 'undefined' ? window.location.href : ''
        });
      }
    }
  }

  // Perform IP analysis on product view
  async trackProductViewWithAnalysis(productId: string, productName: string) {
    // Track behavior signal for product view
    behaviorAnalytics.trackProductView(productId, productName);
    
    await this.trackWithIPAnalysis('Product Viewed', {
      productId,
      productName,
      category: 'Product'
    });
  }

  // Perform IP analysis on contact form submission
  async trackContactFormSubmitWithAnalysis(productId?: string, productName?: string) {
    await this.trackWithIPAnalysis('Contact Form Submitted', {
      productId,
      productName,
      formName: 'contact_form'
    });
  }

  // Get current IP information
  async getCurrentIPInfo(): Promise<IPInfo | null> {
    return await ipAnalytics.getIPInfo();
  }

  // Get target customer analysis results
  async getTargetCustomerAnalysis(): Promise<TargetCustomerAnalysis | null> {
    return await ipAnalytics.analyzeTargetCustomer();
  }

  // Use simplified IP analysis service
  async trackWithSimpleIPAnalysis(event: string, properties?: Record<string, unknown>) {
    try {
      // Get simplified IP information and analysis results
      const ipInfo = await simpleIPAnalytics.getIPInfo();
      const analysis = await simpleIPAnalytics.analyzeTargetCustomer();

      // Merge event properties
      const enhancedProperties = {
        ...properties,
        simpleIPInfo: ipInfo ? {
          ip: ipInfo.ip,
          country: ipInfo.country,
          region: ipInfo.region,
          city: ipInfo.city,
          org: ipInfo.org,
          isp: ipInfo.isp
        } : null,
        simpleTargetCustomerAnalysis: analysis ? {
          isTargetCustomer: analysis.isTargetCustomer,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          orgName: analysis.details.orgName,
          orgType: analysis.details.orgType,
          location: analysis.details.location,
          keywords: analysis.details.keywords
        } : null
      };

      // Send to Segment with enhanced properties
      this.track(event, enhancedProperties);

      // If it's a target customer, send additional event (not duplicate)
      if (analysis && analysis.isTargetCustomer) {
        this.track('Simple Target Customer Detected', {
          originalEvent: event,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          leadTier: analysis.leadTier || 'C',
          orgName: analysis.details.orgName,
          location: analysis.details.location
        });
      }

      console.log('Event tracked with simple IP analysis:', {
        event,
        ipInfo,
        analysis
      });

    } catch (error) {
      console.error('Error tracking with simple IP analysis:', error);
      // If IP analysis fails, send the original event without IP data
      if (properties) {
        this.track(event, properties);
      } else {
        this.track(event);
      }
    }
  }

  // Get simplified IP information
  async getSimpleIPInfo(): Promise<SimpleIPInfo | null> {
    return await simpleIPAnalytics.getIPInfo();
  }

  // Get simplified target customer analysis results
  async getSimpleTargetCustomerAnalysis(): Promise<SimpleTargetCustomerAnalysis | null> {
    return await simpleIPAnalytics.analyzeTargetCustomer();
  }
}

export const segmentAnalytics = SegmentAnalyticsService.getInstance(); 
