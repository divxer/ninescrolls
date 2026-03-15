import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
const AUTH = { authMode: 'userPool' as const };

// --- Orders ---

export async function listOrders(status?: string, limit?: number, nextToken?: string) {
  const args: Record<string, unknown> = {};
  if (status) args.status = status;
  if (limit) args.limit = limit;
  if (nextToken) args.nextToken = nextToken;
  const { data, errors } = await client.queries.listOrders(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getOrder(orderId: string) {
  const { data, errors } = await client.queries.getOrder({ orderId } as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getOrderLogs(orderId: string) {
  const { data, errors } = await client.queries.getOrderLogs({ orderId } as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function fetchOrderStats() {
  const { data, errors } = await client.queries.orderStats(AUTH as any);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function createOrder(input: Record<string, unknown>) {
  const { data, errors } = await client.mutations.createOrder(
    { input: JSON.stringify(input) } as any, AUTH,
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
  const { data, errors } = await client.mutations.updateOrderStatus(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function updateOrder(orderId: string, input: Record<string, unknown>) {
  const { data, errors } = await client.mutations.updateOrder(
    { orderId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function addContact(orderId: string, input: Record<string, unknown>) {
  const { data, errors } = await client.mutations.addContact(
    { orderId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function updateContact(
  orderId: string, contactId: string, input: Record<string, unknown>,
) {
  const { data, errors } = await client.mutations.updateContact(
    { orderId, contactId, input: JSON.stringify(input) } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function removeContact(orderId: string, contactId: string) {
  const { data, errors } = await client.mutations.removeContact(
    { orderId, contactId } as any, AUTH,
  );
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function declineInquiry(orderId: string, reason: string, note?: string) {
  const args: Record<string, unknown> = { orderId, reason };
  if (note) args.note = note;
  const { data, errors } = await client.mutations.declineInquiry(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

// --- Documents ---

export async function listOrderDocuments(orderId: string, stage?: string, docType?: string) {
  const args: Record<string, unknown> = { orderId };
  if (stage) args.stage = stage;
  if (docType) args.docType = docType;
  const { data, errors } = await client.queries.listOrderDocuments(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getDocumentUploadUrl(orderId: string, fileName: string, mimeType: string) {
  const { data, errors } = await client.queries.getDocumentUploadUrl(
    { orderId, fileName, mimeType } as any, AUTH,
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
  const { data, errors } = await client.mutations.confirmDocumentUpload(args as any, AUTH);
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
  const { data, errors } = await client.mutations.updateDocument(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function deleteDocument(orderId: string, docId: string) {
  const { data, errors } = await client.mutations.deleteDocument(
    { orderId, docId } as any, AUTH,
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
  const { data, errors } = await client.queries.listRfqs(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function getRfq(rfqId: string) {
  const { data, errors } = await client.queries.getRfq({ rfqId } as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function declineRfq(rfqId: string, reason?: string) {
  const args: Record<string, unknown> = { rfqId };
  if (reason) args.reason = reason;
  const { data, errors } = await client.mutations.declineRfq(args as any, AUTH);
  if (errors?.length) throw new Error(errors.map(e => e.message).join(', '));
  return data;
}

export async function revertRfqToPending(rfqId: string) {
  const { data, errors } = await client.mutations.revertRfqToPending({ rfqId } as any, AUTH);
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
  const { data, errors } = await client.mutations.convertRfqToOrder(args as any, AUTH);
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
