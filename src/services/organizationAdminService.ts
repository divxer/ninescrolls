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
  const { data, errors } = await client().queries.listOrganizations(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
  return data;
}

export async function getOrganization(orgId: string) {
  const { data, errors } = await client().queries.getOrganization({ orgId } as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
  return data;
}

export async function updateOrganizationStatus(args: {
  orgId: string;
  status: string;
  adminNotes?: string;
  tags?: string[];
}) {
  const { data, errors } = await client().mutations.updateOrganizationStatus(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
  return data;
}

export async function updateOrganizationOwner(args: { orgId: string; ownerSalesRep?: string }) {
  const { data, errors } = await client().mutations.updateOrganizationOwner(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
  return data;
}

export async function reclassifyOrganization(args: { orgId: string; force?: boolean }) {
  const { data, errors } = await client().mutations.reclassifyOrganization(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
  return data;
}

export async function mergeOrganization(args: { sourceOrgId: string; targetOrgId: string }) {
  const { data, errors } = await client().mutations.mergeOrganization(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e: any) => e.message).join(', '));
  return data;
}
