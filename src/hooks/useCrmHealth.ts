import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';

type HealthData = Awaited<ReturnType<typeof svc.getCrmHealth>>;

export function useCrmHealth() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await svc.getCrmHealth()); }
    catch (err) { setError(err as Error); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const runRepair = useCallback(async () => {
    setRunMsg(null);
    try {
      const res = await svc.runCrmRepair({});
      setRunMsg(res?.skippedLeaseHeld ? 'already running — the scheduled repair is in progress' : `repaired ${res?.repaired ?? 0}, stuck ${res?.stuck ?? 0}`);
      await load();
    } catch (err) { setRunMsg(`failed: ${(err as Error).message}`); }
  }, [load]);

  return { data, loading, error, runMsg, reload: load, runRepair };
}
