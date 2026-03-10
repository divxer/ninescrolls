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

  if (loading) return <div className="admin-loading">Loading activity log...</div>;

  const displayed = expanded ? logs : logs.slice(0, 5);

  return (
    <div className="admin-panel">
      <div className="admin-panel-header">
        <h3>Activity Log ({logs.length})</h3>
        {logs.length > 5 && (
          <button className="admin-btn-sm admin-btn-outline" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show Less' : `Show All (${logs.length})`}
          </button>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="admin-empty">No activity yet.</p>
      ) : (
        <div className="admin-activity-list">
          {displayed.map((log, i) => (
            <div key={i} className="admin-activity-item">
              <div className="admin-activity-time">{formatDateTime(log.timestamp)}</div>
              <div className="admin-activity-content">
                <strong>{log.operator}</strong>: {log.detail || log.action}
                {log.fromStatus && log.toStatus && (
                  <span style={{ marginLeft: '8px' }}>
                    <StatusBadge status={log.fromStatus} /> &rarr; <StatusBadge status={log.toStatus} />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
