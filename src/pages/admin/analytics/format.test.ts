import { describe, it, expect } from 'vitest';
import {
  normalizePath, tierRank, tierColor, formatDuration,
  engagementLevel, engagementRank, getDateBounds, isPrivateIP, maskIP,
} from './format';

describe('normalizePath', () => {
  it('strips a trailing slash except for root', () => {
    expect(normalizePath('/products/')).toBe('/products');
    expect(normalizePath('/products')).toBe('/products');
    expect(normalizePath('/')).toBe('/');
  });
});

describe('tierRank / tierColor', () => {
  it('ranks A>B>C>null', () => {
    expect(tierRank('A')).toBe(3);
    expect(tierRank('B')).toBe(2);
    expect(tierRank('C')).toBe(1);
    expect(tierRank(null)).toBe(0);
    expect(tierRank('X')).toBe(0);
  });
  it('maps tiers to colors with a default', () => {
    expect(tierColor('A')).toBe('#2e7d32');
    expect(tierColor(null)).toBe('#90caf9');
  });
});

describe('formatDuration', () => {
  it('formats seconds, minutes, and hours', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(60)).toBe('1m');
    expect(formatDuration(90)).toBe('1m 30s');
    expect(formatDuration(3600)).toBe('1h');
    expect(formatDuration(3660)).toBe('1h 1m');
  });
});

describe('engagementLevel / engagementRank', () => {
  it('buckets by score thresholds', () => {
    expect(engagementLevel(0.5)).toBe('High');
    expect(engagementLevel(0.2)).toBe('Medium');
    expect(engagementLevel(0.05)).toBe('Low');
    expect(engagementLevel(0)).toBeNull();
    expect(engagementRank(0.5)).toBe(3);
    expect(engagementRank(0)).toBe(0);
  });
});

describe('getDateBounds', () => {
  it('returns the unix epoch as the start for "all"', () => {
    const { start } = getDateBounds('all');
    expect(start.getTime()).toBe(0);
  });
  it('honors custom start/end', () => {
    const { start, end } = getDateBounds('custom', '2026-01-01', '2026-01-02');
    expect(start.getTime()).toBe(new Date('2026-01-01').getTime());
    // end is inclusive — the custom end date plus one day
    expect(end.getTime()).toBe(new Date('2026-01-02').getTime() + 86400000);
  });
});

describe('isPrivateIP', () => {
  it('detects private / reserved ranges', () => {
    expect(isPrivateIP('10.0.0.1')).toBe(true);
    expect(isPrivateIP('192.168.1.1')).toBe(true);
    expect(isPrivateIP('172.16.0.1')).toBe(true);
    expect(isPrivateIP('127.0.0.1')).toBe(true);
    expect(isPrivateIP('::1')).toBe(true);
  });
  it('treats public IPs as non-private', () => {
    expect(isPrivateIP('8.8.8.8')).toBe(false);
    expect(isPrivateIP('172.15.0.1')).toBe(false);
  });
});

describe('maskIP', () => {
  it('masks the 3rd octet of IPv4', () => {
    expect(maskIP('203.0.113.42')).toBe('203.0.***.42');
  });
  it('keeps only the first 2 groups of IPv6', () => {
    expect(maskIP('2001:db8:abcd:0012::1')).toBe('2001:db8:***');
  });
});
