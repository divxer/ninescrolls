import type {
  CaseType, LegDirection, CustomsStatus, RelatedEntityType, LogisticsStage,
} from './stages.js';

export interface AppSyncEvent {
  info: { fieldName: string; parentTypeName: string };
  arguments: Record<string, unknown>;
  identity?: { sub: string; username?: string; claims?: Record<string, unknown> };
}

export function getOperatorInfo(event: AppSyncEvent): { sub: string; email: string } {
  const id = event.identity;
  if (!id) return { sub: 'admin', email: 'admin' };
  const email = (id.claims?.email as string)
    || (id.claims?.['cognito:email'] as string)
    || id.username
    || id.sub
    || 'admin';
  return { sub: id.sub || 'admin', email };
}

export interface ShipmentLeg {
  legId: string;
  direction: LegDirection;
  customsRequired?: boolean;
  customsStatus?: CustomsStatus;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string; // optional manual/auto-built link; Phase 1 has NO carrier-API polling
  freightForwarder?: string;
  blOrAwb?: string;
  containerNo?: string;
  declaredValueUSD?: number;
  hsCode?: string;
  shippedAt?: string;
  clearedAt?: string;
  deliveredAt?: string;
}

export interface LogisticsLogEntry {
  action: string;
  fromStage?: LogisticsStage | null;
  toStage?: LogisticsStage | null;
  operator: string;
  timestamp: string;
  detail?: string;
  internalOnly: boolean;
}

export interface LogisticsCaseItem {
  PK: string;
  SK: 'META';
  GSI1PK: 'LOGISTICS_CASES'; // constant listing partition — never per-stage
  GSI1SK: string;            // '<updatedAt>#<caseId>'
  caseId: string;
  caseNumber: string;
  caseType: CaseType;
  relatedOrderId?: string;
  relatedEntityType?: RelatedEntityType;
  relatedEntityId?: string;
  customerName: string;
  contactName?: string;
  customsRequired: boolean;
  currentStage: LogisticsStage;
  enabledStages: LogisticsStage[];
  legs: ShipmentLeg[];
  milestoneLog: LogisticsLogEntry[];
  isCustomerVisible: boolean;
  publicToken?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

/** GraphQL-facing shape: identical to the item minus DDB keys. */
export type LogisticsCaseResponse = Omit<LogisticsCaseItem, 'PK' | 'SK' | 'GSI1PK' | 'GSI1SK'>;

export function toCaseResponse(item: LogisticsCaseItem): LogisticsCaseResponse {
  // Strip the DDB key fields via rest (ignoreRestSiblings keeps lint happy).
  const { PK, SK, GSI1PK, GSI1SK, ...rest } = item;
  return rest;
}
