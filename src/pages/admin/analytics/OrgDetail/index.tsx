import { useState, useEffect } from 'react';
import { getOrgOverride, classifyOrg, type OrgOverride } from '../../../../services/adminClassificationService';
import { matchLinkedLeadsByVisitor } from '../../linkedLeadsMatch';
import * as orderAdminService from '../../../../services/orderAdminService';
import type { RfqSubmission, LeadSubmission } from '../../../../types/admin';
import { getAmplifyDataClient } from '../../../../services/amplifyClient';
import type { AnalyticsEvent, OrganizationRecord } from '../types';
import { formatDuration, formatRelativeTime } from '../format';
import { ActivityLedger } from './ActivityLedger';
import { PagesVisitedCard } from './PagesVisitedCard';
import { TrafficSourcesCard } from './TrafficSourcesCard';
import { TechnicalContextCard } from './TechnicalContextCard';
import { LinkedLeadsPanel } from './LinkedLeadsPanel';
import { useOrgDetection } from './useOrgDetection';
import { DetectionDetailsCard } from './DetectionDetailsCard';
import { OrgDetailHeader } from './OrgDetailHeader';

const client = getAmplifyDataClient;

export function OrgDetail({ org, onBack, allContactLeads, allDownloadGateLeads, allNewsletterLeads }: { org: OrganizationRecord; onBack: () => void; allContactLeads: LeadSubmission[]; allDownloadGateLeads: LeadSubmission[]; allNewsletterLeads: LeadSubmission[] }) {
  const [showFullIP, setShowFullIP] = useState(false);
  const [override, setOverride] = useState<OrgOverride | null>(null);
  const [overrideLoading, setOverrideLoading] = useState(true);
  const [overrideMsg, setOverrideMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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



  const detection = useOrgDetection(org, override);
  const { hasMultipleNetworks, effectiveAiReason } = detection;

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



  return (
    <div className="space-y-8">
      {/* ── Header Section ── */}
      <section className="space-y-6">
        <OrgDetailHeader
          org={org}
          onBack={onBack}
          override={override}
          setOverride={setOverride}
          overrideLoading={overrideLoading}
          setOverrideLoading={setOverrideLoading}
          overrideMsg={overrideMsg}
          setOverrideMsg={setOverrideMsg}
          linkedRfqs={linkedRfqs}
          detection={detection}
        />

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
          <DetectionDetailsCard org={org} detection={detection} showFullIP={showFullIP} setShowFullIP={setShowFullIP} />

          {/* Linked Leads (RFQs / inquiries / downloads / newsletter signups) */}
          <LinkedLeadsPanel
            linkedRfqs={linkedRfqs}
            linkedInquiries={linkedInquiries}
            linkedDownloads={linkedDownloads}
            linkedNewsletters={linkedNewsletters}
          />

          {/* Traffic Sources Card */}
          <TrafficSourcesCard org={org} />

          {/* Technical Context Card */}
          <TechnicalContextCard org={org} />

          {/* Pages Visited Card */}
          <PagesVisitedCard org={org} />
        </div>
      </div>
    </div>
  );
}
