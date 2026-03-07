// Admin Classification Override Service
// Calls the /classify-org Lambda with admin actions (override, undo, get-override)

import outputs from '../../amplify_outputs.json';

export interface OrgOverride {
  found: boolean;
  orgName?: string;
  organizationType?: string;
  isTargetCustomer?: boolean;
  confidence?: number;
  reason?: string;
  source?: 'ai' | 'manual';
  classifiedAt?: string;
  previousClassification?: {
    organizationType: string;
    isTargetCustomer: boolean;
    confidence: number;
    reason: string;
    source: string;
    classifiedAt?: string;
  };
}

function getApiEndpoint(): string {
  if (outputs?.custom?.API?.['ninescrolls-api']?.endpoint) {
    return outputs.custom.API['ninescrolls-api'].endpoint.replace(/\/$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return 'https://api.ninescrolls.com';
}

function getAdminToken(): string {
  return import.meta.env.VITE_ADMIN_API_SECRET || '';
}

async function callClassifyOrg(body: Record<string, unknown>): Promise<unknown> {
  const apiEndpoint = getApiEndpoint();
  const response = await fetch(`${apiEndpoint}/classify-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, adminToken: getAdminToken() }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error((err as { error?: string }).error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get the current classification override status for an org.
 */
export async function getOrgOverride(orgName: string): Promise<OrgOverride> {
  return callClassifyOrg({ action: 'get-override', orgName }) as Promise<OrgOverride>;
}

/**
 * Set a manual override for an org classification.
 */
export async function setOrgOverride(
  orgName: string,
  isTargetCustomer: boolean,
  organizationType?: string,
  reason?: string,
): Promise<OrgOverride> {
  const result = await callClassifyOrg({
    action: 'override',
    orgName,
    isTargetCustomer,
    organizationType,
    reason,
  });
  return { found: true, ...(result as object) } as OrgOverride;
}

/**
 * Undo a manual override, restoring the previous classification.
 */
export async function undoOrgOverride(orgName: string): Promise<OrgOverride> {
  const result = await callClassifyOrg({ action: 'undo', orgName });
  return { found: true, ...(result as object) } as OrgOverride;
}

export interface OrgOverrideSummary {
  orgName: string;
  organizationType: string;
  isTargetCustomer: boolean;
  confidence: number;
  reason: string;
  source: 'manual';
  classifiedAt?: string;
}

/**
 * List all manual overrides (batch fetch).
 */
export async function listOrgOverrides(): Promise<OrgOverrideSummary[]> {
  const result = await callClassifyOrg({ action: 'list-overrides', orgName: '' });
  return ((result as { overrides?: OrgOverrideSummary[] }).overrides) || [];
}
