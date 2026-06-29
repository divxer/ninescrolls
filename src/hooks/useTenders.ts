import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/tenderAdminService';
import type { ListTendersArgs } from '../services/tenderAdminService';

type TendersData = Awaited<ReturnType<typeof svc.listTenders>>;

export function useTenders(initial: ListTendersArgs = {}) {
    const [filters, setFilters] = useState<ListTendersArgs>(initial);
    const [data, setData] = useState<TendersData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await svc.listTenders(filters);
            setData(result);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => { void refresh(); }, [refresh]);

    return { data, loading, error, refresh, filters, setFilters };
}
