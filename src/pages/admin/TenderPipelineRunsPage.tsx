import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { PipelineRunSummary, TenderSource } from '../../../amplify/lib/tender-watch/pipeline-run-types';
import { listPipelineRuns } from '../../services/tenderAdminService';

function formatPacific(iso: string): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: false });
}

function formatDuration(ms: number): string {
    const sec = Math.round((ms ?? 0) / 1000);
    return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

function statusClass(status: string): string {
    if (status === 'SUCCESS') return 'bg-emerald-100 text-emerald-700';
    if (status === 'PARTIAL') return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
}

function sourceState(run: PipelineRunSummary, source: TenderSource): string {
    if (!run.sourcesAttempted?.includes(source)) return 'bg-surface-container-highest';
    return run.sourcesFailed?.includes(source) ? 'bg-red-500' : 'bg-emerald-500';
}

export function TenderPipelineRunsPage() {
    const [rows, setRows] = useState<PipelineRunSummary[] | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function load() {
        setError(null);
        try {
            setRows(await listPipelineRuns(100) as PipelineRunSummary[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        }
    }

    useEffect(() => { void load(); }, []);

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-1">Tender Watch</p>
                    <h1 className="font-headline text-2xl md:text-4xl font-black text-on-surface tracking-tighter">Pipeline Runs</h1>
                </div>
                <button onClick={load} className="px-3 py-2 text-xs font-bold text-primary hover:bg-surface-variant rounded-lg">
                    <span className="material-symbols-outlined align-middle mr-1 text-sm">refresh</span>
                    Refresh
                </button>
            </div>

            {error && <div className="bg-error-container text-on-error-container p-4 rounded-lg mb-3 text-sm">{error}</div>}
            {!rows ? (
                <div className="text-center py-8 text-sm text-on-surface-variant">Loading runs...</div>
            ) : (
                <div className="overflow-x-auto bg-surface rounded-lg border border-outline-variant/20">
                    <table className="w-full text-sm">
                        <thead className="text-left text-xs uppercase tracking-wider text-on-surface-variant bg-surface-container-low">
                            <tr>
                                <th className="px-4 py-3">Started PT</th>
                                <th className="px-4 py-3">Duration</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Sources</th>
                                <th className="px-4 py-3 text-right">Fetched</th>
                                <th className="px-4 py-3 text-right">HP</th>
                                <th className="px-4 py-3">Notify</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-outline-variant/20">
                            {rows.map((run) => (
                                <tr key={run.executionId} className="hover:bg-surface-container-low">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <Link className="text-primary hover:underline font-medium" to={`/admin/tenders/runs/${encodeURIComponent(run.executionId)}`}>
                                            {formatPacific(run.startedAt)}
                                        </Link>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">{formatDuration(run.durationMs)}</td>
                                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-bold ${statusClass(run.status)}`}>{run.status}</span></td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2" title="sam / ted / calusource">
                                            {(['sam', 'ted', 'calusource'] as TenderSource[]).map(src => (
                                                <span key={src} className={`w-3 h-3 rounded-full ${sourceState(run, src)}`} />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right tabular-nums">{run.totalFetched}</td>
                                    <td className="px-4 py-3 text-right tabular-nums">{run.totalHighPriority}</td>
                                    <td className="px-4 py-3">{run.notificationStatus}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
