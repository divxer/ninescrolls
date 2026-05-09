import { describe, it, expect } from 'vitest';
import {
  addDaysISO,
  daysUntilExpiry,
  isQuoteExpired,
  quoteExpiryStatus,
} from './orderHelpers';
import type { Order } from '../types/admin';

const TODAY = '2026-05-09';

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    orderId: 'o1',
    status: 'QUOTE_SENT',
    institution: 'Test U',
    productModel: 'ICP',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    createdBy: 'admin',
    feedbackScheduleCreated: false,
    feedbackCount: 0,
    daysSinceLastUpdate: 0,
    source: 'MANUAL',
    ...overrides,
  };
}

describe('addDaysISO', () => {
  it('adds positive days across month boundary', () => {
    expect(addDaysISO('2026-04-30', 5)).toBe('2026-05-05');
  });
  it('handles 30-day default for quotes', () => {
    expect(addDaysISO('2026-05-09', 30)).toBe('2026-06-08');
  });
  it('returns empty string for empty input', () => {
    expect(addDaysISO('', 30)).toBe('');
  });
});

describe('daysUntilExpiry', () => {
  it('returns positive count for future date', () => {
    expect(daysUntilExpiry('2026-05-15', TODAY)).toBe(6);
  });
  it('returns 0 for today', () => {
    expect(daysUntilExpiry(TODAY, TODAY)).toBe(0);
  });
  it('returns negative count for past date', () => {
    expect(daysUntilExpiry('2026-05-04', TODAY)).toBe(-5);
  });
  it('returns null for missing date', () => {
    expect(daysUntilExpiry(null, TODAY)).toBeNull();
    expect(daysUntilExpiry(undefined, TODAY)).toBeNull();
  });
});

describe('isQuoteExpired', () => {
  it('is true for QUOTE_SENT with past validUntil', () => {
    const order = makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-01' });
    expect(isQuoteExpired(order, TODAY)).toBe(true);
  });
  it('is false for QUOTE_SENT with future validUntil', () => {
    const order = makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-06-01' });
    expect(isQuoteExpired(order, TODAY)).toBe(false);
  });
  it('is false for non-QUOTE_SENT status even if past', () => {
    const order = makeOrder({ status: 'PO_RECEIVED', quoteValidUntil: '2026-05-01' });
    expect(isQuoteExpired(order, TODAY)).toBe(false);
  });
  it('is false when quoteValidUntil is null', () => {
    const order = makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: null });
    expect(isQuoteExpired(order, TODAY)).toBe(false);
  });
  it('is false when quoteValidUntil equals today (not yet expired)', () => {
    const order = makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: TODAY });
    expect(isQuoteExpired(order, TODAY)).toBe(false);
  });
});

describe('quoteExpiryStatus', () => {
  it('returns "expired" for past date on QUOTE_SENT', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-01' }), TODAY),
    ).toBe('expired');
  });
  it('returns "soon" within 7 days', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-15' }), TODAY),
    ).toBe('soon');
  });
  it('returns "soon" exactly at 7 days', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-16' }), TODAY),
    ).toBe('soon');
  });
  it('returns "ok" beyond 7 days', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: '2026-05-17' }), TODAY),
    ).toBe('ok');
  });
  it('returns "none" when validUntil missing', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'QUOTE_SENT', quoteValidUntil: null }), TODAY),
    ).toBe('none');
  });
  it('returns "none" when status is not QUOTE_SENT', () => {
    expect(
      quoteExpiryStatus(makeOrder({ status: 'INQUIRY', quoteValidUntil: '2026-05-01' }), TODAY),
    ).toBe('none');
  });
});
