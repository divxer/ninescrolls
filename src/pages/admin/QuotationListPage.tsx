import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listHistoricalQuotations,
  listQuotations,
  marginPct,
  usd,
  type HistoricalQuotationSummary,
  type QuotationSummary,
} from '../../services/priceAdminService';

type Tab = 'live' | 'historical';
type HistoricalListItem = HistoricalQuotationSummary & {
  sourceQuotationNumber?: string | null;
  legacyStatus?: string;
  customerAmountUsdCents?: number | null;
  quotedAt?: string | null;
};

const tableClass = 'w-full min-w-[920px] border-collapse text-sm';
const headClass = 'bg-surface-container-low text-left text-[11px] uppercase tracking-wider text-on-surface-variant';
const rowClass = 'border-t border-outline-variant/30';
const qualityOrder: HistoricalQuotationSummary['dataQualityFlags'] = ['INCOMPLETE', 'UNCONFIRMED', 'CONFLICT_RESOLVED'];

function EmptyLive() {
  return <div className="p-8 text-center text-sm text-on-surface-variant">
    <p className="font-semibold text-on-surface">No live quotations yet.</p>
    <p className="mt-2">Set up <Link to="/admin/suppliers" className="font-semibold text-secondary">Suppliers</Link>, add current costs in the <Link to="/admin/price-book" className="font-semibold text-secondary">Price Book</Link>, then start a <Link to="/admin/quotations/new" className="font-semibold text-secondary">New quotation</Link>.</p>
  </div>;
}

