import React from 'react';
import { useAnalytics } from './GoogleAnalytics';

export const AnalyticsExample: React.FC = () => {
  const analytics = useAnalytics();

  const handleProductView = () => {
    analytics.trackProductView('product-123', 'Sample Product');
  };

  const handleDownload = () => {
    analytics.trackProductDownload('product-123', 'Sample Product');
  };

  const handleContactSubmit = () => {
    analytics.trackContactFormSubmit('product-123', 'Sample Product');
  };

  const handleSearch = () => {
    analytics.trackSearch('sample search term');
  };

  const handleCustomEvent = () => {
    analytics.trackCustomEvent('button_click', {
      button_name: 'example_button',
      page_location: 'homepage'
    });
  };

  return (
    <div className="analytics-example">
      <h3>Analytics Tracking Examples</h3>
      <div className="button-group">
        <button onClick={handleProductView}>
          Track Product View
        </button>
        <button onClick={handleDownload}>
          Track Download
        </button>
        <button onClick={handleContactSubmit}>
          Track Contact Form Submit
        </button>
        <button onClick={handleSearch}>
          Track Search
        </button>
        <button onClick={handleCustomEvent}>
          Track Custom Event
        </button>
      </div>
    </div>
  );
}; 