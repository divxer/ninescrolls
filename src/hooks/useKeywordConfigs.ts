import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/tenderAdminService';

type KeywordConfig = NonNullable<Awaited<ReturnType<typeof svc.listKeywordConfigs>>[number]>;

export function useKeywordConfigs(includeInactive = false) {
    const [data, setData] = useState<KeywordConfig[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await svc.listKeywordConfigs(includeInactive);
            // Service elements are typed nullable by Amplify but are non-null in
            // practice; narrow to the non-null config shape for consumers.
            setData((result ?? []) as KeywordConfig[]);
        } catch (err) {
            setError(err as Error);
        } finally {
            setLoading(false);
        }
    }, [includeInactive]);

    useEffect(() => { void refresh(); }, [refresh]);

    return { data, loading, error, refresh };
}
