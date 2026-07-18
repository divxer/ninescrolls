import { describe, it, expect } from 'vitest';
import {
  draftCreateSchema,
  draftPatchRequestSchema,
  normalizeDraftPatch,
  applyNormalizedDraftPatch,
  DRAFT_FIELD_KEYS,
} from './draftContract';

const VALID = {
  name: 'Jane Researcher',
  email: 'JANE@Stanford.edu',
  institution: 'Stanford University',
  equipmentCategory: 'Probe-Station',
  applicationDescription: 'Wafer probing for silicon photonics device characterization.',
  quantity: 2,
};

describe('draftCreateSchema', () => {
  it('accepts a valid whitelisted draft and NFC-lowercases the email', () => {
    const r = draftCreateSchema.safeParse(VALID);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe('jane@stanford.edu');
  });

  it('rejects unknown keys (e.g. a leaked shipping field)', () => {
    const r = draftCreateSchema.safeParse({ ...VALID, shippingAddress: '1 Infinite Loop' });
    expect(r.success).toBe(false);
  });

  it('rejects quantity outside 1–100', () => {
    expect(draftCreateSchema.safeParse({ ...VALID, quantity: 0 }).success).toBe(false);
    expect(draftCreateSchema.safeParse({ ...VALID, quantity: 101 }).success).toBe(false);
  });

  it('rejects a category not in the shared contract', () => {
    expect(draftCreateSchema.safeParse({ ...VALID, equipmentCategory: 'Nonsense' }).success).toBe(false);
  });

  it('never lists a non-whitelisted field (attachments, keySpecifications, comments)', () => {
    for (const banned of ['attachmentKeys', 'keySpecifications', 'additionalComments', 'shippingAddress']) {
      expect(DRAFT_FIELD_KEYS).not.toContain(banned);
    }
  });

  it('exports immutable whitelist metadata', () => {
    expect(Object.isFrozen(DRAFT_FIELD_KEYS)).toBe(true);
  });
});

describe('normalized draft patch', () => {
  it('accepts a single changed whitelisted field', () => {
    const parsed = draftPatchRequestSchema.parse({ quantity: 5 });
    expect(normalizeDraftPatch(parsed)).toEqual({ set: { quantity: 5 }, remove: [] });
  });

  it('still rejects unknown keys in a patch', () => {
    expect(draftPatchRequestSchema.safeParse({ turnstileToken: 'x' }).success).toBe(false);
  });

  it('normalizes an empty optional string to an explicit removal', () => {
    const parsed = draftPatchRequestSchema.parse({ department: '  ' });
    expect(normalizeDraftPatch(parsed)).toEqual({ set: {}, remove: ['department'] });
  });

  it('normalizes whitespace-only phone and enum values to removals', () => {
    const parsed = draftPatchRequestSchema.parse({ phone: '  ', role: '  ' });
    expect(normalizeDraftPatch(parsed)).toEqual({ set: {}, remove: ['phone', 'role'] });
  });

  it('rejects removal of a required string', () => {
    expect(draftPatchRequestSchema.safeParse({ institution: '  ' }).success).toBe(false);
  });

  it('preserves an empty patch as a detectable no-op', () => {
    expect(normalizeDraftPatch(draftPatchRequestSchema.parse({})))
      .toEqual({ set: {}, remove: [] });
  });

  it('applies an operation and revalidates the complete resulting draft', () => {
    const operation = normalizeDraftPatch(draftPatchRequestSchema.parse({ department: '' }));
    const current = draftCreateSchema.parse({ ...VALID, department: 'Physics' });
    expect(applyNormalizedDraftPatch(current, operation))
      .not.toHaveProperty('department');
  });
});
