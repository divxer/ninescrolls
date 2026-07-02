import { useState, useEffect, useCallback } from 'react';
import type { RfqSubmission } from '../types/admin';
import * as svc from '../services/orderAdminService';

export function useRfqs(statusFilter?: string, pageSize = 20, enabled = true) {
  const [rfqs, setRfqs] = useState<RfqSubmission[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Key identifying which (enabled, statusFilter) the current rfqs belong to.
  // Between a params change and its effect firing, the live args differ from
  // settledKey, so `loading` reads true in that render — no stale/empty flash
  // when switching tabs (e.g. All → Pending on a lazily-enabled instance).
  const activeKey = enabled ? (statusFilter ?? '__all__') : '__disabled__';
  const [settledKey, setSettledKey] = useState<string | null>(null);

  const fetchFirstPage = useCallback(() => {
    const key = enabled ? (statusFilter ?? '__all__') : '__disabled__';
    if (!enabled) {
      setRfqs([]);
      setNextToken(null);
      setFetching(false);
      setLoadingMore(false);
      setError(null);
      setSettledKey(key);
      return () => {};
    }

    let cancelled = false;
    setFetching(true);
    setError(null);
    setNextToken(null);
    svc.listRfqs(statusFilter, pageSize)
      .then((data) => {
        if (cancelled) return;
        setRfqs((data?.items as RfqSubmission[]) || []);
        setNextToken((data?.nextToken as string | null) ?? null);
        setFetching(false);
        setSettledKey(key);
      })
      .catch((err) => { if (!cancelled) { setError(err); setFetching(false); setSettledKey(key); } });
    return () => { cancelled = true; };
  }, [statusFilter, pageSize, enabled]);

  const refresh = useCallback(() => { fetchFirstPage(); }, [fetchFirstPage]);

  const loadMore = useCallback(() => {
    if (!enabled || !nextToken || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    svc.listRfqs(statusFilter, pageSize, nextToken)
      .then((data) => {
        setRfqs((prev) => [...prev, ...((data?.items as RfqSubmission[]) || [])]);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoadingMore(false);
      })
      .catch((err) => { setError(err); setLoadingMore(false); });
  }, [statusFilter, pageSize, nextToken, loadingMore, enabled]);

  useEffect(() => fetchFirstPage(), [fetchFirstPage]);

  const loading = fetching || settledKey !== activeKey;

  return { rfqs, loading, loadingMore, hasMore: nextToken !== null, error, refresh, loadMore };
}

export function useRfq(rfqId: string | undefined) {
  const [rfq, setRfq] = useState<RfqSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!rfqId) return;
    setLoading(true);
    svc.getRfq(rfqId)
      .then((data) => { setRfq(data as RfqSubmission | null); setLoading(false); })
      .catch((err) => { setError(err); setLoading(false); });
  }, [rfqId]);

  useEffect(() => {
    if (!rfqId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    svc.getRfq(rfqId)
      .then((data) => { if (!cancelled) { setRfq(data as RfqSubmission | null); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [rfqId]);

  return { rfq, loading, error, refresh };
}
