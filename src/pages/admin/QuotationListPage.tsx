import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listQuotations, marginPct, usd, type QuotationSummary } from '../../services/priceAdminService';

export function QuotationListPage() {
  const [items, setItems] = useState<QuotationSummary[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback((token?: string) => {
    setLoading(true); setError('');
    listQuotations(token ? { nextToken: token } : {}).then((result) => {
      setItems((current) => token ? [...current, ...result.items] : result.items);
      setNextToken(result.nextToken);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause))).finally(() => setLoading(false));
  }, []);
  useEffect(() => load(), [load]);
  return <div className="px-5 py-8 lg:px-8 lg:py-10">
    <header className="mb-6 flex items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-secondary">Sales operations</p><h1 className="font-headline text-3xl font-black tracking-tight text-on-surface">Quotations</h1><p className="mt-2 text-sm text-on-surface-variant">Create and revise customer pricing from the current catalog.</p></div><Link to="/admin/quotations/new" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary no-underline shadow-sm">Create quotation</Link></header>
    {error && <p role="alert" className="rounded-xl bg-error-container p-4 text-error">{error}</p>}
    <section className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[920px] border-collapse text-sm"><thead className="bg-surface-container-low text-left text-[11px] uppercase tracking-wider text-on-surface-variant"><tr><th className="px-5 py-3">Number</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Scheme</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Suggested</th><th className="px-4 py-3 text-right">Actual</th><th className="px-4 py-3 text-right">Margin</th><th className="px-5 py-3">Updated</th></tr></thead><tbody>{items.map((q) => <tr key={`${q.quotationNumber}-${q.version}`} className="border-t border-outline-variant/30"><td className="px-5 py-4"><Link className="font-bold text-secondary no-underline" to={`/admin/quotations/${q.quotationNumber}`}>{q.quotationNumber}</Link><span className="ml-2 text-xs text-on-surface-variant">v{q.version}</span></td><td className="px-4 py-4 font-semibold">{q.customerName}</td><td className="px-4 py-4">{q.schemeLabel}</td><td className="px-4 py-4"><span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold">{q.status}</span>{q.incomplete && <span className="ml-2 text-error">Incomplete</span>}</td><td className="px-4 py-4 text-right font-mono">{usd(q.totalCostUsdCents)}</td><td className="px-4 py-4 text-right font-mono">{usd(q.suggestedTotalUsdCents)}</td><td className="px-4 py-4 text-right font-mono font-bold">{usd(q.actualTotalUsdCents)}</td><td className={`px-4 py-4 text-right font-bold ${q.belowMinMargin ? 'text-error' : 'text-emerald-700'}`}>{marginPct(q.actualMarginBp)}</td><td className="px-5 py-4 text-on-surface-variant">{q.updatedAt?.slice(0, 10)}</td></tr>)}</tbody></table></div>{loading && <p className="p-8 text-center text-sm text-on-surface-variant">Loading quotations…</p>}{!loading && !items.length && <p className="p-8 text-center text-sm text-on-surface-variant">No quotations yet.</p>}</section>
    {nextToken && !loading && <button className="mt-4 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold" onClick={() => load(nextToken)}>Load more</button>}
  </div>;
}
