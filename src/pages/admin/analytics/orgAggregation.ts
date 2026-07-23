import type { LifecycleStage } from '../../../services/behaviorAnalytics';
import type { AnalyticsEvent, OrganizationRecord } from './types';
import { isPrivateIP, tierRank } from './format';
import { computePerPageDuration } from './flush';
import { isSecurityProxyOrg } from '../../../../amplify/lib/analytics/proxy-vendors';

/**
 * Stable identity key for org-override reads/writes.
 *
 * ISP-split visitors get a synthesized DISPLAY name (`"Cloudflare, Inc. ·
 * Needham, Massachusetts"`, possibly `#N`-suffixed) that is city-scoped and
 * order-dependent — an override stored under it can miss its visitor or drift
 * to a different one. Their group `key` however is the stable first-party
 * visitorId (or IP fallback), so overrides for ISP visitors are keyed on that;
 * real organizations keep the org name. The list matcher already checks both
 * (`overrideMap.get(org.orgName) || overrideMap.get(org.key)`), which also
 * keeps legacy display-name-keyed overrides working.
 */
export function orgOverrideKey(org: Pick<OrganizationRecord, 'key' | 'orgName' | 'isISPVisitor'>): string {
  return org.isISPVisitor ? org.key : org.orgName;
}

/**
 * Single override-lookup precedence for BOTH the list and the detail view —
 * they must never disagree. Stable key first (visitorId for ISP visitors, org
 * name otherwise), then the legacy fallbacks: the display name (pre-stable-key
 * ISP writes) and the group key (pre-split org rows).
 */
export function resolveOrgOverride<T>(
  overrides: Map<string, T>,
  org: Pick<OrganizationRecord, 'key' | 'orgName' | 'isISPVisitor'>,
): T | undefined {
  return overrides.get(orgOverrideKey(org)) ?? overrides.get(org.orgName) ?? overrides.get(org.key);
}

export function computeOrgLifecycleStage(group: AnalyticsEvent[], productsViewed: Set<string>, pdfDownloads: number, returnVisits: number): LifecycleStage {
  const hasRFQSubmission = group.some(e => e.eventType === 'rfq_submission');
  if (hasRFQSubmission) return 'intent';

  const hasContactForm = group.some(e => e.eventType === 'contact_form' || e.eventType === 'rfq_step');
  if (pdfDownloads > 0 || hasContactForm) return 'consideration';

  if (productsViewed.size > 0 || returnVisits > 0) return 'interest';

  return 'awareness';
}

