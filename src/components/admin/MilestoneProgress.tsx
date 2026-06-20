import { STAGE_LABELS, type LogisticsStage } from '../../types/logistics';

export function MilestoneProgress({
  enabledStages, currentStage,
}: { enabledStages: LogisticsStage[]; currentStage: LogisticsStage }) {
  // CANCELLED is a terminal exception, not a ladder position — show it on its own.
  if (currentStage === 'CANCELLED') {
    return (
      <div className="inline-flex items-center gap-1.5 rounded-full bg-error-container px-3 py-1 text-[11px] font-bold uppercase tracking-tight text-on-error-container">
        <span className="material-symbols-outlined text-[14px]">cancel</span>Cancelled
      </div>
    );
  }

  // Always lead with DRAFT (cases open at DRAFT, which is never inside enabledStages);
  // drop any DRAFT/CANCELLED that might appear inside the stored set.
  const display: LogisticsStage[] = [
    'DRAFT',
    ...enabledStages.filter((s) => s !== 'DRAFT' && s !== 'CANCELLED'),
  ];
  const currentIdx = display.indexOf(currentStage);

  return (
    <ol className="flex flex-wrap items-center gap-2">
      {display.map((stage, i) => {
        const done = currentIdx >= 0 && i < currentIdx;
        const active = stage === currentStage;
        const cls = active
          ? 'bg-primary text-on-primary'
          : done
            ? 'bg-emerald-100 text-emerald-800'
            : 'bg-surface-container-high text-on-surface-variant';
        return (
          <li
            key={stage}
            aria-current={active ? 'step' : undefined}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-tight ${cls}`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {done ? 'check_circle' : active ? 'radio_button_checked' : 'radio_button_unchecked'}
            </span>
            {STAGE_LABELS[stage]}
          </li>
        );
      })}
    </ol>
  );
}
