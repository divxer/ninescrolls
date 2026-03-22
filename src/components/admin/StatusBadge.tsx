import { STATUS_LABELS, type OrderStatus } from '../../types/admin';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

const ORDER_STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  INQUIRY: { badge: 'bg-purple-100 text-purple-800', dot: 'bg-purple-600' },
  QUOTING: { badge: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', dot: 'bg-on-tertiary-fixed-variant' },
  QUOTE_SENT: { badge: 'bg-cyan-100 text-cyan-800', dot: 'bg-cyan-600' },
  PO_RECEIVED: { badge: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-600' },
  IN_PRODUCTION: { badge: 'bg-secondary-fixed text-secondary', dot: 'bg-secondary' },
  SHIPPED: { badge: 'bg-on-primary-container/20 text-on-primary-container', dot: 'bg-on-primary-container' },
  INSTALLED: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-600' },
  CLOSED: { badge: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-on-surface-variant' },
  DECLINED: { badge: 'bg-error-container text-on-error-container', dot: 'bg-on-error-container' },
};

const RFQ_STATUS_STYLES: Record<string, { badge: string; dot: string }> = {
  pending: { badge: 'bg-secondary/10 text-secondary', dot: 'bg-secondary' },
  converted: { badge: 'bg-green-100 text-green-800', dot: 'bg-green-600' },
  declined: { badge: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-on-surface-variant' },
};

const DEFAULT_STYLE = { badge: 'bg-surface-container-high text-on-surface-variant', dot: 'bg-on-surface-variant' };

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const isOrderStatus = status in STATUS_LABELS;
  const label = isOrderStatus
    ? STATUS_LABELS[status as OrderStatus]
    : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

  const style =
    ORDER_STATUS_STYLES[status] ||
    RFQ_STATUS_STYLES[status] ||
    DEFAULT_STYLE;

  const sizeClasses =
    size === 'lg'
      ? 'text-xs px-4 py-1.5'
      : size === 'md'
        ? 'text-[11px] px-3 py-1'
        : 'text-[10px] px-3 py-1';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-tighter ${sizeClasses} ${style.badge}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}
