import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, CheckCircle2, Sparkles, Mic, FileText, Check } from 'lucide-react';
import type { GradingProgress } from '@fluentpath/shared';
import { stopAllSpeech } from '../hooks/usePlayOnce.ts';
import { api, apiUrl } from '../lib/api.ts';

export function EvaluatingPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [progress, setProgress] = useState<GradingProgress>({
    status: 'grading',
    total: 0,
    done: 0,
    stage: 'transcribing',
  });

  useEffect(() => {
    stopAllSpeech();
    if (!sessionId) return;

    let cancelled = false;
    let pollInterval: number | null = null;
    const eventSource = new EventSource(apiUrl(`/api/sessions/${sessionId}/events`), {
      withCredentials: true,
    });

    const checkResultNow = async () => {
      if (cancelled) return;
      try {
        const res = await api.getResult(sessionId);
        if (res.status === 'complete' && !cancelled) {
          cancelled = true;
          if (pollInterval !== null) clearInterval(pollInterval);
          eventSource.close();
          setProgress((p) => ({ ...p, status: 'complete', stage: 'done' }));
          setTimeout(() => {
            navigate(`/results/${sessionId}`, { replace: true });
          }, 300);
        }
      } catch {
        // still grading or waiting
      }
    };

    // Always run an immediate check + 1.5s backup polling alongside SSE
    // so instant parts and cross-origin Bearer-token sessions never stall
    checkResultNow();
    pollInterval = window.setInterval(checkResultNow, 1500);

    eventSource.onmessage = (event) => {
      try {
        const data: GradingProgress = JSON.parse(event.data);
        if (!cancelled) setProgress(data);

        if (data.status === 'complete' && !cancelled) {
          cancelled = true;
          eventSource.close();
          if (pollInterval !== null) clearInterval(pollInterval);
          setTimeout(() => {
            navigate(`/results/${sessionId}`, { replace: true });
          }, 400);
        }
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      cancelled = true;
      eventSource.close();
      if (pollInterval !== null) {
        clearInterval(pollInterval);
      }
    };
  }, [sessionId, navigate]);

  const stages = [
    { id: 'transcribing', label: 'Transcribing speech recordings & calculating speech rate', icon: Mic },
    { id: 'grammar', label: 'Analyzing grammar accuracy, word count & idea checklists', icon: FileText },
    { id: 'scoring', label: 'Ensemble LLM rubric judging & CEFR descriptor mapping', icon: Sparkles },
    { id: 'finalizing', label: 'Calculating Rasch ability estimates & GSE scale scores', icon: Check },
  ];

  const stageOrder = ['transcribing', 'grammar', 'scoring', 'finalizing', 'done'];
  const currentIdx = stageOrder.indexOf(progress.stage);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg p-8 sm:p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-floating text-center"
      >
        <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-6 border border-indigo-100 dark:border-indigo-900/50 shadow-sm">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>

        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Evaluating Your Performance
        </h2>
        <p className="text-sm text-zinc-500 mt-1 mb-8">
          Our scoring engine is processing your answers, speech metrics, and writing rubrics.
        </p>

        {/* Step list */}
        <div className="space-y-4 text-left p-6 rounded-2xl bg-zinc-50/70 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 mb-6">
          {stages.map((st, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const Icon = st.icon;

            return (
              <div key={st.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 animate-spin" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700" />
                  )}
                </div>
                <span
                  className={`text-xs ${
                    isCurrent
                      ? 'font-semibold text-zinc-900 dark:text-zinc-100'
                      : isCompleted
                      ? 'text-zinc-700 dark:text-zinc-300'
                      : 'text-zinc-400'
                  }`}
                >
                  {st.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-zinc-400">
          Evaluations typically complete within 10 to 30 seconds.
        </div>
      </motion.div>
    </div>
  );
}
