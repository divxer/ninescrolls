import { describe, it, expect } from 'vitest';
import { isSecurityProxyOrg } from './proxy-vendors';

describe('isSecurityProxyOrg', () => {
  it('matches known security-proxy / browser-isolation vendors', () => {
    // Names as they appear in ipinfo/ipapi org strings (with and without ASN prefix)
    expect(isSecurityProxyOrg('Menlo Security, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('AS399629 Menlo Security, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('MENLO-SECURITY')).toBe(true);
    expect(isSecurityProxyOrg('Zscaler, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('ZSCALER-INC')).toBe(true);
    expect(isSecurityProxyOrg('iboss, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('Cloudflare, Inc.')).toBe(true);
    expect(isSecurityProxyOrg('CLOUDFLARENET')).toBe(true);
    expect(isSecurityProxyOrg('Netskope Inc')).toBe(true);
    expect(isSecurityProxyOrg('Forcepoint Cloud Ltd')).toBe(true);
  });

  it('does not match lookalikes or ordinary orgs', () => {
    expect(isSecurityProxyOrg('Menlo College')).toBe(false);
    expect(isSecurityProxyOrg('Menlo Park Research LLC')).toBe(false);
    expect(isSecurityProxyOrg('Cloud Nine Fabrication')).toBe(false);
    expect(isSecurityProxyOrg('Bossier University')).toBe(false);
    expect(isSecurityProxyOrg('Stanford University')).toBe(false);
    expect(isSecurityProxyOrg('China Mobile')).toBe(false);
  });

  it('checks every provided name and tolerates null/undefined/empty', () => {
    expect(isSecurityProxyOrg(undefined, null, '')).toBe(false);
    expect(isSecurityProxyOrg()).toBe(false);
    // org empty but isp carries the vendor
    expect(isSecurityProxyOrg('', undefined, 'Zscaler, Inc.')).toBe(true);
  });
});
