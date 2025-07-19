# Segment Analytics Integration

This document explains how to use the Segment analytics integration in the NineScrolls website.

## Overview

The website now supports both Google Analytics 4 and Segment analytics simultaneously. This provides flexibility in data collection and analysis.

## Setup

### Environment Variables

Add the following environment variable to your `.env` file:

```env
VITE_SEGMENT_WRITE_KEY=WMoEScvR6dgChGx0LQUz0wQhgXK4nAHU
```

### Components

The Segment integration consists of several components:

1. **SegmentAnalytics Component** (`src/components/analytics/SegmentAnalytics.tsx`)
   - Loads the Segment script
   - Tracks page views automatically
   - Provides the `useSegmentAnalytics` hook

2. **Segment Analytics Service** (`src/services/segmentAnalytics.ts`)
   - Provides a service layer for Segment tracking
   - Includes product-specific tracking methods

3. **Combined Analytics Hook** (`src/hooks/useCombinedAnalytics.ts`)
   - Provides a unified interface for both GA and Segment
   - Allows tracking to both platforms simultaneously

## Usage

### Basic Usage

```tsx
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';

const MyComponent = () => {
  const analytics = useCombinedAnalytics();

  const handleButtonClick = () => {
    // This will send to both Google Analytics and Segment
    analytics.trackProductView('product-id', 'Product Name');
  };

  return <button onClick={handleButtonClick}>View Product</button>;
};
```

### Segment-Specific Usage

```tsx
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';

const MyComponent = () => {
  const analytics = useCombinedAnalytics();

  const handleSegmentEvent = () => {
    // This will only send to Segment
    analytics.segment.track('Custom Event', {
      property1: 'value1',
      property2: 'value2'
    });
  };

  return <button onClick={handleSegmentEvent}>Track Segment Event</button>;
};
```

### Google Analytics-Specific Usage

```tsx
import { useCombinedAnalytics } from '../hooks/useCombinedAnalytics';

const MyComponent = () => {
  const analytics = useCombinedAnalytics();

  const handleGAEvent = () => {
    // This will only send to Google Analytics
    analytics.googleAnalytics.trackEvent('Category', 'Action', 'Label');
  };

  return <button onClick={handleGAEvent}>Track GA Event</button>;
};
```

## Available Tracking Methods

### Combined Methods (Both GA and Segment)

- `trackEvent(category, action, label?, value?)`
- `trackProductView(productId, productName)`
- `trackProductDownload(productId, productName)`
- `trackContactFormSubmit(productId?, productName?)`
- `trackDatasheetDownload(productId, productName)`
- `trackSearch(searchTerm)`
- `identifyUser(userId, traits?)`
- `trackCustomEvent(eventName, parameters?)`

### Segment-Specific Methods

- `segment.track(event, properties?)`
- `segment.identify(userId, traits?)`
- `segment.page(name?, properties?)`
- `segment.group(groupId, traits?)`
- `segment.alias(userId, previousId?)`
- `segment.reset()`

### Google Analytics-Specific Methods

- `googleAnalytics.trackEvent(category, action, label?, value?)`
- `googleAnalytics.trackProductView(productId, productName)`
- `googleAnalytics.trackProductDownload(productId, productName)`
- `googleAnalytics.trackContactFormSubmit(productId?, productName?)`
- `googleAnalytics.trackDatasheetDownload(productId, productName)`
- `googleAnalytics.trackSearch(searchTerm)`
- `googleAnalytics.identifyUser(userId, traits?)`
- `googleAnalytics.trackCustomEvent(eventName, parameters?)`

## Testing

You can test the analytics integration by:

1. Opening the browser console
2. Navigating to different pages (page views are tracked automatically)
3. Using the analytics test page at `/analytics-test`
4. Checking that events appear in both Google Analytics and Segment dashboards

## Configuration

### Segment Write Key

The Segment write key is configured in the `SegmentAnalytics` component. You can override it by passing a `writeKey` prop:

```tsx
<SegmentAnalytics writeKey="your-custom-write-key" />
```

### Environment Variable

The write key can also be set via environment variable:

```env
VITE_SEGMENT_WRITE_KEY=your-segment-write-key
```

## Troubleshooting

### Segment Not Loading

1. Check that the write key is correct
2. Verify the environment variable is set
3. Check browser console for errors
4. Ensure the Segment script is not blocked by ad blockers

### Events Not Appearing

1. Check browser console for tracking logs
2. Verify that both GA and Segment are initialized
3. Check network tab for requests to Segment
4. Ensure events are being called correctly

### Console Errors

Common errors and solutions:

- `"Segment snippet included twice"` - The script is being loaded multiple times
- `"Analytics not initialized"` - The analytics service hasn't been initialized yet
- `"window.analytics is not defined"` - The Segment script hasn't loaded yet

## Best Practices

1. **Use Combined Methods**: For most tracking, use the combined methods to ensure data goes to both platforms
2. **Test in Development**: Always test analytics in development before deploying
3. **Check Console Logs**: The services log events to the console for debugging
4. **Use Descriptive Event Names**: Make event names clear and consistent
5. **Include Relevant Properties**: Add useful properties to events for better analysis

## Migration from Google Analytics Only

If you're migrating from Google Analytics only:

1. The existing `useAnalytics` hook still works
2. You can gradually migrate to `useCombinedAnalytics`
3. Both systems will work simultaneously
4. No breaking changes to existing code 