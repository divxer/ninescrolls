export function validatePositiveInteger(value: unknown, field: string): void {
  if (!Number.isInteger(value) || (value as number) <= 0) {
    throw new Error(`VALIDATION: ${field} must be a positive integer`);
  }
}

export function validateOptionalSkuArray(value: unknown, field: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !v.trim())) {
    throw new Error(`VALIDATION: ${field} must be an array of non-empty SKU strings`);
  }
}

export function validateMarginMap(value: unknown, field: string): void {
  if (value === undefined) return;
  if (value === null || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error(`VALIDATION: ${field} must be a plain object`);
  }
  for (const [key, margin] of Object.entries(value)) {
    if (!key.trim() || !Number.isFinite(margin) || !Number.isInteger(margin)
      || (margin as number) < 0 || (margin as number) >= 10000) {
      throw new Error(`VALIDATION: ${field}.${key || '<empty>'} must be an integer in [0, 10000)`);
    }
  }
}
