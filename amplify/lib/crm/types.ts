import type { EmitArgs } from '../../functions/crm-api/lib/emitTimelineEvent';

// Single source of truth for the timeline-emit shape is crm-api; re-export it as the wire
// contract so business Lambdas never import crm-api runtime internals (type-only = erased at build).
export type { EmitArgs };

export interface CrmEmitPayload {
  action: 'emitTimelineEvent';
  args: EmitArgs;
}
