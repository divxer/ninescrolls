import { useCrmHealth, type MergeReviewMarker } from '../../hooks/useCrmHealth';

type Sample = { unitType: string; unitKey: string; targetOrgId: string; attemptCount?: number; stuckReason?: string | null; lastError?: string | null; createdAt: string };
type Bucket = { count: number; more: boolean; sample: Sample[] };

function BucketCard({ title, bucket }: { title: string; bucket?: Bucket | null }) {
  const b = bucket ?? { count: 0, more: false, sample: [] };
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px' }}>{title}: {b.count}{b.more ? '+' : ''}</h3>
      {b.sample.length === 0 ? <p style={{ color: '#6b7280' }}>None</p> : (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead><tr><th align="left">Type</th><th align="left">Unit</th><th align="left">Target org</th><th align="left">Attempts</th><th align="left">Reason / error</th><th align="left">Created</th></tr></thead>
          <tbody>
            {b.sample.map((s) => (
              <tr key={`${s.unitType}-${s.unitKey}`}>
                <td>{s.unitType}</td><td>{s.unitKey}</td><td>{s.targetOrgId}</td>
                <td>{s.attemptCount ?? 0}</td><td>{s.stuckReason ?? s.lastError ?? ''}</td><td>{s.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function MergeReviewSection({
  markers, ackInFlight, ackError, onAcknowledge,
}: {
  markers: MergeReviewMarker[];
  ackInFlight: string | null;
  ackError: string | null;
  onAcknowledge: (fromOrgId: string, toOrgId: string) => void;
}) {
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px' }}>Merge review: {markers.length}</h3>
      {ackError && <p style={{ color: '#b91c1c', fontSize: 13 }}>{ackError}</p>}
      {markers.length === 0 ? <p style={{ color: '#6b7280' }}>None</p> : (
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th align="left">From → To</th><th align="left">Residuals</th><th align="left">Sample count</th>
              <th align="left">Probed at</th><th align="left"></th>
            </tr>
          </thead>
          <tbody>
            {markers.map((m) => {
              const key = `${m.fromOrgId}|${m.toOrgId}`;
              const inFlight = ackInFlight === key;
              return (
                <tr key={key}>
                  <td>{m.fromOrgId} → {m.toOrgId}</td>
                  <td>{m.residualsDetected ? 'yes' : 'no'}</td>
                  <td>{m.residualSamples?.length ?? 0}</td>
                  <td>{m.probedAt ?? ''}</td>
                  <td>
                    <button
                      type="button"
                      disabled={inFlight}
                      onClick={() => onAcknowledge(m.fromOrgId, m.toOrgId)}
                    >
                      {inFlight ? 'Acknowledging…' : 'Acknowledge'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

function SummaryCard({ title, summary }: { title: string; summary?: unknown }) {
  // a.json() fields arrive from AppSync as JSON *strings*; parse before pretty-printing so the card
  // shows readable JSON instead of a double-encoded escaped string. Objects (tests/mocks) pass through.
  const value = typeof summary === 'string'
    ? (() => { try { return JSON.parse(summary) as unknown; } catch { return summary; } })()
    : summary;
  const isEmpty = value == null || value === '';
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 8px' }}>{title}</h3>
      {isEmpty ? <p style={{ color: '#6b7280' }}>No run yet</p> : <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{JSON.stringify(value, null, 2)}</pre>}
    </section>
  );
}

export function CrmHealthPage() {
  const { data, loading, error, runMsg, runRepair, mergeReviewMarkers, ackInFlight, ackError, acknowledge } = useCrmHealth();
  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>CRM Health</h1>
        <button onClick={() => void runRepair()} style={{ padding: '8px 16px' }}>Run repair now</button>
      </div>
      {runMsg && <p style={{ color: '#374151' }}>{runMsg}</p>}
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: '#b91c1c' }}>Error: {error.message}</p>}
      {data && (
        <>
          <BucketCard title="Pending repairs" bucket={data.repairPending as Bucket} />
          <BucketCard title="Stuck repairs (needs attention)" bucket={data.repairStuck as Bucket} />
          <MergeReviewSection
            markers={mergeReviewMarkers}
            ackInFlight={ackInFlight}
            ackError={ackError}
            onAcknowledge={(fromOrgId, toOrgId) => { void acknowledge(fromOrgId, toOrgId); }}
          />
          <SummaryCard title="Last repair run" summary={data.lastRepairSummary} />
          <SummaryCard title="Last hot sweep" summary={data.lastHotSweep} />
          <SummaryCard title="Last cold sweep" summary={data.lastColdSweep} />
          <SummaryCard title="Last dirty-rollup sweep" summary={data.lastDirtyRollupSweep} />
        </>
      )}
    </div>
  );
}
