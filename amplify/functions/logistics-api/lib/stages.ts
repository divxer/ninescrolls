export const CASE_TYPES = ['SAMPLE', 'EQUIPMENT', 'SPARE_PART', 'RMA', 'DEMO'] as const;
export type CaseType = typeof CASE_TYPES[number];

export const LEG_DIRECTIONS = ['INBOUND', 'OUTBOUND', 'RETURN', 'DOMESTIC_TRANSFER'] as const;
export type LegDirection = typeof LEG_DIRECTIONS[number];

export const CUSTOMS_STATUSES = [
  'NOT_REQUIRED', 'DOCS_READY', 'FILED', 'EXAM', 'HELD', 'RELEASED', 'DUTIES_PAID', 'CLEARED',
] as const;
export type CustomsStatus = typeof CUSTOMS_STATUSES[number];

export const RELATED_ENTITY_TYPES = [
  'ORDER', 'LEAD', 'SAMPLE_PROJECT', 'CUSTOMER', 'SERVICE_CASE',
] as const;
export type RelatedEntityType = typeof RELATED_ENTITY_TYPES[number];

export const LOGISTICS_STAGES = [
  'DRAFT',
  'AWAITING_SHIPMENT',
  'IN_TRANSIT',
  'EXPORT_CUSTOMS',
  'IMPORT_CUSTOMS',
  'CUSTOMS_HOLD',
  'RECEIVED',
  'TESTING',
  'REPORT_ISSUED',
  'READY_TO_RETURN',
  'RETURN_IN_TRANSIT',
  'RETURNED',
  'PRODUCTION',
  'FAT_SCHEDULED',
  'FAT_PASSED',
  'READY_TO_SHIP',
  'DELIVERED',
  'INSTALLATION_SCHEDULED',
  'INSTALLED',
  'ACCEPTED',
  'CLOSED',
  'CANCELLED',
] as const;
export type LogisticsStage = typeof LOGISTICS_STAGES[number];

/** Stages reachable for any case type, exempt from the enabledStages subset constraint. */
export const UNIVERSAL_STAGES: LogisticsStage[] = ['DRAFT', 'CANCELLED'];

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
  SPARE_PART: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'EXPORT_CUSTOMS', 'IMPORT_CUSTOMS', 'DELIVERED', 'CLOSED',
  ],
  RMA: [
    'AWAITING_SHIPMENT', 'IN_TRANSIT', 'IMPORT_CUSTOMS', 'RECEIVED', 'TESTING',
    'READY_TO_RETURN', 'RETURN_IN_TRANSIT', 'EXPORT_CUSTOMS', 'DELIVERED', 'CLOSED',
  ],
  DEMO: EQUIPMENT_STAGES,
};

export function isStageEnabled(caseType: CaseType, stage: LogisticsStage): boolean {
  if (UNIVERSAL_STAGES.includes(stage)) return true;
  return ENABLED_STAGES[caseType]?.includes(stage) ?? false;
}

/** Phase 1: any enabled (or universal) target is valid — no forced linear order. */
export function isValidStageTransition(caseType: CaseType, target: LogisticsStage): boolean {
  return isStageEnabled(caseType, target);
}
