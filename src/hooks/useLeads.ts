import { useState, useEffect, useCallback } from 'react';
import type { LeadSubmission } from '../types/admin';
import * as svc from '../services/orderAdminService';

export function useLeads(typeFilter?: string) {
  const [leads, setLeads] = useState<LeadSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    svc.listLeads(typeFilter)
      .then((data) => { setLeads((data?.items as LeadSubmission[]) || []); setLoading(false); })
      .catch((err) => { setError(err); setLoading(false); });
  }, [typeFilter]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    svc.listLeads(typeFilter)
      .then((data) => { if (!cancelled) { setLeads((data?.items as LeadSubmission[]) || []); setLoading(false); } })
      .catch((err) => { if (!cancelled) { setError(err); setLoading(false); } });
    return () => { cancelled = true; };
  }, [typeFilter]);

  return { leads, loading, error, refresh };
}