export function aggregateByOrg(
  events: AnalyticsEvent[],
  overrideAiByOrg?: Map<string, { organizationType: string; confidence: number }>,
): OrganizationRecord[] {
  // Bots never aggregate into human orgs — they are summarized separately via aggregateBots().
  // This guard is unconditional; callers do not need to pre-filter.
  events = events.filter((e) => !e.isBot);

  // ── Pre-pass: build visitorId → org metadata from events that carry org data ──
  // page_time_flush events lack ip/org/orgName/country etc. We inherit those
  // from other events (page_view, product_view, etc.) sharing the same visitorId.
  const visitorOrgMap = new Map<string, {
    ip: string; org: string; orgName: string;
    country: string; region: string; city: string;
    organizationType: string;
    isTargetCustomer: boolean; leadTier: string | null;
    aiOrganizationType: string | null; aiConfidence: number | null;
    latitude: number | null; longitude: number | null; isp: string;
  }>();

  for (const e of events) {
    // Only learn from events that actually carry org-identifying fields
    if (!e.ip && !e.org && !e.orgName) continue;
    const vid = (e as Record<string, unknown>).visitorId as string;
    if (!vid) continue;

    const existing = visitorOrgMap.get(vid);
    // Keep the entry with the most complete org metadata fields.
    // Same visitorId = same visitor; differences are just field coverage.
    const candidateFields = (e.ip ? 1 : 0) + (e.org ? 1 : 0) + (e.orgName ? 1 : 0) +
      (e.country ? 1 : 0) + (e.region ? 1 : 0) + (e.city ? 1 : 0);
    const existingFields = existing
      ? (existing.ip ? 1 : 0) + (existing.org ? 1 : 0) + (existing.orgName ? 1 : 0) +
        (existing.country ? 1 : 0) + (existing.region ? 1 : 0) + (existing.city ? 1 : 0)
      : -1;

    if (candidateFields > existingFields) {
      visitorOrgMap.set(vid, {
        ip: e.ip || existing?.ip || '',
        org: e.org || existing?.org || '',
        orgName: e.orgName || existing?.orgName || '',
        country: e.country || existing?.country || '',
        region: e.region || existing?.region || '',
        city: e.city || existing?.city || '',
        organizationType: e.organizationType || existing?.organizationType || '',
        isTargetCustomer: e.isTargetCustomer || existing?.isTargetCustomer || false,
        leadTier: e.leadTier || existing?.leadTier || null,
        aiOrganizationType: e.aiOrganizationType || existing?.aiOrganizationType || null,
        aiConfidence: e.aiConfidence ?? existing?.aiConfidence ?? null,
        latitude: e.latitude ?? existing?.latitude ?? null,
        longitude: e.longitude ?? existing?.longitude ?? null,
        isp: e.isp || existing?.isp || '',
      });
    }
  }

  const groups = new Map<string, AnalyticsEvent[]>();

  for (const e of events) {
    // ── Inherit org metadata for events missing org/orgName (e.g. page_time_flush) ──
    const vid = (e as Record<string, unknown>).visitorId as string;
    const needsInheritance = !e.org && !e.orgName;
    const inherited = (needsInheritance && vid) ? visitorOrgMap.get(vid) : undefined;

    // Effective org fields: event's own data → inherited → default
    const effOrgName = e.orgName || inherited?.orgName || '';
    const effOrg = e.org || inherited?.org || '';
    const rawIp = e.ip || inherited?.ip || '';
    const effIp = (rawIp && !isPrivateIP(rawIp)) ? rawIp : '';
    // Group by org name → IP → visitorId → Unknown.
    // ISP orgs are re-split by visitorId in a post-processing step.
    const key = effOrgName || effOrg || effIp || vid || 'Unknown';
    const group = groups.get(key);
    if (group) {
      group.push(e);
    } else {
      groups.set(key, [e]);
    }
  }

  // ── Collect ISP-like org names (AI telecom_isp + IP-level isp + proxies) ──
  // Used to split ISP/proxy visitors and prevent merge-back. corporate_proxy =
  // security-proxy / browser-isolation egress (Menlo, Zscaler, …): like an ISP,
  // the org name identifies the network, never the visitor.
  const ISP_ORG_TYPES = new Set(['telecom_isp', 'isp', 'corporate_proxy']);
  const ispOrgNames = new Set<string>();
  const addIfISP = (orgName: string, org: string, aiType: string | null | undefined, ipType: string | undefined) => {
    // Name fallback: historical events were AI-classified 'enterprise' under the
    // proxy vendor's name (pre-corporate_proxy pipeline) and never re-classify.
    if (ISP_ORG_TYPES.has(aiType || '') || ISP_ORG_TYPES.has(ipType || '') || isSecurityProxyOrg(orgName, org)) {
      if (orgName) ispOrgNames.add(orgName);
      if (org) ispOrgNames.add(org);
    }
  };
  for (const meta of visitorOrgMap.values()) {
    addIfISP(meta.orgName, meta.org, meta.aiOrganizationType, meta.organizationType);
  }
  for (const [, grp] of groups) {
    for (const e of grp) {
      addIfISP(e.orgName || '', e.org || '', e.aiOrganizationType ?? undefined, e.organizationType ?? undefined);
    }
  }
  // Also trust OrgOverride cache: events may lack aiOrganizationType while
  // the org-level classification is already known. Without this, ISP
  // splitting silently skips and multiple residential visitors collapse
  // into a single record.
  if (overrideAiByOrg) {
    for (const [orgName, ov] of overrideAiByOrg) {
      if (ISP_ORG_TYPES.has(ov.organizationType)) ispOrgNames.add(orgName);
    }
  }

  // ── Split ISP org-keyed groups by individual visitor ───────────────
  // Some events lack AI classification and end up keyed by org name even
  // though the org is an ISP.  Re-split those groups by visitorId so each
  // residential user gets their own entry.
  // Before splitting, capture the org-level AI classification so sub-groups inherit it.
  const ispAiType = new Map<string, { aiOrganizationType: string; aiConfidence: number }>();
  for (const ispName of ispOrgNames) {
    const ispGroup = groups.get(ispName);
    if (!ispGroup) continue;
    const aiEvt = ispGroup.find(e =>
      e.aiOrganizationType && e.aiOrganizationType !== 'unknown' && e.aiConfidence != null && e.aiConfidence >= 0.5
    );
    if (aiEvt) {
      ispAiType.set(ispName, { aiOrganizationType: aiEvt.aiOrganizationType!, aiConfidence: aiEvt.aiConfidence! });
    } else {
      const ov = overrideAiByOrg?.get(ispName);
      if (ov && ov.organizationType !== 'unknown') {
        ispAiType.set(ispName, { aiOrganizationType: ov.organizationType, aiConfidence: ov.confidence });
      }
    }
    groups.delete(ispName);
    for (const e of ispGroup) {
      const vid = (e as Record<string, unknown>).visitorId as string;
      const k = vid || e.ip || ispName;
      const existing = groups.get(k);
      if (existing) existing.push(e);
      else groups.set(k, [e]);
    }
  }

  // ── Merge visitor-keyed groups back into their parent org ────────
  // Different IPs from the same org may land in separate groups when
  // some events lack org metadata and fall back to visitorId/IP keys.
  // Merge them so the same organization doesn't appear as multiple entries.
  // Skip ISP orgs — those should stay split by visitor.
  const mergeKeys: string[] = [];
  for (const [key, group] of groups) {
    const orgEvent = group.find((e) => e.orgName || e.org);
    const baseOrgName = orgEvent?.orgName || orgEvent?.org || '';
    if (baseOrgName && baseOrgName !== 'Unknown' && baseOrgName !== key
        && groups.has(baseOrgName) && !ispOrgNames.has(baseOrgName)) {
      groups.get(baseOrgName)!.push(...group);
      mergeKeys.push(key);
    }
  }
  for (const key of mergeKeys) {
    groups.delete(key);
  }

  // ── Consolidate groups sharing the same visitorId ──────────────────
  // After ISP splitting and org merge-back, the same visitor may still
  // appear in multiple groups (e.g. same visitorId from different IPs
  // where some events have orgName and some don't).  Merge single-visitor
  // groups that share the same visitorId so they appear as one record.
  const vidPrimaryKey = new Map<string, string>(); // visitorId → first group key
  const consolidateKeys: string[] = [];
  for (const [key, group] of groups) {
    const vids = new Set<string>();
    for (const e of group) {
      const vid = (e as Record<string, unknown>).visitorId as string;
      if (vid) vids.add(vid);
    }
    if (vids.size !== 1) continue; // only merge single-visitor groups
    const vid = [...vids][0];
    const existing = vidPrimaryKey.get(vid);
    if (existing && groups.has(existing)) {
      // Prefer non-ISP group as primary so the org name reflects the
      // real institution rather than a residential ISP connection.
      // Check event-level orgName (not just the key) because ISP-split
      // groups are re-keyed by visitorId and lose their ISP key identity.
      const existingHasISP = groups.get(existing)!.some(e => ispOrgNames.has(e.orgName || e.org || ''));
      const currentHasISP = group.some(e => ispOrgNames.has(e.orgName || e.org || ''));
      if (existingHasISP && !currentHasISP) {
        groups.get(key)!.push(...groups.get(existing)!);
        consolidateKeys.push(existing);
        vidPrimaryKey.set(vid, key);
      } else if (!existingHasISP && currentHasISP) {
        groups.get(existing)!.push(...group);
        consolidateKeys.push(key);
      } else {
        groups.get(existing)!.push(...group);
        consolidateKeys.push(key);
      }
    } else {
      vidPrimaryKey.set(vid, key);
    }
  }
  for (const key of consolidateKeys) {
    groups.delete(key);
  }

  const records: OrganizationRecord[] = [];

  for (const [key, group] of groups) {
    // Proxy-egress events never contribute identity/targeting signal: their
    // org fields, AI verdict, target flag, and tier describe the proxy VENDOR
    // (historically "enterprise, 0.95" for Menlo/Zscaler/…), not the visitor.
    const isProxyEgress = (e: AnalyticsEvent) =>
      e.organizationType === 'corporate_proxy' || isSecurityProxyOrg(e.orgName, e.org, e.isp);
    const groupHasProxyEgress = group.some(isProxyEgress);
    // Trusted to supply classification/target/tier/confidence state: not proxy
    // egress itself, and NAMED. Unnamed events (flush/partial/historical) were
    // grouped here by visitorOrgMap inheritance — when the group contains proxy
    // egress, their fields may be vendor-derived despite carrying no org name,
    // so they are only trusted in groups with no proxy egress at all.
    const isTrustedStateEvent = (e: AnalyticsEvent) =>
      !isProxyEgress(e) && ((!!e.orgName || !!e.org) || !groupHasProxyEgress);

    const pages = new Set<string>();
    const products = new Set<string>();
    let totalTime = 0;
    let maxConf = 0;
    let bestTier: string | null = null;
    let isTarget = false;
    let maxPdfDownloads = 0;
    let maxReturnVisits = 0;
    let maxBehaviorScore = 0;

    for (const e of group) {
      if (e.pathname) {
        // Normalize trailing slash to canonical path (e.g. /products/ → /products)
        const normalizedPath = e.pathname !== '/' && e.pathname.endsWith('/')
          ? e.pathname.slice(0, -1)
          : e.pathname;
        pages.add(normalizedPath);
      }
      if (e.productName) products.add(e.productName);

      // Confidence/tier/target only from trusted events — vendor-derived
      // state on proxy events (named or inherited) must not leak into the record.
      if (isTrustedStateEvent(e)) {
        const eventConf = e.aiConfidence ?? 0;
        if (eventConf > maxConf) {
          maxConf = eventConf;
        }
        if (e.leadTier && tierRank(e.leadTier) > tierRank(bestTier)) {
          bestTier = e.leadTier;
        }
        if (e.isTargetCustomer) isTarget = true;
      }
      if (e.pdfDownloads != null && e.pdfDownloads > maxPdfDownloads) {
        maxPdfDownloads = e.pdfDownloads;
      }
      if (e.returnVisits != null && e.returnVisits > maxReturnVisits) {
        maxReturnVisits = e.returnVisits;
      }
      if (e.behaviorScore != null && e.behaviorScore > maxBehaviorScore) {
        maxBehaviorScore = e.behaviorScore;
      }
    }

    // Compute total active time using the same hybrid flush + legacy logic
    // as the timeline (computePerPageDuration). This ensures page_views
    // without flush events still contribute via timeOnSite deltas.
    const perPageDurations = computePerPageDuration(group);
    for (const seconds of perPageDurations.values()) {
      totalTime += seconds;
    }

    // Use the first event with valid lat/lng
    const geoEvent = group.find((e) => e.latitude != null && e.longitude != null) || group[0];
    const sorted = group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Clear historical tier for non-target customers (pre-fix events may have incorrect tiers)
    if (!isTarget) bestTier = null;

    // Detect ISP/proxy visitors that were split by the ISP split step.
    // Prefer non-ISP org name when the visitor has events from multiple networks.
    // (Computed before org-type promotion: the proxy flag below must suppress
    // the vendor-derived AI type.)
    const nonIspEvent = group.find((e) => {
      const name = e.orgName || e.org || '';
      return name && !ispOrgNames.has(name);
    });
    const orgEvent = nonIspEvent || group.find((e) => e.orgName || e.org) || group[0];
    const ispOrgName = orgEvent.orgName || orgEvent.org || '';
    const isISPVisitor = ispOrgNames.has(ispOrgName) && key !== ispOrgName;
    // The record resolves to a proxy vendor's name (no real-org event found):
    // its org type must say "corporate proxy", never the vendor's own AI
    // classification ("enterprise" — historically stored on pre-fix events).
    const isProxyOrg = isSecurityProxyOrg(ispOrgName);
    // Proxy-only group: clear any residual target/tier state (e.g. carried on
    // unnamed events) — vendor-derived, and it would block anonymous-high-intent.
    if (isProxyOrg) {
      isTarget = false;
      bestTier = null;
    }

    // Promote AI classification when IP-based org type is unknown.
    // Proxy-egress events are excluded as sources: in a mixed multi-network
    // group their stored AI verdict would override the real institution's type.
    const aiEvent = group.find((e) =>
      e.aiOrganizationType && e.aiOrganizationType !== 'unknown' && e.aiConfidence != null && e.aiConfidence >= 0.5
      && isTrustedStateEvent(e)
    );
    // Also check parent ISP AI type and visitorOrgMap (ISP-split groups may lack AI on their own events)
    const aiFromParentISP = !aiEvent ? (() => {
      // Keyed on the record's resolved org name (prefers the real org in mixed
      // groups) so a proxy/ISP parent type is only inherited by its own subgroups.
      if (ispOrgName && ispAiType.has(ispOrgName)) return ispAiType.get(ispOrgName)!;
      // Also check visitorOrgMap — skipping proxy-vendor metadata
      for (const e of group) {
        const vid = (e as Record<string, unknown>).visitorId as string;
        if (!vid) continue;
        const meta = visitorOrgMap.get(vid);
        if (!meta || isSecurityProxyOrg(meta.orgName, meta.org, meta.isp)) continue;
        if (meta.aiOrganizationType && meta.aiOrganizationType !== 'unknown'
            && meta.aiConfidence != null && meta.aiConfidence >= 0.5) {
          return { aiOrganizationType: meta.aiOrganizationType, aiConfidence: meta.aiConfidence };
        }
      }
      return null;
    })() : null;
    const ipOrgType = group.find(e => e.organizationType && e.organizationType !== 'unknown'
        && isTrustedStateEvent(e))?.organizationType ||
      (isTrustedStateEvent(geoEvent) ? geoEvent.organizationType : '') || '';
    const effectiveOrgType = isProxyOrg
      ? 'corporate_proxy'
      : (aiEvent?.aiOrganizationType || aiFromParentISP?.aiOrganizationType || ipOrgType);

    // Backfill tier for old events that lack leadTier.
    // Two paths mirror the pipeline (segmentAnalytics):
    //   1. IP-reliable org types (education/gov) → B without AI confidence
    //   2. AI-classified identified orgs → B if confidence >= 0.5 (trust gate)
    // Tier A only comes from behavioral boost in the pipeline.
    const IP_RELIABLE_TYPES = new Set(['education', 'university', 'research_institute', 'government']);
    const AI_IDENTIFIED_TYPES = new Set(['business', 'enterprise', 'hospital']);
    if (!bestTier) {
      if (IP_RELIABLE_TYPES.has(effectiveOrgType)) {
        bestTier = 'B';
      } else if (AI_IDENTIFIED_TYPES.has(effectiveOrgType) && maxConf >= 0.5) {
        bestTier = 'B';
      }
    }

    // Anonymous high-intent: unidentified org but strong behavioral signals
    // Exclude orgs identified by AI as a real organization (not ISP/proxy/unknown)
    const aiIdentifiedRealOrg = aiEvent && aiEvent.aiOrganizationType !== 'telecom_isp'
      && aiEvent.aiOrganizationType !== 'corporate_proxy' && !isProxyOrg;
    const hasProductPageVisit = group.some(e => e.pathname?.startsWith('/products/'));
    const isAnonymousHighIntent = !isTarget && !bestTier && !aiIdentifiedRealOrg &&
      (
        (maxBehaviorScore >= 0.3 && (maxReturnVisits > 0 || pages.size >= 2)) ||
        (maxBehaviorScore >= 0.1 && hasProductPageVisit)
      );

    // Build a human-readable display name for ISP individual visitors
    // (nonIspEvent/ispOrgName/isISPVisitor computed above, before org-type promotion)
    const displayName = isISPVisitor
      ? `${ispOrgName} · ${[geoEvent.city, geoEvent.region].filter(Boolean).join(', ') || 'Unknown'}`
      : key;

    // Extract IPinfo company type from events (first non-empty value)
    const companyType = group.find(e => (e as Record<string, unknown>).companyType)
      ? String((group.find(e => (e as Record<string, unknown>).companyType) as Record<string, unknown>).companyType)
      : '';

    // Extract RFQ institution from rfq_submission event properties
    const rfqEvent = group.find(e => e.eventType === 'rfq_submission');
    const rfqProps = rfqEvent?.properties
      ? (typeof rfqEvent.properties === 'string'
        ? (() => { try { return JSON.parse(rfqEvent.properties as string); } catch { return null; } })()
        : rfqEvent.properties)
      : null;
    const rfqInstitution = (rfqProps?.rfqInstitution as string) || null;

    records.push({
      key,
      orgName: displayName,
      organizationType: effectiveOrgType,
      country: geoEvent.country || '',
      region: geoEvent.region || '',
      city: geoEvent.city || '',
      latitude: geoEvent.latitude ?? null,
      longitude: geoEvent.longitude ?? null,
      leadTier: bestTier,
      isTargetCustomer: isTarget,
      totalEvents: group.length,
      uniquePages: pages.size,
      productsViewed: Array.from(products),
      totalTimeOnSite: totalTime,
      pdfDownloads: maxPdfDownloads,
      returnVisits: maxReturnVisits,
      lastVisit: sorted[0].timestamp,
      firstVisit: sorted[sorted.length - 1].timestamp,
      maxConfidence: maxConf,
      maxBehaviorScore,
      isAnonymousHighIntent,
      isISPVisitor,
      companyType,
      lifecycleStage: computeOrgLifecycleStage(group, products, maxPdfDownloads, maxReturnVisits),
      rfqInstitution,
      contactOrganization: null,
      downloadGateOrganization: null,
      events: sorted,
    });
  }

  // Disambiguate ISP visitors with identical display names (same ISP + same city)
  const nameCounts = new Map<string, number>();
  for (const r of records) {
    if (r.isISPVisitor) {
      nameCounts.set(r.orgName, (nameCounts.get(r.orgName) || 0) + 1);
    }
  }
  const nameIdx = new Map<string, number>();
  for (const r of records) {
    if (r.isISPVisitor && (nameCounts.get(r.orgName) || 0) > 1) {
      const idx = (nameIdx.get(r.orgName) || 0) + 1;
      nameIdx.set(r.orgName, idx);
      r.orgName = `${r.orgName} #${idx}`;
    }
  }

  return records;
}
