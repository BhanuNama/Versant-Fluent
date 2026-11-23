import React, { useState, useRef, useEffect } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { Mail, CheckCircle2, Circle, AlertCircle, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  item: Extract<PublicItem, { part: 'D' }>;
  onSubmit: (text: string, integrity: { pasted: boolean; pasteChars: number }) => void;
  disabled?: boolean;
}

export function WriteEmail({ item, onSubmit, disabled }: Props) {
  const [text, setText] = useState('');
  const pasteInfoRef = useRef({ pasted: false, pasteChars: 0 });

  useEffect(() => {
    setText('');
    pasteInfoRef.current = { pasted: false, pasteChars: 0 };
  }, [item.id]);

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const minWords = item.minWords || 100;
  const isWordCountMet = wordCount >= minWords;

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text') || '';
    pasteInfoRef.current.pasted = true;
    pasteInfoRef.current.pasteChars += pasted.length;
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled || !text.trim()) return;
    onSubmit(text.trim(), pasteInfoRef.current);
  };

  // Quick theme keyword checks
  const lowText = text.toLowerCase();
  const themeChecks = item.points.map((pt) => {
    const words = pt.toLowerCase().split(/\s+/);
    const hit = words.some((w) => w.length > 3 && lowText.includes(w));
    return { point: pt, hit };
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-5xl mx-auto">
      {/* Prompt & Requirements */}
      <div className="lg:col-span-5 flex flex-col gap-5">
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-zinc-100 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            <Mail className="w-4 h-4 text-indigo-500" />
            Email Task & Situation
          </div>

          <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200 mb-4">
            {item.task}
          </p>

          <div className="text-xs bg-zinc-50 dark:bg-zinc-800/60 p-3 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 mb-4">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">Recipient:</span> {item.recipient}
          </div>

          <div className="space-y-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              Required Points to Cover:
            </span>
            {themeChecks.map(({ point, hit }, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                {hit ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0 mt-0.5" />
                )}
                <span className={clsx(hit ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-600 dark:text-zinc-400')}>
                  {point}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Word count progress card */}
        <div className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs text-zinc-500 block">Length goal:</span>
            <span className={clsx('text-lg font-bold tabular-nums', isWordCountMet ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300')}>
              {wordCount} / {minWords} words
            </span>
          </div>

          <div className="w-32 bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
            <div
              className={clsx('h-full transition-all duration-300', isWordCountMet ? 'bg-emerald-500' : 'bg-indigo-500')}
              style={{ width: `${Math.min(100, (wordCount / minWords) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Editor */}
      <form onSubmit={handleSubmit} className="lg:col-span-7 flex flex-col gap-4">
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col flex-1">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            rows={14}
            disabled={disabled}
            placeholder={`Dear ${(item.recipient || 'Manager').split(',')[0] || 'Manager'},\n\nI am writing to...`}
            className="w-full flex-1 p-4 text-base font-normal rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all placeholder:text-zinc-400 leading-relaxed font-sans"
          />

          {pasteInfoRef.current.pasted && (
            <div className="flex items-center gap-1.5 mt-3 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>Text was pasted. Make sure all sentences are your own work.</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800">
            <span className="text-xs text-zinc-400">
              Include greeting, supporting ideas for all 3 points, and closing.
            </span>
            <Button type="submit" disabled={disabled || wordCount < 20} size="md">
              Submit Email
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
