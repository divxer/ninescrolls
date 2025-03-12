import { useEffect } from 'react';
import '../../styles/Chat.css';

declare global {
  interface Window {
    Tawk_API?: {
      onLoad: (callback: () => void) => void;
      setAttributes: (attributes: Record<string, string>, callback?: (error: any) => void) => void;
      addEvent: (name: string, value: string, callback?: (error: any) => void) => void;
      customize: (config: {
        position?: string;
        offsetVertical?: string;
        offsetHorizontal?: string;
        height?: string;
        zIndex?: number;
      }) => void;
    };
    Tawk_LoadStart?: Date;
  }
}

export function Chat() {
  useEffect(() => {
    const propertyId = import.meta.env.VITE_TAWK_PROPERTY_ID;
    const widgetId = import.meta.env.VITE_TAWK_WIDGET_ID;

    // Validate Tawk.to configuration
    if (!propertyId || !widgetId) {
      console.error('Tawk.to Property ID or Widget ID is not configured. Please check your environment variables.');
      return;
    }

    // Initialize Tawk.to
    const w = window as any;
    w.Tawk_API = w.Tawk_API || {};
    w.Tawk_LoadStart = new Date();

    // Load Tawk.to script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    script.setAttribute('crossorigin', '*');
    document.head.appendChild(script);

    // Configure Tawk.to
    w.Tawk_API.onLoad = function() {
      // Set visitor information
      w.Tawk_API.setAttributes({
        'name': 'Visitor',
        'email': '',  // We'll let visitors provide their own email
        'hash': ''  // Add hash if you want to use secure mode
      }, function(error: any) {
        if (error) {
          console.error('Error setting Tawk.to attributes:', error);
        }
      });

      // Set custom variables
      w.Tawk_API.addEvent('website', 'ninescrolls.us', function(error: any) {
        if (error) {
          console.error('Error setting Tawk.to custom variable:', error);
        }
      });

      // Position the widget to avoid overlap
      w.Tawk_API.customize({
        position: 'right',
        offsetVertical: '120px',
        offsetHorizontal: '20px',
        height: '500px',
        zIndex: 1000
      });
    };

    // Cleanup function
    return () => {
      const tawkScript = document.querySelector('script[src^="https://embed.tawk.to/"]');
      if (tawkScript) {
        tawkScript.remove();
      }
      delete w.Tawk_API;
      delete w.Tawk_LoadStart;
    };
  }, []);

  return null;
} 