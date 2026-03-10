import type { OrderStatus } from './types.js';

/** Forward-only transitions (index-based) */
export const FORWARD_PATH: OrderStatus[] = [
    'INQUIRY', 'QUOTING', 'QUOTE_SENT', 'PO_RECEIVED',
    'IN_PRODUCTION', 'SHIPPED', 'INSTALLED', 'CLOSED',
];

/** Status date field mapping — §12.5 step 2 */
export const STATUS_DATE_FIELD: Record<string, string> = {
    INQUIRY: 'inquiryDate',
    QUOTING: 'quoteDate',
    QUOTE_SENT: 'quoteSentDate',
    PO_RECEIVED: 'poDate',
    IN_PRODUCTION: 'productionStartDate',
    SHIPPED: 'shipDate',
    INSTALLED: 'installDate',
    CLOSED: 'closeDate',
    DECLINED: 'declinedDate',
};

/**
 * Validate a status transition.
 * Returns true if newStatus is the next step from currentStatus,
 * or if it's the special INQUIRY -> DECLINED path.
 */
export function isValidTransition(current: OrderStatus, next: OrderStatus): boolean {
    if (current === 'INQUIRY' && next === 'DECLINED') return true;

    const curIdx = FORWARD_PATH.indexOf(current);
    const nextIdx = FORWARD_PATH.indexOf(next);

    if (curIdx === -1 || nextIdx === -1) return false;
    return nextIdx === curIdx + 1;
}

/** Roles eligible for each feedback stage */
export const FEEDBACK_STAGE_ROLES: Record<string, string[]> = {
    '3-day':   ['PI', 'RESEARCHER', 'PROCUREMENT', 'FACILITIES', 'FINANCE', 'LAB_MANAGER', 'OTHER'],
    '30-day':  ['PI', 'RESEARCHER', 'LAB_MANAGER'],
    '90-day':  ['PI', 'RESEARCHER', 'LAB_MANAGER'],
    '180-day': ['PI', 'LAB_MANAGER'],
    '365-day': ['PI', 'LAB_MANAGER', 'PROCUREMENT'],
};

export const FEEDBACK_STAGE_DAYS: Record<string, number> = {
    '3-day': 3,
    '30-day': 30,
    '90-day': 90,
    '180-day': 180,
    '365-day': 365,
};

export function addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}
