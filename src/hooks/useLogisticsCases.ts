import { useState, useEffect, useCallback } from 'react';
import type { LogisticsCase, LogisticsStats } from '../types/logistics';
import * as svc from '../services/logisticsAdminService';

interface UseLogisticsCasesOptions {
  stage?: string;
  caseType?: string;
  customsRequired?: boolean;
  relatedOrderId?: string;
  search?: string;
  pageSize?: number;
}

export function useLogisticsCases(options: UseLogisticsCasesOptions = {}) {
  const { stage, caseType, customsRequired, relatedOrderId, search, pageSize = 50 } = options;

  const [cases, setCases] = useState<LogisticsCase[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFirstPage = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNextToken(null); // reset cursor so a stale loadMore can't fire after a filter change
    svc.listLogisticsCases({ stage, caseType, customsRequired, relatedOrderId, search, limit: pageSize })
      .then((data) => {
        if (cancelled) return;
        setCases((data?.items as LogisticsCase[]) || []);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoading(false);
      })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [stage, caseType, customsRequired, relatedOrderId, search, pageSize]);

  // Public refresh wrapper — does NOT leak the effect-cleanup function to callers.
  const refresh = useCallback(() => { fetchFirstPage(); }, [fetchFirstPage]);

  const loadMore = useCallback(() => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    svc.listLogisticsCases({ stage, caseType, customsRequired, relatedOrderId, search, limit: pageSize, nextToken })
      .then((data) => {
        setCases((prev) => [...prev, ...((data?.items as LogisticsCase[]) || [])]);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoadingMore(false);
      })
      .catch((err) => { setError(err); setLoadingMore(false); });
  }, [nextToken, loadingMore, stage, caseType, customsRequired, relatedOrderId, search, pageSize]);

  useEffect(() => fetchFirstPage(), [fetchFirstPage]);

  return { cases, loading, loadingMore, hasMore: nextToken !== null, error, refresh, loadMore };
}

export function useLogisticsCase(caseId: string | undefined) {
  const [logisticsCase, setLogisticsCase] = useState<LogisticsCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Single loader shared by the initial effect and refresh(). `isActive` lets the
  // effect ignore a resolved fetch after unmount; refresh() passes the default.
  const load = useCallback((isActive: () => boolean = () => true) => {
    if (!caseId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    svc.getLogisticsCase(caseId)
      .then((data) => { if (isActive()) { setLogisticsCase(data as LogisticsCase | null); setLoading(false); } })
      .catch((err) => { if (isActive()) { setError(err); setLoading(false); } });
  }, [caseId]);

  const refresh = useCallback(() => { load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    load(() => !cancelled);
    return () => { cancelled = true; };
  }, [load]);

  return { logisticsCase, loading, error, refresh };
}

export function useLogisticsStats() {
  const [stats, setStats] = useState<LogisticsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    svc.fetchLogisticsStats()
      .then((data) => { if (!cancelled) { setStats(data as unknown as LogisticsStats); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading, error };
}
