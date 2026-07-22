import { getAmplifyDataClient } from './amplifyClient';

const client = getAmplifyDataClient;
const AUTH = { authMode: 'userPool' as const };

export interface ListOrgFilters {
  statuses?: string[];
  types?: string[];
  countries?: string[];
  ownerSalesRep?: string;
  minLeadScore?: number;
  search?: string;
  sortBy?: 'activity' | 'leadScore' | 'firstSeen';
  sortDir?: 'asc' | 'desc';
  limit?: number;
  nextToken?: string;
}

export async function listOrganizations(args: ListOrgFilters) {
  const { data, errors } = await client().queries.listOrganizations(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function getOrganization(orgId: string) {
  const { data, errors } = await client().queries.getOrganization({ orgId }, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export interface TimelineQueryArgs {
  orgId: string;
  limit?: number;
  nextToken?: string;
  includeInternalOnly?: boolean;
}

export async function getOrganizationTimeline(args: TimelineQueryArgs) {
  const { data, errors } = await client().queries.timelineByOrg(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateOrganizationStatus(args: {
  orgId: string;
  status: string;
  adminNotes?: string;
  tags?: string[];
}) {
  const { data, errors } = await client().mutations.updateOrganizationStatus(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateOrganizationOwner(args: { orgId: string; ownerSalesRep?: string }) {
  const { data, errors } = await client().mutations.updateOrganizationOwner(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function reclassifyOrganization(args: { orgId: string; force?: boolean }) {
  const { data, errors } = await client().mutations.reclassifyOrganization(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function mergeOrganization(args: { sourceOrgId: string; targetOrgId: string }) {
  const { data, errors } = await client().mutations.mergeOrganization(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function getNeedsLinkingQueue(args: { limit?: number; nextToken?: string }) {
  const { data, errors } = await client().queries.needsLinkingQueue(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function linkStructuredUnit(args: {
  representativeEventId: string;
  targetOrgId: string;
}) {
  const { data, errors } = await client().mutations.linkStructuredUnit(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function linkVisitor(args: { visitorId: string; targetOrgId: string }) {
  const { data, errors } = await client().mutations.linkVisitor(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function getCrmHealth() {
  const { data, errors } = await client().queries.crmHealth(AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function runCrmRepair(args: { limit?: number } = {}) {
  const { data, errors } = await client().mutations.runCrmRepair(args, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function acknowledgeMergeRecon(fromOrgId: string, toOrgId: string) {
  const { data, errors } = await client().mutations.acknowledgeMergeRecon({ fromOrgId, toOrgId }, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data as { ok?: boolean; raced?: boolean; notFound?: boolean } | null;
}
