import { describe, it, expect } from 'vitest';
import { EQUIPMENT_CATEGORIES, ALLOWED_FILE_TYPES, MAX_FILES, MAX_FILE_SIZE } from './rfqEquipmentOptions';
import {
  RFQ_EQUIPMENT_CATEGORY_VALUES,
  RFQ_ATTACHMENT_MIME_TYPES,
  MAX_RFQ_ATTACHMENTS,
  MAX_RFQ_ATTACHMENT_SIZE,
} from '../../amplify/lib/rfq/contract';

/**
 * Client half of the RFQ form ⇄ submit-rfq contract guard. Asserts the dropdown
 * and the client-side file validation derive exactly from the shared contract
 * that the Lambda's Zod schemas also use. The server half lives in
 * amplify/functions/submit-rfq/handler.test.ts. Together they make the
 * 2026-07-15 Probe-Station enum-drift outage (and its attachment equivalent) a
 * CI failure rather than a silent lead loss.
 */
describe('RFQ form ⇄ submit-rfq contract parity (client side)', () => {
  it('offers exactly the shared canonical equipment categories — no extras, none missing', () => {
    const offered = EQUIPMENT_CATEGORIES.map((c) => c.value).slice().sort();
    const canonical = [...RFQ_EQUIPMENT_CATEGORY_VALUES].sort();
    expect(offered).toEqual(canonical);
  });

  it('gives every offered category a non-empty label', () => {
    for (const option of EQUIPMENT_CATEGORIES) {
      expect(option.label, `missing label for ${option.value}`).toBeTruthy();
    }
  });

  it('accepts exactly the shared attachment MIME types', () => {
    expect([...ALLOWED_FILE_TYPES].sort()).toEqual([...RFQ_ATTACHMENT_MIME_TYPES].sort());
  });

  it('caps file count and size at the shared attachment limits', () => {
    expect(MAX_FILES).toBe(MAX_RFQ_ATTACHMENTS);
    expect(MAX_FILE_SIZE).toBe(MAX_RFQ_ATTACHMENT_SIZE);
  });
});
