import { useState, useEffect, useCallback } from 'react';
import type { Order, OrderStats, OrderLog, OrderDocument } from '../types/admin';
import * as svc from '../services/orderAdminService';

export function useOrders(statusFilter?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    svc.listOrders(statusFilter)
      .then((data) => { setOrders((data?.items as Order[]) || []); setLoading(false); })
      .catch((err) => { setError(err); setLoading(false); });
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    svc.listOrders(statusFilter)
      .then((data) => { if (!cancelled) { setOrders((data?.items as Order[]) || []); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [statusFilter]);

  return { orders, loading, error, refresh };
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
