// Segment Analytics Service
// This service provides a unified interface for tracking events with Segment

import { ipAnalytics, type IPInfo, type TargetCustomerAnalysis } from './ipAnalytics';
import { simpleIPAnalytics, type SimpleIPInfo, type SimpleTargetCustomerAnalysis } from './simpleIPAnalytics';

declare global {
  interface Window {
    analytics: any;
  }
}

class SegmentAnalyticsService {
  private static instance: SegmentAnalyticsService;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): SegmentAnalyticsService {
    if (!SegmentAnalyticsService.instance) {
      SegmentAnalyticsService.instance = new SegmentAnalyticsService();
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

  // Track custom events
  track(event: string, properties?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.track) {
      window.analytics.track(event, properties);
      console.log('Segment Track Event:', event, properties);
    }
  }

  // Identify users
  identify(userId: string, traits?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.identify) {
      window.analytics.identify(userId, traits);
      console.log('Segment Identify User:', userId, traits);
    }
  }

  // Track page views
  page(name?: string, properties?: Record<string, any>) {
    if (typeof window !== 'undefined' && window.analytics && window.analytics.page) {
      window.analytics.page(name, properties);
      console.log('Segment Page View:', name, properties);
    }
  }

  // Track group events
  group(groupId: string, traits?: Record<string, any>) {
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
  async trackWithIPAnalysis(event: string, properties?: Record<string, any>) {
    try {
      // Get IP information and analysis results
      const ipInfo = await ipAnalytics.getIPInfo();
      const analysis = await ipAnalytics.analyzeTargetCustomer();

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
          longitude: ipInfo.longitude
        } : null,
        targetCustomerAnalysis: analysis ? {
          isTargetCustomer: analysis.isTargetCustomer,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          orgName: analysis.details.orgName,
          orgType: analysis.details.orgType,
          location: analysis.details.location,
          keywords: analysis.details.keywords
        } : null
      };

      // Send to Segment
      this.track(event, enhancedProperties);

      // If it's a target customer, send special event
      if (analysis && analysis.isTargetCustomer) {
        this.track('Target Customer Detected', {
          originalEvent: event,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
          orgName: analysis.details.orgName,
          location: analysis.details.location
        });
      }

      console.log('Event tracked with IP analysis:', {
        event,
        ipInfo,
        analysis
      });

    } catch (error) {
      console.error('Error tracking with IP analysis:', error);
      // If IP analysis fails, still send the original event
      this.track(event, properties);
    }
  }

  // Perform IP analysis on page view
  async trackPageViewWithAnalysis(pageName?: string, properties?: Record<string, any>) {
    await this.trackWithIPAnalysis('Page Viewed', {
      pageName,
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      pageTitle: typeof window !== 'undefined' ? document.title : '',
      ...properties
    });
  }

  // Perform IP analysis on product view
  async trackProductViewWithAnalysis(productId: string, productName: string) {
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
  async trackWithSimpleIPAnalysis(event: string, properties?: Record<string, any>) {
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

      // Send to Segment
      this.track(event, enhancedProperties);

      // If it's a target customer, send special event
      if (analysis && analysis.isTargetCustomer) {
        this.track('Simple Target Customer Detected', {
          originalEvent: event,
          organizationType: analysis.organizationType,
          confidence: analysis.confidence,
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
      // If IP analysis fails, still send the original event
      this.track(event, properties);
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