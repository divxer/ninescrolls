// amplify/lib/rfq/limits.ts
// Dependency-free single source of truth for RFQ field length limits.
// Imported by the submit-rfq Lambda (../../lib/rfq/limits) to build its Zod
// schema, and by the frontend RFQ form (src/pages/RFQPage.tsx via
// ../../amplify/lib/rfq/limits) for maxLength attributes + validateField().
// MUST stay import-free so both the esbuild (Lambda) and Vite (frontend)
// bundlers can include it without pulling in extra dependencies.
//
// Client and server MUST derive their limits from this object so they cannot
// drift — an untracked drift is exactly what caused the Probe-Station outage.

export const RFQ_FIELD_LIMITS = {
  name: { min: 2, max: 100 },
  email: { max: 254 },
  phone: { max: 30 },
  institution: { min: 2, max: 200 },
  department: { max: 200 },
  specificModel: { max: 100 },
  applicationDescription: { min: 10, max: 3000 },
  keySpecifications: { max: 3000 },
  existingEquipment: { max: 2000 },
  additionalComments: { max: 3000 },
  shippingAddress: { max: 300 },
  shippingCity: { max: 100 },
  shippingState: { max: 100 },
  shippingZipCode: { max: 20 },
  shippingCountry: { max: 100 },
  visitorId: { max: 100 },
  referrerSource: { max: 200 },
} as const;

export type RfqFieldLimits = typeof RFQ_FIELD_LIMITS;
export type RfqLimitedField = keyof RfqFieldLimits;
