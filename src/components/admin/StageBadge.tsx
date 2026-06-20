import {
  STAGE_LABELS, CUSTOMS_STATUS_LABELS, isCustomsStage,
  type LogisticsStage, type CustomsStatus,
} from '../../types/logistics';

function stageStyle(stage: LogisticsStage): string {
  if (stage === 'CANCELLED') return 'bg-error-container text-on-error-container';
  if (stage === 'CLOSED' || stage === 'DRAFT') return 'bg-surface-container-high text-on-surface-variant';
  if (isCustomsStage(stage)) return 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
  return 'bg-secondary-fixed text-secondary';
}

export function StageBadge({ stage, size = 'sm' }: { stage: LogisticsStage; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = size === 'lg' ? 'text-xs px-4 py-1.5' : size === 'md' ? 'text-[11px] px-3 py-1' : 'text-[10px] px-3 py-1';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-black uppercase tracking-tighter ${sizeClasses} ${stageStyle(stage)}`}>
      {STAGE_LABELS[stage]}
    </span>
  );
}

const CUSTOMS_STYLE: Record<CustomsStatus, string> = {
  NOT_REQUIRED: 'bg-surface-container-high text-on-surface-variant',
  DOCS_READY: 'bg-cyan-100 text-cyan-800',
  FILED: 'bg-secondary-fixed text-secondary',
  EXAM: 'bg-amber-100 text-amber-800',
  HELD: 'bg-error-container text-on-error-container',
  RELEASED: 'bg-emerald-100 text-emerald-800',
  DUTIES_PAID: 'bg-emerald-100 text-emerald-800',
  CLEARED: 'bg-green-100 text-green-800',
};

export function CustomsBadge({ status }: { status?: CustomsStatus | null }) {
  if (!status) return null;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${CUSTOMS_STYLE[status]}`}>
      {CUSTOMS_STATUS_LABELS[status]}
    </span>
  );
}
