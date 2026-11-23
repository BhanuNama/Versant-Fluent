import React, { useState, useEffect, useRef } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { Eye, Edit3, ArrowRight, AlertCircle } from 'lucide-react';
import { Badge } from '../common/Badge.tsx';

interface Props {
  item: Extract<PublicItem, { part: 'B' }>;
  onSubmit: (text: string, integrity: { pasted: boolean; pasteChars: number }) => void;
  disabled?: boolean;
}

export function Reconstruct({ item, onSubmit, disabled }: Props) {
  const [phase, setPhase] = useState<'reading' | 'writing'>('reading');
  const [readSecondsLeft, setReadSecondsLeft] = useState(30);
  const [text, setText] = useState('');
  const pasteInfoRef = useRef({ pasted: false, pasteChars: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 30s Reading phase countdown
  useEffect(() => {
    setPhase('reading');
    setReadSecondsLeft(30);
    setText('');
    pasteInfoRef.current = { pasted: false, pasteChars: 0 };

    const interval = setInterval(() => {
      setReadSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setPhase('writing');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [item.id]);

  useEffect(() => {
    if (phase === 'writing') {
      textareaRef.current?.focus();
    }
  }, [phase]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text') || '';
    pasteInfoRef.current.pasted = true;
    pasteInfoRef.current.pasteChars += pastedText.length;
  };

  const handleSkipReading = () => {
    setPhase('writing');
    setReadSecondsLeft(0);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (disabled || phase === 'reading') return;
    onSubmit(text.trim(), pasteInfoRef.current);
  };

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto">
      {/* Phase indicator banner */}
      <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2">
          {phase === 'reading' ? (
            <>
              <Eye className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-semibold">Reading Phase</span>
              <Badge variant="purple" size="sm">Read & memorize key ideas</Badge>
            </>
          ) : (
            <>
              <Edit3 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-sm font-semibold">Writing Phase</span>
              <Badge variant="success" size="sm">Rewrite from memory</Badge>
            </>
          )}
        </div>

        {phase === 'reading' && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
              {readSecondsLeft}s left
            </span>
            <button
              onClick={handleSkipReading}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline font-medium"
            >
              Start writing now
            </button>
          </div>
        )}
      </div>

      {/* Main card */}
      <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card">
        {phase === 'reading' ? (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/50">
              <p className="text-lg sm:text-xl font-medium leading-relaxed text-zinc-800 dark:text-zinc-200 select-none">
                {item.passage}
              </p>
            </div>

            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-indigo-600 h-full transition-all duration-1000 ease-linear"
                style={{ width: `${(readSecondsLeft / 30) * 100}%` }}
              />
            </div>
            <p className="text-xs text-center text-zinc-400">The passage will vanish when the timer ends.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Write the passage in your own words with all key ideas:</span>
              <span className="font-medium tabular-nums">{wordCount} words</span>
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onPaste={handlePaste}
              rows={6}
              disabled={disabled}
              placeholder="Start rewriting the passage from memory..."
              className="w-full p-4 text-base rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-all placeholder:text-zinc-400"
            />

            {pasteInfoRef.current.pasted && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Pasting detected. Write in your own words from memory.</span>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={disabled || !text.trim()} size="md">
                Submit & Next
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
