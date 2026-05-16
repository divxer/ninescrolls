import { useParams, Link } from 'react-router-dom';
import { useOrganization } from '../../hooks/useOrganization';
import { OrganizationHeaderPanel } from '../../components/admin/OrganizationHeaderPanel';
import { OrganizationTimeline } from '../../components/admin/OrganizationTimeline';

export function OrganizationDetailPage() {
    const { orgId } = useParams<{ orgId: string }>();
    const { data, loading, error, refresh } = useOrganization(orgId);

    if (loading) return <div>Loading...</div>;
    if (error) return <div className="error">{error.message}</div>;
    if (!data) return <div>Not found.</div>;

    return (
        <div className="org-detail-page">
            <Link to="/admin/organizations">&larr; Back to list</Link>
            <div className="two-column">
                <OrganizationHeaderPanel org={data.organization} onUpdate={refresh} />
                <main className="org-main">
                    <div className="aggregate-cards">
                        <div className="agg-card">
                            <div className="agg-value">{data.organization.rfqCount ?? 0}</div>
                            <div className="agg-label">RFQs</div>
                        </div>
                        <div className="agg-card">
                            <div className="agg-value">{data.organization.orderCount ?? 0}</div>
                            <div className="agg-label">Orders</div>
                        </div>
                        <div className="agg-card">
                            <div className="agg-value">{data.organization.leadCount ?? 0}</div>
                            <div className="agg-label">Leads</div>
                        </div>
                        <div className="agg-card">
                            <div className="agg-value">${(data.organization.totalOrderValueUSD ?? 0).toLocaleString()}</div>
                            <div className="agg-label">Total order value</div>
                        </div>
                    </div>
                    <OrganizationTimeline
                        recentRfqs={data.recentRfqs ?? []}
                        recentOrders={data.recentOrders ?? []}
                        recentLeads={data.recentLeads ?? []}
                    />
                </main>
            </div>
        </div>
    );
}
