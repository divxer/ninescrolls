import { useState, useEffect, useCallback, useRef } from 'react';
import * as svc from '../services/organizationAdminService';

type TimelineData = Awaited<ReturnType<typeof svc.getOrganizationTimeline>>;
type Item = NonNullable<NonNullable<TimelineData>['items'][number]>;
export type OrganizationTimelineItem = Item;

export function useOrganizationTimeline(orgId: string | undefined) {
  const [items, setItems] = useState<Item[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [includeInternal, setIncludeInternalState] = useState(false);
  const reqRef = useRef(0);

  const load = useCallback(async (token: string | undefined, append: boolean, includeInternalOnly: boolean) => {
    if (!orgId) return;
    const myId = ++reqRef.current;
    setLoading(true);
    setError(null);
    if (!append) setItems([]);
    try {
      const res = await svc.getOrganizationTimeline({ orgId, nextToken: token, includeInternalOnly });
      if (myId !== reqRef.current) return;
      const page = (res?.items ?? []) as Item[];
      setItems((prev) => (append ? [...prev, ...page] : page));
      setNextToken((res?.nextToken as string | null) ?? null);
    } catch (err) {
      if (myId !== reqRef.current) return;
      setError(err as Error);
    } finally {
      if (myId === reqRef.current) setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void load(undefined, false, includeInternal); }, [load, includeInternal]);

  const loadMore = useCallback(async () => {
    if (nextToken) await load(nextToken, true, includeInternal);
  }, [load, nextToken, includeInternal]);

  const reload = useCallback(() => load(undefined, false, includeInternal), [load, includeInternal]);

  const setIncludeInternal = useCallback((v: boolean) => { setIncludeInternalState(v); }, []);

  return { items, loading, error, hasMore: nextToken !== null, loadMore, reload, includeInternal, setIncludeInternal };
}
