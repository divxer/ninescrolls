import { useState } from 'react';
import { Link } from 'react-router-dom';

interface Props {
    recentRfqs: any[];
    recentOrders: any[];
    recentLeads: any[];
}

export function OrganizationTimeline({ recentRfqs, recentOrders, recentLeads }: Props) {
    const [tab, setTab] = useState<'rfqs' | 'orders' | 'leads' | 'tenders'>('rfqs');

    return (
        <div className="org-timeline">
            <div className="tabs">
                <button onClick={() => setTab('rfqs')} className={tab === 'rfqs' ? 'active' : ''}>
                    RFQs ({recentRfqs.length})
                </button>
                <button onClick={() => setTab('orders')} className={tab === 'orders' ? 'active' : ''}>
                    Orders ({recentOrders.length})
                </button>
                <button onClick={() => setTab('leads')} className={tab === 'leads' ? 'active' : ''}>
                    Leads ({recentLeads.length})
                </button>
                <button onClick={() => setTab('tenders')} className={tab === 'tenders' ? 'active' : ''}>
                    Tenders (0)
                </button>
            </div>

            {tab === 'rfqs' && recentRfqs.map((r) => (
                <div key={r.rfqId} className="timeline-row">
                    <span>{r.submittedAt?.slice(0, 10)}</span>
                    <Link to={`/admin/rfqs/${r.rfqId}`}>{r.equipmentCategory} — {r.institution}</Link>
                </div>
            ))}
            {tab === 'orders' && recentOrders.map((o) => (
                <div key={o.orderId} className="timeline-row">
                    <span>{o.quoteDate?.slice(0, 10)}</span>
                    <Link to={`/admin/orders/${o.orderId}`}>{o.productModel} — ${o.quoteAmount?.toLocaleString()}</Link>
                </div>
            ))}
            {tab === 'leads' && recentLeads.map((l) => (
                <div key={l.leadId} className="timeline-row">
                    <span>{l.submittedAt?.slice(0, 10)}</span>
                    <Link to={`/admin/leads/${l.leadId}`}>{l.type} — {l.topic ?? l.productName ?? ''}</Link>
                </div>
            ))}
            {tab === 'tenders' && (
                <div className="empty-state">
                    Tender &rarr; Organization matching arrives in Phase D.
                </div>
            )}
        </div>
    );
}
