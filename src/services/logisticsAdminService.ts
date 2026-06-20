import { getAmplifyDataClient } from './amplifyClient';

const client = getAmplifyDataClient;
const AUTH = { authMode: 'userPool' as const };

function unwrapPayload<T>(data: T | string): T {
  if (typeof data !== 'string') return data;
  return JSON.parse(data) as T;
}

interface ListLogisticsArgs {
  stage?: string;
  caseType?: string;
  customsRequired?: boolean;
  relatedOrderId?: string;
  search?: string;
  limit?: number;
  nextToken?: string;
}

export async function listLogisticsCases(opts: ListLogisticsArgs = {}) {
  const args: Record<string, unknown> = {};
  if (opts.stage) args.stage = opts.stage;
  if (opts.caseType) args.caseType = opts.caseType;
  if (opts.customsRequired !== undefined) args.customsRequired = opts.customsRequired;
  if (opts.relatedOrderId) args.relatedOrderId = opts.relatedOrderId;
  if (opts.search) args.search = opts.search;
  if (opts.limit) args.limit = opts.limit;
  if (opts.nextToken) args.nextToken = opts.nextToken;
  const { data, errors } = await client().queries.listLogisticsCases(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return unwrapPayload(data);
}

export async function getLogisticsCase(caseId: string) {
  const { data, errors } = await client().queries.getLogisticsCase({ caseId } as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return unwrapPayload(data);
}

export async function fetchLogisticsStats() {
  const { data, errors } = await client().queries.logisticsStats(AUTH as any);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return unwrapPayload(data);
}

export async function createLogisticsCase(input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.createLogisticsCase(
    { input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateLogisticsCase(caseId: string, input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.updateLogisticsCase(
    { caseId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function advanceLogisticsStage(
  caseId: string, targetStage: string, detail?: string, internalOnly?: boolean,
) {
  const { data, errors } = await client().mutations.advanceLogisticsStage(
    { caseId, targetStage, detail, internalOnly } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function addLeg(caseId: string, input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.addLeg(
    { caseId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function updateLeg(caseId: string, legId: string, input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.updateLeg(
    { caseId, legId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}

export async function removeLeg(caseId: string, legId: string) {
  const { data, errors } = await client().mutations.removeLeg({ caseId, legId } as any, AUTH);
  if (errors?.length) throw new Error(errors.map((e) => e.message).join(', '));
  return data;
}
