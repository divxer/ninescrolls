export interface PepperSet {
  pepper: Buffer;
  keyVersion: number;
  resolvePepper: (keyVersion: number) => Buffer | undefined;
}

/** Parse `{ current: n, keys: { "n": "<64 hex>" } }` into a signing + verification set. */
export function parsePepperSecret(raw: string): PepperSet {
  const parsed = JSON.parse(raw) as { current?: number; keys?: Record<string, string> };
  const current = parsed.current;
  const keys = parsed.keys ?? {};
  const decoded = new Map<number, Buffer>();
  for (const [k, hex] of Object.entries(keys)) {
    if (!/^(0|[1-9]\d*)$/.test(k) || !Number.isSafeInteger(Number(k))) {
      throw new Error(`rfq-draft pepper: invalid key version ${k}`);
    }
    if (!/^[0-9a-f]{64}$/.test(hex)) throw new Error(`rfq-draft pepper: key ${k} is not 32 bytes hex`);
    decoded.set(Number(k), Buffer.from(hex, 'hex'));
  }
  if (decoded.size === 0) throw new Error('rfq-draft pepper: no keys');
  if (typeof current !== 'number' || !Number.isSafeInteger(current) || current < 0 || !decoded.has(current)) {
    throw new Error('rfq-draft pepper: current key version missing');
  }
  return {
    pepper: decoded.get(current)!,
    keyVersion: current,
    resolvePepper: (v) => decoded.get(v),
  };
}
