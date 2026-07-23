import { useState, type Dispatch, type SetStateAction } from 'react';
import { getOrgOverride, setOrgOverride, undoOrgOverride, renameOrg, type OrgOverride } from '../../../../services/adminClassificationService';
import { orgOverrideKey } from '../orgAggregation';
import type { RfqSubmission } from '../../../../types/admin';
import type { OrganizationRecord } from '../types';
import type { OrgDetection } from './useOrgDetection';

type OverrideMsg = { type: 'success' | 'error'; text: string } | null;

interface OrgDetailHeaderProps {
  org: OrganizationRecord;
  onBack: () => void;
  override: OrgOverride | null;
  setOverride: Dispatch<SetStateAction<OrgOverride | null>>;
  overrideLoading: boolean;
  setOverrideLoading: Dispatch<SetStateAction<boolean>>;
  overrideMsg: OverrideMsg;
  setOverrideMsg: Dispatch<SetStateAction<OverrideMsg>>;
  linkedRfqs: RfqSubmission[];
  detection: OrgDetection;
}

export function OrgDetailHeader({
  org, onBack, override, setOverride, overrideLoading, setOverrideLoading,
  overrideMsg, setOverrideMsg, linkedRfqs, detection,
}: OrgDetailHeaderProps) {
  const { displayOrgType, isManualOverride, currentIsTarget, engagement, engagementBadgeClass } = detection;
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  async function handleOverride(isTarget: boolean) {
    setOverrideLoading(true);
    setOverrideMsg(null);
    try {
      // ISP visitors: override keyed on the stable visitorId (org.key), never
      // the synthesized city-level display name — see orgOverrideKey.
      const result = await setOrgOverride(orgOverrideKey(org), isTarget);
      setOverride(result);
      setOverrideMsg({ type: 'success', text: `Marked as ${isTarget ? 'target' : 'non-target'} customer` });
    } catch {
      setOverrideMsg({ type: 'error', text: 'Failed to save override' });
    } finally {
      setOverrideLoading(false);
    }
  }

  async function handleUndoOverride() {
    setOverrideLoading(true);
    setOverrideMsg(null);
    try {
      const overrideKey = orgOverrideKey(org);
      // The override may live under the stable key (new writes) OR the legacy
      // display name — undo each independently: a 404 on one must not stop
      // the other from being cleared.
      let undone = false;
      try { await undoOrgOverride(overrideKey); undone = true; } catch { /* none under stable key */ }
      if (overrideKey !== org.orgName) {
        try { await undoOrgOverride(org.orgName); undone = true; } catch { /* none under legacy name */ }
      }
      if (!undone) throw new Error('No override found to undo');
      // Re-fetch to get restored state
      const fresh = await getOrgOverride(overrideKey);
      setOverride(fresh);
      setOverrideMsg({ type: 'success', text: 'Override removed' });
    } catch {
      setOverrideMsg({ type: 'error', text: 'Failed to undo override' });
    } finally {
      setOverrideLoading(false);
    }
  }

  async function handleRename() {
    const trimmed = editedName.trim();
    if (!trimmed || trimmed === (override?.displayName || org.orgName)) {
      setEditingName(false);
      return;
    }
    setRenameLoading(true);
    try {
      // Same stable key as target overrides — a display name stored under the
      // synthesized ISP label would drift with city/#N changes and split from
      // the visitor's target override.
      await renameOrg(orgOverrideKey(org), trimmed);
      setOverride((prev) => prev ? { ...prev, displayName: trimmed } : { found: true, displayName: trimmed });
      setEditingName(false);
      setOverrideMsg({ type: 'success', text: `Renamed to "${trimmed}"` });
    } catch {
      setOverrideMsg({ type: 'error', text: 'Failed to rename organization' });
    } finally {
      setRenameLoading(false);
    }
  }

  return (
    <>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1">
            <button className="inline-flex items-center gap-2 text-secondary text-sm font-medium hover:underline mb-2 border-none bg-transparent cursor-pointer" onClick={onBack}>
              <span className="material-symbols-outlined text-sm">arrow_back</span>
              Back to list
            </button>
            {(() => {
              const rfqInstitution = linkedRfqs.find(r => r.institution)?.institution;
              const showRfqName = rfqInstitution && rfqInstitution.toLowerCase() !== org.orgName.toLowerCase();
              const displayOrgName = override?.displayName || org.orgName;
              const hasDisplayName = !!override?.displayName;
              return showRfqName ? (
                <>
                  <h1 className="text-3xl font-bold tracking-tight text-on-surface font-headline">{rfqInstitution}</h1>
                  <p className="text-sm text-on-surface-variant">
                    <span className="material-symbols-outlined text-[14px] align-middle mr-1">dns</span>
                    IP: {org.orgName}
                  </p>
                </>
              ) : editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false); }}
                    className="text-2xl font-bold tracking-tight text-on-surface font-headline bg-surface-container px-3 py-1 rounded-lg border border-outline-variant focus:border-primary focus:outline-none w-full max-w-lg"
                    autoFocus
                    disabled={renameLoading}
                  />
                  <button onClick={handleRename} disabled={renameLoading} className="p-1.5 rounded-full hover:bg-secondary/10 text-secondary border-none bg-transparent cursor-pointer disabled:opacity-50" title="Save">
                    <span className="material-symbols-outlined text-xl">check</span>
                  </button>
                  <button onClick={() => setEditingName(false)} disabled={renameLoading} className="p-1.5 rounded-full hover:bg-error/10 text-error border-none bg-transparent cursor-pointer disabled:opacity-50" title="Cancel">
                    <span className="material-symbols-outlined text-xl">close</span>
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h1 className="text-3xl font-bold tracking-tight text-on-surface font-headline">{displayOrgName}</h1>
                  <button
                    onClick={() => { setEditedName(displayOrgName); setEditingName(true); }}
                    className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity border-none bg-transparent cursor-pointer"
                    title="Rename organization"
                  >
                    <span className="material-symbols-outlined text-lg">edit</span>
                  </button>
                  {hasDisplayName && (
                    <span className="text-xs text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">
                      {org.orgName}
                    </span>
                  )}
                </div>
              );
            })()}
            <div className="flex items-center gap-2 text-on-surface-variant">
              {(org.city || org.region || org.country) && (
                <>
                  <span className="material-symbols-outlined text-sm">location_on</span>
                  <span className="text-sm">{[org.city, org.region, org.country].filter(Boolean).join(', ')}</span>
                </>
              )}
              {engagement && (
                <>
                  {(org.city || org.region || org.country) && <span className="mx-2 text-outline-variant">|</span>}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${engagementBadgeClass}`}>
                    {engagement} Engagement
                  </span>
                </>
              )}
              {displayOrgType && displayOrgType !== 'unknown' && (
                <>
                  <span className="mx-2 text-outline-variant">|</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-on-surface-variant text-xs font-semibold">
                    {displayOrgType}
                  </span>
                </>
              )}
              {org.leadTier && (
                <span
                  className="px-2 py-0.5 rounded text-xs font-bold bg-secondary/10 text-secondary"
                  style={isManualOverride && !override?.isTargetCustomer ? { textDecoration: 'line-through', opacity: 0.5 } : undefined}
                >
                  Tier {org.leadTier}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentIsTarget ? (
              <button
                className="bg-error-container text-on-error-container px-6 py-2 rounded font-semibold text-sm hover:opacity-90 disabled:opacity-50 border-none cursor-pointer"
                onClick={() => handleOverride(false)}
                disabled={overrideLoading}
              >
                Mark as Not Target
              </button>
            ) : (
              <button
                className="bg-primary text-on-primary px-6 py-2 rounded font-semibold text-sm hover:opacity-90 disabled:opacity-50 border-none cursor-pointer"
                onClick={() => handleOverride(true)}
                disabled={overrideLoading}
              >
                Mark as Target
              </button>
            )}
            {isManualOverride && (
              <button
                className="bg-surface-container-high text-on-surface px-6 py-2 rounded font-semibold text-sm hover:bg-surface-dim border-none cursor-pointer disabled:opacity-50"
                onClick={handleUndoOverride}
                disabled={overrideLoading}
              >
                Undo Override
              </button>
            )}
          </div>
        </div>

        {overrideMsg && (
          <div className={`p-3 rounded-lg text-sm ${overrideMsg.type === 'success' ? 'bg-secondary/10 text-secondary' : 'bg-error-container text-on-error-container'}`}>
            {overrideMsg.text}
          </div>
        )}
    </>
  );
}
