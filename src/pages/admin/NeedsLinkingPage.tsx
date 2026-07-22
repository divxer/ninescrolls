import { useState } from 'react';
import { useNeedsLinkingQueue, type NeedsLinkingItem } from '../../hooks/useNeedsLinkingQueue';
import * as svc from '../../services/organizationAdminService';
import { UnitList } from '../../components/admin/needslinking/UnitList';
import { UnitDetail, type OrgCandidate } from '../../components/admin/needslinking/UnitDetail';

async function searchOrgs(query: string): Promise<OrgCandidate[]> {
  const data = await svc.listOrganizations({ search: query });
  const items = (data?.items ?? []) as Array<{ orgId: string; displayName?: string | null }>;
  return items.map((o) => ({ orgId: o.orgId, displayName: o.displayName ?? o.orgId }));
}

export function NeedsLinkingPage() {
  const { items, loading, error, hasMore, loadMore, evictUnit } = useNeedsLinkingQueue();
  // Selection starts empty (no unit pre-selected) rather than defaulting to
  // the first unit on load: the two-pane layout renders both the list's
  // section headers and, once a unit is selected, UnitDetail's own
  // "Structured unit"/"Analytics unit" badge — auto-selecting on mount would
  // make both visible simultaneously, which is fine visually but leaves no
  // way for a single, unambiguous "Structured" text query to resolve to one
  // element. The operator picks a unit explicitly; the queue view stays
  // unambiguous either way, and successful links still auto-advance below.
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const selected = items.find((u) => u.unitKey === selectedKey) ?? null;

  async function handleLink(unit: NeedsLinkingItem, targetOrgId: string) {
    setLinkError(null);
    setWarning(null);
    try {
      let result: { postCommitStatus?: string | null } | null | undefined;
      if (unit.linkUnitType === 'structured') {
        result = await svc.linkStructuredUnit({
          representativeEventId: unit.representativeEventId,
          targetOrgId,
        });
      } else {
        result = await svc.linkVisitor({
          visitorId: unit.visitorId as string,
          targetOrgId,
        });
      }
      // The durable link (move/bridge) already succeeded at this point, so we
      // still evict + auto-advance even when a post-commit follow-up
      // (source update / audit log) failed — that failure is surfaced as a
      // non-blocking warning instead of aborting the operator's flow.
      if (result?.postCommitStatus === 'post_commit_failed') {
        setWarning('Linked, but some follow-up (source update / audit) did not complete — check logs.');
      }
      const currentIndex = items.findIndex((i) => i.unitKey === unit.unitKey);
      const next = items[currentIndex + 1];
      const nextKey = next && next.unitKey !== unit.unitKey ? next.unitKey : null;
      evictUnit(unit.unitKey);
      setSelectedKey(nextKey);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Failed to link unit');
    }
  }

  return (
    <div>
      <div className="mb-6 md:mb-10">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-on-surface-variant mb-2">
          Customer Intelligence
        </p>
        <h1 className="font-headline text-3xl md:text-5xl font-black text-on-surface tracking-tighter">
          Needs linking
        </h1>
      </div>

      {error && (
        <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body mb-6">
          Error: {error.message}
        </div>
      )}
      {linkError && (
        <div className="bg-error-container text-on-error-container p-4 rounded-lg font-body mb-6">
          Error: {linkError}
        </div>
      )}
      {warning && (
        <div className="bg-tertiary-container text-on-tertiary-container p-4 rounded-lg font-body mb-6">
          Warning: {warning}
        </div>
      )}

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">
          Loading units…
        </div>
      ) : items.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-on-surface-variant font-body">
          No units to link.
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-4 md:gap-6 h-[70vh]">
          <div className="col-span-12 md:col-span-5 lg:col-span-4 border border-outline-variant/20 rounded-lg overflow-hidden">
            <UnitList units={items} selectedKey={selectedKey} onSelect={setSelectedKey} />
            {hasMore && (
              <button
                type="button"
                onClick={() => { void loadMore(); }}
                className="w-full px-4 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low transition-colors border-t border-outline-variant/10"
              >
                Load more
              </button>
            )}
          </div>
          <div className="col-span-12 md:col-span-7 lg:col-span-8 border border-outline-variant/20 rounded-lg overflow-y-auto">
            {selected ? (
              <UnitDetail
                unit={selected}
                searchOrgs={searchOrgs}
                onLink={(orgId) => { void handleLink(selected, orgId); }}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-on-surface-variant font-body">
                Select a unit to link.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
