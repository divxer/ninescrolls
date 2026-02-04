import { useEffect } from 'react';
import '../../styles/Chat.css';

declare global {
  interface Window {
    Tawk_API?: TawkAPI;
    Tawk_LoadStart?: Date;
  }
}

type TawkAPI = {
  onLoad?: (callback: () => void) => void;
  setAttributes?: (attributes: Record<string, string>, callback?: (error: unknown) => void) => void;
  addEvent?: (name: string, value: string, callback?: (error: unknown) => void) => void;
  // customize method may not be available in all Tawk.to versions
  customize?: (config: {
    position?: string;
    offsetVertical?: string;
    offsetHorizontal?: string;
    height?: string;
    zIndex?: number;
  }) => void;
};

export function Chat() {
  useEffect(() => {
    const propertyId = import.meta.env.VITE_TAWK_PROPERTY_ID;
    const widgetId = import.meta.env.VITE_TAWK_WIDGET_ID;

    // Validate Tawk.to configuration
    if (!propertyId || !widgetId) {
      console.warn('Tawk.to Property ID or Widget ID is not configured. Chat widget will not load.');
      return;
    }

    // Initialize Tawk.to
    const w = window;
    const tawkApi: TawkAPI = w.Tawk_API ?? {};
    w.Tawk_API = tawkApi;
    w.Tawk_LoadStart = new Date();

    // Load Tawk.to script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    script.setAttribute('crossorigin', '*');
    document.head.appendChild(script);

    // Configure Tawk.to
    tawkApi.onLoad = function() {
      try {
        // Set visitor information - only set name, skip email to avoid INVALID_EMAIL error
        tawkApi.setAttributes?.({
          'name': 'Visitor'
          // Skip email and hash to avoid validation errors
        }, function(error: unknown) {
          if (error) {
            console.warn('Tawk.to attributes setting failed:', error);
          }
        });

        // Set custom variables - use a very simple event name
        tawkApi.addEvent?.('visit', 'ninescrolls', function(error: unknown) {
          if (error) {
            console.warn('Tawk.to custom variable setting failed:', error);
          }
        });

        // Position the widget to avoid overlap - only if customize method exists
        if (tawkApi.customize) {
          try {
            tawkApi.customize({
              position: 'right',
              offsetVertical: '120px',
              offsetHorizontal: '20px',
              height: '500px',
              zIndex: 1000
            });
          } catch (customizeError: unknown) {
            console.warn('Tawk.to customize failed:', customizeError);
          }
        }
      } catch (error: unknown) {
        console.warn('Tawk.to configuration failed:', error);
      }
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
