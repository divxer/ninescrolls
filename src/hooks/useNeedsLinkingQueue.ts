import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';

type QueueData = Awaited<ReturnType<typeof svc.getNeedsLinkingQueue>>;
type Item = NonNullable<NonNullable<QueueData>['items'][number]>;
export type NeedsLinkingItem = Item;

export function useNeedsLinkingQueue() {
  const [items, setItems] = useState<Item[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async (token: string | undefined, append: boolean) => {
    setLoading(true);
    if (!append) setError(null);
    try {
      const res = await svc.getNeedsLinkingQueue({ nextToken: token });
      const page = (res?.items ?? []) as Item[];
      setItems((prev) => (append ? [...prev, ...page] : page));
      setNextToken((res?.nextToken as string | null) ?? null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(undefined, false); }, [load]);

  const loadMore = useCallback(async () => { if (nextToken) await load(nextToken, true); }, [load, nextToken]);
  const evictUnit = useCallback((unitKey: string) => { setItems((prev) => prev.filter((i) => (i as { unitKey?: string }).unitKey !== unitKey)); }, []);

  return { items, loading, error, hasMore: nextToken !== null, loadMore, evictUnit };
}
