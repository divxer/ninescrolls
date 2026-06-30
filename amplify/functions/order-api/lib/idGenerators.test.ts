import { describe, it, expect } from 'vitest';
import { generateLogId } from './idGenerators';

describe('generateLogId', () => {
  it('produces an olog- prefixed id', () => {
    expect(generateLogId()).toMatch(/^olog-[0-9a-f]{12}$/);
  });
  it('is unique across calls', () => {
    expect(generateLogId()).not.toBe(generateLogId());
  });
});
