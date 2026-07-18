// amplify/lib/rfq/contract.ts
// Dependency-free single source of truth for the RFQ form ⇄ submit-rfq Lambda
// contract: the equipment-category enum and the attachment upload constraints.
//
// Companion to ./limits.ts (field length caps). Imported by the submit-rfq
// Lambda (../../lib/rfq/contract) to build its Zod schemas, and by the frontend
// RFQ form (src/pages/rfqEquipmentOptions.ts via ../../amplify/lib/rfq/contract)
// for the dropdown + client-side file validation.
//
// MUST stay import-free (no React/CSS/@aws-sdk) so both the esbuild Lambda
// bundle and the Vite/jsdom frontend bundle can include it without pulling in
// extra dependencies.
//
// Client and server MUST derive from these values so they cannot drift — the
// form offering a value the Lambda rejects is exactly what caused the
// 2026-07-15 Probe-Station outage.

/**
 * Equipment-category values an RFQ may carry, in dropdown order. The Lambda's
 * `equipmentCategory` enum and the form's dropdown both derive from this list.
 */
export const RFQ_EQUIPMENT_CATEGORY_VALUES = [
  'ICP',
  'PECVD',
  'Sputter',
  'E-Beam',
  'ALD',
  'RIE',
  'IBE',
  'HDP-CVD',
  'Plasma-Cleaner',
  'Stripper',
  'Coater-Developer',
  'Probe-Station',
  'Other',
] as const;

export type RfqEquipmentCategory = (typeof RFQ_EQUIPMENT_CATEGORY_VALUES)[number];

/**
 * MIME types the RFQ attachment upload accepts. The Lambda's presign
 * `uploadUrlSchema.mimeType` enum and the form's client-side file-type check
 * both derive from this list.
 */
export const RFQ_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
] as const;

export type RfqAttachmentMimeType = (typeof RFQ_ATTACHMENT_MIME_TYPES)[number];

/** Maximum number of attachments a single RFQ may carry. */
export const MAX_RFQ_ATTACHMENTS = 3;

/** Maximum size (bytes) of a single RFQ attachment. */
export const MAX_RFQ_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
