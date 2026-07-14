import { randomUUID } from 'node:crypto';

const short = () => randomUUID().replace(/-/g, '').slice(0, 12);

export const generateSupplierId = () => `sup-${short()}`;
export const generateCatalogItemId = () => `cat-${short()}`;

/** Q-2026-0001 — sequential per year (spec: LogisticsCase numbering precedent). */
export const formatQuotationNumber = (year: number, seq: number) =>
  `Q-${year}-${String(seq).padStart(4, '0')}`;

/** Zero-padded so base-table Query returns versions/lines in order. */
export const versionSk = (version: number) => `V#${String(version).padStart(3, '0')}`;
export const lineSk = (version: number, lineNo: number) =>
  `${versionSk(version)}#LINE#${String(lineNo).padStart(2, '0')}`;
