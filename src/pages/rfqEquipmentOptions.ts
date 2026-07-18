import {
  RFQ_EQUIPMENT_CATEGORY_VALUES,
  RFQ_ATTACHMENT_MIME_TYPES,
  MAX_RFQ_ATTACHMENTS,
  MAX_RFQ_ATTACHMENT_SIZE,
  type RfqEquipmentCategory,
} from '../../amplify/lib/rfq/contract';

/**
 * Dropdown labels for the RFQ equipment-category picker.
 *
 * Typed as `Record<RfqEquipmentCategory, string>`, so adding a category to the
 * shared contract without giving it a label here — or removing one — is a
 * compile error. Labels are UI copy and intentionally live here, not in the
 * shared contract (the Lambda's email labels differ by design).
 */
const EQUIPMENT_CATEGORY_LABELS: Record<RfqEquipmentCategory, string> = {
  'ICP': 'ICP Etching System',
  'PECVD': 'PECVD System',
  'Sputter': 'Sputter Deposition System',
  'E-Beam': 'E-Beam Evaporation System',
  'ALD': 'ALD System',
  'RIE': 'RIE / Reactive Ion Etching',
  'IBE': 'Ion Beam Etching (IBE)',
  'HDP-CVD': 'HDP-CVD System',
  'Plasma-Cleaner': 'Plasma Cleaner / Surface Treatment',
  'Stripper': 'Photoresist Stripping System',
  'Coater-Developer': 'Coater / Developer (Spin Coater)',
  'Probe-Station': 'Wafer Probe Station',
  'Other': 'Not Sure / Need Recommendation',
};

/**
 * `{ value, label }` options rendered by the RFQ form dropdown, in the shared
 * contract's canonical order. Derived from `RFQ_EQUIPMENT_CATEGORY_VALUES`, so
 * the form can never offer a value the Lambda's enum rejects.
 */
export const EQUIPMENT_CATEGORIES: ReadonlyArray<{ value: RfqEquipmentCategory; label: string }> =
  RFQ_EQUIPMENT_CATEGORY_VALUES.map((value) => ({ value, label: EQUIPMENT_CATEGORY_LABELS[value] }));

/**
 * Attachment constraints for the form's client-side file validation, sourced
 * from the shared contract so they can never exceed / diverge from what the
 * submit-rfq Lambda's presign schema accepts. `ALLOWED_FILE_TYPES` is widened to
 * `readonly string[]` so `.includes(file.type)` (a plain string) type-checks.
 */
export const ALLOWED_FILE_TYPES: readonly string[] = RFQ_ATTACHMENT_MIME_TYPES;
export const MAX_FILES = MAX_RFQ_ATTACHMENTS;
export const MAX_FILE_SIZE = MAX_RFQ_ATTACHMENT_SIZE;
