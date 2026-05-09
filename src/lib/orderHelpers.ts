import type { Order } from '../types/admin';

export type QuoteExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';

const SOON_DAYS = 7;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseISODateUTC(dateISO: string): number | null {
  if (!ISO_DATE_RE.test(dateISO)) return null;
  const [y, m, d] = dateISO.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const ms = Date.UTC(y, m - 1, d);
  if (Number.isNaN(ms)) return null;
  // Reject dates that rolled over (e.g. 2026-02-30 → Mar 2)
  const dt = new Date(ms);
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return null;
  }
  return ms;
}

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDaysISO(dateISO: string, days: number): string {
  if (!dateISO) return '';
  const ms = parseISODateUTC(dateISO);
  if (ms === null) return '';
  const dt = new Date(ms);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysUntilExpiry(
  validUntil: string | null | undefined,
  today: string = todayISO(),
): number | null {
  if (!validUntil) return null;
  const v = parseISODateUTC(validUntil);
  const t = parseISODateUTC(today);
  if (v === null || t === null) return null;
  return Math.round((v - t) / (1000 * 60 * 60 * 24));
}

export function isQuoteExpired(order: Order, today: string = todayISO()): boolean {
  if (order.status !== 'QUOTE_SENT') return false;
  if (!order.quoteValidUntil) return false;
  const remaining = daysUntilExpiry(order.quoteValidUntil, today);
  return remaining !== null && remaining < 0;
}

export function quoteExpiryStatus(
  order: Order,
  today: string = todayISO(),
): QuoteExpiryStatus {
  if (order.status !== 'QUOTE_SENT') return 'none';
  const remaining = daysUntilExpiry(order.quoteValidUntil, today);
  if (remaining === null) return 'none';
  if (remaining < 0) return 'expired';
  if (remaining <= SOON_DAYS) return 'soon';
  return 'ok';
}
