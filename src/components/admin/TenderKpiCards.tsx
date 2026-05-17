interface Props {
    todayNew: number;
    weekNew: number;
    highPriority: number;
    closingSoon: number;
    onClick: (kpi: 'todayNew' | 'weekNew' | 'highPriority' | 'closingSoon') => void;
}

interface CardDef {
    key: 'todayNew' | 'weekNew' | 'highPriority' | 'closingSoon';
    label: string;
}

const CARDS: CardDef[] = [
    { key: 'todayNew', label: 'Today (new)' },
    { key: 'weekNew', label: 'This week (new)' },
    { key: 'highPriority', label: 'High priority (≥80)' },
    { key: 'closingSoon', label: 'Closing <7 days' },
];

export function TenderKpiCards({ todayNew, weekNew, highPriority, closingSoon, onClick }: Props) {
    const values: Record<CardDef['key'], number> = { todayNew, weekNew, highPriority, closingSoon };
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {CARDS.map((c) => (
                <button
                    key={c.key}
                    onClick={() => onClick(c.key)}
                    className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 shadow-sm hover:-translate-y-0.5 transition-transform p-4 text-left"
                >
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">{c.label}</p>
                    <div className="mt-2 text-2xl md:text-3xl font-headline font-black text-on-surface">{values[c.key]}</div>
                </button>
            ))}
        </div>
    );
}
