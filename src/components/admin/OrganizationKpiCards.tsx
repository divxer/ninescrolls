interface Props {
    total: number;
    highLeadScore: number;
    newThisWeek: number;
    withoutOwner: number;
    onClickKpi: (kpi: 'all' | 'highLeadScore' | 'newThisWeek' | 'withoutOwner') => void;
}

export function OrganizationKpiCards({ total, highLeadScore, newThisWeek, withoutOwner, onClickKpi }: Props) {
    return (
        <div className="kpi-grid">
            <button className="kpi-card" onClick={() => onClickKpi('all')}>
                <div className="kpi-value">{total}</div>
                <div className="kpi-label">Total active</div>
            </button>
            <button className="kpi-card" onClick={() => onClickKpi('highLeadScore')}>
                <div className="kpi-value">{highLeadScore}</div>
                <div className="kpi-label">Lead score &ge; 50</div>
            </button>
            <button className="kpi-card" onClick={() => onClickKpi('newThisWeek')}>
                <div className="kpi-value">{newThisWeek}</div>
                <div className="kpi-label">New this week</div>
            </button>
            <button className="kpi-card" onClick={() => onClickKpi('withoutOwner')}>
                <div className="kpi-value">{withoutOwner}</div>
                <div className="kpi-label">Without owner</div>
            </button>
        </div>
    );
}
