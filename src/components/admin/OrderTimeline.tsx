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
  // Determine which items are completed (have a date)
  const completedStates = TIMELINE_ITEMS.map(({ key }) => !!order[key]);

  // Find the active index: the first empty one after the last completed one
  let lastCompletedIdx = -1;
  for (let i = completedStates.length - 1; i >= 0; i--) {
    if (completedStates[i]) {
      lastCompletedIdx = i;
      break;
    }
  }
  const activeIdx = lastCompletedIdx + 1 < TIMELINE_ITEMS.length ? lastCompletedIdx + 1 : -1;

  // Progress line percentage
  const progressPct =
    lastCompletedIdx >= 0
      ? ((lastCompletedIdx + 0.5) / (TIMELINE_ITEMS.length - 1)) * 100
      : 0;

  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-on-surface-variant text-lg">timeline</span>
        <h4 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
          Timeline
        </h4>
      </div>

      {/* Horizontal stepper */}
      <div className="relative">
        {/* Background line */}
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-surface-container-high" />
        {/* Progress line */}
        <div
          className="absolute top-4 left-4 h-0.5 bg-secondary transition-all duration-500"
          style={{ width: `calc(${progressPct}% - 16px)` }}
        />

        <div className="relative flex justify-between">
          {TIMELINE_ITEMS.map(({ key, label }, idx) => {
            const value = order[key] as string | null | undefined;
            const hasValue = !!value;
            const isActive = idx === activeIdx;

            return (
              <div key={key} className="flex flex-col items-center" style={{ width: `${100 / TIMELINE_ITEMS.length}%` }}>
                {/* Dot */}
                {hasValue ? (
                  <div className="w-8 h-8 bg-secondary text-white rounded-full flex items-center justify-center z-10">
                    <span className="material-symbols-outlined text-base">check</span>
                  </div>
                ) : isActive ? (
                  <div className="w-8 h-8 bg-secondary-fixed text-secondary rounded-full flex items-center justify-center z-10 ring-4 ring-secondary/10 animate-pulse">
                    <span className="material-symbols-outlined text-base">radio_button_checked</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 bg-surface-container-high text-on-surface-variant rounded-full flex items-center justify-center z-10">
                    <span className="material-symbols-outlined text-base">circle</span>
                  </div>
                )}

                {/* Label */}
                <span className="text-[10px] font-bold uppercase tracking-tighter text-on-surface-variant mt-2 text-center leading-tight">
                  {label}
                </span>

                {/* Date */}
                <span className="text-[11px] text-on-surface-variant mt-0.5 text-center">
                  {hasValue ? formatDate(value) : '\u2014'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
