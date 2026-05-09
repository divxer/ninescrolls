import type { Order } from '../types/admin';

export type QuoteExpiryStatus = 'expired' | 'soon' | 'ok' | 'none';

const SOON_DAYS = 7;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number): string {
  if (!dateISO) return '';
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function daysUntilExpiry(
  validUntil: string | null | undefined,
  today: string = todayISO(),
): number | null {
  if (!validUntil) return null;
  const [vy, vm, vd] = validUntil.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const v = Date.UTC(vy, vm - 1, vd);
  const t = Date.UTC(ty, tm - 1, td);
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
