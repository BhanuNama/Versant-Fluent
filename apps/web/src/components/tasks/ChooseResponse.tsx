import React, { useState, useEffect } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { Volume2, ArrowRight, Loader2 } from 'lucide-react';
import { usePlayOnce } from '../../hooks/usePlayOnce.ts';
import { api } from '../../lib/api.ts';
import { clsx } from 'clsx';

interface Props {
  sessionId: string;
  item: Extract<PublicItem, { part: 'F' }>;
  onSubmit: (choice: number) => void;
  disabled?: boolean;
}

export function ChooseResponse({ sessionId, item, onSubmit, disabled }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const { isPlaying, hasPlayed, isLoading, playAudio } = usePlayOnce();

  useEffect(() => {
    setSelected(null);
    api.signAudioUrl(sessionId, item.id)
      .then(({ url, promptText }) => {
        playAudio(url, promptText);
      })
      .catch((err) => {
        console.error('Audio sign error:', err);
      });
  }, [sessionId, item.id]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled || selected === null) return;
    onSubmit(selected);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-xl mx-auto">
      <div className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col items-center">
        {/* Audio state banner */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
            {isLoading ? (
              <Loader2 className="w-7 h-7 animate-spin" />
            ) : isPlaying ? (
              <Volume2 className="w-7 h-7 animate-pulse" />
            ) : (
              <Volume2 className="w-7 h-7 text-zinc-400" />
            )}
          </div>
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {isPlaying ? 'Listening to prompt...' : 'Select the best response:'}
          </span>
        </div>

        {/* Options A, B, C */}
        <div className="w-full space-y-3 mb-6">
          {item.options.map((opt, idx) => {
            const isSelected = selected === idx;
            const letter = String.fromCharCode(65 + idx);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => setSelected(idx)}
                disabled={disabled}
                className={clsx(
                  'w-full flex items-center gap-4 p-4 rounded-2xl border text-left text-base transition-all',
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/60 text-indigo-950 dark:bg-indigo-950/40 dark:text-indigo-200 font-medium ring-2 ring-indigo-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/40 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200'
                )}
              >
                <span
                  className={clsx(
                    'w-7 h-7 rounded-xl flex items-center justify-center text-sm font-semibold shrink-0',
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

        <div className="flex justify-end w-full">
          <Button type="submit" disabled={disabled || selected === null} size="md">
            Next
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </form>
  );
}
