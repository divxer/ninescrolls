import React from 'react';
import { useCombinedAnalytics } from '../../hooks/useCombinedAnalytics';

export const AnalyticsExample: React.FC = () => {
  const analytics = useCombinedAnalytics();

  const handleProductView = () => {
    analytics.trackProductView('ald-system', 'ALD System');
  };

  const handleContactFormSubmit = () => {
    analytics.trackContactFormSubmit('ald-system', 'ALD System');
  };

  const handleDatasheetDownload = () => {
    analytics.trackDatasheetDownload('ald-system', 'ALD System');
  };

  const handleSearch = () => {
    analytics.trackSearch('semiconductor equipment');
  };

  const handleCustomEvent = () => {
    analytics.trackCustomEvent('button_click', {
      buttonName: 'example_button',
      page: 'analytics_test'
    });
  };

  const handleSegmentSpecific = () => {
    analytics.segment.track('Segment Specific Event', {
      customProperty: 'value',
      timestamp: new Date().toISOString()
    });
  };

  const handleGoogleAnalyticsSpecific = () => {
    analytics.googleAnalytics.trackEvent('Test', 'Click', 'GA Specific');
  };

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2>Analytics Testing Page</h2>
      <p>This page demonstrates how to use both Google Analytics and Segment analytics together.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button onClick={handleProductView} style={buttonStyle}>
          Track Product View (Both GA & Segment)
        </button>
        
        <button onClick={handleContactFormSubmit} style={buttonStyle}>
          Track Contact Form Submit (Both GA & Segment)
        </button>
        
        <button onClick={handleDatasheetDownload} style={buttonStyle}>
          Track Datasheet Download (Both GA & Segment)
        </button>
        
        <button onClick={handleSearch} style={buttonStyle}>
          Track Search (Both GA & Segment)
        </button>
        
        <button onClick={handleCustomEvent} style={buttonStyle}>
          Track Custom Event (Both GA & Segment)
        </button>
        
        <button onClick={handleSegmentSpecific} style={buttonStyle}>
          Track Segment-Specific Event
        </button>
        
        <button onClick={handleGoogleAnalyticsSpecific} style={buttonStyle}>
          Track GA-Specific Event
        </button>
      </div>
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '5px' }}>
        <h3>How it works:</h3>
        <ul>
          <li>Combined methods send events to both Google Analytics and Segment</li>
          <li>Segment-specific methods only send to Segment</li>
          <li>Google Analytics-specific methods only send to GA</li>
          <li>Check the browser console to see the events being sent</li>
        </ul>
      </div>
    </div>
  );
};

const buttonStyle = {
  padding: '10px 15px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '14px'
}; 