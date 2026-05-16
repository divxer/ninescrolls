import { useState } from 'react';
import { Link } from 'react-router-dom';

interface Props {
    recentRfqs: any[];
    recentOrders: any[];
    recentLeads: any[];
}

type Tab = 'rfqs' | 'orders' | 'leads' | 'tenders';

function TabButton({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-2 rounded-full text-xs border-none cursor-pointer transition-colors whitespace-nowrap ${
                active
                    ? 'bg-primary text-on-primary font-semibold'
                    : 'bg-surface-container-low text-on-surface-variant font-medium hover:bg-surface-container'
            }`}
        >
            {label} <span className={active ? 'opacity-80' : 'opacity-60'}>({count})</span>
        </button>
    );
}

function TimelineEmpty({ children }: { children: React.ReactNode }) {
    return (
        <div className="py-10 text-center text-sm text-on-surface-variant italic">
            {children}
        </div>
    );
}

function TimelineRow({ date, children }: { date: string | undefined; children: React.ReactNode }) {
    return (
        <div className="flex items-start gap-4 py-3 border-b border-outline-variant/5 last:border-b-0">
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest shrink-0 w-24 pt-0.5">
                {date ?? '—'}
            </span>
            <div className="flex-1 min-w-0 text-sm text-on-surface">
                {children}
            </div>
        </div>
    );
}

export function OrganizationTimeline({ recentRfqs, recentOrders, recentLeads }: Props) {
    const [tab, setTab] = useState<Tab>('rfqs');

    return (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-2 mb-5 md:mb-6">
                <TabButton active={tab === 'rfqs'} onClick={() => setTab('rfqs')} label="RFQs" count={recentRfqs.length} />
                <TabButton active={tab === 'orders'} onClick={() => setTab('orders')} label="Orders" count={recentOrders.length} />
                <TabButton active={tab === 'leads'} onClick={() => setTab('leads')} label="Leads" count={recentLeads.length} />
                <TabButton active={tab === 'tenders'} onClick={() => setTab('tenders')} label="Tenders" count={0} />
            </div>

            <div>
                {tab === 'rfqs' && (
                    recentRfqs.length === 0
                        ? <TimelineEmpty>No recent RFQs.</TimelineEmpty>
                        : recentRfqs.map((r) => (
                            <TimelineRow key={r.rfqId} date={r.submittedAt?.slice(0, 10)}>
                                <Link to={`/admin/rfqs/${r.rfqId}`} className="font-medium text-primary hover:underline">
                                    {r.equipmentCategory} — {r.institution}
                                </Link>
                            </TimelineRow>
                        ))
                )}
                {tab === 'orders' && (
                    recentOrders.length === 0
                        ? <TimelineEmpty>No recent orders.</TimelineEmpty>
                        : recentOrders.map((o) => (
                            <TimelineRow key={o.orderId} date={o.quoteDate?.slice(0, 10)}>
                                <Link to={`/admin/orders/${o.orderId}`} className="font-medium text-primary hover:underline">
                                    {o.productModel}
                                    {o.quoteAmount != null && (
                                        <span className="ml-2 font-headline font-semibold text-on-surface">
                                            ${o.quoteAmount.toLocaleString()}
                                        </span>
                                    )}
                                </Link>
                            </TimelineRow>
                        ))
                )}
                {tab === 'leads' && (
                    recentLeads.length === 0
                        ? <TimelineEmpty>No recent leads.</TimelineEmpty>
                        : recentLeads.map((l) => (
                            <TimelineRow key={l.leadId} date={l.submittedAt?.slice(0, 10)}>
                                <Link to={`/admin/leads/${l.leadId}`} className="font-medium text-primary hover:underline">
                                    {l.type} — {l.topic ?? l.productName ?? ''}
                                </Link>
                            </TimelineRow>
                        ))
                )}
                {tab === 'tenders' && (
                    <TimelineEmpty>
                        Tender → Organization matching arrives in Phase D.
                    </TimelineEmpty>
                )}
            </div>
        </div>
    );
}
