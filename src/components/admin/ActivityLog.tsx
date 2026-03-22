import { useState } from 'react';
import type { OrderLog } from '../../types/admin';
import { formatDateTime } from '../../types/admin';
import { StatusBadge } from './StatusBadge';

interface ActivityLogProps {
  logs: OrderLog[];
  loading?: boolean;
}

function getLogIcon(log: OrderLog): { icon: string; classes: string } {
  if (log.fromStatus && log.toStatus) {
    return { icon: 'swap_horiz', classes: 'bg-primary text-white' };
  }
  if (log.action?.toLowerCase().includes('note') || log.action?.toLowerCase().includes('comment')) {
    return { icon: 'sticky_note_2', classes: 'bg-surface-container-high text-on-surface-variant' };
  }
  return { icon: 'edit', classes: 'bg-secondary-container text-white' };
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
    <div className="bg-surface-container-lowest rounded-xl p-6 shadow-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-on-surface-variant text-lg">history</span>
          <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">
            Activity Log ({logs.length})
          </h3>
        </div>
        {logs.length > 5 && (
          <button
            className="text-[11px] font-bold text-secondary uppercase tracking-widest hover:underline"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? 'Show Less' : `Show All (${logs.length})`}
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-on-surface-variant">No activity yet.</p>
      ) : (
        <div className="relative before:absolute before:left-3.5 before:top-2 before:bottom-0 before:w-px before:bg-outline-variant/30">
          <div className="space-y-5">
            {displayed.map((log, i) => {
              const { icon, classes } = getLogIcon(log);
              return (
                <div key={i} className="relative pl-10">
                  {/* Circle icon */}
                  <div
                    className={`absolute left-0 top-0 w-7 h-7 rounded-full flex items-center justify-center ring-4 ring-surface-container-lowest ${classes}`}
                  >
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </div>

                  {/* Content */}
                  <div>
                    <p className="text-xs font-bold text-on-surface">
                      <span>{log.operator}</span>
                      <span className="font-normal text-on-surface-variant">
                        {' '}&mdash; {log.detail || log.action}
                      </span>
                    </p>
                    {log.fromStatus && log.toStatus && (
                      <div className="flex items-center gap-2 mt-1">
                        <StatusBadge status={log.fromStatus} />
                        <span className="text-on-surface-variant text-xs">&rarr;</span>
                        <StatusBadge status={log.toStatus} />
                      </div>
                    )}
                    <p className="text-[10px] text-on-surface-variant mt-1">
                      {formatDateTime(log.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
