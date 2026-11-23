import React, { useState, useEffect } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { Volume2, Mic, Square, Loader2, ArrowRight } from 'lucide-react';
import { usePlayOnce, stopAllSpeech } from '../../hooks/usePlayOnce.ts';
import { useRecorder } from '../../hooks/useRecorder.ts';
import { WaveformMeter } from '../common/WaveformMeter.tsx';
import { api } from '../../lib/api.ts';
import { Badge } from '../common/Badge.tsx';

interface Props {
  sessionId: string;
  item: Extract<PublicItem, { part: 'J' }>;
  onSubmit: (blob: Blob, durationMs: number) => void;
  disabled?: boolean;
}

export function StoryRetell({ sessionId, item, onSubmit, disabled }: Props) {
  const [phase, setPhase] = useState<'listening' | 'speaking' | 'submitting'>('listening');
  const [storyText, setStoryText] = useState<string>(item.story || '');

  const { isPlaying, speakPrompt, cleanup: cleanupAudio } = usePlayOnce({
    onEnded: () => {
      setPhase('speaking');
      startRecording();
    },
  });

  const { isRecording, audioLevel, startRecording, stopRecording } = useRecorder({
    maxDurationSec: item.speakSec || 30,
    onAutoStop: (blob, durationMs) => {
      setPhase('submitting');
      onSubmit(blob, durationMs);
    },
  });

  useEffect(() => {
    setPhase('listening');
    cleanupAudio();

    if (item.story) {
      setStoryText(item.story);
      speakPrompt(item.story);
    } else {
      api.signAudioUrl(sessionId, item.id)
        .then(({ promptText }) => {
          if (promptText) {
            setStoryText(promptText);
            speakPrompt(promptText);
          } else {
            setPhase('speaking');
            startRecording();
          }
        })
        .catch(() => {
          setPhase('speaking');
          startRecording();
        });
    }

    return () => {
      cleanupAudio();
      stopAllSpeech();
    };
  }, [sessionId, item.id, item.story]);

  const handleStartSpeakingNow = () => {
    cleanupAudio();
    stopAllSpeech();
    setPhase('speaking');
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
    <div className="flex flex-col gap-6 w-full max-w-xl mx-auto">
      <div className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col items-center text-center">
        <div className="mb-6 flex flex-col items-center gap-2">
          {phase === 'listening' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                <Volume2 className="w-8 h-8 animate-pulse" />
              </div>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                {isPlaying ? 'Listening to the story...' : 'Story Ready'}
              </span>
              <span className="text-xs text-zinc-400">Remember who was involved, what happened, and how it ended.</span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleStartSpeakingNow}
                className="mt-2 text-xs"
              >
                Ready to Retell
                <Mic className="w-3.5 h-3.5 ml-1" />
              </Button>
            </>
          ) : phase === 'speaking' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-900/50 animate-pulse">
                <Mic className="w-8 h-8" />
              </div>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Retell the story in your own words
              </span>
              <Badge variant="purple" size="sm">You have 30 seconds</Badge>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-600 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Saving your retelling...
              </span>
            </>
          )}
        </div>

        {/* Story Card Display */}
        {storyText && phase === 'listening' && (
          <div className="w-full text-left p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 my-2">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">
              Story Narrative
            </span>
            <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
              "{storyText}"
            </p>
          </div>
        )}

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
      </div>
    </div>
  );
}
