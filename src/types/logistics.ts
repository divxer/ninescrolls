export const CASE_TYPES = ['SAMPLE', 'EQUIPMENT', 'SPARE_PART', 'RMA', 'DEMO'] as const;
export type CaseType = (typeof CASE_TYPES)[number];

export const LEG_DIRECTIONS = ['INBOUND', 'OUTBOUND', 'RETURN', 'DOMESTIC_TRANSFER'] as const;
export type LegDirection = (typeof LEG_DIRECTIONS)[number];

export const CUSTOMS_STATUSES = [
  'NOT_REQUIRED', 'DOCS_READY', 'FILED', 'EXAM', 'HELD', 'RELEASED', 'DUTIES_PAID', 'CLEARED',
] as const;
export type CustomsStatus = (typeof CUSTOMS_STATUSES)[number];

export const RELATED_ENTITY_TYPES = [
  'ORDER', 'LEAD', 'SAMPLE_PROJECT', 'CUSTOMER', 'SERVICE_CASE',
] as const;
export type RelatedEntityType = (typeof RELATED_ENTITY_TYPES)[number];

export const LOGISTICS_STAGES = [
  'DRAFT', 'AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS',
  'CUSTOMS_HOLD', 'RECEIVED', 'TESTING', 'REPORT_ISSUED', 'READY_TO_RETURN',
  'RETURN_IN_TRANSIT', 'RETURNED', 'PRODUCTION', 'FAT_SCHEDULED', 'FAT_PASSED',
  'READY_TO_SHIP', 'DELIVERED', 'INSTALLATION_SCHEDULED', 'INSTALLED', 'ACCEPTED',
  'CLOSED', 'CANCELLED',
] as const;
export type LogisticsStage = (typeof LOGISTICS_STAGES)[number];

export interface ShipmentLeg {
  legId: string;
  direction: LegDirection;
  customsRequired?: boolean | null;
  customsStatus?: CustomsStatus | null;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  freightForwarder?: string | null;
  blOrAwb?: string | null;
  containerNo?: string | null;
  declaredValueUSD?: number | null;
  hsCode?: string | null;
  shippedAt?: string | null;
  clearedAt?: string | null;
  deliveredAt?: string | null;
}

export interface LogisticsLogEntry {
  action: string;
  fromStage?: LogisticsStage | null;
  toStage?: LogisticsStage | null;
  operator: string;
  timestamp: string;
  detail?: string | null;
  internalOnly: boolean;
}

export interface LogisticsCase {
  caseId: string;
  caseNumber: string;
  caseType: CaseType;
  relatedOrderId?: string | null;
  relatedEntityType?: RelatedEntityType | null;
  relatedEntityId?: string | null;
  customerName: string;
  contactName?: string | null;
  customsRequired: boolean;
  currentStage: LogisticsStage;
  enabledStages: LogisticsStage[];
  legs?: ShipmentLeg[] | null;
  milestoneLog?: LogisticsLogEntry[] | null;
  isCustomerVisible: boolean;
  publicToken?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface LogisticsStats {
  totalActive: number;
  byType: string;   // a.json() — JSON-stringified Record<CaseType, number>
  byStage: string;  // a.json() — JSON-stringified Record<LogisticsStage, number>
  customsInProgress: number;
  stalledCases: number;
}

const EQUIPMENT_STAGES: LogisticsStage[] = [
  'PRODUCTION', 'FAT_SCHEDULED', 'FAT_PASSED', 'READY_TO_SHIP', 'EXPORT_CUSTOMS',
  'IN_TRANSIT', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD', 'DELIVERED',
  'INSTALLATION_SCHEDULED', 'INSTALLED', 'ACCEPTED', 'CLOSED',
];

export const ENABLED_STAGES: Record<CaseType, LogisticsStage[]> = {
  SAMPLE: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD',
    'RECEIVED', 'TESTING', 'REPORT_ISSUED', 'READY_TO_RETURN', 'RETURN_IN_TRANSIT',
    'RETURNED', 'CLOSED',
  ],
  EQUIPMENT: EQUIPMENT_STAGES,
  SPARE_PART: ['AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'DELIVERED', 'CLOSED'],
  RMA: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'IMPORT_CUSTOMS', 'RECEIVED', 'TESTING',
    'READY_TO_RETURN', 'RETURN_IN_TRANSIT', 'EXPORT_CUSTOMS', 'DELIVERED', 'CLOSED',
  ],
  DEMO: EQUIPMENT_STAGES,
};

