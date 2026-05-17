import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/tenderAdminService';

export function useTender(tenderId: string | undefined) {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        if (!tenderId) return;
        setLoading(true);
        setError(null);
        try {
            const result = await svc.getTender(tenderId);
            setData(result);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [tenderId]);

    useEffect(() => { void refresh(); }, [refresh]);

    return { data, loading, error, refresh };
}
