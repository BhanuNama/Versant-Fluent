import React, { useState, useEffect } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { ArrowRight, BookOpen } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  item: Extract<PublicItem, { part: 'C' }>;
  onSubmit: (choices: number[]) => void;
  disabled?: boolean;
}

export function ReadAndChoose({ item, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<number[]>(
    new Array(item.questions.length).fill(-1)
  );

  useEffect(() => {
    setSelected(new Array(item.questions.length).fill(-1));
  }, [item.id, item.questions.length]);

  const handleSelect = (qIdx: number, optionIdx: number) => {
    if (disabled) return;
    const next = [...selected];
    next[qIdx] = optionIdx;
    setSelected(next);
  };

  const isAllAnswered = selected.every((choice) => choice >= 0);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isAllAnswered || disabled) return;
    onSubmit(selected);
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-5xl mx-auto">
      {/* Passage view */}
      <div className="lg:col-span-6 p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          Reading Passage
        </div>

        <h3 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">
          {item.title}
        </h3>

        <div className="prose prose-zinc dark:prose-invert text-base leading-relaxed text-zinc-700 dark:text-zinc-300">
          {item.passage}
        </div>
      </div>

      {/* Questions & choices */}
      <div className="lg:col-span-6 flex flex-col gap-6">
        {item.questions.map((q, qIdx) => (
          <div
            key={qIdx}
            className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card"
          >
            <p className="font-semibold text-base mb-4 text-zinc-900 dark:text-zinc-100">
              <span className="text-indigo-600 dark:text-indigo-400 mr-2">{qIdx + 1}.</span>
              {q.q}
            </p>

            <div className="space-y-2.5">
              {q.options.map((opt, optIdx) => {
                const isSelected = selected[qIdx] === optIdx;
                const letter = String.fromCharCode(65 + optIdx);

                return (
                  <button
                    key={optIdx}
                    type="button"
                    onClick={() => handleSelect(qIdx, optIdx)}
                    disabled={disabled}
                    className={clsx(
                      'w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left text-sm transition-all',
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200 font-medium ring-1 ring-indigo-500/30'
                        : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300'
                    )}
                  >
                    <span
                      className={clsx(
                        'w-6 h-6 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0',
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                      )}
                    >
                      {letter}
                    </span>
                    <span>{opt}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={disabled || !isAllAnswered} size="md">
            Next
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </form>
  );
}