/** Prefer the case's own enabledStages; fall back to the caseType default. */
export function enabledStagesFor(caseType: CaseType, stored?: LogisticsStage[] | null): LogisticsStage[] {
  return stored && stored.length ? stored : ENABLED_STAGES[caseType];
}

const CUSTOMS_STAGES = new Set<LogisticsStage>(['EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'CUSTOMS_HOLD']);
export function isCustomsStage(stage: LogisticsStage): boolean {
  return CUSTOMS_STAGES.has(stage);
}

/** Optional/branch stages that sit inside enabledStages but are NOT mandatory steps. */
export const EXCEPTION_STAGES = new Set<LogisticsStage>(['CUSTOMS_HOLD']);

/**
 * Guided advancement for the detail-page dropdown. Returns the recommended next
 * stage(s): the next happy-path stage (so you can't accidentally jump
 * PRODUCTION → CLOSED), PLUS the CUSTOMS_HOLD branch when sitting on a customs
 * stage, PLUS CANCELLED. The backend still accepts any enabled stage — this only
 * guides the UI; it does not force a rigid single-step machine through exception
 * states like CUSTOMS_HOLD.
 */
export function nextAdvanceableStages(
  currentStage: LogisticsStage,
  enabledStages: LogisticsStage[],
): LogisticsStage[] {
  // Terminal stages have nowhere to advance.
  if (currentStage === 'CLOSED' || currentStage === 'CANCELLED') return [];

  const happy = enabledStages.filter((s) => !EXCEPTION_STAGES.has(s));
  const out: LogisticsStage[] = [];

  if (currentStage === 'DRAFT') {
    if (happy[0]) out.push(happy[0]);
  } else {
    const hi = happy.indexOf(currentStage);
    if (hi >= 0) {
      if (happy[hi + 1]) out.push(happy[hi + 1]);
    } else {
      // On an exception stage (e.g. CUSTOMS_HOLD): resume at the next happy stage.
      const ei = enabledStages.indexOf(currentStage);
      const resume = enabledStages.slice(ei + 1).find((s) => !EXCEPTION_STAGES.has(s));
      if (resume) out.push(resume);
    }
  }

  if ((currentStage === 'EXPORT_CUSTOMS' || currentStage === 'IMPORT_CUSTOMS')
    && enabledStages.includes('CUSTOMS_HOLD')) {
    out.push('CUSTOMS_HOLD');
  }
  out.push('CANCELLED');
  return Array.from(new Set(out));
}

export const STAGE_LABELS: Record<LogisticsStage, string> = {
  DRAFT: 'Draft', AWAITING_SHIPMENT: 'Awaiting Shipment', IN_TRANSIT: 'In Transit',
  EXPORT_CUSTOMS: 'Export Customs', IMPORT_CUSTOMS: 'Import Customs', CUSTOMS_HOLD: 'Customs Hold',
  RECEIVED: 'Received', TESTING: 'Testing', REPORT_ISSUED: 'Report Issued',
  READY_TO_RETURN: 'Ready to Return', RETURN_IN_TRANSIT: 'Return In Transit', RETURNED: 'Returned',
  PRODUCTION: 'Production', FAT_SCHEDULED: 'FAT Scheduled', FAT_PASSED: 'FAT Passed',
  READY_TO_SHIP: 'Ready to Ship', DELIVERED: 'Delivered', INSTALLATION_SCHEDULED: 'Installation Scheduled',
  INSTALLED: 'Installed', ACCEPTED: 'Accepted', CLOSED: 'Closed', CANCELLED: 'Cancelled',
};

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
  SAMPLE: 'Sample', EQUIPMENT: 'Equipment', SPARE_PART: 'Spare Part', RMA: 'RMA', DEMO: 'Demo',
};

export const CUSTOMS_STATUS_LABELS: Record<CustomsStatus, string> = {
  NOT_REQUIRED: 'Not Required', DOCS_READY: 'Docs Ready', FILED: 'Filed', EXAM: 'Exam',
  HELD: 'Held', RELEASED: 'Released', DUTIES_PAID: 'Duties Paid', CLEARED: 'Cleared',
};

export const LEG_DIRECTION_LABELS: Record<LegDirection, string> = {
  INBOUND: 'Inbound', OUTBOUND: 'Outbound', RETURN: 'Return', DOMESTIC_TRANSFER: 'Domestic Transfer',
};

/** Parse the JSON-string stat buckets (a.json() round-trips as a string). Numbers only. */
export function parseStatBucket(raw: string | null | undefined): Record<string, number> {
  let parsed: unknown = raw;
  while (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return {}; }
  }
  if (!parsed || typeof parsed !== 'object') return {};
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'number'),
  ) as Record<string, number>;
}
