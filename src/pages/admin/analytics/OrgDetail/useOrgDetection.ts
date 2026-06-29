import { useMemo } from 'react';
import type { OrgOverride } from '../../../../services/adminClassificationService';
import { engagementLevel } from '../format';
import type { OrganizationRecord } from '../types';

/**
 * Derives the organization's classification / detection details from its events
 * and any cached override. These values are shared across the OrgDetail header,
 * the behavior-analysis (left) column, and the detection-details (right) card,
 * so they live in one hook rather than being recomputed per panel.
 */
export type OrgDetection = ReturnType<typeof useOrgDetection>;

export function useOrgDetection(org: OrganizationRecord, override: OrgOverride | null) {
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

  return {
    networkContexts,
    hasMultipleNetworks,
    aiEvent,
    ipEvent,
    ipOrgType,
    hasEventAI,
    hasOverrideAI,
    hasAI,
    effectiveAiOrgType,
    effectiveAiConf,
    effectiveAiReason,
    aiUpgraded,
    classificationSource,
    aiProviderLabel,
    isManualOverride,
    currentIsTarget,
    displayOrgType,
    engagement,
    engagementBadgeClass,
  };
}
