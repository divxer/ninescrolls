import { useState, useEffect, useCallback } from 'react';
import type { Order, OrderStats, OrderLog, OrderDocument } from '../types/admin';
import * as svc from '../services/orderAdminService';

interface UseOrdersOptions {
  status?: string;
  search?: string;
  pageSize?: number;
}

export function useOrders(options: UseOrdersOptions | string = {}) {
  // Backwards-compat: callers that pass a bare status string still work.
  const opts: UseOrdersOptions = typeof options === 'string' ? { status: options } : options;
  const { status, search, pageSize = 50 } = opts;

  const [orders, setOrders] = useState<Order[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchFirstPage = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    svc.listOrders(status, search, pageSize)
      .then((data) => {
        if (cancelled) return;
        setOrders((data?.items as Order[]) || []);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [status, search, pageSize]);

  const refresh = useCallback(() => {
    fetchFirstPage();
  }, [fetchFirstPage]);

  const loadMore = useCallback(() => {
    if (!nextToken || loadingMore) return;
    setLoadingMore(true);
    svc.listOrders(status, search, pageSize, nextToken)
      .then((data) => {
        setOrders((prev) => [...prev, ...((data?.items as Order[]) || [])]);
        setNextToken((data?.nextToken as string | null) ?? null);
        setLoadingMore(false);
      })
      .catch((err) => {
        setError(err);
        setLoadingMore(false);
      });
  }, [nextToken, loadingMore, status, search, pageSize]);

  useEffect(() => {
    const cancel = fetchFirstPage();
    return cancel;
  }, [fetchFirstPage]);

  const hasMore = nextToken !== null;
  return { orders, loading, loadingMore, hasMore, error, refresh, loadMore };
}

export function useOrder(orderId: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!orderId) return;
    setLoading(true);
    svc.getOrder(orderId)
      .then((data) => { setOrder(data as Order | null); setLoading(false); })
      .catch((err) => { setError(err); setLoading(false); });
  }, [orderId]);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    svc.getOrder(orderId)
      .then((data) => { if (!cancelled) { setOrder(data as Order | null); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [orderId]);

  return { order, loading, error, refresh };
}

export function useOrderStats() {
  const [stats, setStats] = useState<OrderStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    svc.fetchOrderStats()
      .then((data) => { if (!cancelled) { setStats(data as unknown as OrderStats); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  return { stats, loading, error };
}

export function useOrderLogs(orderId: string | undefined) {
  const [logs, setLogs] = useState<OrderLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    svc.getOrderLogs(orderId)
      .then((data) => { if (!cancelled) { setLogs((data as OrderLog[]) || []); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [orderId]);

  return { logs, loading, error };
}

export function useOrderDocuments(orderId: string | undefined) {
  const [documents, setDocuments] = useState<OrderDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    if (!orderId) return;
    setLoading(true);
    svc.listOrderDocuments(orderId)
      .then((data) => { setDocuments((data as OrderDocument[]) || []); setLoading(false); })
      .catch((err) => { setError(err); setLoading(false); });
  }, [orderId]);

  useEffect(() => {
    if (!orderId) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    svc.listOrderDocuments(orderId)
      .then((data) => { if (!cancelled) { setDocuments((data as OrderDocument[]) || []); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [orderId]);

  return { documents, loading, error, refresh };
}
