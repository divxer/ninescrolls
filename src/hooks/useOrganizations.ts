import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';
import type { ListOrgFilters } from '../services/organizationAdminService';

export function useOrganizations(initialFilters: ListOrgFilters = {}) {
  const [filters, setFilters] = useState<ListOrgFilters>(initialFilters);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await svc.listOrganizations(filters);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh, filters, setFilters };
}
