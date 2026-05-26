import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { PipelineRunSummary, PipelineRunSource } from '../../../amplify/lib/tender-watch/pipeline-run-types';
import { getPipelineRun } from '../../services/tenderAdminService';
import { buildFunnelRows } from './pipelineRunFunnel';

interface RunDetail {
    summary: PipelineRunSummary | null;
    sources: PipelineRunSource[];
}

function formatPacific(iso?: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour12: false });
}

function sfConsoleUrl(arn: string): string {
    return `https://us-east-2.console.aws.amazon.com/states/home?region=us-east-2#/v2/executions/details/${encodeURIComponent(arn)}`;
}

export function TenderPipelineRunDetailPage() {
    const { executionId = '' } = useParams();
    const [detail, setDetail] = useState<RunDetail | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            setError(null);
            try {
                setDetail(await getPipelineRun(executionId) as RunDetail);
            } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
            }
        }
        void load();
    }, [executionId]);

    if (error) return <div className="bg-error-container text-on-error-container p-4 rounded-lg text-sm">{error}</div>;
    if (!detail) return <div className="text-center py-8 text-sm text-on-surface-variant">Loading run...</div>;
    if (!detail.summary) return <div className="text-sm text-on-surface-variant">Run not found. <Link to="/admin/tenders/runs" className="text-primary hover:underline">Back to runs</Link></div>;

    const { summary, sources } = detail;
    const funnel = buildFunnelRows(summary);

    return (
        <div>
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <Link to="/admin/tenders/runs" className="text-xs text-primary hover:underline">Back to runs</Link>
                    <h1 className="font-headline text-2xl md:text-4xl font-black text-on-surface tracking-tighter mt-1">Run {summary.executionId}</h1>
                    <p className="text-sm text-on-surface-variant">{formatPacific(summary.startedAt)} PT</p>
                </div>
                <a className="px-3 py-2 text-xs font-bold text-primary hover:bg-surface-variant rounded-lg no-underline" href={sfConsoleUrl(summary.stepFunctionExecutionArn)} target="_blank" rel="noreferrer">
                    <span className="material-symbols-outlined align-middle mr-1 text-sm">open_in_new</span>
                    SF Console
                </a>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
                <section className="bg-surface rounded-lg border border-outline-variant/20 p-4">
                    <h2 className="font-headline text-lg font-bold mb-3">Overall</h2>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <dt className="text-on-surface-variant">Status</dt><dd className="font-bold">{summary.status}</dd>
                        <dt className="text-on-surface-variant">Duration</dt><dd>{Math.round(summary.durationMs / 1000)}s</dd>
                        <dt className="text-on-surface-variant">Fetched</dt><dd>{summary.totalFetched}</dd>
                        <dt className="text-on-surface-variant">High priority</dt><dd>{summary.totalHighPriority}</dd>
                    </dl>
                </section>
                <section className="bg-surface rounded-lg border border-outline-variant/20 p-4">
                    <h2 className="font-headline text-lg font-bold mb-3">Notifications</h2>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                        <dt className="text-on-surface-variant">Status</dt><dd className="font-bold">{summary.notificationStatus}</dd>
                        <dt className="text-on-surface-variant">Notified</dt><dd>{summary.totalNotified}</dd>
                        <dt className="text-on-surface-variant">Succeeded</dt><dd>{summary.sourcesSucceeded.join(', ') || '-'}</dd>
                        <dt className="text-on-surface-variant">Failed</dt><dd>{summary.sourcesFailed.join(', ') || '-'}</dd>
                    </dl>
                    {summary.lastError && <p className="mt-3 text-xs text-error">{summary.lastError}</p>}
                </section>
            </div>

            <section className="bg-surface rounded-lg border border-outline-variant/20 p-4 mb-6">
                <h2 className="font-headline text-lg font-bold mb-4">Funnel</h2>
                <div className="space-y-3">
                    {funnel.map(row => (
                        <div key={row.label} className="grid grid-cols-[150px_1fr_72px] items-center gap-3 text-sm">
                            <span className="text-on-surface-variant truncate">{row.label}</span>
                            <div className="h-4 bg-surface-container rounded overflow-hidden">
                                <div className="h-full bg-primary" style={{ width: `${row.widthPct}%` }} />
                            </div>
                            <span className="text-right tabular-nums">{row.count}</span>
                        </div>
                    ))}
                </div>
            </section>

            <section className="grid lg:grid-cols-3 gap-4">
                {sources.map(src => (
                    <article key={src.source} className="bg-surface rounded-lg border border-outline-variant/20 p-4">
                        <h2 className="font-headline text-lg font-bold mb-3">{src.source} - {src.status}</h2>
                        <dl className="grid grid-cols-2 gap-2 text-sm">
                            <dt className="text-on-surface-variant">Fetched</dt><dd>{src.fetched ?? '-'}</dd>
                            <dt className="text-on-surface-variant">Normalized</dt><dd>{src.normalized ?? '-'}</dd>
                            <dt className="text-on-surface-variant">Prefilter</dt><dd>{src.prefilterCandidates ?? '-'}</dd>
                            <dt className="text-on-surface-variant">Scored</dt><dd>{src.scored ?? '-'}</dd>
                            <dt className="text-on-surface-variant">LLM avg</dt><dd>{src.llmAvgScore?.toFixed(1) ?? '-'}</dd>
                            <dt className="text-on-surface-variant">Timeouts</dt><dd>{src.llmTimeoutCount ?? '-'}</dd>
                        </dl>
                        <p className="mt-3 text-xs text-on-surface-variant">Stages: {src.completedStages.join(' / ')}</p>
                        {src.errorCause && <p className="mt-2 text-xs text-error">{src.errorCause}</p>}
                    </article>
                ))}
            </section>
        </div>
    );
}
