import React, { useState, useEffect, useRef } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { ArrowRight } from 'lucide-react';

interface Props {
  item: Extract<PublicItem, { part: 'A' }>;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function TypeOneWord({ item, onSubmit, disabled }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue('');
    inputRef.current?.focus();
  }, [item.id]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled) return;
    onSubmit(value.trim());
  };

  // Render prompt with distinct blank highlighting (handles 3+ underscores)
  const parts = item.prompt.split(/_{3,}/);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-xl mx-auto">
      <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card text-center">
        <p className="text-xl sm:text-2xl font-medium leading-relaxed text-zinc-900 dark:text-zinc-100">
          {parts[0]}
          <span className="inline-block border-b-2 border-indigo-500 font-semibold px-3 py-0.5 mx-1 min-w-[70px] text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-t">
            {value || '_____'}
          </span>
          {parts[1] || ''}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-center">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\s+/g, ''))}
            placeholder="Type one word..."
            maxLength={35}
            disabled={disabled}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="w-full sm:w-72 px-4 py-3 text-center text-lg font-medium rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
          />

          <Button type="submit" disabled={disabled || !value.trim()} size="md" className="w-full sm:w-auto">
            Next
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      <p className="text-xs text-center text-zinc-500 dark:text-zinc-400">
        Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono text-[10px]">Enter</kbd> to submit
      </p>
    </form>
  );
}
