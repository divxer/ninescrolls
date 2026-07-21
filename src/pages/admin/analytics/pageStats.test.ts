import { describe, it, expect } from 'vitest';
import { aggregatePageStats, aggregateProductStats, aggregateLandingPages } from './pageStats';
import type { AnalyticsEvent } from './types';

const ev = (p: Record<string, unknown>): AnalyticsEvent =>
  ({ id: 'e', timestamp: '2026-01-01T00:00:00.000Z', ...p } as unknown as AnalyticsEvent);

describe('aggregatePageStats', () => {
  it('counts views, normalizes trailing slashes, and excludes /admin', () => {
    const stats = aggregatePageStats([
      ev({ eventType: 'page_view', pathname: '/products/', visitorId: 'v1' }),
      ev({ eventType: 'page_view', pathname: '/products', visitorId: 'v2' }),
      ev({ eventType: 'page_view', pathname: '/admin/analytics', visitorId: 'v3' }),
    ]);
    const products = stats.find(s => s.pathname === '/products');
    expect(products?.views).toBe(2);
    expect(products?.uniqueVisitors).toBe(2);
    expect(stats.find(s => s.pathname.startsWith('/admin'))).toBeUndefined();
  });

  it('sorts pages by descending views and flags product pages', () => {
    const stats = aggregatePageStats([
      ev({ eventType: 'page_view', pathname: '/products/hy-20l', visitorId: 'v1' }),
      ev({ eventType: 'page_view', pathname: '/about', visitorId: 'v2' }),
      ev({ eventType: 'page_view', pathname: '/about', visitorId: 'v3' }),
    ]);
    expect(stats[0].pathname).toBe('/about'); // 2 views > 1 view
    expect(stats.find(s => s.pathname === '/products/hy-20l')?.isProductPage).toBe(true);
  });
});

describe('aggregateProductStats', () => {
  it('matches PDF/contact counts to product pages by slug and computes conversion', () => {
    const pageStats = aggregatePageStats([
      ev({ eventType: 'page_view', pathname: '/products/hy-20l', visitorId: 'v1' }),
      ev({ eventType: 'page_view', pathname: '/products/hy-20l', visitorId: 'v2' }),
    ]);
    const products = aggregateProductStats(pageStats, [
      ev({ eventType: 'pdf_download', productName: 'HY-20L' }),
      ev({ eventType: 'contact_form', productName: 'HY 20L' }),
    ]);
    const hy = products.find(p => p.pathname === '/products/hy-20l');
    expect(hy?.pdfDownloads).toBe(1);
    expect(hy?.contactFormSubmits).toBe(1);
    expect(hy?.conversionRate).toBeCloseTo(1); // 2 conversions / 2 unique visitors
  });

  it('counts pdf_download events by pathname when productName is absent', () => {
    // Real DownloadGateModal events carry pathname but no productName (productName: null).
    const pageStats = aggregatePageStats([
      ev({ eventType: 'page_view', pathname: '/products/rie-etcher', visitorId: 'v1' }),
      ev({ eventType: 'page_view', pathname: '/products/rie-etcher', visitorId: 'v2' }),
    ]);
    const products = aggregateProductStats(pageStats, [
      ev({ eventType: 'pdf_download', pathname: '/products/rie-etcher', productName: null }),
      ev({ eventType: 'pdf_download', pathname: '/products/rie-etcher', productName: null }),
    ]);
    const rie = products.find(p => p.pathname === '/products/rie-etcher');
    expect(rie?.pdfDownloads).toBe(2);
    expect(rie?.conversionRate).toBeCloseTo(1); // 2 downloads / 2 unique visitors
  });

  it('does not double-count a download that has both a matching pathname and productName', () => {
    const pageStats = aggregatePageStats([
      ev({ eventType: 'page_view', pathname: '/products/hy-20l', visitorId: 'v1' }),
    ]);
    const products = aggregateProductStats(pageStats, [
      ev({ eventType: 'pdf_download', pathname: '/products/hy-20l', productName: 'HY-20L' }),
    ]);
    expect(products.find(p => p.pathname === '/products/hy-20l')?.pdfDownloads).toBe(1);
  });

  it('caps conversion rate at 100%', () => {
    const pageStats = aggregatePageStats([
      ev({ eventType: 'page_view', pathname: '/products/x', visitorId: 'v1' }),
    ]);
    const products = aggregateProductStats(pageStats, [
      ev({ eventType: 'pdf_download', productName: 'x' }),
      ev({ eventType: 'pdf_download', productName: 'x' }),
      ev({ eventType: 'pdf_download', productName: 'x' }),
    ]);
    expect(products[0].conversionRate).toBe(1);
  });
});

describe('aggregateLandingPages', () => {
  it('counts the first page of each session and marks single-page sessions as bounces', () => {
    const landings = aggregateLandingPages([
      // session v1: lands on /a, then /b → not a bounce
      ev({ eventType: 'page_view', pathname: '/a', visitorId: 'v1', sessionId: 's1', timestamp: '2026-01-01T00:00:01Z' }),
      ev({ eventType: 'page_view', pathname: '/b', visitorId: 'v1', sessionId: 's1', timestamp: '2026-01-01T00:00:02Z' }),
      // session v2: lands on /a only → bounce
      ev({ eventType: 'page_view', pathname: '/a', visitorId: 'v2', sessionId: 's2', timestamp: '2026-01-01T00:00:03Z' }),
    ]);
    const a = landings.find(l => l.pathname === '/a');
    expect(a?.landings).toBe(2);
    expect(a?.bounceRate).toBeCloseTo(0.5); // 1 of 2 sessions bounced
  });
});
