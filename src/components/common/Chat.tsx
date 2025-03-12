import { useEffect } from 'react';
import '../../styles/Chat.css';

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
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    // Load Tawk.to script
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    script.setAttribute('crossorigin', '*');
    document.head.appendChild(script);

    // Configure Tawk.to
    window.Tawk_API.onLoad = function() {
      // Set visitor information
      window.Tawk_API.setAttributes({
        'name': 'Visitor',
        'email': '',  // We'll let visitors provide their own email
        'hash': ''  // Add hash if you want to use secure mode
      }, function(error: any) {
        if (error) {
          console.error('Error setting Tawk.to attributes:', error);
        }
      });

      // Set custom variables
      window.Tawk_API.addEvent('website', 'ninescrolls.us', function(error: any) {
        if (error) {
          console.error('Error setting Tawk.to custom variable:', error);
        }
      });

      // Position the widget to avoid overlap
      window.Tawk_API.customize({
        position: 'right',
        offsetVertical: '120px',
        offsetHorizontal: '20px',
        height: '500px', // Adjust chat window height
        zIndex: 1000 // Ensure proper stacking
      });
    };

    // Cleanup function
    return () => {
      const tawkScript = document.querySelector('script[src^="https://embed.tawk.to/"]');
      if (tawkScript) {
        tawkScript.remove();
      }
      delete window.Tawk_API;
      delete window.Tawk_LoadStart;
    };
  }, []);

  return null;
} 