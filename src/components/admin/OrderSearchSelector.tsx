import { useState, useEffect } from 'react';
import * as orderSvc from '../../services/orderAdminService';

interface OrderResult {
  orderId: string;
  institution: string;
  quoteNumber?: string | null;
  poNumber?: string | null;
  productModel?: string | null;
}

interface OrderSearchSelectorProps {
  value: string;                                   // current relatedOrderId ('' when none)
  onSelect: (order: { orderId: string; institution: string } | null) => void;
  selectedLabel?: string;                          // optional pre-known label for an existing value
}

const SEARCH_DEBOUNCE_MS = 300;

function orderLabel(o: OrderResult): string {
  return o.quoteNumber || o.poNumber || o.orderId;
}

export function OrderSearchSelector({ value, onSelect, selectedLabel }: OrderSearchSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<OrderResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<OrderResult | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (!term) { setResults([]); setLoading(false); setError(false); return; }
    setLoading(true); setError(false);
    let cancelled = false;
    const t = setTimeout(() => {
      orderSvc.listOrders({ search: term, limit: 10 })
        .then((data) => {
          if (cancelled) return;
          setResults((data?.items as OrderResult[]) || []);
          setLoading(false);
        })
        .catch((e) => {
          if (cancelled) return;
          console.warn('OrderSearchSelector: order search failed —', e instanceof Error ? e.message : String(e));
          setError(true); setResults([]); setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  // If the parent clears the value, drop the locally-remembered order so internal
  // state can't drift out of sync with `value`.
  useEffect(() => { if (!value) setSelected(null); }, [value]);

  function pick(o: OrderResult) {
    setSelected(o);
    setQuery('');
    setResults([]);
    onSelect({ orderId: o.orderId, institution: o.institution });
  }

  function clear() {
    setSelected(null);
    onSelect(null);
  }

  // A set value renders a chip. Rich (quote#/institution) only for an order picked this
  // session; otherwise selectedLabel, else a plain label — NEVER a reverse lookup.
  if (value) {
    const chip = selected
      ? `${orderLabel(selected)} · ${selected.institution}`
      : (selectedLabel || `Linked order: ${value}`);
    return (
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-surface-container-high px-3 py-1.5 text-sm">{chip}</span>
        <button type="button" onClick={clear} className="text-xs text-error hover:underline">Clear</button>
      </div>
    );
  }

  return (
    <div className="relative mt-1">
      <input
        aria-label="Search order"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search order by quote #, PO #, institution, product…"
        className="block w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
      />
      {query.trim() && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-outline-variant bg-surface shadow-lg">
          {loading && <div className="px-3 py-2 text-xs text-on-surface-variant">Searching…</div>}
          {error && <div className="px-3 py-2 text-xs text-error">Search failed</div>}
          {!loading && !error && !results.length && (
            <div className="px-3 py-2 text-xs text-on-surface-variant">No orders found</div>
          )}
          {results.map((o) => (
            <button
              key={o.orderId} type="button" onClick={() => pick(o)}
              className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-container-low"
            >
              <span className="font-semibold">{orderLabel(o)}</span>
              <span className="text-on-surface-variant"> · {o.institution}</span>
              {o.productModel && <span className="text-on-surface-variant"> · {o.productModel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
