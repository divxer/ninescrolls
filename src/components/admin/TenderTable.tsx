import { Link } from 'react-router-dom';
import { TenderStatusDropdown } from './TenderStatusDropdown';

interface Props {
    items: any[];
    selectedIds: string[];
    onToggleSelected: (id: string) => void;
    onRefresh: () => void;
}

function scoreColor(score: number): string {
    if (score >= 80) return 'bg-error-container text-on-error-container';
    if (score >= 60) return 'bg-tertiary-container text-on-tertiary-container';
    if (score >= 30) return 'bg-secondary-container text-on-secondary-container';
    return 'bg-surface-container-high text-on-surface-variant';
}

function deadlineLabel(deadline: string | null | undefined): string {
    if (!deadline) return '—';
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return deadline;
    const days = Math.floor((d.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const dateStr = deadline.slice(0, 10);
    if (days < 0) return `${dateStr} (expired)`;
    return `${dateStr} (${days}d)`;
}

export function TenderTable({ items, selectedIds, onToggleSelected, onRefresh }: Props) {
    if (items.length === 0) {
        return <div className="p-8 text-center text-sm text-on-surface-variant">No tenders match these filters.</div>;
    }
    const selectedSet = new Set(selectedIds);
    return (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/30 overflow-x-auto">
            <table className="min-w-full text-sm">
                <thead className="bg-surface-container-low border-b border-outline-variant/30">
                    <tr>
                        <th className="px-2 py-2 w-8"></th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Score</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Title</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Agency</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Country</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Deadline</th>
                        <th className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((t) => {
                        const dlLabel = deadlineLabel(t.deadline);
                        const closingSoon = t.deadline && (new Date(t.deadline).getTime() - Date.now()) < 7 * 86400_000;
                        return (
                            <tr key={t.tenderId} className="border-b border-outline-variant/10 hover:bg-surface-container-low/50">
                                <td className="px-2 py-2">
                                    <input
                                        type="checkbox"
                                        checked={selectedSet.has(t.tenderId)}
                                        onChange={() => onToggleSelected(t.tenderId)}
                                    />
                                </td>
                                <td className="px-3 py-2">
                                    <span className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-[11px] font-bold ${scoreColor(t.overallScore ?? 0)}`}>
                                        {t.overallScore ?? 0}
                                    </span>
                                </td>
                                <td className="px-3 py-2 max-w-md truncate">
                                    <Link to={`/admin/tenders/${t.tenderId}`} className="text-primary hover:underline" title={t.title}>{t.title}</Link>
                                </td>
                                <td className="px-3 py-2 max-w-[200px] truncate" title={t.agency}>{t.agency}</td>
                                <td className="px-3 py-2 text-xs text-on-surface-variant">{t.country ?? '—'}</td>
                                <td className={`px-3 py-2 text-xs ${closingSoon ? 'text-error font-medium' : 'text-on-surface-variant'}`}>{dlLabel}</td>
                                <td className="px-3 py-2">
                                    <TenderStatusDropdown tender={t} onUpdated={onRefresh} />
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
