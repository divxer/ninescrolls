import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/tenderAdminService';

export function useKeywordConfigs(includeInactive = false) {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await svc.listKeywordConfigs(includeInactive);
            setData((result ?? []) as any[]);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => { void refresh(); }, [refresh]);

    return { data, loading, error, refresh };
}
