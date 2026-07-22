import crypto from 'node:crypto';

// Time-ordered unique id: 10 chars of ms-timestamp + 16 chars of randomness, Crockford base32.
// Lexicographic order == time order (same-ms ties broken arbitrarily — accepted per spec R9/1;
// spec R10: merge-vs-replay is handled STRUCTURALLY via canonical-successor resolution, so stamp
// ordering never has to decide a merge outcome and plain ULIDs suffice).
const ENC = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const ULID_REGEX = /^[0-9A-HJKMNP-TV-Z]{26}$/;

export function generateUlid(now: number = Date.now()): string {
  let ts = now;
  const time = Array.from({ length: 10 }, () => { const c = ENC[ts % 32]; ts = Math.floor(ts / 32); return c; }).reverse().join('');
  const rand = Array.from(crypto.randomBytes(16), (b) => ENC[b % 32]).join('').slice(0, 16);
  return time + rand;
}
