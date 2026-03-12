import { describe, it, expect } from 'vitest';
import { extractSearchQuery } from './behaviorAnalytics';

describe('extractSearchQuery', () => {
  it('extracts query from Google referrer', () => {
    expect(extractSearchQuery(
      'https://www.google.com/search?q=non+uniform+etch+rate&sca_esv=abc'
    )).toBe('non uniform etch rate');
  });

  it('extracts query from Google with URL-encoded characters', () => {
    expect(extractSearchQuery(
      'https://www.google.com/search?q=%E7%AD%89%E7%A6%BB%E5%AD%90%E4%BD%93%E8%9A%80%E5%88%BB'
    )).toBe('等离子体蚀刻');
  });

  it('extracts query from Bing referrer', () => {
    expect(extractSearchQuery(
      'https://www.bing.com/search?q=plasma+etch+uniformity'
    )).toBe('plasma etch uniformity');
  });

  it('extracts query from Yahoo referrer (uses p= param)', () => {
    expect(extractSearchQuery(
      'https://search.yahoo.com/search?p=semiconductor+etching'
    )).toBe('semiconductor etching');
  });

  it('extracts query from Baidu referrer (uses wd= param)', () => {
    expect(extractSearchQuery(
      'https://www.baidu.com/s?wd=%E5%88%BB%E8%9A%80%E5%9D%87%E5%8C%80%E6%80%A7'
    )).toBe('刻蚀均匀性');
  });

  it('extracts query from Baidu referrer (uses word= param)', () => {
    expect(extractSearchQuery(
      'https://www.baidu.com/s?word=test+query'
    )).toBe('test query');
  });

  it('extracts query from Yandex referrer (uses text= param)', () => {
    expect(extractSearchQuery(
      'https://yandex.ru/search/?text=plasma+etching'
    )).toBe('plasma etching');
  });

  it('extracts query from DuckDuckGo referrer', () => {
    expect(extractSearchQuery(
      'https://duckduckgo.com/?q=gas+flow+temperature'
    )).toBe('gas flow temperature');
  });

  it('extracts query from Naver referrer (uses query= param)', () => {
    expect(extractSearchQuery(
      'https://search.naver.com/search.naver?query=etch+chamber'
    )).toBe('etch chamber');
  });

  it('returns undefined for non-search-engine referrer', () => {
    expect(extractSearchQuery('https://www.example.com/page?q=something')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(extractSearchQuery(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(extractSearchQuery('')).toBeUndefined();
  });

  it('returns undefined for search engine referrer without query param', () => {
    expect(extractSearchQuery('https://www.google.com/')).toBeUndefined();
  });

  it('returns undefined for invalid URL', () => {
    expect(extractSearchQuery('not-a-url')).toBeUndefined();
  });

  it('handles Google subdomain correctly (e.g. news.google.com)', () => {
    expect(extractSearchQuery(
      'https://news.google.com/search?q=semiconductor+news'
    )).toBe('semiconductor news');
  });
});
