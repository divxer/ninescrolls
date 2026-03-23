import { useState } from 'react';
import type { OrderLog } from '../../types/admin';
import { formatDateTime } from '../../types/admin';
import { StatusBadge } from './StatusBadge';

interface ActivityLogProps {
  logs: OrderLog[];
  loading?: boolean;
}

export function ActivityLog({ logs, loading }: ActivityLogProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
        <p className="text-sm text-on-surface-variant">Loading activity log...</p>
      </div>
    );
  }

  const displayed = expanded ? logs : logs.slice(0, 5);

  return (
    <div className="bg-surface-container-lowest rounded-xl p-6 border border-outline-variant/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold tracking-wider text-primary uppercase">Activity Audit</h3>
        {logs.length > 5 && (
          <button
            className="text-[11px] font-bold text-secondary uppercase tracking-widest hover:underline bg-transparent border-none cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : `Show All (${logs.length})`}
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No activity yet.</p>
      ) : (
        <div className="relative space-y-6 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-outline-variant/20">
          {displayed.map((log, i) => {
            const isStatusChange = !!(log.fromStatus && log.toStatus);
            return (
              <div key={i} className="relative pl-8">
                {/* Dot */}
                <div className={`absolute left-0 top-1 w-6 h-6 rounded-full bg-surface-container-lowest flex items-center justify-center z-10 ${
                  isStatusChange ? 'border-2 border-secondary' : 'border-2 border-outline-variant/30'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${isStatusChange ? 'bg-secondary' : 'bg-outline-variant'}`} />
                </div>

                {/* Content */}
                <div>
                  <p className="text-xs text-on-surface-variant">
                    <span className="font-bold text-primary">{log.operator}</span>
                    {' '}{log.detail || log.action}
                  </p>
                  {isStatusChange && (
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={log.fromStatus!} />
                      <span className="text-on-surface-variant text-xs">&rarr;</span>
                      <StatusBadge status={log.toStatus!} />
                    </div>
                  )}
                  <p className="text-[10px] text-on-surface-variant/60 mt-1">
                    {formatDateTime(log.timestamp)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
