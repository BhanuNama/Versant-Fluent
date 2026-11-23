import React from 'react';
import { clsx } from 'clsx';
import { PARTS, PART_META, type PartId } from '@fluentpath/shared';

export interface PartStepperProps {
  activePart: PartId;
  parts?: PartId[];
  className?: string;
}

export function PartStepper({ activePart, parts = [...PARTS], className }: PartStepperProps) {
  const activeIdx = parts.indexOf(activePart);

  return (
    <div className={clsx('flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar', className)}>
      {parts.map((p, idx) => {
        const isCurrent = p === activePart;
        const isCompleted = idx < activeIdx;
        const meta = PART_META[p];

        return (
          <div
            key={p}
            className={clsx(
              'flex items-center justify-center px-2.5 py-1 rounded-lg text-xs font-semibold transition-all select-none',
              isCurrent && 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 shadow-sm ring-2 ring-indigo-500/20',
              isCompleted && 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
              !isCurrent && !isCompleted && 'text-zinc-400 dark:text-zinc-600'
            )}
            title={`Part ${p}: ${meta?.name}`}
          >
            Part {p}
          </div>
        );
      })}
    </div>
  );
}
