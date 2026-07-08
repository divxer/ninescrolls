import { useState } from 'react';
import type { NeedsLinkingItem } from '../../../hooks/useNeedsLinkingQueue';

export interface OrgCandidate {
  orgId: string;
  displayName?: string | null;
}

export interface UnitDetailProps {
  unit: NeedsLinkingItem;
  searchOrgs: (query: string) => Promise<OrgCandidate[]>;
  onLink: (targetOrgId: string) => void;
}

const inputClass =
  'w-full bg-surface-container-low border-transparent focus:border-primary focus:ring-0 rounded-lg text-sm px-4 py-2.5 text-on-surface placeholder:text-outline-variant transition-all';

const KIND_LABELS: Record<string, string> = {
  site_visit_session: 'Site visit',
  rfq_submitted: 'RFQ submitted',
  rfq_status_changed: 'RFQ status changed',
  order_created: 'Order created',
  order_stage_changed: 'Order stage changed',
  lead_captured: 'Lead captured',
  quote_sent: 'Quote sent',
  logistics_milestone: 'Logistics milestone',
};

function formatKind(kind: string): string {
  return KIND_LABELS[kind] ?? kind.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function SignalRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-on-surface-variant">{label}</span>
      <span className="font-medium text-on-surface truncate">{value}</span>
    </div>
  );
}

export function UnitDetail({ unit, searchOrgs, onLink }: UnitDetailProps) {
  const [query, setQuery] = useState('');
  const [candidates, setCandidates] = useState<OrgCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrgCandidate | null>(null);

  const isStructured = unit.linkUnitType === 'structured';
  const signal = unit.signal;

  async function handleSearchChange(value: string) {
    setQuery(value);
    setSelectedOrg(null);
    const trimmed = value.trim();
    if (!trimmed) {
      setCandidates([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchOrgs(trimmed);
      setCandidates(results);
    } finally {
      setSearching(false);
    }
  }

  function handleSelect(candidate: OrgCandidate) {
    setSelectedOrg(candidate);
    setCandidates([]);
  }

  function handleLink() {
    if (!selectedOrg) return;
    onLink(selectedOrg.orgId);
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-outline-variant/20">
        <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-on-surface-variant">
          <span className="material-symbols-outlined text-base">
            {isStructured ? 'description' : 'travel_explore'}
          </span>
          {isStructured ? 'Structured unit' : 'Analytics unit'}
        </div>
        <h3 className="mt-1 text-lg font-semibold text-on-surface">
          {unit.source} · {formatKind(unit.kind)}
        </h3>
        <p className="text-xs text-on-surface-variant mt-1">
          {unit.eventCount} event{unit.eventCount === 1 ? '' : 's'} · last seen {unit.occurredAt}
        </p>
      </div>

      <div className="p-5 border-b border-outline-variant/20 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant mb-2">
          Signal
        </div>
        {isStructured ? (
          <>
            <SignalRow label="Email" value={signal.email} />
            <SignalRow label="Domain" value={signal.domain} />
            <SignalRow label="Product model" value={signal.productModel} />
            <SignalRow label="Equipment category" value={signal.equipmentCategory} />
          </>
        ) : (
          <>
            <SignalRow label="IP org" value={signal.orgNameDisplay} />
            <SignalRow
              label="Location"
              value={[signal.region, signal.country].filter(Boolean).join(', ') || null}
            />
            <SignalRow label="Top paths" value={signal.topPaths?.join(', ') ?? null} />
          </>
        )}
      </div>

      <div className="p-5 border-b border-outline-variant/20 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
          Link to organization
        </div>
        <input
          type="text"
          aria-label="Search organizations"
          placeholder="Search by name or domain…"
          value={query}
          onChange={(e) => { void handleSearchChange(e.target.value); }}
          className={inputClass}
        />
        {selectedOrg ? (
          <div className="flex items-center justify-between gap-3 bg-surface-container-low rounded-lg px-4 py-2.5">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-on-surface truncate">
                {selectedOrg.displayName ?? selectedOrg.orgId}
              </div>
              <div className="text-xs text-on-surface-variant truncate">{selectedOrg.orgId}</div>
            </div>
            <button
              type="button"
              className="material-symbols-outlined text-base text-on-surface-variant hover:text-on-surface"
              onClick={() => setSelectedOrg(null)}
              aria-label="Clear selected organization"
            >
              close
            </button>
          </div>
        ) : (
          <div className="border border-outline-variant/20 rounded-lg max-h-56 overflow-y-auto">
            {searching && (
              <div className="p-4 text-center text-sm text-on-surface-variant">Searching…</div>
            )}
            {!searching && candidates.length === 0 && query.trim() && (
              <div className="p-4 text-center text-sm text-on-surface-variant">No matching organizations</div>
            )}
            {!searching && candidates.map((c) => (
              <button
                key={c.orgId}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full text-left px-4 py-2.5 border-b border-outline-variant/10 last:border-b-0 hover:bg-surface-container-low transition-colors"
              >
                <div className="text-sm font-semibold text-on-surface truncate">
                  {c.displayName ?? c.orgId}
                </div>
                <div className="text-xs text-on-surface-variant truncate">{c.orgId}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 space-y-3">
        <div className="bg-surface-container-low rounded-lg p-4 text-sm text-on-surface-variant">
          {isStructured ? (
            <span>
              Linking will move <strong>{unit.eventCount}</strong> loaded events onto{' '}
              {selectedOrg ? (
                <strong className="text-on-surface">{selectedOrg.displayName ?? selectedOrg.orgId}</strong>
              ) : (
                'the selected organization'
              )}
              .
            </span>
          ) : (
            <span>
              Linking will resolve this visitor's sessions and future site visits to{' '}
              {selectedOrg ? (
                <strong className="text-on-surface">{selectedOrg.displayName ?? selectedOrg.orgId}</strong>
              ) : (
                'the selected organization'
              )}
              .
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleLink}
          disabled={!selectedOrg}
          className="w-full px-8 py-2.5 bg-primary text-on-primary font-semibold text-sm rounded-lg hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
        >
          Link to organization
        </button>
      </div>
    </div>
  );
}
