// amplify/lib/evidence/status.ts
// Dependency-free single source of truth for Evidence status/type strings.
// Imported by the evidence-api Lambda (../../lib/evidence/status), by the data
// schema (../lib/evidence/status), and re-exported by src/config/evidence.ts.
// MUST stay import-free so both the esbuild (Lambda) and Vite (frontend)
// bundlers can include it without pulling in extra dependencies.

export const EVIDENCE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUS)[keyof typeof EVIDENCE_STATUS];

export const EVIDENCE_TYPE = {
  APPLICATION_NOTE: 'application_note',
  PROCESS_NOTE: 'process_note',
  TECHNICAL_NOTE: 'technical_note',
  PUBLICATION: 'publication',
  CASE_STUDY: 'case_study',
  VALIDATION: 'validation',
} as const;
export type EvidenceType = (typeof EVIDENCE_TYPE)[keyof typeof EVIDENCE_TYPE];
