import { useParams, Link } from 'react-router-dom';
import { useOrganization } from '../../hooks/useOrganization';
import { useOrganizationTimeline } from '../../hooks/useOrganizationTimeline';
import { OrganizationHeaderPanel } from '../../components/admin/OrganizationHeaderPanel';
import { OrganizationTimeline } from '../../components/admin/OrganizationTimeline';

interface AggregateCardProps {
    label: string;
    value: string | number;
    icon: string;
}

function AggregateCard({ label, value, icon }: AggregateCardProps) {
    return (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] p-4 md:p-6 hover:-translate-y-0.5 transition-transform">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{label}</p>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-lg">{icon}</span>
            </div>
            <div className="font-headline text-3xl md:text-4xl font-bold text-primary tracking-tight tabular-nums">{value}</div>
        </div>
    );
}

export function OrganizationDetailPage() {
    const { orgId } = useParams<{ orgId: string }>();
    const { data, loading, error, refresh } = useOrganization(orgId);
    const timeline = useOrganizationTimeline(orgId);

    if (loading) {
        return <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">Loading organization...</div>;
    }
    if (error) {
        return <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body">Error: {error.message}</div>;
    }
    if (!data) {
        return <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">Organization not found.</div>;
    }

    return (
        <div>
            <Link
                to="/admin/organizations"
                className="inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-primary transition-colors mb-4 md:mb-6 no-underline"
            >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Back to organizations
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
                <div className="lg:col-span-4">
                    <OrganizationHeaderPanel org={data.organization} onUpdate={refresh} />
                </div>
                <div className="lg:col-span-8 space-y-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                        <AggregateCard
                            label="RFQs"
                            value={data.organization.rfqCount ?? 0}
                            icon="description"
                        />
                        <AggregateCard
                            label="Orders"
                            value={data.organization.orderCount ?? 0}
                            icon="receipt_long"
                        />
                        <AggregateCard
                            label="Leads"
                            value={data.organization.leadCount ?? 0}
                            icon="person_search"
                        />
                        <AggregateCard
                            label="Total order value"
                            value={`$${(data.organization.totalOrderValueUSD ?? 0).toLocaleString()}`}
                            icon="payments"
                        />
                    </div>
                    <OrganizationTimeline
                        items={timeline.items}
                        loading={timeline.loading}
                        error={timeline.error}
                        hasMore={timeline.hasMore}
                        loadMore={timeline.loadMore}
                        reload={timeline.reload}
                        includeInternal={timeline.includeInternal}
                        setIncludeInternal={timeline.setIncludeInternal}
                    />
                </div>
            </div>
        </div>
    );
}
