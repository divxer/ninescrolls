import { useState } from 'react';
import {
    updateOrganizationStatus,
    updateOrganizationOwner,
    reclassifyOrganization,
} from '../../services/organizationAdminService';

interface Props {
    org: any;
    onUpdate: () => void;
}

export function OrganizationHeaderPanel({ org, onUpdate }: Props) {
    const [status, setStatus] = useState(org.status ?? 'active');
    const [owner, setOwner] = useState(org.ownerSalesRep ?? '');
    const [busy, setBusy] = useState(false);

    async function saveStatus(newStatus: string) {
        setBusy(true);
        try {
            await updateOrganizationStatus({ orgId: org.orgId, status: newStatus });
            setStatus(newStatus);
            onUpdate();
        } finally { setBusy(false); }
    }

    async function saveOwner(newOwner: string) {
        setBusy(true);
        try {
            await updateOrganizationOwner({ orgId: org.orgId, ownerSalesRep: newOwner || undefined });
            setOwner(newOwner);
            onUpdate();
        } finally { setBusy(false); }
    }

    async function doReclassify() {
        setBusy(true);
        try {
            await reclassifyOrganization({ orgId: org.orgId, force: true });
            onUpdate();
        } finally { setBusy(false); }
    }

    return (
        <aside className="org-header-panel">
            <h2>{org.displayName ?? org.orgId}</h2>
            <div className="primary-domain">{org.primaryDomain}</div>
            <div className="org-meta">
                <div><strong>Type:</strong> {org.type}</div>
                <div><strong>Country:</strong> {org.country ?? '—'}</div>
                <div><strong>Lead score:</strong> {org.leadScore ?? 0}</div>
                <div><strong>First seen:</strong> {org.firstSeenAt?.slice(0, 10) ?? '—'}</div>
                <div><strong>Last activity:</strong> {org.lastActivityAt?.slice(0, 10) ?? '—'}</div>
                {org.aiClassifiedAt && (
                    <div><strong>AI classified:</strong> {org.aiClassifiedAt.slice(0, 10)} ({org.aiProvider})</div>
                )}
            </div>

            <label>
                Status:
                <select value={status} onChange={(e) => saveStatus(e.target.value)} disabled={busy}>
                    <option value="active">active</option>
                    <option value="archived">archived</option>
                    <option value="blocked">blocked</option>
                </select>
            </label>

            <label>
                Owner:
                <input
                    type="email"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    onBlur={() => saveOwner(owner)}
                    placeholder="sales@ninescrolls.com"
                    disabled={busy}
                />
            </label>

            <button onClick={doReclassify} disabled={busy}>Reclassify with AI</button>

            {org.aliasDomains?.length > 0 && (
                <div className="alias-domains">
                    <strong>Alias domains:</strong>
                    <ul>{org.aliasDomains.map((d: string) => <li key={d}>{d}</li>)}</ul>
                </div>
            )}
        </aside>
    );
}
