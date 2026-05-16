import { Link } from 'react-router-dom';

interface Props {
    items: any[];
}

function relativeTime(iso: string | undefined): string {
    if (!iso) return '—';
    const ms = Date.now() - new Date(iso).getTime();
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

export function OrganizationTable({ items }: Props) {
    if (!items.length) {
        return <div className="empty-state">No organizations match these filters.</div>;
    }
    return (
        <table className="org-table">
            <thead>
                <tr>
                    <th>Organization</th>
                    <th>Domain</th>
                    <th>Type</th>
                    <th>Country</th>
                    <th>Lead score</th>
                    <th>Last activity</th>
                    <th>Status</th>
                    <th>Owner</th>
                </tr>
            </thead>
            <tbody>
                {items.map((org) => (
                    <tr key={org.orgId}>
                        <td><Link to={`/admin/organizations/${org.orgId}`}>{org.displayName ?? org.orgId}</Link></td>
                        <td>{org.primaryDomain}</td>
                        <td><span className={`type-chip type-${org.type}`}>{org.type}</span></td>
                        <td>{org.country ?? '—'}</td>
                        <td>
                            <div className="lead-score-bar">
                                <div className="lead-score-fill" style={{ width: `${Math.min(100, (org.leadScore ?? 0))}%` }} />
                                <span>{org.leadScore ?? 0}</span>
                            </div>
                        </td>
                        <td>{relativeTime(org.lastActivityAt)}</td>
                        <td><span className={`status-chip status-${org.status}`}>{org.status}</span></td>
                        <td>{org.ownerSalesRep ?? '—'}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
