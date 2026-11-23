import React, { useState, useEffect, useRef } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { Clock, Mic, Square, Loader2 } from 'lucide-react';
import { useRecorder } from '../../hooks/useRecorder.ts';
import { WaveformMeter } from '../common/WaveformMeter.tsx';
import { Badge } from '../common/Badge.tsx';

interface Props {
  item: Extract<PublicItem, { part: 'I' }>;
  onSubmit: (blob: Blob, durationMs: number) => void;
  disabled?: boolean;
}

export function SpeakingSituation({ item, onSubmit, disabled }: Props) {
  const [phase, setPhase] = useState<'thinking' | 'speaking' | 'submitting'>('thinking');
  const [thinkSeconds, setThinkSeconds] = useState(10);
  const thinkIntervalRef = useRef<number | null>(null);

  const { isRecording, audioLevel, startRecording, stopRecording } = useRecorder({
    maxDurationSec: 60,
    onAutoStop: (blob, durationMs) => {
      setPhase('submitting');
      onSubmit(blob, durationMs);
    },
  });

  // 10s think countdown
  useEffect(() => {
    setPhase('thinking');
    setThinkSeconds(10);

    if (thinkIntervalRef.current) {
      clearInterval(thinkIntervalRef.current);
    }

    thinkIntervalRef.current = window.setInterval(() => {
      setThinkSeconds((prev) => {
        if (prev <= 1) {
          if (thinkIntervalRef.current) {
            clearInterval(thinkIntervalRef.current);
            thinkIntervalRef.current = null;
          }
          setPhase('speaking');
          startRecording();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (thinkIntervalRef.current) {
        clearInterval(thinkIntervalRef.current);
        thinkIntervalRef.current = null;
      }
    };
  }, [item.id, startRecording]);

  const handleSkipThinking = () => {
    if (thinkIntervalRef.current) {
      clearInterval(thinkIntervalRef.current);
      thinkIntervalRef.current = null;
    }
    setPhase('speaking');
    setThinkSeconds(0);
    startRecording();
  };

  const handleFinishSpeaking = async () => {
    if (phase !== 'speaking') return;
    setPhase('submitting');
    const result = await stopRecording();
    if (result) {
      onSubmit(result.blob, result.durationMs);
    } else {
      onSubmit(new Blob([], { type: 'audio/webm' }), 0);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      {/* Phase status bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2">
          {phase === 'thinking' ? (
            <>
              <Clock className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-semibold">Preparation Time</span>
              <Badge variant="warning" size="sm">Think about your response</Badge>
            </>
          ) : (
            <>
              <Mic className="w-4 h-4 text-red-500 animate-pulse" />
              <span className="text-sm font-semibold">Speaking Time</span>
              <Badge variant="accent" size="sm">Respond aloud naturally</Badge>
            </>
          )}
        </div>

        {phase === 'thinking' && (
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {thinkSeconds}s to think
            </span>
            <button
              onClick={handleSkipThinking}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline font-medium"
            >
              Start speaking now
            </button>
          </div>
        )}
      </div>

      <div className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col items-center text-center">
        <p className="text-xl sm:text-2xl font-medium leading-relaxed text-zinc-900 dark:text-zinc-100 mb-8">
          "{item.situation}"
        </p>

        <div className="w-full max-w-sm my-4">
          <WaveformMeter level={audioLevel} isRecording={isRecording} />
        </div>

        {phase === 'speaking' && (
          <Button
            type="button"
            onClick={handleFinishSpeaking}
            variant="danger"
            size="md"
            className="mt-4"
          >
            <Square className="w-4 h-4 mr-1.5 fill-current" />
            Done Speaking
          </Button>
        )}

        {phase === 'submitting' && (
          <div className="flex items-center gap-2 text-sm text-zinc-500 mt-4">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing your spoken answer...</span>
          </div>
        )}
      </div>
    </div>
  );
}
