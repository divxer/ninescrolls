interface Props {
    total: number;
    highLeadScore: number;
    newThisWeek: number;
    withoutOwner: number;
    onClickKpi: (kpi: 'all' | 'highLeadScore' | 'newThisWeek' | 'withoutOwner') => void;
}

interface KpiCardProps {
    label: string;
    value: number | string;
    icon: string;
    onClick: () => void;
}

function KpiCard({ label, value, icon, onClick }: KpiCardProps) {
    return (
        <button
            onClick={onClick}
            className="bg-surface-container-lowest rounded-xl border border-outline-variant/5 shadow-[0px_10px_30px_rgba(2,36,72,0.04)] flex flex-col justify-between items-start hover:-translate-y-0.5 transition-transform p-4 md:p-6 text-left w-full cursor-pointer"
        >
            <div className="flex items-center justify-between w-full">
                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{label}</p>
                <span className="material-symbols-outlined text-on-surface-variant/60 text-lg">{icon}</span>
            </div>
            <div className="flex items-baseline gap-2 mt-4">
                <span className="font-headline text-4xl font-bold text-primary tracking-tight">{value}</span>
            </div>
        </button>
    );
}

export function OrganizationKpiCards({ total, highLeadScore, newThisWeek, withoutOwner, onClickKpi }: Props) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            <KpiCard
                label="Total active"
                value={total}
                icon="domain"
                onClick={() => onClickKpi('all')}
            />
            <KpiCard
                label="Lead score ≥ 50"
                value={highLeadScore}
                icon="trending_up"
                onClick={() => onClickKpi('highLeadScore')}
            />
            <KpiCard
                label="New this week"
                value={newThisWeek}
                icon="fiber_new"
                onClick={() => onClickKpi('newThisWeek')}
            />
            <KpiCard
                label="Without owner"
                value={withoutOwner}
                icon="person_off"
                onClick={() => onClickKpi('withoutOwner')}
            />
        </div>
    );
}
