import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';

type OrganizationData = Awaited<ReturnType<typeof svc.getOrganization>>;

export function useOrganization(orgId: string | undefined) {
  const [data, setData] = useState<OrganizationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const result = await svc.getOrganization(orgId);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
