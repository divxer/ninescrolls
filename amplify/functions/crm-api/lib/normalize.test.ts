import { describe, it, expect } from 'vitest';
import { normalizeEmail, domainOf, normalizeOrgName, isFreeEmailDomain, isDenylistedDomain, normalizeRfc822MessageId } from './normalize';

describe('normalize', () => {
  it('normalizeEmail lowercases + trims', () => {
    expect(normalizeEmail('  Terry@DiamondFoundry.com ')).toBe('terry@diamondfoundry.com');
  });
  it('domainOf extracts host or null', () => {
    expect(domainOf('terry@diamondfoundry.com')).toBe('diamondfoundry.com');
    expect(domainOf('not-an-email')).toBeNull();
  });
  it('normalizeOrgName collapses case/space/punct', () => {
    expect(normalizeOrgName('  Diamond  Foundry, Inc. ')).toBe('diamond foundry inc');
  });
  it('isFreeEmailDomain flags consumer providers', () => {
    expect(isFreeEmailDomain('gmail.com')).toBe(true);
    expect(isFreeEmailDomain('qq.com')).toBe(true);
    expect(isFreeEmailDomain('diamondfoundry.com')).toBe(false);
  });
  it('isDenylistedDomain flags infra + free', () => {
    expect(isDenylistedDomain('amazonaws.com')).toBe(true);
    expect(isDenylistedDomain('gmail.com')).toBe(true);
    expect(isDenylistedDomain('diamondfoundry.com')).toBe(false);
  });
});

describe('normalizeRfc822MessageId', () => {
  it('trims, strips surrounding <>, lowercases', () => {
    expect(normalizeRfc822MessageId('  <CAF+Abc123@Mail.Gmail.Com>  ')).toBe('caf+abc123@mail.gmail.com');
  });
  it('passes through an already-bare id', () => {
    expect(normalizeRfc822MessageId('x@y.z')).toBe('x@y.z');
  });
});
