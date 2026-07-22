import { useState, useEffect, useCallback } from 'react';
import * as svc from '../services/organizationAdminService';

type HealthData = Awaited<ReturnType<typeof svc.getCrmHealth>>;

export interface MergeReviewMarker {
  fromOrgId: string;
  toOrgId: string;
  version?: number;
  residualsDetected: boolean | null;
  residualSamples: string[];
  probedAt: string | null;
}

// a.json() fields arrive from AppSync as JSON *strings* in some paths (see CrmHealthPage's
// SummaryCard) — normalize defensively so callers always get a plain array.
function parseMergeReviewMarkers(v: unknown): MergeReviewMarker[] {
  const value = typeof v === 'string'
    ? (() => { try { return JSON.parse(v) as unknown; } catch { return null; } })()
    : v;
  return Array.isArray(value) ? (value as MergeReviewMarker[]) : [];
}

export function useCrmHealth() {
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [runMsg, setRunMsg] = useState<string | null>(null);
  const [ackInFlight, setAckInFlight] = useState<string | null>(null);
  const [ackError, setAckError] = useState<string | null>(null);

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

  // Task 13 (R9): needs_review → acknowledged. Refetches on success so the row disappears (its
  // GSI1PK moved off the needs_review partition crmHealth queries); on a lost fence / notFound it
  // still refetches (another actor may already have advanced it) but surfaces the outcome.
  const acknowledge = useCallback(async (fromOrgId: string, toOrgId: string) => {
    const key = `${fromOrgId}|${toOrgId}`;
    setAckInFlight(key); setAckError(null);
    try {
      const res = await svc.acknowledgeMergeRecon(fromOrgId, toOrgId);
      if (!res?.ok) {
        setAckError(res?.raced ? 'Another actor already acknowledged this — refreshing.' : res?.notFound ? 'Marker no longer exists — refreshing.' : 'Failed to acknowledge.');
      }
      await load();
      return res;
    } catch (err) {
      setAckError((err as Error).message);
      throw err;
    } finally {
      setAckInFlight((cur) => (cur === key ? null : cur));
    }
  }, [load]);

  return {
    data, loading, error, runMsg, reload: load, runRepair,
    mergeReviewMarkers: parseMergeReviewMarkers(data?.mergeReviewMarkers),
    mergeNeedsReviewCount: data?.mergeNeedsReviewCount ?? 0,
    acknowledge, ackInFlight, ackError,
  };
}
