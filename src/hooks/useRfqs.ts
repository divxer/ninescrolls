import { useState, useEffect, useCallback } from 'react';
import type { RfqSubmission } from '../types/admin';
import * as svc from '../services/orderAdminService';

export function useRfqs(statusFilter?: string) {
  const [rfqs, setRfqs] = useState<RfqSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    svc.listRfqs(statusFilter)
      .then((data) => { setRfqs((data?.items as RfqSubmission[]) || []); setLoading(false); })
      .catch((err) => { setError(err); setLoading(false); });
  }, [statusFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    svc.listRfqs(statusFilter)
      .then((data) => { if (!cancelled) { setRfqs((data?.items as RfqSubmission[]) || []); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [statusFilter]);

  return { rfqs, loading, error, refresh };
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
