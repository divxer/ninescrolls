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
  [key: string]: any;
}

// Google Analytics 4 Configuration
const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-XXXXXXXXXX';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
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
    
    if (typeof window !== 'undefined') {
      // Load Google Analytics script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);

      // Initialize gtag
      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', GA_MEASUREMENT_ID, {
        page_title: document.title,
        page_location: window.location.href,
        send_page_view: false // We'll handle page views manually
      });
    }
    
    this.isInitialized = true;
    console.log('Google Analytics 4 initialized');
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
    this.trackEvent({
      category: 'Navigation',
      action: 'View',
      label: title,
      path
    });

    // GA4 page view tracking
    if (typeof window !== 'undefined' && window.gtag) {
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
  identifyUser(userId: string, traits?: any) {
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
  trackCustomEvent(eventName: string, parameters?: Record<string, any>) {
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