import { UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '../lib/dynamodb.js';
import { fetchCase, buildCaseResponse } from '../lib/caseHelper.js';
import { generateLegId } from '../lib/idGenerators.js';
import type { AppSyncEvent, ShipmentLeg } from '../lib/types.js';
import { LEG_DIRECTIONS, CUSTOMS_STATUSES, type LegDirection, type CustomsStatus } from '../lib/stages.js';

const LEG_FIELDS = [
  'direction', 'customsRequired', 'customsStatus', 'carrier', 'trackingNumber', 'trackingUrl',
  'freightForwarder', 'blOrAwb', 'containerNo', 'declaredValueUSD', 'hsCode',
  'shippedAt', 'clearedAt', 'deliveredAt',
] as const;

function validateLegInput(input: Record<string, unknown>): void {
  if (input.direction !== undefined
    && !LEG_DIRECTIONS.includes(input.direction as LegDirection)) {
    throw new Error(`direction must be one of: ${LEG_DIRECTIONS.join(', ')}`);
  }
  if (input.customsStatus !== undefined
    && input.customsStatus !== null
    && !CUSTOMS_STATUSES.includes(input.customsStatus as CustomsStatus)) {
    throw new Error(`customsStatus must be one of: ${CUSTOMS_STATUSES.join(', ')}`);
  }
}

function pickLegFields(input: Record<string, unknown>): Partial<ShipmentLeg> {
  const out: Record<string, unknown> = {};
  for (const f of LEG_FIELDS) if (input[f] !== undefined) out[f] = input[f];
  return out as Partial<ShipmentLeg>;
}

async function persistLegs(caseId: string, legs: ShipmentLeg[], expectedUpdatedAt: string) {
  const now = new Date().toISOString();
  try {
    await docClient.send(new UpdateCommand({
      TableName: TABLE_NAME(),
      Key: { PK: `LOGISTICS#${caseId}`, SK: 'META' },
      UpdateExpression: 'SET legs = :legs, updatedAt = :now, GSI1SK = :gsi1sk',
      ConditionExpression: 'updatedAt = :expectedUpdatedAt',
      ExpressionAttributeValues: {
        ':legs': legs,
        ':now': now,
        ':gsi1sk': `${now}#${caseId}`,
        ':expectedUpdatedAt': expectedUpdatedAt,
      },
    }));
  } catch (err) {
    if ((err as { name?: string }).name === 'ConditionalCheckFailedException') {
      throw new Error('Logistics case was updated by another user. Please refresh.');
    }
    throw err;
  }
  return buildCaseResponse(caseId);
}

export async function addLeg(event: AppSyncEvent) {
  const { caseId, input: raw } = event.arguments as { caseId?: string; input: string | Record<string, unknown> };
  if (!caseId) throw new Error('caseId is required');
  const input: Record<string, unknown> = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!input.direction) throw new Error('direction is required');
  validateLegInput(input);

  const current = await fetchCase(caseId);
  if (!current) throw new Error(`Logistics case not found: ${caseId}`);

  const leg: ShipmentLeg = { legId: generateLegId(), direction: input.direction as LegDirection, ...pickLegFields(input) };
  return persistLegs(caseId, [...(current.legs || []), leg], current.updatedAt);
}

export async function updateLeg(event: AppSyncEvent) {
  const { caseId, legId, input: raw } = event.arguments as {
    caseId?: string; legId?: string; input: string | Record<string, unknown>;
  };
  if (!caseId || !legId) throw new Error('caseId and legId are required');
  const input: Record<string, unknown> = typeof raw === 'string' ? JSON.parse(raw) : raw;
  validateLegInput(input);

  const current = await fetchCase(caseId);
  if (!current) throw new Error(`Logistics case not found: ${caseId}`);
  const legs = current.legs || [];
  const idx = legs.findIndex((l) => l.legId === legId);
  if (idx === -1) throw new Error(`Leg not found: ${legId}`);

  legs[idx] = { ...legs[idx], ...pickLegFields(input) };
  return persistLegs(caseId, legs, current.updatedAt);
}

export async function removeLeg(event: AppSyncEvent) {
  const { caseId, legId } = event.arguments as { caseId?: string; legId?: string };
  if (!caseId || !legId) throw new Error('caseId and legId are required');

  const current = await fetchCase(caseId);
  if (!current) throw new Error(`Logistics case not found: ${caseId}`);
  const existing = current.legs || [];
  if (!existing.some((l) => l.legId === legId)) throw new Error(`Leg not found: ${legId}`);
  return persistLegs(caseId, existing.filter((l) => l.legId !== legId), current.updatedAt);
}
