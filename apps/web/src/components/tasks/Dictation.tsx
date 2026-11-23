import React, { useState, useEffect } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { Volume2, ArrowRight, Loader2, Play } from 'lucide-react';
import { usePlayOnce } from '../../hooks/usePlayOnce.ts';
import { api } from '../../lib/api.ts';

interface Props {
  sessionId: string;
  item: Extract<PublicItem, { part: 'E' }>;
  onSubmit: (text: string) => void;
  disabled?: boolean;
}

export function Dictation({ sessionId, item, onSubmit, disabled }: Props) {
  const [text, setText] = useState('');
  const { isPlaying, hasPlayed, isLoading, playAudio } = usePlayOnce();

  // Auto-play audio when item starts
  useEffect(() => {
    setText('');
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
    if (disabled) return;
    onSubmit(text.trim());
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 w-full max-w-xl mx-auto">
      <div className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card text-center flex flex-col items-center">
        {/* Play-once audio status widget */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
            {isLoading ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isPlaying ? (
              <Volume2 className="w-8 h-8 animate-pulse" />
            ) : (
              <Volume2 className="w-8 h-8 text-zinc-400" />
            )}
          </div>

          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {isPlaying ? 'Listening... (Sentence plays once)' : hasPlayed ? 'Audio finished. Type what you heard:' : 'Loading audio...'}
          </span>
          <span className="text-xs text-zinc-400">Audio plays once only, in accordance with the test format.</span>
        </div>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type the exact sentence you heard..."
          disabled={disabled}
          autoFocus
          className="w-full px-5 py-3.5 text-center text-lg font-medium rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all placeholder:text-zinc-400"
        />

        <div className="mt-6 flex justify-end w-full">
          <Button type="submit" disabled={disabled || !text.trim()} size="md" className="w-full sm:w-auto">
            Submit & Next
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </form>
  );
}
