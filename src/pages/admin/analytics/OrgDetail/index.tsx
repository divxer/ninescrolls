import { useState, useEffect, useMemo } from 'react';
import { getOrgOverride, classifyOrg, setOrgOverride, undoOrgOverride, renameOrg, type OrgOverride } from '../../../../services/adminClassificationService';
import { matchLinkedLeadsByVisitor } from '../../linkedLeadsMatch';
import { resolveTrafficChannel, type TrafficChannel } from '../../../../services/behaviorAnalytics';
import * as orderAdminService from '../../../../services/orderAdminService';
import type { RfqSubmission, LeadSubmission } from '../../../../types/admin';
import { getAmplifyDataClient } from '../../../../services/amplifyClient';
import type { AnalyticsEvent, OrganizationRecord } from '../types';
import { formatDuration, engagementLevel, formatRelativeTime, maskIP } from '../format';
import { getSearchQuery } from '../keywords';
import { ActivityLedger } from './ActivityLedger';

const client = getAmplifyDataClient;

export function OrgDetail({ org, onBack, allContactLeads, allDownloadGateLeads, allNewsletterLeads }: { org: OrganizationRecord; onBack: () => void; allContactLeads: LeadSubmission[]; allDownloadGateLeads: LeadSubmission[]; allNewsletterLeads: LeadSubmission[] }) {
  const [showFullIP, setShowFullIP] = useState(false);
  const [override, setOverride] = useState<OrgOverride | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(true);
  const [overrideMsg, setOverrideMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setOverrideLoading(true);
    getOrgOverride(org.orgName).then(async (result) => {
      if (cancelled) return;
      // Auto-classify if no cached classification exists.
      if (!result.found) {
        try {
          const ctxEvent = org.events.find(e => e.isp || e.country || e.city) || org.events[0];
          const classified = await classifyOrg(org.orgName, {
            isp: ctxEvent?.isp || undefined,
            country: ctxEvent?.country || undefined,
            city: ctxEvent?.city || undefined,
          });
          if (!cancelled) {
            setOverride(classified);
            // Write back AI data to events missing it (backfill on view)
            if (classified.organizationType) {
              const eventsToFix = org.events.filter(e =>
                e.eventType === 'page_view' && !e.aiOrganizationType
              );
              for (const e of eventsToFix) {
                try {
                  await client().graphql({
                    query: `mutation UpdateEvent($input: UpdateAnalyticsEventInput!) {
                      updateAnalyticsEvent(input: $input) { id }
                    }`,
                    variables: {
                      input: {
                        id: e.id,
                        aiOrganizationType: classified.organizationType,
                        aiConfidence: classified.confidence ?? null,
                        aiReason: classified.reason ?? null,
                        provider: classified.provider ?? null,
                      },
                    },
                    authMode: 'userPool',
                  } as any);
                } catch { /* best-effort backfill */ }
              }
            }
          }
        } catch {
          if (!cancelled) setOverride(result);
        }
      } else {
        setOverride(result);
      }
    }).catch(() => {
      if (!cancelled) setOverride(null);
    }).finally(() => {
      if (!cancelled) setOverrideLoading(false);
    });
    return () => { cancelled = true; };
  }, [org.orgName]);

  // ── Linked RFQ lookup ──────────────────────────────────────────────────
  const [linkedRfqs, setLinkedRfqs] = useState<RfqSubmission[]>([]);
  const rfqSubmitted = org.events.some((e) => e.eventType === 'rfq_submission');

  useEffect(() => {
    if (!rfqSubmitted) return;
    let cancelled = false;

    // 1. Collect rfqIds and timestamps from rfq_submission event properties
    const rfqIdsFromEvents = new Set<string>();
    const rfqEventTimestamps: number[] = [];
    for (const e of org.events) {
      if (e.eventType !== 'rfq_submission') continue;
      rfqEventTimestamps.push(new Date(e.timestamp).getTime());
      const props = typeof e.properties === 'string'
        ? (() => { try { return JSON.parse(e.properties); } catch { return null; } })()
        : e.properties;
      if (props?.rfqId) rfqIdsFromEvents.add(props.rfqId as string);
    }

    // 2. Fetch individual RFQs by ID (new events with rfqId in properties)
    const fetchById = Array.from(rfqIdsFromEvents).map(id =>
      orderAdminService.getRfq(id).catch(() => null)
    );

    // 3. For legacy events without rfqId, match by timestamp proximity (±60s)
    const hasLegacyEvents = rfqEventTimestamps.length > rfqIdsFromEvents.size;
    const fetchByTimestamp = hasLegacyEvents
      ? orderAdminService.listRfqs().then(data => {
          const items = (data?.items as RfqSubmission[]) || [];
          return items.filter(r => {
            const rfqTime = new Date(r.submittedAt).getTime();
            return rfqEventTimestamps.some(evtTime => Math.abs(rfqTime - evtTime) < 60_000);
          });
        }).catch(() => [] as RfqSubmission[])
      : Promise.resolve([] as RfqSubmission[]);

    Promise.all([Promise.all(fetchById), fetchByTimestamp]).then(([byId, byTime]) => {
      if (cancelled) return;
      const map = new Map<string, RfqSubmission>();
      for (const r of byId) if (r) map.set((r as RfqSubmission).rfqId, r as RfqSubmission);
      for (const r of byTime) if (!map.has(r.rfqId)) map.set(r.rfqId, r);
      setLinkedRfqs(Array.from(map.values()));
    });

    return () => { cancelled = true; };
  }, [rfqSubmitted, org.events]);

  // ── Linked Inquiries lookup ────────────────────────────────────────────
  // Mirrors linkedRfqs but joins against the leads already fetched at the
  // top level (no duplicate listLeads call). No leadId is stored in
  // contact_form event properties (we did not change form/segment/storage),
  // so this is purely visitorId + timestamp join via matchLinkedLeadsByVisitor.
  const [linkedInquiries, setLinkedInquiries] = useState<LeadSubmission[]>([]);
  const hasContactForm = org.events.some((e) => e.eventType === 'contact_form');

  useEffect(() => {
    if (!hasContactForm) {
      setLinkedInquiries([]);
      return;
    }
    const eventsForMatcher = org.events.map((e) => ({
      visitorId: (e as Record<string, unknown>).visitorId as string | null | undefined,
      eventType: e.eventType,
      timestamp: e.timestamp,
    }));
    setLinkedInquiries(matchLinkedLeadsByVisitor(eventsForMatcher, allContactLeads));
  }, [hasContactForm, org.events, allContactLeads]);

  // ── Linked Downloads lookup ────────────────────────────────────────────
  // Same hybrid match as linkedInquiries, just against download_gate leads.
  const [linkedDownloads, setLinkedDownloads] = useState<LeadSubmission[]>([]);
  const hasDownload = org.events.some((e) =>
    e.eventType === 'lead_capture' || e.eventType === 'pdf_download'
  );

  useEffect(() => {
    if (!hasDownload) {
      setLinkedDownloads([]);
      return;
    }
    const eventsForMatcher = org.events.map((e) => ({
      visitorId: (e as Record<string, unknown>).visitorId as string | null | undefined,
      eventType: e.eventType,
      timestamp: e.timestamp,
    }));
    setLinkedDownloads(matchLinkedLeadsByVisitor(eventsForMatcher, allDownloadGateLeads, ['lead_capture', 'pdf_download']));
  }, [hasDownload, org.events, allDownloadGateLeads]);

  // ── Linked Newsletter lookup ───────────────────────────────────────────
  // Newsletter signups have only email + source + timestamp. No event-type
  // gate — newsletter signups don't always fire a corresponding analytics
  // event (the form posts directly to the leads API). Match purely by
  // visitorId; if no visitorId matches, the card simply hides.
  const [linkedNewsletters, setLinkedNewsletters] = useState<LeadSubmission[]>([]);

  useEffect(() => {
    if (allNewsletterLeads.length === 0) {
      setLinkedNewsletters([]);
      return;
    }
    const visitorIds = new Set<string>();
    for (const e of org.events) {
      const vid = (e as Record<string, unknown>).visitorId as string | null | undefined;
      if (vid) visitorIds.add(vid);
    }
    if (visitorIds.size === 0) {
      setLinkedNewsletters([]);
      return;
    }
    const matched = allNewsletterLeads
      .filter(l => l.visitorId && visitorIds.has(l.visitorId))
      .sort((a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt));
    setLinkedNewsletters(matched);
  }, [org.events, allNewsletterLeads]);

  async function handleOverride(isTarget: boolean) {
    setOverrideLoading(true);
    setOverrideMsg(null);
    try {
      const result = await setOrgOverride(org.orgName, isTarget);
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
      await undoOrgOverride(org.orgName);
      // Re-fetch to get restored state
      const fresh = await getOrgOverride(org.orgName);
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
      await renameOrg(org.orgName, trimmed);
      setOverride((prev) => prev ? { ...prev, displayName: trimmed } : { found: true, displayName: trimmed });
      setEditingName(false);
      setOverrideMsg({ type: 'success', text: `Renamed to "${trimmed}"` });
    } catch {
      setOverrideMsg({ type: 'error', text: 'Failed to rename organization' });
    } finally {
      setRenameLoading(false);
    }
  }

  // Collect unique IPs, ISPs, User Agents, and visitor IDs
  const uniqueIPs = Array.from(new Set(org.events.map((e) => e.ip).filter(Boolean))) as string[];
  const uniqueISPs = Array.from(new Set(org.events.map((e) => e.isp).filter(Boolean))) as string[];
  const uniqueUAs = Array.from(new Set(org.events.map((e) => e.userAgent).filter(Boolean))) as string[];

  // ── Per-IP network contexts (for multi-network visitors) ──
  const networkContexts = useMemo(() => {
    const ipMap = new Map<string, { ip: string; orgName: string; org: string; organizationType: string; isp: string; count: number }>();
    for (const e of org.events) {
      if (!e.ip) continue;
      const existing = ipMap.get(e.ip);
      if (existing) {
        existing.count++;
        if (!existing.orgName && e.orgName) existing.orgName = e.orgName;
        if (!existing.org && e.org) existing.org = e.org;
        if (!existing.organizationType && e.organizationType) existing.organizationType = e.organizationType;
        if (!existing.isp && e.isp) existing.isp = e.isp;
      } else {
        ipMap.set(e.ip, {
          ip: e.ip,
          orgName: e.orgName || '',
          org: e.org || '',
          organizationType: e.organizationType || '',
          isp: e.isp || '',
          count: 1,
        });
      }
    }
    return Array.from(ipMap.values()).sort((a, b) => b.count - a.count);
  }, [org.events]);
  const hasMultipleNetworks = networkContexts.length > 1
    && new Set(networkContexts.map(c => c.orgName || c.org || c.isp).filter(Boolean)).size > 1;

  const visitedContactPage = org.events.some((e) =>
    e.pathname?.includes('/contact') || e.eventName === 'Contact Form Submitted'
  );
  const downloadedPDF = org.events.some((e) =>
    e.eventType === 'pdf_download' || e.eventName === 'Product Downloaded' || e.eventName === 'Datasheet Downloaded' || e.eventName === 'Document Downloaded'
  );
  const contactFormSubmitted = org.events.some((e) => e.eventType === 'contact_form');
  const uniqueProductPages = new Set(
    org.events.filter((e) => e.eventType === 'product_view' || e.pathname?.includes('/products/')).map((e) => e.pathname)
  );

  // Group events by date
  const eventsByDate = new Map<string, AnalyticsEvent[]>();
  for (const e of org.events) {
    const dateKey = new Date(e.timestamp).toLocaleDateString();
    const existing = eventsByDate.get(dateKey);
    if (existing) {
      existing.push(e);
    } else {
      eventsByDate.set(dateKey, [e]);
    }
  }

  // ── Pre-compute detection details (shared between left & right columns) ──
  const aiEvent = org.events.find((e) => e.aiReason || e.aiOrganizationType);
  const ipEvent = org.events.find((e) => e.organizationType && e.organizationType !== 'unknown') || org.events[0];
  const ipOrgType = ipEvent?.organizationType || 'unknown';
  const hasEventAI = aiEvent && aiEvent.aiConfidence != null && aiEvent.aiOrganizationType;
  const hasOverrideAI = !hasEventAI && override?.found && override?.source !== 'manual'
    && !!(override?.organizationType);
  const hasAI = hasEventAI || hasOverrideAI;
  const effectiveAiOrgType = hasEventAI ? aiEvent.aiOrganizationType : override?.organizationType;
  const effectiveAiConf = hasEventAI ? (aiEvent.aiConfidence ?? 0) : (override?.confidence ?? 0);
  const effectiveAiReason = hasEventAI ? aiEvent.aiReason : override?.reason;
  const aiUpgraded = hasAI && effectiveAiOrgType !== 'unknown' && effectiveAiOrgType !== ipOrgType;

  // Classification source
  const classificationSource = (() => {
    if (override?.found && override?.source === 'manual') return 'manual';
    if (hasAI && effectiveAiConf >= 0.5) return 'ai';
    if (ipOrgType !== 'unknown') return 'ip';
    if (org.isAnonymousHighIntent) return 'behavior';
    return 'none';
  })();

  // AI provider label
  const aiProviderLabel = (() => {
    if (hasEventAI) {
      const provider = (aiEvent as Record<string, unknown>).provider as string | undefined;
      if (provider === 'bedrock') return 'Bedrock';
      if (provider === 'anthropic') return 'Anthropic API';
    }
    if (override?.provider) return override.provider === 'bedrock' ? 'Bedrock' : 'Anthropic API';
    return null;
  })();

  // Override state
  const isManualOverride = override?.found && override?.source === 'manual';
  const currentIsTarget = isManualOverride ? override?.isTargetCustomer : org.isTargetCustomer;

  // Display org type
  const displayOrgType = (override?.found && override?.organizationType && override.organizationType !== 'unknown')
    ? override.organizationType
    : org.organizationType;

  // Engagement level
  const engagement = engagementLevel(org.maxBehaviorScore);
  const engagementBadgeClass = engagement === 'High'
    ? 'bg-secondary/10 text-secondary'
    : engagement === 'Medium'
      ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
      : 'bg-error-container text-on-error-container';

  // Traffic sources computation
  const channelIcons: Record<string, string> = {
    paid_search: 'paid', organic_search: 'search', ai_referral: 'smart_toy',
    paid_social: 'share', organic_social: 'share', email: 'mail',
    referral: 'link', direct: 'monitor',
  };
  const channelLabels: Record<string, string> = {
    paid_search: 'Paid Search', organic_search: 'Organic Search', ai_referral: 'AI Referral',
    paid_social: 'Paid Social', organic_social: 'Organic Social', email: 'Email',
    referral: 'Referral', direct: 'Direct',
  };
  const trafficSources = useMemo(() => {
    const sources = new Map<string, { count: number; channel: TrafficChannel; label: string }>();
    for (const e of org.events) {
      const channel = resolveTrafficChannel(e);
      const hostname = e.referrer
        ? (() => { try { return new URL(e.referrer).hostname; } catch { return e.referrer; } })()
        : '';
      const groupKey = hostname ? `${channel}::${hostname}` : channel;
      const displayLabel = hostname || (channelLabels[channel] || 'Other');
      const existing = sources.get(groupKey);
      if (existing) existing.count += 1;
      else sources.set(groupKey, { count: 1, channel, label: displayLabel });
    }
    return Array.from(sources.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [org.events]);

  // Search keywords from this org's events
  const searchKeywords = useMemo(() => {
    const kws = new Map<string, { count: number; source: 'organic' | 'paid' }>();
    for (const e of org.events) {
      const keyword = getSearchQuery(e) || e.utmTerm;
      if (!keyword) continue;
      const key = keyword.toLowerCase().trim();
      const channel = resolveTrafficChannel(e);
      const source = channel === 'paid_search' ? 'paid' : 'organic';
      const existing = kws.get(key);
      if (existing) existing.count++;
      else kws.set(key, { count: 1, source });
    }
    return Array.from(kws.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [org.events]);

  // Referrer URL for display
  const primaryReferrer = useMemo(() => {
    const ev = org.events.find((e) => {
      if (!e.referrer) return false;
      try {
        const host = new URL(e.referrer).hostname.toLowerCase();
        return !host.includes('ninescrolls') && !host.includes('localhost');
      } catch { return false; }
    });
    return ev?.referrer || null;
  }, [org.events]);

  // Parse UA for OS/Browser display
  const parsedUA = useMemo(() => {
    const ua = uniqueUAs[0] || '';
    let os = 'Unknown';
    let browser = 'Unknown';
    if (ua.includes('Mac OS X')) {
      const m = ua.match(/Mac OS X (\d+[._]\d+)/);
      os = m ? `macOS ${m[1].replace(/_/g, '.')}` : 'macOS';
    } else if (ua.includes('Windows')) {
      const m = ua.match(/Windows NT (\d+\.\d+)/);
      os = m ? `Windows ${m[1] === '10.0' ? '10/11' : m[1]}` : 'Windows';
    } else if (ua.includes('Linux')) os = 'Linux';
    if (ua.includes('Chrome/')) {
      const m = ua.match(/Chrome\/(\d+)/);
      browser = m ? `Chrome ${m[1]}` : 'Chrome';
    } else if (ua.includes('Firefox/')) {
      const m = ua.match(/Firefox\/(\d+)/);
      browser = m ? `Firefox ${m[1]}` : 'Firefox';
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      const m = ua.match(/Version\/(\d+)/);
      browser = m ? `Safari ${m[1]}` : 'Safari';
    }
    return { os, browser };
  }, [uniqueUAs]);

  return (
    <div className="space-y-8">
      {/* ── Header Section ── */}
      <section className="space-y-6">
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

        {/* ── High-Level Stats Grid ── */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0.5 bg-outline-variant/20 rounded-xl overflow-hidden">
          <div className="bg-surface-container-lowest p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">First Seen</p>
            <p className="font-headline text-lg font-bold">{new Date(org.firstVisit).toLocaleDateString()}</p>
          </div>
          <div className="bg-surface-container-lowest p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Last Seen</p>
            <p className="font-headline text-lg font-bold">{formatRelativeTime(org.lastVisit)}</p>
          </div>
          <div className="bg-surface-container-lowest p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Total Events</p>
            <p className="font-headline text-lg font-bold">{org.totalEvents.toLocaleString()}</p>
          </div>
          <div className="bg-surface-container-lowest p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Pages Viewed</p>
            <p className="font-headline text-lg font-bold">{org.uniquePages}</p>
          </div>
          <div className="bg-surface-container-lowest p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Active Time</p>
            <p className="font-headline text-lg font-bold">{org.totalTimeOnSite > 0 ? formatDuration(org.totalTimeOnSite) : 'Pending'}</p>
          </div>
          <div className="bg-surface-container-lowest p-5">
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-1">Return Visits</p>
            <p className="font-headline text-lg font-bold">{org.returnVisits}</p>
          </div>
        </div>
      </section>

      {/* ── Analysis Dashboard: Two-Column Layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* ── Left Column: Primary Analysis ── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Behavior Analysis Card */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">psychology</span>
                Behavior Analysis
              </h3>
              {org.lifecycleStage && (
                <span className="text-xs font-medium text-on-surface-variant">{org.lifecycleStage}</span>
              )}
            </div>
            <div className="space-y-4">
              {org.maxBehaviorScore > 0 ? (
                <>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-headline font-bold text-primary">{(org.maxBehaviorScore * 100).toFixed(0)}%</p>
                      <p className="text-sm text-on-surface-variant">Intent Probability Score</p>
                    </div>
                    <div className="text-right">
                      {org.maxBehaviorScore >= 0.3 ? (
                        <p className="text-xs font-bold text-secondary uppercase">Above Threshold</p>
                      ) : (
                        <>
                          <p className="text-xs font-bold text-error uppercase">Below Threshold</p>
                          <p className="text-xs text-on-surface-variant">30% minimum required</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-3 w-full bg-surface-container rounded-full overflow-hidden">
                    <div
                      className="h-full bg-secondary rounded-full transition-all"
                      style={{ width: `${Math.min(org.maxBehaviorScore * 100, 100)}%` }}
                    />
                  </div>
                </>
              ) : (
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-headline font-bold text-on-surface-variant">--</p>
                    <p className="text-sm text-on-surface-variant">No behavior score recorded</p>
                  </div>
                </div>
              )}

              {/* AI Observation / Behavior Signals */}
              <div className="space-y-2">
                {org.isTargetCustomer && (
                  <div className="p-4 bg-secondary/5 rounded-lg">
                    <p className="text-sm leading-relaxed text-on-surface">
                      <span className="font-bold text-secondary">Target Customer:</span> Identified as a target customer based on classification and engagement signals.
                    </p>
                  </div>
                )}
                {org.isAnonymousHighIntent && !(override?.found && override?.isTargetCustomer) && (
                  <div className="p-4 bg-surface rounded-lg">
                    <p className="text-sm leading-relaxed text-on-surface">
                      <span className="font-bold text-primary">AI Observation:</span>{' '}
                      {org.isISPVisitor
                        ? 'ISP visitor with purchase intent — browsing from home/mobile network. Consider monitoring for return visits or PDF downloads to confirm buyer interest.'
                        : 'Unknown company with high purchase intent — consider targeted engagement.'}
                    </p>
                  </div>
                )}
                {!org.isTargetCustomer && !org.isAnonymousHighIntent && org.maxBehaviorScore > 0 && org.maxBehaviorScore < 0.3 && (
                  <div className="p-4 bg-surface rounded-lg">
                    <p className="text-sm leading-relaxed text-on-surface">
                      <span className="font-bold text-primary">AI Observation:</span> The visitor primarily engaged with documentation and generic pricing pages without initiating high-value interactions like "Schedule Demo" or "API Console" access.
                    </p>
                  </div>
                )}
                {effectiveAiReason && !org.isAnonymousHighIntent && (
                  <div className="p-4 bg-surface rounded-lg">
                    <p className="text-sm leading-relaxed text-on-surface">
                      <span className="font-bold text-primary">AI Observation:</span> {effectiveAiReason}
                    </p>
                  </div>
                )}
              </div>

              {/* Signal badges */}
              {(downloadedPDF || visitedContactPage || rfqSubmitted || contactFormSubmitted || uniqueProductPages.size >= 3 || org.returnVisits >= 3) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {downloadedPDF && (
                    <span className="flex items-center gap-1.5 bg-secondary/10 text-secondary rounded-lg px-3 py-1.5 text-xs font-medium">
                      <span className="material-symbols-outlined text-sm">download</span> PDF Downloaded
                    </span>
                  )}
                  {visitedContactPage && (
                    <span className="flex items-center gap-1.5 bg-secondary/10 text-secondary rounded-lg px-3 py-1.5 text-xs font-medium">
                      <span className="material-symbols-outlined text-sm">mail</span> Contact Page
                    </span>
                  )}
                  {rfqSubmitted && (
                    <span className="flex items-center gap-1.5 bg-secondary/10 text-secondary rounded-lg px-3 py-1.5 text-xs font-medium">
                      <span className="material-symbols-outlined text-sm">send</span> RFQ Submitted
                    </span>
                  )}
                  {contactFormSubmitted && !rfqSubmitted && (
                    <span className="flex items-center gap-1.5 bg-secondary/10 text-secondary rounded-lg px-3 py-1.5 text-xs font-medium">
                      <span className="material-symbols-outlined text-sm">contact_mail</span> Contact Form
                    </span>
                  )}
                  {uniqueProductPages.size >= 3 && (
                    <span className="flex items-center gap-1.5 bg-tertiary-fixed/20 text-on-surface rounded-lg px-3 py-1.5 text-xs font-medium">
                      {uniqueProductPages.size} Products Compared
                    </span>
                  )}
                  {org.returnVisits >= 3 && (
                    <span className="flex items-center gap-1.5 bg-tertiary-fixed/20 text-on-surface rounded-lg px-3 py-1.5 text-xs font-medium">
                      {org.returnVisits} Return Visits
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Activity Ledger ── */}
          <ActivityLedger org={org} showFullIP={showFullIP} setShowFullIP={setShowFullIP} hasMultipleNetworks={hasMultipleNetworks} />
        </div>

        {/* ── Right Column: Context & Metadata ── */}
        <div className="space-y-8">
          {/* Detection Details Card */}
          <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
            <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">security</span>
              Detection Details
            </h3>
            <div className="space-y-6">
              {/* IP Details */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">
                  {hasMultipleNetworks ? 'Networks Detected' : 'IP Lookup'}
                </p>
                {hasMultipleNetworks ? (
                  <div className="space-y-2">
                    {networkContexts.map((ctx) => {
                      const label = ctx.orgName || ctx.org || ctx.isp || 'Unknown';
                      const typeLabel = ctx.organizationType && ctx.organizationType !== 'unknown'
                        ? ctx.organizationType : '';
                      return (
                        <div key={ctx.ip} className="p-3 bg-surface rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <span
                                className="font-mono text-xs font-bold cursor-pointer hover:text-on-surface"
                                onClick={() => setShowFullIP((v) => !v)}
                                title={showFullIP ? 'Click to mask' : 'Click to reveal'}
                              >
                                {showFullIP ? ctx.ip : maskIP(ctx.ip)}
                              </span>
                              {showFullIP && (
                                <a href={`https://ipinfo.io/${ctx.ip}`} target="_blank" rel="noopener noreferrer" title="Lookup on ipinfo.io" className="text-on-surface-variant hover:text-primary transition-colors">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </a>
                              )}
                            </span>
                            <span className="text-[10px] text-on-surface-variant">
                              {ctx.count} event{ctx.count !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-on-surface">{label}</span>
                            {typeLabel && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                                {typeLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between p-3 bg-surface rounded-lg">
                      <span className="flex items-center gap-1.5">
                        <span
                          className="font-mono text-xs font-bold cursor-pointer hover:text-on-surface"
                          onClick={() => setShowFullIP((v) => !v)}
                          title={showFullIP ? 'Click to mask' : 'Click to reveal'}
                        >
                          {uniqueIPs.length > 0
                            ? (showFullIP ? uniqueIPs[0] : maskIP(uniqueIPs[0]))
                            : 'N/A'}
                        </span>
                        {showFullIP && uniqueIPs.length > 0 && (
                          <a href={`https://ipinfo.io/${uniqueIPs[0]}`} target="_blank" rel="noopener noreferrer" title="Lookup on ipinfo.io" className="text-on-surface-variant hover:text-primary transition-colors">
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                          </a>
                        )}
                      </span>
                      {aiUpgraded && (
                        <span className="text-[10px] font-bold bg-primary-fixed text-primary px-2 py-0.5 rounded">UPGRADED</span>
                      )}
                    </div>
                    {uniqueIPs.length > 1 && (
                      <div className="space-y-1 mt-2">
                        {uniqueIPs.slice(1).map((ip) => (
                          <div key={ip} className="flex items-center p-2 bg-surface rounded-lg">
                            <span className="flex items-center gap-1.5">
                              <span className="font-mono text-xs text-on-surface-variant cursor-pointer hover:text-on-surface" onClick={() => setShowFullIP((v) => !v)}>
                                {showFullIP ? ip : maskIP(ip)}
                              </span>
                              {showFullIP && (
                                <a href={`https://ipinfo.io/${ip}`} target="_blank" rel="noopener noreferrer" title="Lookup on ipinfo.io" className="text-on-surface-variant hover:text-primary transition-colors">
                                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                                </a>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-on-surface-variant mt-2">
                      Type: <span className="text-on-surface font-medium">
                        {org.companyType || ipOrgType || 'Unknown'}
                        {uniqueISPs.length > 0 && ` / ${uniqueISPs[0]}`}
                      </span>
                    </p>
                  </>
                )}
              </div>

              {/* AI Classification */}
              {hasAI && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">AI Classification</p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-on-surface">{effectiveAiOrgType}</span>
                    <span className="text-sm font-bold text-secondary">{(effectiveAiConf * 100).toFixed(0)}% Confidence</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-secondary" style={{ width: `${effectiveAiConf * 100}%` }} />
                  </div>
                  {effectiveAiReason && (
                    <div className="mt-4 p-3 border-l-4 border-outline-variant bg-surface-container-low">
                      <p className="text-xs italic text-on-surface-variant leading-relaxed">
                        "{effectiveAiReason}"
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Status Indicators */}
              <div className="pt-4" style={{ borderTop: '1px solid rgba(196, 198, 207, 0.2)' }}>
                <div className="flex items-center gap-2 text-xs font-medium text-on-surface-variant">
                  {classificationSource === 'ai' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-secondary" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                      AI Classified{aiProviderLabel ? ` via ${aiProviderLabel}` : ''}
                    </>
                  )}
                  {classificationSource === 'manual' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-tertiary-fixed-dim" style={{ fontVariationSettings: "'FILL' 1" }}>edit</span>
                      Manual Override
                    </>
                  )}
                  {classificationSource === 'ip' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">dns</span>
                      IP Lookup Classification
                    </>
                  )}
                  {classificationSource === 'behavior' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-tertiary-fixed-dim">trending_up</span>
                      Behavior-based Classification
                    </>
                  )}
                  {classificationSource === 'none' && (
                    <>
                      <span className="material-symbols-outlined text-[16px] text-on-surface-variant">help_outline</span>
                      Unclassified
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Linked RFQs Card */}
          {linkedRfqs.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">request_quote</span>
                Linked RFQs
              </h3>
              <div className="space-y-3">
                {linkedRfqs.map(rfq => (
                  <a
                    key={rfq.rfqId}
                    href={`/admin/rfqs/${rfq.rfqId}`}
                    className="block p-3 bg-surface-container-low rounded-lg hover:bg-surface-container transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-bold text-primary">
                        {rfq.referenceNumber || rfq.rfqId.slice(0, 12)}
                      </span>
                      <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
                        rfq.status === 'pending' ? 'bg-tertiary/10 text-tertiary'
                          : rfq.status === 'converted' ? 'bg-primary/10 text-primary'
                          : 'bg-surface-container text-on-surface-variant'
                      }`}>
                        {rfq.status}
                      </span>
                    </div>
                    {rfq.institution && (
                      <p className="text-xs font-medium text-on-surface">{rfq.institution}</p>
                    )}
                    {rfq.name && (
                      <p className="text-xs text-on-surface-variant">{rfq.name} {rfq.email && `· ${rfq.email}`}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-on-surface-variant">
                      {rfq.equipmentCategory && <span>{rfq.equipmentCategory}</span>}
                      {rfq.specificModel && <span>· {rfq.specificModel}</span>}
                      <span>· {new Date(rfq.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Linked Inquiries Card */}
          {linkedInquiries.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">contact_mail</span>
                Linked Inquiries
              </h3>
              <div className="space-y-3">
                {linkedInquiries.map(lead => {
                  const subject = lead.productName || lead.topic || lead.inquiryType || 'General Inquiry';
                  return (
                    <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
                      <div className="text-sm font-bold text-primary mb-1">{subject}</div>
                      {lead.name && (
                        <p className="text-xs text-on-surface">
                          {lead.name}
                          {lead.email && (
                            <> · <a href={`mailto:${lead.email}`} className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>{lead.email}</a></>
                          )}
                        </p>
                      )}
                      {lead.phone && (
                        <p className="text-[11px] text-on-surface-variant">{lead.phone}</p>
                      )}
                      {lead.organization && (
                        <p className="text-[11px] text-on-surface-variant">{lead.organization}</p>
                      )}
                      {lead.message && (
                        <p
                          className="mt-2 pt-2 border-t border-outline-variant/20 text-xs text-on-surface whitespace-pre-wrap line-clamp-3"
                          title={lead.message}
                        >
                          {lead.message}
                        </p>
                      )}
                      <div className="mt-2 text-[10px] text-on-surface-variant">
                        {new Date(lead.submittedAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked Downloads Card */}
          {linkedDownloads.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">download</span>
                Linked Downloads
              </h3>
              <div className="space-y-3">
                {linkedDownloads.map(lead => {
                  const subject = lead.fileName || lead.productName || 'Download';
                  return (
                    <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
                      <div className="text-sm font-bold text-primary mb-1 break-all" title={subject}>{subject}</div>
                      {lead.name && (
                        <p className="text-xs text-on-surface">
                          {lead.name}
                          {lead.email && (
                            <> · <a href={`mailto:${lead.email}`} className="text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>{lead.email}</a></>
                          )}
                        </p>
                      )}
                      {lead.organization && (
                        <p className="text-[11px] text-on-surface-variant">{lead.organization}</p>
                      )}
                      {lead.jobTitle && (
                        <p className="text-[11px] text-on-surface-variant italic">{lead.jobTitle}</p>
                      )}
                      {(lead.researchAreas || lead.intent) && (
                        <div className="mt-2 pt-2 border-t border-outline-variant/20 space-y-1">
                          {lead.researchAreas && (
                            <p className="text-xs text-on-surface line-clamp-2" title={lead.researchAreas}>
                              <span className="font-semibold">Research Areas:</span> {lead.researchAreas}
                            </p>
                          )}
                          {lead.intent && (
                            <p className="text-xs text-on-surface line-clamp-2" title={lead.intent}>
                              <span className="font-semibold">Intent:</span> {lead.intent}
                            </p>
                          )}
                        </div>
                      )}
                      <div className="mt-2 text-[10px] text-on-surface-variant">
                        {new Date(lead.submittedAt).toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Linked Newsletter Card */}
          {linkedNewsletters.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">newspaper</span>
                Newsletter Signups
              </h3>
              <div className="space-y-3">
                {linkedNewsletters.map(lead => (
                  <div key={lead.leadId} className="p-3 bg-surface-container-low rounded-lg">
                    <a
                      href={`mailto:${lead.email}`}
                      className="text-sm font-medium text-primary hover:underline break-all"
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {lead.email}
                    </a>
                    {lead.source && (
                      <p className="text-[11px] text-on-surface-variant mt-0.5 break-all" title={lead.source}>
                        from: {lead.source}
                      </p>
                    )}
                    <div className="mt-1 text-[10px] text-on-surface-variant">
                      {new Date(lead.submittedAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Traffic Sources Card */}
          {trafficSources.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Traffic Sources</h3>
              <div className="space-y-4">
                {trafficSources.map(([groupKey, { count, channel, label: displayLabel }]) => (
                  <div key={groupKey} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant">{channelIcons[channel] || 'language'}</span>
                      <span className="font-medium">{channelLabels[channel] || displayLabel}</span>
                    </div>
                    <span className="font-bold">{count} Visit{count !== 1 ? 's' : ''}</span>
                  </div>
                ))}
                {primaryReferrer && (
                  <div className="mt-2 p-3 bg-surface rounded text-[10px] font-mono text-on-surface-variant break-all">
                    Referrer: {primaryReferrer}
                  </div>
                )}
                {searchKeywords.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-outline-variant/20">
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-3">Search Keywords</p>
                    <div className="space-y-2">
                      {searchKeywords.map(([keyword, { count, source }]) => (
                        <div key={keyword} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-sm text-on-surface-variant">{source === 'paid' ? 'paid' : 'search'}</span>
                            <span className="text-sm font-medium truncate" title={keyword}>{keyword}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${source === 'paid' ? 'bg-tertiary/10 text-tertiary' : 'bg-primary/10 text-primary'}`}>
                              {source}
                            </span>
                            <span className="text-[10px] font-bold text-on-surface-variant">{count}x</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Technical Context Card */}
          {uniqueUAs.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
              <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Technical Context</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold mb-2">User Agent</p>
                  <p className="text-[11px] font-mono leading-relaxed bg-surface p-3 rounded text-on-surface-variant break-all">
                    {uniqueUAs[0]}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">OS</p>
                    <p className="text-sm font-semibold">{parsedUA.os}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Browser</p>
                    <p className="text-sm font-semibold">{parsedUA.browser}</p>
                  </div>
                </div>
                {(() => {
                  const vids = [...new Set(org.events.map(e => (e as Record<string, unknown>).visitorId).filter(Boolean).map(String))];
                  // Hide when multiple visitors — Activity Ledger already shows per-group visitorId
                  if (vids.length > 1) return null;
                  return (
                    <div>
                      <p className="text-[10px] uppercase tracking-widest text-on-surface-variant font-bold">Visitor ID</p>
                      <p className="text-xs font-mono text-on-surface-variant">
                        {vids.length === 1 ? vids[0].substring(0, 12) : org.key.substring(0, 12)}
                      </p>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Pages Visited Card */}
          {(() => {
            const pageEvents = org.events.filter((e) => e.pathname);
            const uniquePages = new Map<string, number>();
            for (const e of pageEvents) {
              uniquePages.set(e.pathname!, (uniquePages.get(e.pathname!) || 0) + 1);
            }
            return uniquePages.size > 0 ? (
              <div className="bg-surface-container-lowest rounded-xl p-6 shadow-elevated" style={{ border: '1px solid rgba(196, 198, 207, 0.1)' }}>
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-6">Pages Visited</h3>
                <div className="space-y-1">
                  {Array.from(uniquePages.entries()).map(([path, count]) => (
                    <div key={path} className="flex justify-between items-center bg-surface-container-low rounded px-3 py-2">
                      <span className="text-sm font-medium text-on-surface">{path}</span>
                      <span className="text-[10px] font-bold bg-surface-container px-2 py-0.5 rounded text-on-surface-variant">{count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null;
          })()}
        </div>
      </div>
    </div>
  );
}
