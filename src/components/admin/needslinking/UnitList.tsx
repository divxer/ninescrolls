export interface UnitListUnit {
  unitKey: string;
  linkUnitType: string;
  source: string;
  kind: string;
  eventCount: number;
  signal: {
    domain?: string | null;
    orgNameDisplay?: string | null;
    country?: string | null;
  };
}

export interface UnitListProps {
  units: UnitListUnit[];
  selectedKey: string | null;
  onSelect: (unitKey: string) => void;
}

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

function unitTitle(unit: UnitListUnit): string {
  return `${unit.source} · ${formatKind(unit.kind)}`;
}

function primarySignal(unit: UnitListUnit): string | null {
  if (unit.signal.domain) return unit.signal.domain;
  const orgAndCountry = [unit.signal.orgNameDisplay, unit.signal.country].filter(Boolean).join(', ');
  return orgAndCountry || null;
}

function UnitRow({ unit, selected, onSelect }: { unit: UnitListUnit; selected: boolean; onSelect: () => void }) {
  const signal = primarySignal(unit);
  // Title + primary signal are rendered as a single text node (rather than
  // separate spans) so the row exposes exactly one text match for queries
  // like "find the row mentioning <domain>" — splitting them across
  // sibling elements would make each one independently queryable and any
  // matcher that could match either piece (e.g. a combined regex) would
  // hit "multiple elements found" against this single row.
  const label = signal ? `${unitTitle(unit)} — ${signal}` : unitTitle(unit);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left px-4 py-3 border-b border-outline-variant/10 last:border-b-0 transition-colors ${
        selected ? 'bg-primary/10' : 'hover:bg-surface-container-low'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-on-surface truncate">{label}</span>
        <span className="text-xs text-on-surface-variant shrink-0">
          {unit.eventCount} event{unit.eventCount === 1 ? '' : 's'}
        </span>
      </div>
    </button>
  );
}

function UnitSection({
  title,
  icon,
  units,
  selectedKey,
  onSelect,
}: {
  title: string;
  icon: string;
  units: UnitListUnit[];
  selectedKey: string | null;
  onSelect: (unitKey: string) => void;
}) {
  if (units.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-2 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant bg-surface-container-low sticky top-0">
        <span className="material-symbols-outlined text-base">{icon}</span>
        {title}
        <span className="text-on-surface-variant/70">({units.length})</span>
      </div>
      {units.map((unit) => (
        <UnitRow
          key={unit.unitKey}
          unit={unit}
          selected={unit.unitKey === selectedKey}
          onSelect={() => onSelect(unit.unitKey)}
        />
      ))}
    </div>
  );
}

export function UnitList({ units, selectedKey, onSelect }: UnitListProps) {
  const structured = units.filter((u) => u.linkUnitType === 'structured');
  const analytics = units.filter((u) => u.linkUnitType !== 'structured');

  return (
    <div className="flex flex-col overflow-y-auto h-full">
      <UnitSection
        title="Structured"
        icon="description"
        units={structured}
        selectedKey={selectedKey}
        onSelect={onSelect}
      />
      <UnitSection
        title="Site visitors"
        icon="travel_explore"
        units={analytics}
        selectedKey={selectedKey}
        onSelect={onSelect}
      />
    </div>
  );
}
