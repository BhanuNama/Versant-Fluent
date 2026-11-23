import React, { useState, useEffect, useRef } from 'react';
import type { PublicItem } from '@fluentpath/shared';
import { Button } from '../common/Button.tsx';
import { Volume2, Mic, Square, Loader2, ArrowRight, Play, CheckCircle2 } from 'lucide-react';
import { usePlayOnce, stopAllSpeech } from '../../hooks/usePlayOnce.ts';
import { useRecorder } from '../../hooks/useRecorder.ts';
import { WaveformMeter } from '../common/WaveformMeter.tsx';
import { api } from '../../lib/api.ts';
import { Badge } from '../common/Badge.tsx';

interface Props {
  sessionId: string;
  item: Extract<PublicItem, { part: 'G' }>;
  onSubmit: (blob: Blob, durationMs: number, subIndex: number) => void;
  disabled?: boolean;
}

export function ListenAndSpeak({ sessionId, item, onSubmit, disabled }: Props) {
  const [subIndex, setSubIndex] = useState(0);
  const [phase, setPhase] = useState<'listening_story' | 'listening_question' | 'speaking' | 'submitting'>('listening_story');
  const [storyText, setStoryText] = useState<string>('');
  const [questionText, setQuestionText] = useState<string>('');

  // Track current phase and subIndex in ref so callbacks always have latest value
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const subIndexRef = useRef(subIndex);
  subIndexRef.current = subIndex;

  const { isPlaying, isLoading, speakPrompt, cleanup: cleanupAudio } = usePlayOnce({
    onEnded: () => {
      if (phaseRef.current === 'listening_story') {
        // Story finished! Transition to Question 1
        startQuestion(subIndexRef.current);
      } else if (phaseRef.current === 'listening_question') {
        // Question audio finished! Begin speaking
        setPhase('speaking');
        startRecording();
      }
    },
  });

  const { isRecording, audioLevel, startRecording, stopRecording } = useRecorder({
    maxDurationSec: 15,
    onAutoStop: (blob, durationMs) => {
      handleAnswerFinished(blob, durationMs);
    },
  });

  const startQuestion = (qIdx: number) => {
    setPhase('listening_question');
    cleanupAudio();

    api.signAudioUrl(sessionId, item.id, qIdx)
      .then(({ promptText }) => {
        const text = promptText || `Question ${qIdx + 1}`;
        setQuestionText(text);
        speakPrompt(text);
      })
      .catch(() => {
        setQuestionText(`Question ${qIdx + 1}`);
        setPhase('speaking');
        startRecording();
      });
  };

  // Mount or item change: Start with story
  useEffect(() => {
    setSubIndex(0);
    setPhase('listening_story');
    setStoryText('');
    setQuestionText('');
    cleanupAudio();

    api.signAudioUrl(sessionId, item.id)
      .then(({ promptText }) => {
        if (promptText) {
          setStoryText(promptText);
          speakPrompt(promptText);
        } else {
          startQuestion(0);
        }
      })
      .catch(() => {
        startQuestion(0);
      });

    return () => {
      cleanupAudio();
      stopAllSpeech();
    };
  }, [sessionId, item.id]);

  const handleSkipStoryToQuestion = () => {
    cleanupAudio();
    stopAllSpeech();
    startQuestion(0);
  };

  const handleSkipQuestionToSpeaking = () => {
    cleanupAudio();
    stopAllSpeech();
    setPhase('speaking');
    startRecording();
  };

  const handleAnswerFinished = (blob: Blob, durationMs: number) => {
    const currentSub = subIndexRef.current;
    setPhase('submitting');
    onSubmit(blob, durationMs, currentSub);

    if (currentSub + 1 < item.questionCount) {
      const nextSub = currentSub + 1;
      setSubIndex(nextSub);
      subIndexRef.current = nextSub;
      setTimeout(() => {
        startQuestion(nextSub);
      }, 600);
    }
  };

  const handleDoneSpeaking = async () => {
    if (phase !== 'speaking') return;
    setPhase('submitting');
    const result = await stopRecording();
    if (result) {
      handleAnswerFinished(result.blob, result.durationMs);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl mx-auto">
      <div className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col items-center text-center">
        {/* Status header */}
        <div className="mb-6 flex flex-col items-center gap-2">
          {phase === 'listening_story' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50">
                <Volume2 className="w-8 h-8 animate-pulse" />
              </div>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {isPlaying ? 'Listening to Passage...' : 'Passage Ready'}
              </span>
              <span className="text-xs text-zinc-400">
                Listen carefully. Three short comprehension questions will follow.
              </span>
            </>
          ) : phase === 'listening_question' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-200 dark:border-amber-900/50">
                <Volume2 className="w-8 h-8 animate-pulse" />
              </div>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Listening to Question {subIndex + 1} of {item.questionCount}...
              </span>
              <Badge variant="purple" size="sm">Question {subIndex + 1} of {item.questionCount}</Badge>
            </>
          ) : phase === 'speaking' ? (
            <>
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-200 dark:border-red-900/50 animate-pulse">
                <Mic className="w-8 h-8" />
              </div>
              <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Recording Your Answer Now
              </span>
              <span className="text-xs text-zinc-400">Answer in a few clear words, then click Done Speaking.</span>
              <Badge variant="accent" size="sm">Question {subIndex + 1} of {item.questionCount}</Badge>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-zinc-50 dark:bg-zinc-800 text-zinc-600 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <span className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Saving answer {subIndex + 1}...
              </span>
            </>
          )}
        </div>

        {/* Story Card Display */}
        {storyText && phase === 'listening_story' && (
          <div className="w-full text-left p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 my-2">
            <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">
              Passage Scenario
            </span>
            <p className="text-sm font-medium leading-relaxed text-zinc-800 dark:text-zinc-200">
              "{storyText}"
            </p>
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSkipStoryToQuestion}
                className="text-xs"
              >
                Proceed to Questions
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* Question Card Display */}
        {(phase === 'listening_question' || phase === 'speaking') && questionText && (
          <div className="w-full text-left p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/40 my-2">
            <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider block mb-1">
              Question {subIndex + 1}
            </span>
            <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              "{questionText}"
            </p>
            {phase === 'listening_question' && (
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={handleSkipQuestionToSpeaking}
                  className="text-xs"
                >
                  Start Answering Now
                  <Mic className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Recording Waveform Meter */}
        <div className="w-full max-w-sm my-4">
          <WaveformMeter level={audioLevel} isRecording={isRecording} />
        </div>

        {/* Action Button */}
        {phase === 'speaking' && (
          <Button
            type="button"
            onClick={handleDoneSpeaking}
            variant="danger"
            size="md"
            className="mt-2"
          >
            <Square className="w-4 h-4 mr-1.5 fill-current" />
            Done Speaking (Submit Answer)
          </Button>
        )}
      </div>
    </div>
  );
}
