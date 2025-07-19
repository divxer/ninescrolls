// Segment Analytics Service
// This service provides a unified interface for tracking events with Segment

import { ipAnalytics, type IPInfo, type TargetCustomerAnalysis } from './ipAnalytics';

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
      // 获取IP信息和分析结果
      const ipInfo = await ipAnalytics.getIPInfo();
      const analysis = await ipAnalytics.analyzeTargetCustomer();

      // 合并事件属性
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

      // 发送到Segment
      this.track(event, enhancedProperties);

      // 如果是目标客户，发送特殊事件
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
      // 如果IP分析失败，仍然发送原始事件
      this.track(event, properties);
    }
  }

  // 页面浏览时进行IP分析
  async trackPageViewWithAnalysis(pageName?: string, properties?: Record<string, any>) {
    await this.trackWithIPAnalysis('Page Viewed', {
      pageName,
      pageUrl: typeof window !== 'undefined' ? window.location.href : '',
      pageTitle: typeof window !== 'undefined' ? document.title : '',
      ...properties
    });
  }

  // 产品浏览时进行IP分析
  async trackProductViewWithAnalysis(productId: string, productName: string) {
    await this.trackWithIPAnalysis('Product Viewed', {
      productId,
      productName,
      category: 'Product'
    });
  }

  // 联系表单提交时进行IP分析
  async trackContactFormSubmitWithAnalysis(productId?: string, productName?: string) {
    await this.trackWithIPAnalysis('Contact Form Submitted', {
      productId,
      productName,
      formName: 'contact_form'
    });
  }

  // 获取当前IP信息
  async getCurrentIPInfo(): Promise<IPInfo | null> {
    return await ipAnalytics.getIPInfo();
  }

  // 获取目标客户分析结果
  async getTargetCustomerAnalysis(): Promise<TargetCustomerAnalysis | null> {
    return await ipAnalytics.analyzeTargetCustomer();
  }
}

export const segmentAnalytics = SegmentAnalyticsService.getInstance(); 