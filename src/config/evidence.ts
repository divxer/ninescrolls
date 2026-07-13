// src/config/evidence.ts
// Re-exports the shared status/type constants (single source of truth in
// amplify/lib/evidence/status.ts) and adds frontend-only display + validation
// helpers. Mirrors the existing src -> amplify type import in amplifyClient.ts;
// the imported file is pure constants, so Vite bundles only those values.
import {
  EVIDENCE_STATUS,
  EVIDENCE_TYPE,
  type EvidenceStatus,
  type EvidenceType,
} from '../../amplify/lib/evidence/status';

export { EVIDENCE_STATUS, EVIDENCE_TYPE };
export type { EvidenceStatus, EvidenceType };

export const EVIDENCE_TYPE_ORDER: EvidenceType[] = [
  EVIDENCE_TYPE.APPLICATION_NOTE,
  EVIDENCE_TYPE.PROCESS_NOTE,
  EVIDENCE_TYPE.TECHNICAL_NOTE,
  EVIDENCE_TYPE.PUBLICATION,
  EVIDENCE_TYPE.CASE_STUDY,
  EVIDENCE_TYPE.VALIDATION,
];

const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  [EVIDENCE_TYPE.APPLICATION_NOTE]: 'Application Note',
  [EVIDENCE_TYPE.PROCESS_NOTE]: 'Process Note',
  [EVIDENCE_TYPE.TECHNICAL_NOTE]: 'Technical Note',
  [EVIDENCE_TYPE.PUBLICATION]: 'Published Research',
  [EVIDENCE_TYPE.CASE_STUDY]: 'Case Study',
  [EVIDENCE_TYPE.VALIDATION]: 'Process Validation',
};
export function evidenceTypeLabel(type: string): string {
  return EVIDENCE_TYPE_LABELS[type as EvidenceType] ?? type;
}

export const EVIDENCE_TYPE_HELP: Partial<Record<EvidenceType, string>> = {
  [EVIDENCE_TYPE.PROCESS_NOTE]: 'Process recipe / process-specific explanation',
  [EVIDENCE_TYPE.TECHNICAL_NOTE]: 'Equipment / design / operation explanation',
};

type PayloadInput = {
  articleSlug?: string | null;
  pdfUrl?: string | null;
  sourceUrl?: string | null;
  images?: string[] | null;
};
export function hasPayload(input: PayloadInput): boolean {
  const nonBlank = (s?: string | null) => typeof s === 'string' && s.trim().length > 0;
  const hasImages = Array.isArray(input.images) && input.images.length > 0;
  return nonBlank(input.articleSlug) || nonBlank(input.pdfUrl) || nonBlank(input.sourceUrl) || hasImages;
}

export type EvidenceTypeCount = { type: EvidenceType; label: string; count: number };
export function countEvidenceByType(records: { type: string }[]): EvidenceTypeCount[] {
  const counts = new Map<string, number>();
  for (const r of records) counts.set(r.type, (counts.get(r.type) ?? 0) + 1);
  return EVIDENCE_TYPE_ORDER
    .filter((type) => (counts.get(type) ?? 0) > 0)
    .map((type) => ({ type, label: evidenceTypeLabel(type), count: counts.get(type)! }));
}
