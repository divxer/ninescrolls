import crypto from 'node:crypto';

export function generateCaseId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `lc-${date}-${crypto.randomBytes(8).toString('hex')}`;
}

export function generateLegId(): string {
  return `leg-${crypto.randomBytes(3).toString('hex')}`;
}

export function formatCaseNumber(year: number, seq: number): string {
  return `NS-LOG-${year}-${String(seq).padStart(4, '0')}`;
}