function LiveTable({ items }: { items: QuotationSummary[] }) {
  return <div className="overflow-x-auto"><table className={tableClass}>
    <thead className={headClass}><tr><th className="px-5 py-3">Number</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Scheme</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Cost</th><th className="px-4 py-3 text-right">Suggested</th><th className="px-4 py-3 text-right">Actual</th><th className="px-4 py-3 text-right">Margin</th><th className="px-5 py-3">Updated</th></tr></thead>
    <tbody>{items.map((q) => <tr key={`${q.quotationNumber}-${q.version}`} className={rowClass}><td className="px-5 py-4"><Link className="font-bold text-secondary no-underline" to={`/admin/quotations/${q.quotationNumber}`}>{q.quotationNumber}</Link><span className="ml-2 text-xs text-on-surface-variant">v{q.version}</span></td><td className="px-4 py-4 font-semibold">{q.customerName}</td><td className="px-4 py-4">{q.schemeLabel}</td><td className="px-4 py-4"><span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold">{q.status}</span>{q.incomplete && <span className="ml-2 text-error">Incomplete</span>}</td><td className="px-4 py-4 text-right font-mono">{usd(q.totalCostUsdCents)}</td><td className="px-4 py-4 text-right font-mono">{usd(q.suggestedTotalUsdCents)}</td><td className="px-4 py-4 text-right font-mono font-bold">{usd(q.actualTotalUsdCents)}</td><td className={`px-4 py-4 text-right font-bold ${q.belowMinMargin ? 'text-error' : 'text-emerald-700'}`}>{marginPct(q.actualMarginBp)}</td><td className="px-5 py-4 text-on-surface-variant">{q.updatedAt?.slice(0, 10)}</td></tr>)}</tbody>
  </table></div>;
}

function HistoricalTable({ items }: { items: HistoricalListItem[] }) {
  return <div className="overflow-x-auto"><table className={tableClass}>
    <thead className={headClass}><tr><th className="px-5 py-3">Number</th><th className="px-4 py-3">Customer</th><th className="px-4 py-3">Product / project</th><th className="px-4 py-3">Legacy status</th><th className="px-4 py-3 text-right">Customer amount</th><th className="px-4 py-3">Quote date</th><th className="px-5 py-3">Data quality</th></tr></thead>
    <tbody>{items.map((q) => {
      const primaryFlag = qualityOrder.find((flag) => q.dataQualityFlags.includes(flag));
      return <tr key={q.historicalId} data-testid={q.historicalId} className={rowClass}>
        <td className="px-5 py-4"><Link className="font-bold text-secondary no-underline" to={`/admin/quotations/historical/${q.historicalId}`}>{q.sourceQuotationNumber || `Historical #${q.sourceRow}`}</Link></td>
        <td className="px-4 py-4 font-semibold">{q.customerName}</td>
        <td className="px-4 py-4">{q.productName}</td>
        <td className="px-4 py-4">{q.legacyStatus || '—'}</td>
        <td className="px-4 py-4 text-right font-mono font-bold">{usd(q.customerAmountUsdCents)}</td>
        <td className="px-4 py-4 text-on-surface-variant">{q.quotedAt?.slice(0, 10) || '—'}</td>
        <td className="px-5 py-4">{primaryFlag ? <><span className="rounded-full bg-surface-container px-2.5 py-1 text-[10px] font-bold">{primaryFlag}</span>{q.dataQualityFlags.length > 1 && <span className="ml-2 text-xs text-on-surface-variant">+{q.dataQualityFlags.length - 1}</span>}</> : <span className="text-on-surface-variant">Complete</span>}</td>
      </tr>;
    })}</tbody>
  </table></div>;
}

export function QuotationListPage() {
  const [activeTab, setActiveTab] = useState<Tab>('live');
  const [liveItems, setLiveItems] = useState<QuotationSummary[]>([]);
  const [liveNextToken, setLiveNextToken] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveError, setLiveError] = useState('');
  const [historicalItems, setHistoricalItems] = useState<HistoricalListItem[]>([]);
  const [historicalNextToken, setHistoricalNextToken] = useState<string | null>(null);
  const [historicalLoading, setHistoricalLoading] = useState(false);
  const [historicalError, setHistoricalError] = useState('');
  const [historicalInitialized, setHistoricalInitialized] = useState(false);

  const loadLive = useCallback((token?: string) => {
    setLiveLoading(true); setLiveError('');
    listQuotations(token ? { nextToken: token } : {}).then((result) => {
      setLiveItems((current) => token ? [...current, ...result.items] : result.items);
      setLiveNextToken(result.nextToken);
    }).catch((cause: unknown) => setLiveError(cause instanceof Error ? cause.message : String(cause))).finally(() => setLiveLoading(false));
  }, []);

  const loadHistorical = useCallback((token?: string) => {
    setHistoricalLoading(true); setHistoricalError('');
    listHistoricalQuotations(token ? { nextToken: token } : {}).then((result) => {
      const items = result.items as HistoricalListItem[];
      setHistoricalItems((current) => token ? [...current, ...items] : items);
      setHistoricalNextToken(result.nextToken);
    }).catch((cause: unknown) => setHistoricalError(cause instanceof Error ? cause.message : String(cause))).finally(() => setHistoricalLoading(false));
  }, []);

  useEffect(() => loadLive(), [loadLive]);

  const selectTab = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'historical' && !historicalInitialized) {
      setHistoricalInitialized(true);
      loadHistorical();
    }
  };

  const isLive = activeTab === 'live';
  const loading = isLive ? liveLoading : historicalLoading;
  const error = isLive ? liveError : historicalError;
  const nextToken = isLive ? liveNextToken : historicalNextToken;

  return <div className="px-5 py-8 lg:px-8 lg:py-10">
    <header className="mb-6 flex items-end justify-between gap-4"><div><p className="mb-2 text-xs font-bold uppercase tracking-[.18em] text-secondary">Sales operations</p><h1 className="font-headline text-3xl font-black tracking-tight text-on-surface">Quotations</h1><p className="mt-2 text-sm text-on-surface-variant">Create and revise customer pricing from the current catalog.</p></div>{isLive && <Link to="/admin/quotations/new" className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary no-underline shadow-sm">Create quotation</Link>}</header>
    <div role="tablist" aria-label="Quotation type" className="mb-4 inline-flex rounded-xl bg-surface-container-low p-1">
      {(['live', 'historical'] as const).map((tab) => <button key={tab} id={`${tab}-tab`} role="tab" aria-selected={activeTab === tab} aria-controls={`${tab}-panel`} onClick={() => selectTab(tab)} className={`rounded-lg px-5 py-2 text-sm font-bold ${activeTab === tab ? 'bg-surface-container-lowest text-on-surface shadow-sm' : 'text-on-surface-variant'}`}>{tab === 'live' ? 'Live' : 'Historical'}</button>)}
    </div>
    {error && <p role="alert" className="mb-4 rounded-xl bg-error-container p-4 text-error">{error}</p>}
    <section id={`${activeTab}-panel`} role="tabpanel" aria-labelledby={`${activeTab}-tab`} className="overflow-hidden rounded-2xl border border-outline-variant/40 bg-surface-container-lowest shadow-sm">
      {isLive ? <LiveTable items={liveItems} /> : <HistoricalTable items={historicalItems} />}
      {loading && <p className="p-8 text-center text-sm text-on-surface-variant">{isLive ? 'Loading quotations…' : 'Loading historical quotations…'}</p>}
      {!loading && isLive && !liveItems.length && <EmptyLive />}
      {!loading && !isLive && !historicalItems.length && <p className="p-8 text-center text-sm text-on-surface-variant">No historical quotations have been imported. Historical records are populated through a script-only administrative import.</p>}
    </section>
    {nextToken && !loading && <button className="mt-4 rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold" onClick={() => isLive ? loadLive(nextToken) : loadHistorical(nextToken)}>Load more</button>}
  </div>;
}
