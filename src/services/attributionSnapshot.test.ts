import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureLandingAttribution, getAttributionSnapshot } from './attributionSnapshot';

const KEY = 'ns_attribution';

beforeEach(() => {
  localStorage.clear();
});

describe('captureLandingAttribution', () => {
  it('writes a snapshot when any utm/click param is present, lowercasing utm but not click ids', () => {
    captureLandingAttribution('?utm_source=Google&utm_medium=CPC&gclid=AbC123xYz', new Date('2026-07-21T00:00:00Z'));
    const snap = getAttributionSnapshot()!;
    expect(snap.source).toBe('google');   // lowercased
    expect(snap.medium).toBe('cpc');       // lowercased
    expect(snap.gclid).toBe('AbC123xYz');  // verbatim, case preserved
    expect(snap.capturedAt).toBe('2026-07-21T00:00:00.000Z');
  });

  it('treats empty-string params as absent', () => {
    captureLandingAttribution('?utm_source=&utm_medium=cpc', new Date('2026-07-21T00:00:00Z'));
    const snap = getAttributionSnapshot()!;
    expect(snap.source).toBeUndefined();
    expect(snap.medium).toBe('cpc');
  });

  it('does NOT overwrite an in-window snapshot on a param-less landing', () => {
    captureLandingAttribution('?utm_source=google&gclid=g1', new Date('2026-07-21T00:00:00Z'));
    captureLandingAttribution('', new Date('2026-07-25T00:00:00Z')); // direct, 4 days later
    expect(getAttributionSnapshot()!.gclid).toBe('g1'); // preserved
  });

  it('overwrites an existing snapshot when a NEW param landing arrives (recency wins, ignores age)', () => {
    captureLandingAttribution('?utm_source=google&gclid=old', new Date('2026-01-01T00:00:00Z')); // old
    captureLandingAttribution('?utm_source=bing&msclkid=new', new Date('2026-07-21T00:00:00Z'));
    const snap = getAttributionSnapshot()!;
    expect(snap.source).toBe('bing');
    expect(snap.msclkid).toBe('new');
    expect(snap.gclid).toBeUndefined();
  });

  it('clears a >90-day-old snapshot on a param-less landing (reverts to Direct)', () => {
    captureLandingAttribution('?utm_source=google&gclid=g1', new Date('2026-01-01T00:00:00Z'));
    captureLandingAttribution('', new Date('2026-07-21T00:00:00Z')); // >90 days, no params
    expect(getAttributionSnapshot()).toBeUndefined();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('caps each value at the shared limit', () => {
    captureLandingAttribution(`?utm_campaign=${'x'.repeat(400)}`, new Date('2026-07-21T00:00:00Z'));
    expect(getAttributionSnapshot()!.campaign!.length).toBe(256); // RFQ_FIELD_LIMITS.attribution.campaign.max
  });

  it('swallows localStorage failures', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => captureLandingAttribution('?gclid=g1', new Date())).not.toThrow();
    spy.mockRestore();
  });
});
