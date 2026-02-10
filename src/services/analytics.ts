// Analytics event types
export type EventCategory = 
  | 'Product'
  | 'Contact'
  | 'Navigation'
  | 'Download'
  | 'User';

export type EventAction = 
  | 'View'
  | 'Click'
  | 'Submit'
  | 'Download'
  | 'Search'
  | 'Scroll';

interface EventData {
  category: EventCategory;
  action: EventAction;
  label?: string;
  value?: number;
  [key: string]: unknown;
}

// Google Analytics 4 Configuration
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

class Analytics {
  private static instance: Analytics;
  private isInitialized: boolean = false;

  private constructor() {}

  static getInstance(): Analytics {
    if (!Analytics.instance) {
      Analytics.instance = new Analytics();
    }
    return Analytics.instance;
  }

  initialize() {
    if (this.isInitialized) return;
    
    // Check if measurement ID is valid
    if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') {
      console.warn('Google Analytics: Measurement ID not configured. Please set VITE_GA_MEASUREMENT_ID environment variable.');
      return;
    }
    
    if (typeof window !== 'undefined') {
      // 🔥 标准 GA4 初始化：先设置 dataLayer 和占位符 gtag 函数
      // 这样在脚本加载前，命令会被缓存到 dataLayer，脚本加载后会自动处理
      window.dataLayer = window.dataLayer || [];
      
      // 定义占位符 gtag 函数（只在不存在时设置，避免覆盖已存在的）
      if (!window.gtag) {
        window.gtag = function(...args: unknown[]) {
          window.dataLayer.push(args);
        };
      }
      
      // 先推送命令到 dataLayer（脚本加载后会自动处理）
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
        send_page_view: true
      });

      // Load Google Analytics script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      
      script.onerror = () => {
        console.error('❌ Failed to load Google Analytics script');
      };

      script.onload = () => {
        console.log('✅ GA4 script loaded successfully');
        console.log(`📊 dataLayer has ${window.dataLayer?.length || 0} commands queued`);
        
        // 脚本加载后，真正的 GA4 会处理 dataLayer 中的所有命令
        // 验证 gtag 是否被正确接管（真正的 GA4 gtag 函数会更复杂）
        if (window.gtag && typeof window.gtag === 'function') {
          const gtagSource = window.gtag.toString();
          // 如果 gtag 仍然是简单的 dataLayer.push，说明可能有问题
          // 但通常 GA4 脚本会保留这个函数，只是内部实现不同
          console.log('✅ GA4 initialization complete');
        }
      };

      document.head.appendChild(script);
      
      this.isInitialized = true;
      console.log(`📡 Loading Google Analytics 4 with ID: ${GA_MEASUREMENT_ID}`);
    }
  }

  trackEvent(data: EventData) {
    if (!this.isInitialized) {
      console.warn('Analytics not initialized');
      return;
    }

    // Log event data
    console.log('Analytics Event:', data);

    // Send to Google Analytics 4
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', data.action.toLowerCase(), {
        event_category: data.category,
        event_label: data.label,
        value: data.value,
        custom_parameter_1: data.category,
        custom_parameter_2: data.label,
        ...data
      });
    }
  }

  // Product events
  trackProductView(productId: string, productName: string) {
    this.trackEvent({
      category: 'Product',
      action: 'View',
      label: productName,
      productId
    });

    // GA4 specific product view event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'view_item', {
        currency: 'USD',
        value: 0,
        items: [{
          item_id: productId,
          item_name: productName,
          item_category: 'Product'
        }]
      });
    }
  }

  trackProductDownload(productId: string, productName: string) {
    this.trackEvent({
      category: 'Product',
      action: 'Download',
      label: productName,
      productId
    });

    // GA4 specific download event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'file_download', {
        file_name: productName,
        file_extension: 'pdf',
        item_id: productId
      });
    }
  }

  // Contact form events
  trackContactFormSubmit(productId?: string, productName?: string) {
    this.trackEvent({
      category: 'Contact',
      action: 'Submit',
      label: productName,
      productId
    });

    // GA4 specific form submit event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'form_submit', {
        form_name: 'contact_form',
        item_id: productId,
        item_name: productName
      });
    }
  }

  // Navigation events
  trackPageView(path: string, title: string) {
    if (!this.isInitialized) {
      console.warn('Analytics not initialized, skipping page view');
      return;
    }

    this.trackEvent({
      category: 'Navigation',
      action: 'View',
      label: title,
      path
    });

    // GA4 page view tracking - use config to update page info
    if (typeof window !== 'undefined' && window.gtag) {
      // Update config with new page info (this sends a page_view event)
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_title: title,
        page_location: window.location.href,
        page_path: path
      });
      
      // Also send explicit page_view event for better tracking
      window.gtag('event', 'page_view', {
        page_title: title,
        page_location: window.location.href,
        page_path: path
      });
    }
  }

  // Download events
  trackDatasheetDownload(productId: string, productName: string) {
    this.trackEvent({
      category: 'Download',
      action: 'Download',
      label: productName,
      productId,
      fileType: 'datasheet'
    });

    // GA4 specific file download event
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'file_download', {
        file_name: `${productName}_datasheet`,
        file_extension: 'pdf',
        item_id: productId,
        item_name: productName
      });
    }
  }

  // User identification
  identifyUser(userId: string, traits?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', GA_MEASUREMENT_ID, {
        user_id: userId,
        custom_map: {
          'user_properties': traits
        }
      });
    }
  }

  // Custom event tracking
  trackCustomEvent(eventName: string, parameters?: Record<string, unknown>) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', eventName, parameters);
    }
  }

  // E-commerce events
  trackAddToCart(productId: string, productName: string, value: number = 0) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'add_to_cart', {
        currency: 'USD',
        value: value,
        items: [{
          item_id: productId,
          item_name: productName,
          item_category: 'Product'
        }]
      });
    }
  }

  // Search events
  trackSearch(searchTerm: string) {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'search', {
        search_term: searchTerm
      });
    }
  }
}

export const analytics = Analytics.getInstance(); 
