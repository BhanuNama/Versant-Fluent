import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  Volume2,
  AlertCircle,
  ArrowRight,
  Play,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '../components/common/Button.tsx';
import { TimerRing } from '../components/common/TimerRing.tsx';
import { PartStepper } from '../components/common/PartStepper.tsx';
import { TaskCard } from '../components/tasks/TaskCard.tsx';
import { WaveformMeter } from '../components/common/WaveformMeter.tsx';
import { PART_META, itemLimitSec, type PartId } from '@fluentpath/shared';
import { useTestStore } from '../store/useTestStore.ts';
import { useRecorder } from '../hooks/useRecorder.ts';
import { stopAllSpeech } from '../hooks/usePlayOnce.ts';
import { fadeSlideVariants } from '../lib/motion.ts';
import { api } from '../lib/api.ts';

export function TestRunnerPage() {
  const { sessionId, partId } = useParams();
  const navigate = useNavigate();
  const {
    session,
    currentItemIndex,
    setCurrentItemIndex,
    fetchSessionState,
    setSession,
    reset,
  } = useTestStore();

  const [machineState, setMachineState] = useState<'mic_check' | 'intro_part' | 'in_item'>('mic_check');
  const [micAudioUrl, setMicAudioUrl] = useState<string | null>(null);
  const [isPlayingTestAudio, setIsPlayingTestAudio] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load session state once on mount; cleanly cancel any speech on unmount
  useEffect(() => {
    if (sessionId) {
      fetchSessionState(sessionId);
    }
    return () => {
      stopAllSpeech();
      reset();
    };
  }, [sessionId]);

  const currentPart: PartId = (session?.part || (partId as PartId) || 'A') as PartId;
  const meta = PART_META[currentPart];
  const currentItem = session?.items ? session.items[currentItemIndex] : undefined;
  const limitSec = currentItem ? itemLimitSec(currentItem.part) : 25;

  // Dedicated, stable item countdown timer
  const [secondsRemaining, setSecondsRemaining] = useState<number>(limitSec);
  const timerIntervalRef = useRef<number | null>(null);

  // Initialize and reset timer whenever current item changes or entering in_item
  useEffect(() => {
    if (machineState !== 'in_item' || !currentItem || !session) return;

    // Reset countdown for this item
    const totalSec = itemLimitSec(currentItem.part);
    setSecondsRemaining(totalSec);

    // Notify server of timer start (without resetting local state)
    api.startItemTimer(session.sessionId, { itemId: currentItem.id }).catch(() => {});

    // Clear any previous timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    timerIntervalRef.current = window.setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [machineState, currentItem?.id, session?.sessionId]);

  const advanceToNext = useCallback(async () => {
    stopAllSpeech();
    if (!session) return;

    if (currentItemIndex + 1 < session.items.length) {
      setCurrentItemIndex(currentItemIndex + 1);
    } else {
      // Part complete! Advance to next part or submit
      const nextState = await api.advancePart(session.sessionId);
      if (nextState.status === 'grading') {
        stopAllSpeech();
        navigate(`/evaluating/${session.sessionId}`);
        return;
      }
      setSession(nextState);
      setMachineState('intro_part');
    }
  }, [session, currentItemIndex, setCurrentItemIndex, setSession, navigate]);

  // Advance to next item or next part (guarded against double-clicks/timer overlap)
  const handleNextItem = useCallback(async () => {
    if (!session || submitting) return;
    setSubmitting(true);
    try {
      await advanceToNext();
    } finally {
      setSubmitting(false);
    }
  }, [session, submitting, advanceToNext]);

  // Auto-advance when countdown reaches 0
  useEffect(() => {
    if (machineState === 'in_item' && secondsRemaining === 0 && !submitting) {
      handleNextItem();
    }
  }, [secondsRemaining, machineState, submitting, handleNextItem]);

  // Submit Text Answer
  const handleTextSubmit = async (data: {
    itemId: string;
    sub?: number | null;
    text?: string;
    choice?: number;
    choices?: number[];
    integrity?: { pasted: boolean; pasteChars: number };
  }) => {
    if (!session || submitting) return;
    setSubmitting(true);

    try {
      await api.submitTextAnswer(session.sessionId, data);
      await advanceToNext();
    } catch (err: any) {
      console.error('Submit error:', err);
      await advanceToNext();
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Audio Answer
  const handleAudioSubmit = async (data: {
    itemId: string;
    sub?: number | null;
    blob: Blob;
    durationMs: number;
  }) => {
    if (!session || submitting) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      formData.append('itemId', data.itemId);
      if (data.sub !== undefined && data.sub !== null) {
        formData.append('sub', String(data.sub));
      }
      formData.append('durationMs', String(data.durationMs));
      formData.append('mimeType', data.blob.type || 'audio/webm');
      formData.append('audio', data.blob, 'answer.webm');

      await api.submitAudioAnswer(session.sessionId, formData);

      // In Part G (multiple questions for one item), only advance when last question is done
      if (currentItem?.part === 'G') {
        const totalQ = currentItem.questionCount;
        if (data.sub !== null && data.sub !== undefined && data.sub + 1 < totalQ) {
          return; // wait for next sub-question
        }
      }

      await advanceToNext();
    } catch (err: any) {
      console.error('Submit audio error:', err);
      await advanceToNext();
    } finally {
      setSubmitting(false);
    }
  };

  // Recorder for Mic Check
  const { isRecording, audioLevel, requestPermission, startRecording, stopRecording, permission } = useRecorder({
    maxDurationSec: 4,
    onAutoStop: (blob) => {
      const url = URL.createObjectURL(blob);
      setMicAudioUrl(url);
    },
  });

  const handleStartMicCheck = async () => {
    setMicAudioUrl(null);
    const ok = await requestPermission();
    if (ok) {
      await startRecording();
    }
  };

  const handlePlayTestAudio = () => {
    if (!micAudioUrl) return;
    const a = new Audio(micAudioUrl);
    setIsPlayingTestAudio(true);
    a.onended = () => setIsPlayingTestAudio(false);
    a.play();
  };

  /* ---------------- State 1: Microphone & Audio Check ---------------- */
  if (machineState === 'mic_check') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          variants={fadeSlideVariants}
          initial="initial"
          animate="animate"
          className="w-full max-w-lg p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card text-center"
        >
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4 border border-indigo-100 dark:border-indigo-900/50">
            <Mic className="w-7 h-7" />
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Microphone & Audio Check
          </h2>
          <p className="text-sm text-zinc-500 mt-1 mb-6">
            Ensure your microphone is clear and working properly before entering the timed exam.
          </p>

          <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 mb-6">
            <WaveformMeter level={audioLevel} isRecording={isRecording} className="mb-4" />

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {!isRecording && !micAudioUrl && (
                <Button onClick={handleStartMicCheck} size="md">
                  <Mic className="w-4 h-4 mr-2" />
                  Test Microphone (Record 3s)
                </Button>
              )}

              {isRecording && (
                <span className="text-sm font-semibold text-red-600 dark:text-red-400 animate-pulse">
                  Recording test audio... Say "Hello, checking audio"
                </span>
              )}

              {micAudioUrl && !isRecording && (
                <div className="flex items-center gap-2">
                  <Button onClick={handlePlayTestAudio} disabled={isPlayingTestAudio} variant="secondary" size="md">
                    <Play className="w-4 h-4 mr-1.5" />
                    {isPlayingTestAudio ? 'Playing...' : 'Play Back'}
                  </Button>
                  <Button onClick={handleStartMicCheck} variant="ghost" size="md">
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Record Again
                  </Button>
                </div>
              )}
            </div>

            {permission === 'denied' && (
              <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-xs text-red-600 dark:text-red-400 flex items-center gap-2 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Microphone access was blocked. Please enable microphone permissions in your browser address bar to continue.</span>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Exit to Dashboard
            </button>

            <Button
              onClick={() => setMachineState('intro_part')}
              disabled={isRecording}
              size="md"
            >
              Microphone Sounds Good
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ---------------- State 2: Part Intro ---------------- */
  if (machineState === 'intro_part') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          variants={fadeSlideVariants}
          initial="initial"
          animate="animate"
          className="w-full max-w-xl p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card text-center"
        >
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center mx-auto mb-4 font-bold text-lg">
            {currentPart}
          </div>

          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Part {currentPart}: {meta?.name}
          </h2>
          <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400 mt-1 capitalize">
            {meta?.skill} Assessment • {meta?.timeLabel}
          </p>

          <div className="p-6 my-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 text-left">
            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Instructions</h4>
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {meta?.instructions}
            </p>
          </div>

          <div className="flex justify-between items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
              Exit Test
            </button>

            <Button onClick={() => setMachineState('in_item')} size="lg">
              Begin Part {currentPart}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  /* ---------------- State 3: Active Item Runner ---------------- */
  return (
    <div className="min-h-screen flex flex-col justify-between">
      {/* Slim Top Bar */}
      <header className="px-4 py-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                if (confirm('Are you sure you want to exit the practice test?')) {
                  stopAllSpeech();
                  navigate('/dashboard');
                }
              }}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Exit Test"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex flex-col">
              <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                Part {currentPart}: {meta?.name}
              </span>
              <span className="text-xs text-zinc-400">
                Item {currentItemIndex + 1} of {session?.items.length || 1}
              </span>
            </div>
          </div>

          {/* Stepper on desktop */}
          <div className="hidden md:block">
            <PartStepper activePart={currentPart} parts={session?.parts} />
          </div>

          {/* Timer Ring */}
          <div className="flex items-center gap-3">
            <TimerRing
              seconds={secondsRemaining}
              totalSeconds={limitSec}
              size={44}
              strokeWidth={3.5}
            />
          </div>
        </div>
      </header>

      {/* Main Task Area */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <AnimatePresence mode="wait">
          {currentItem && (
            <motion.div
              key={currentItem.id}
              variants={fadeSlideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full"
            >
              <TaskCard
                sessionId={session!.sessionId}
                item={currentItem}
                onTextSubmit={handleTextSubmit}
                onAudioSubmit={handleAudioSubmit}
                disabled={submitting}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Slim bottom footer */}
      <footer className="py-2.5 px-4 text-center text-[11px] text-zinc-400 border-t border-zinc-100 dark:border-zinc-800/60">
        Answers are autosaved securely. Auto-advance occurs when the timer ends.
      </footer>
    </div>
  );
}
