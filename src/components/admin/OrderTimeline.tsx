import type { Order } from '../../types/admin';
import { formatDate } from '../../types/admin';

interface OrderTimelineProps {
  order: Order;
}

const TIMELINE_ITEMS: { key: keyof Order; label: string }[] = [
  { key: 'quoteDate', label: 'Quote Date' },
  { key: 'poDate', label: 'PO Received' },
  { key: 'productionStartDate', label: 'Production Start' },
  { key: 'estimatedDelivery', label: 'Est. Delivery' },
  { key: 'shipDate', label: 'Shipped' },
  { key: 'installDate', label: 'Installed' },
  { key: 'warrantyEndDate', label: 'Warranty Until' },
];

export function OrderTimeline({ order }: OrderTimelineProps) {
  return (
    <div className="admin-timeline">
      <h4>Timeline</h4>
      {TIMELINE_ITEMS.map(({ key, label }) => {
        const value = order[key] as string | null | undefined;
        const hasValue = !!value;
        return (
          <div key={key} className={`admin-timeline-item ${hasValue ? 'completed' : 'pending'}`}>
            <div className="admin-timeline-dot" />
            <div className="admin-timeline-label">{label}</div>
            <div className="admin-timeline-date">{hasValue ? formatDate(value) : 'Pending'}</div>
          </div>
        );
      })}
    </div>
  );
}
