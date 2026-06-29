import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { useOrganizations } from '../../hooks/useOrganizations';
import { mergeOrganization } from '../../services/organizationAdminService';

// Minimal Org shape this dialog reads from. Org records come from Amplify with
// no shared domain type, so we describe just the fields consumed here.
interface OrgSummary {
    orgId: string;
    displayName?: string | null;
    primaryDomain?: string | null;
    type?: string | null;
    leadScore?: number | null;
    rfqCount?: number | null;
    orderCount?: number | null;
    leadCount?: number | null;
    aliasDomains?: unknown[] | null;
}

interface MergeOrgDialogProps {
    sourceOrg: OrgSummary;
    open: boolean;
    onClose: () => void;
}

const inputClass = 'w-full bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-sm px-4 py-2.5 text-on-surface placeholder:text-outline-variant transition-all';

export function MergeOrgDialog({ sourceOrg, open, onClose }: MergeOrgDialogProps) {
    const navigate = useNavigate();
    // Pull a large page of Orgs (Phase C lists return first 25 by default — bump the limit).
    const { data, loading } = useOrganizations({ limit: 500 });
    const [search, setSearch] = useState('');
    const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');

    const candidates = useMemo(() => {
        const items = (data?.items ?? []) as OrgSummary[];
        const filtered = items.filter((o) => o.orgId !== sourceOrg.orgId);
        if (!search.trim()) return filtered;
        const needle = search.toLowerCase();
        return filtered.filter((o) =>
            (o.displayName ?? '').toLowerCase().includes(needle) ||
            (o.primaryDomain ?? '').toLowerCase().includes(needle) ||
            (o.orgId ?? '').toLowerCase().includes(needle),
        );
    }, [data, search, sourceOrg.orgId]);

    const selectedTarget = useMemo(
        () => candidates.find((c) => c.orgId === selectedTargetId) ?? null,
        [candidates, selectedTargetId],
    );

    function reset() {
        setSearch('');
        setSelectedTargetId(null);
        setSubmitting(false);
        setConfirming(false);
        setError('');
    }

    function handleClose() {
        if (submitting) return;
        reset();
        onClose();
    }

    async function handleMerge() {
        if (!selectedTarget) return;
        setSubmitting(true);
        setError('');
        try {
            await mergeOrganization({
                sourceOrgId: sourceOrg.orgId,
                targetOrgId: selectedTarget.orgId,
            });
            reset();
            onClose();
            navigate(`/admin/organizations/${selectedTarget.orgId}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Merge failed');
            setSubmitting(false);
            setConfirming(false);
        }
    }

    // Preview numbers
    const srcRfqCount = sourceOrg.rfqCount ?? 0;
    const srcOrderCount = sourceOrg.orderCount ?? 0;
    const srcLeadCount = sourceOrg.leadCount ?? 0;
    const srcAliasCount = (sourceOrg.aliasDomains?.length ?? 0)
        + (sourceOrg.primaryDomain ? 1 : 0);
    const srcLeadScore = sourceOrg.leadScore ?? 0;
    const tgtLeadScore = selectedTarget?.leadScore ?? 0;

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="Merge into another Org"
            subtitle={`Choose the canonical Org that "${sourceOrg.displayName ?? sourceOrg.orgId}" should be merged into. The source Org will be archived.`}
            className="max-w-2xl"
            footer={
                <>
                    {!confirming ? (
                        <>
                            <button
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-primary text-on-primary font-semibold text-sm rounded-lg hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50"
                                onClick={() => setConfirming(true)}
                                disabled={!selectedTarget || submitting}
                            >
                                Merge…
                            </button>
                            <button
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-transparent border border-outline-variant text-on-surface-variant font-semibold text-sm rounded-lg hover:bg-surface-variant/20 hover:text-on-surface transition-all active:scale-[0.98]"
                                onClick={handleClose}
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-error text-on-error font-semibold text-sm rounded-lg hover:bg-error/90 transition-all active:scale-[0.98] disabled:opacity-50"
                                onClick={handleMerge}
                                disabled={submitting}
                            >
                                {submitting ? 'Merging…' : 'Yes, merge'}
                            </button>
                            <button
                                className="flex-1 sm:flex-none px-8 py-2.5 bg-transparent border border-outline-variant text-on-surface-variant font-semibold text-sm rounded-lg hover:bg-surface-variant/20 hover:text-on-surface transition-all active:scale-[0.98]"
                                onClick={() => setConfirming(false)}
                                disabled={submitting}
                            >
                                Back
                            </button>
                        </>
                    )}
                </>
            }
        >
            {error && (
                <div className="bg-error-container text-on-error-container p-3 rounded-lg text-sm mb-4">
                    {error}
                </div>
            )}

            {!confirming ? (
                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="Search by name or domain…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className={inputClass}
                        autoFocus
                    />

                    <div className="border border-outline-variant/20 rounded-lg max-h-72 overflow-y-auto">
                        {loading && (
                            <div className="p-4 text-center text-sm text-on-surface-variant">Loading organizations…</div>
                        )}
                        {!loading && candidates.length === 0 && (
                            <div className="p-4 text-center text-sm text-on-surface-variant">No matching organizations</div>
                        )}
                        {!loading && candidates.map((o) => (
                            <button
                                key={o.orgId}
                                type="button"
                                onClick={() => setSelectedTargetId(o.orgId)}
                                className={`w-full text-left px-4 py-2.5 border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container-low transition-colors ${
                                    selectedTargetId === o.orgId ? 'bg-primary-fixed' : 'bg-transparent'
                                }`}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="text-sm font-semibold text-on-surface truncate">
                                            {o.displayName ?? o.orgId}
                                        </div>
                                        <div className="text-xs text-on-surface-variant italic truncate">
                                            {o.primaryDomain ?? o.orgId}
                                        </div>
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-on-surface-variant shrink-0">
                                        {o.type ?? 'unknown'} · score {o.leadScore ?? 0}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {selectedTarget && (
                        <div className="bg-surface-container-low rounded-lg p-4 text-sm text-on-surface space-y-1.5">
                            <div className="font-semibold text-on-surface">
                                Preview: merge into <span className="text-primary">{selectedTarget.displayName ?? selectedTarget.orgId}</span>
                            </div>
                            <div className="text-xs text-on-surface-variant">
                                Will move <strong>{srcRfqCount}</strong> RFQ{srcRfqCount === 1 ? '' : 's'},{' '}
                                <strong>{srcOrderCount}</strong> order{srcOrderCount === 1 ? '' : 's'},{' '}
                                <strong>{srcLeadCount}</strong> lead{srcLeadCount === 1 ? '' : 's'}.
                            </div>
                            <div className="text-xs text-on-surface-variant">
                                Will union up to <strong>{srcAliasCount}</strong> alias domain{srcAliasCount === 1 ? '' : 's'} onto the target.
                            </div>
                            <div className="text-xs text-on-surface-variant">
                                Lead score: {tgtLeadScore} + {srcLeadScore} → <strong>{tgtLeadScore + srcLeadScore}</strong>
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3 text-sm text-on-surface">
                    <p>
                        You are about to merge{' '}
                        <strong>{sourceOrg.displayName ?? sourceOrg.orgId}</strong> ({sourceOrg.primaryDomain}) into{' '}
                        <strong>{selectedTarget?.displayName ?? selectedTarget?.orgId}</strong> ({selectedTarget?.primaryDomain}).
                    </p>
                    <p>
                        All {srcRfqCount + srcOrderCount + srcLeadCount} linked RFQs/Orders/Leads will be re-pointed, alias domains
                        unioned, and the source Org marked as archived.
                    </p>
                    <p className="text-error font-semibold">This cannot be undone. Continue?</p>
                </div>
            )}
        </Modal>
    );
}
