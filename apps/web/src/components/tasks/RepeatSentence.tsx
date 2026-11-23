import React, { useState, useEffect } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { Volume2, Mic, Square, Loader2 } from 'lucide-react';
import { usePlayOnce, stopAllSpeech } from '../../hooks/usePlayOnce.ts';
import { useRecorder } from '../../hooks/useRecorder.ts';
import { WaveformMeter } from '../common/WaveformMeter.tsx';
import { api } from '../../lib/api.ts';

interface Props {
  sessionId: string;
  item: Extract<PublicItem, { part: 'H' }>;
  onSubmit: (blob: Blob, durationMs: number) => void;
  disabled?: boolean;
}

export function RepeatSentence({ sessionId, item, onSubmit, disabled }: Props) {
  const [phase, setPhase] = useState<'listening' | 'countdown' | 'recording' | 'submitting'>('listening');
  const [countdown, setCountdown] = useState(3);

  const { speakPrompt, cleanup: cleanupAudio } = usePlayOnce({
    onEnded: () => {
      // Audio finished! Transition to 3-2-1 prepare countdown
      setPhase('countdown');
      setCountdown(3);
    },
  });

  const { isRecording, audioLevel, startRecording, stopRecording } = useRecorder({
    maxDurationSec: 15,
    onAutoStop: (blob, durationMs) => {
      setPhase('submitting');
      onSubmit(blob, durationMs);
    },
  });

  // Play audio when item starts
  useEffect(() => {
    setPhase('listening');
    cleanupAudio();

    api.signAudioUrl(sessionId, item.id)
      .then(({ promptText }) => {
        if (promptText) {
          speakPrompt(promptText);
        } else {
          setPhase('countdown');
          setCountdown(3);
        }
      })
      .catch(() => {
        setPhase('countdown');
        setCountdown(3);
      });

    return () => {
      cleanupAudio();
      stopAllSpeech();
    };
  }, [sessionId, item.id]);

  // 3-2-1 prepare countdown handler
  useEffect(() => {
    if (phase !== 'countdown') return;

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setPhase('recording');
      startRecording();
    }
  }, [phase, countdown, startRecording]);

  const handleFinishSpeaking = async () => {
    if (phase !== 'recording') return;
    setPhase('submitting');
    const result = await stopRecording();
    if (result) {
      onSubmit(result.blob, result.durationMs);
    } else {
      onSubmit(new Blob([], { type: 'audio/webm' }), 0);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-xl mx-auto">
      <div className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col items-center text-center">
        {/* Status header */}
        <div className="mb-6 flex flex-col items-center gap-2">
          {phase === 'listening' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                <Volume2 className="w-8 h-8 animate-pulse" />
              </div>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Listen carefully to the sentence...
              </span>
              <span className="text-xs text-zinc-400">Audio plays once. You will repeat it after the countdown.</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => {
                  cleanupAudio();
                  stopAllSpeech();
                  setPhase('countdown');
                  setCountdown(3);
                }}
                className="mt-2 text-xs"
              >
                Ready to Repeat
                <Mic className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          )}

          {phase === 'countdown' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-3xl border border-amber-200 dark:border-amber-900/50 shadow-sm animate-bounce">
                {countdown}
              </div>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Prepare to speak...
              </span>
            </>
          )}

          {phase === 'recording' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-900/50 animate-pulse">
                <Mic className="w-8 h-8" />
              </div>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Speaking Now — Repeat the sentence exactly as heard
              </span>
            </>
          )}

          {phase === 'submitting' && (
            <>
              <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-600 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Saving audio...
              </span>
            </>
          )}
        </div>

        {/* Live waveform audio meter */}
        <div className="w-full max-w-sm my-4">
          <WaveformMeter level={audioLevel} isRecording={isRecording} />
        </div>

        {phase === 'recording' && (
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
      </div>
    </div>
  );
}
