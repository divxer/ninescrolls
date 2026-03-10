import { STATUS_LABELS, STATUS_COLORS, RFQ_STATUS_COLORS, type OrderStatus } from '../../types/admin';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md' | 'lg';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const isOrderStatus = status in STATUS_LABELS;
  const label = isOrderStatus
    ? STATUS_LABELS[status as OrderStatus]
    : status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
  const color = isOrderStatus
    ? STATUS_COLORS[status as OrderStatus]
    : RFQ_STATUS_COLORS[status] || '#6b7280';

  const fontSize = size === 'lg' ? '0.95rem' : size === 'md' ? '0.8rem' : '0.7rem';
  const padding = size === 'lg' ? '6px 14px' : size === 'md' ? '4px 10px' : '2px 8px';

  return (
    <span
      className="status-badge"
      style={{
        backgroundColor: `${color}18`,
        color,
        border: `1px solid ${color}40`,
        borderRadius: '4px',
        padding,
        fontSize,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      {label}
    </span>
  );
}
