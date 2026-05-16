import { useState } from 'react';
import {
    updateOrganizationStatus,
    updateOrganizationOwner,
    reclassifyOrganization,
} from '../../services/organizationAdminService';
import { MergeOrgDialog } from './MergeOrgDialog';

interface Props {
    org: any;
    onUpdate: () => void;
}

export function OrganizationHeaderPanel({ org, onUpdate }: Props) {
    const [status, setStatus] = useState(org.status ?? 'active');
    const [owner, setOwner] = useState(org.ownerSalesRep ?? '');
    const [busy, setBusy] = useState(false);
    const [mergeOpen, setMergeOpen] = useState(false);

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
        <aside className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] p-5 md:p-6 lg:sticky lg:top-6 self-start">
            <div className="flex items-start gap-3 mb-1">
                <span className="w-10 h-10 bg-primary-fixed text-primary rounded-lg flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined">domain</span>
                </span>
                <div className="min-w-0">
                    <h2 className="font-headline text-xl md:text-2xl font-bold text-on-surface tracking-tight truncate">
                        {org.displayName ?? org.orgId}
                    </h2>
                    <p className="text-xs text-on-surface-variant italic truncate">{org.primaryDomain}</p>
                </div>
            </div>

            <div className="mt-6 space-y-3">
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Type</span>
                    <span className="font-headline font-semibold text-on-surface text-sm">{org.type}</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Country</span>
                    <span className="font-headline font-semibold text-on-surface text-sm">{org.country ?? '—'}</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Lead score</span>
                    <span className="font-headline font-semibold text-primary text-sm tabular-nums">{org.leadScore ?? 0}</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">First seen</span>
                    <span className="font-headline font-semibold text-on-surface text-sm">{org.firstSeenAt?.slice(0, 10) ?? '—'}</span>
                </div>
                <div className="flex justify-between items-baseline">
                    <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Last activity</span>
                    <span className="font-headline font-semibold text-on-surface text-sm">{org.lastActivityAt?.slice(0, 10) ?? '—'}</span>
                </div>
                {org.aiClassifiedAt && (
                    <div className="flex justify-between items-baseline gap-2">
                        <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest shrink-0">AI classified</span>
                        <span className="font-headline font-semibold text-on-surface text-sm text-right">
                            {org.aiClassifiedAt.slice(0, 10)}
                            <span className="ml-1 text-[10px] text-on-surface-variant font-medium">({org.aiProvider})</span>
                        </span>
                    </div>
                )}
            </div>

            <div className="mt-6 pt-6 border-t border-outline-variant/10 space-y-4">
                <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Status</label>
                    <select
                        value={status}
                        onChange={(e) => saveStatus(e.target.value)}
                        disabled={busy}
                        className="w-full bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface border-none outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50"
                    >
                        <option value="active">active</option>
                        <option value="archived">archived</option>
                        <option value="blocked">blocked</option>
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-2">Owner</label>
                    <input
                        type="email"
                        value={owner}
                        onChange={(e) => setOwner(e.target.value)}
                        onBlur={() => saveOwner(owner)}
                        placeholder="sales@ninescrolls.com"
                        disabled={busy}
                        className="w-full bg-surface-container-low px-3 py-2 rounded-lg text-sm text-on-surface placeholder:text-on-surface-variant/60 border-none outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                    />
                </div>

                <button
                    onClick={doReclassify}
                    disabled={busy}
                    className="w-full px-4 py-2.5 bg-secondary text-on-secondary rounded-lg font-headline font-bold text-sm hover:bg-secondary-container transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    Reclassify with AI
                </button>

                <button
                    onClick={() => setMergeOpen(true)}
                    disabled={busy}
                    className="w-full px-4 py-2.5 bg-transparent border border-outline-variant text-on-surface-variant rounded-lg font-headline font-semibold text-sm hover:bg-surface-variant/20 hover:text-on-surface transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className="material-symbols-outlined text-base">merge</span>
                    Merge into another Org…
                </button>
            </div>

            {org.aliasDomains?.length > 0 && (
                <div className="mt-6 pt-6 border-t border-outline-variant/10">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-3">Alias domains</p>
                    <ul className="space-y-1.5">
                        {org.aliasDomains.map((d: string) => (
                            <li key={d} className="flex items-center gap-2 text-sm text-on-surface-variant">
                                <span className="material-symbols-outlined text-on-surface-variant/60 text-sm">link</span>
                                <span className="italic">{d}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <MergeOrgDialog
                sourceOrg={org}
                open={mergeOpen}
                onClose={() => {
                    setMergeOpen(false);
                    onUpdate();
                }}
            />
        </aside>
    );
}
