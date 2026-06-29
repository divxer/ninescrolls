import { getAmplifyDataClient } from './amplifyClient';

const client = getAmplifyDataClient;
const AUTH = { authMode: 'userPool' as const };

// Generated Amplify input type for a given query/mutation's first argument.
// Used to narrow conditionally-built `Record<string, unknown>` args objects to
// the exact generated input shape (instead of an `any` cast).
type AmplifyClient = ReturnType<typeof client>;
type QueryArgs<K extends keyof AmplifyClient['queries']> =
  Parameters<AmplifyClient['queries'][K]>[0];
type MutationArgs<K extends keyof AmplifyClient['mutations']> =
  Parameters<AmplifyClient['mutations'][K]>[0];

// --- Orders ---

interface ListOrdersArgs {
  status?: string;
  search?: string;
  limit?: number;
  nextToken?: string;
}

export async function listOrders(opts: ListOrdersArgs = {}) {
  const { status, search, limit, nextToken } = opts;
  const args: Record<string, unknown> = {};
  if (status) args.status = status;
  if (search) args.search = search;
  if (limit) args.limit = limit;
  if (nextToken) args.nextToken = nextToken;
  const { data, errors } = await client().queries.listOrders(args, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getOrder(orderId: string) {
  const { data, errors } = await client().queries.getOrder({ orderId }, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getOrderLogs(orderId: string) {
  const { data, errors } = await client().queries.getOrderLogs({ orderId }, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function fetchOrderStats() {
  const { data, errors } = await client().queries.orderStats(AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function createOrder(input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.createOrder(
    { input: JSON.stringify(input) }, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function updateOrderStatus(
  orderId: string, newStatus: string, statusDate?: string, note?: string,
) {
  const args: Record<string, unknown> = { orderId, newStatus };
  if (statusDate) args.statusDate = statusDate;
  if (note) args.note = note;
  const { data, errors } = await client().mutations.updateOrderStatus(
    args as MutationArgs<'updateOrderStatus'>, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function updateOrder(orderId: string, input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.updateOrder(
    { orderId, input: JSON.stringify(input) }, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function addContact(orderId: string, input: Record<string, unknown>) {
  const { data, errors } = await client().mutations.addContact(
    { orderId, input: JSON.stringify(input) }, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function updateContact(
  orderId: string, contactId: string, input: Record<string, unknown>,
) {
  const { data, errors } = await client().mutations.updateContact(
    { orderId, contactId, input: JSON.stringify(input) }, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function removeContact(orderId: string, contactId: string) {
  const { data, errors } = await client().mutations.removeContact(
    { orderId, contactId }, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function declineInquiry(orderId: string, reason: string, note?: string) {
  const args: Record<string, unknown> = { orderId, reason };
  if (note) args.note = note;
  const { data, errors } = await client().mutations.declineInquiry(args as MutationArgs<'declineInquiry'>, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

// --- Documents ---

export async function listOrderDocuments(orderId: string, stage?: string, docType?: string) {
  const args: Record<string, unknown> = { orderId };
  if (stage) args.stage = stage;
  if (docType) args.docType = docType;
  const { data, errors } = await client().queries.listOrderDocuments(args as QueryArgs<'listOrderDocuments'>, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getDocumentUploadUrl(orderId: string, fileName: string, mimeType: string) {
  const { data, errors } = await client().queries.getDocumentUploadUrl(
    { orderId, fileName, mimeType }, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function confirmDocumentUpload(params: {
  orderId: string;
  s3Key: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  stage: string;
  docType: string;
  description?: string;
  tags?: string[];
}) {
  const args: Record<string, unknown> = { ...params };
  if (params.tags) args.tags = JSON.stringify(params.tags);
  const { data, errors } = await client().mutations.confirmDocumentUpload(args as MutationArgs<'confirmDocumentUpload'>, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function updateDocument(
  orderId: string, docId: string,
  input: { description?: string; docType?: string; tags?: string[] },
) {
  const args: Record<string, unknown> = { orderId, docId };
  if (input.description !== undefined) args.description = input.description;
  if (input.docType !== undefined) args.docType = input.docType;
  if (input.tags !== undefined) args.tags = JSON.stringify(input.tags);
  const { data, errors } = await client().mutations.updateDocument(args as MutationArgs<'updateDocument'>, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function deleteDocument(orderId: string, docId: string) {
  const { data, errors } = await client().mutations.deleteDocument(
    { orderId, docId }, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

// --- RFQs ---

export async function listRfqs(status?: string, limit?: number, nextToken?: string) {
  const args: Record<string, unknown> = {};
  if (status) args.status = status;
  if (limit) args.limit = limit;
  if (nextToken) args.nextToken = nextToken;
  const { data, errors } = await client().queries.listRfqs(args, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getRfq(rfqId: string) {
  const { data, errors } = await client().queries.getRfq({ rfqId }, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function declineRfq(rfqId: string, reason?: string) {
  const args: Record<string, unknown> = { rfqId };
  if (reason) args.reason = reason;
  const { data, errors } = await client().mutations.declineRfq(args as MutationArgs<'declineRfq'>, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function revertRfqToPending(rfqId: string) {
  const { data, errors } = await client().mutations.revertRfqToPending({ rfqId }, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function convertRfqToOrder(rfqId: string, overrides?: {
  productModel?: string;
  productName?: string;
  configuration?: string;
  quoteAmount?: number;
  quoteNumber?: string;
  notes?: string;
}) {
  const args: Record<string, unknown> = { rfqId, ...overrides };
  const { data, errors } = await client().mutations.convertRfqToOrder(args as MutationArgs<'convertRfqToOrder'>, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

// --- Leads ---

export async function listLeads(type?: string, limit?: number, nextToken?: string) {
  const args: Record<string, unknown> = {};
  if (type) args.type = type;
  if (limit) args.limit = limit;
  if (nextToken) args.nextToken = nextToken;
  // listLeads may not exist in deployed schema yet — guard against it
  if (typeof (client().queries).listLeads !== 'function') {
    throw new Error('listLeads query not available. Please deploy the updated backend schema first.');
  }
  const { data, errors } = await client().queries.listLeads(args, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getLead(leadId: string) {
  if (typeof (client().queries).getLead !== 'function') {
    throw new Error('getLead query not available. Please deploy the updated backend schema first.');
  }
  const { data, errors } = await client().queries.getLead({ leadId }, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

// --- Customer Timeline (GSI4: email-based cross-entity) ---

export async function listByEmail(email: string, limit?: number, nextToken?: string) {
  const args: Record<string, unknown> = { email };
  if (limit) args.limit = limit;
  if (nextToken) args.nextToken = nextToken;
  if (typeof (client().queries).listByEmail !== 'function') {
    throw new Error('listByEmail query not available. Please deploy the updated backend schema first.');
  }
  const { data, errors } = await client().queries.listByEmail(args as QueryArgs<'listByEmail'>, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

// --- Direct S3 Upload ---

export async function uploadFileToS3(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
}
