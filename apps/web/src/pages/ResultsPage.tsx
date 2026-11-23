import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Trophy,
  Shield,
  ArrowRight,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  Volume2,
  Mic,
  FileText,
  RotateCcw,
  Sparkles,
  Info,
} from 'lucide-react';
import { Button } from '../components/common/Button.tsx';
import { Badge } from '../components/common/Badge.tsx';
import type { SessionResult, Skill, AnswerReview } from '@fluentpath/shared';
import { SKILL_LABEL } from '@fluentpath/shared';
import { stopAllSpeech } from '../hooks/usePlayOnce.ts';
import { api, apiUrl } from '../lib/api.ts';
import { useAuthStore } from '../store/useAuthStore.ts';

export function ResultsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const { user } = useAuthStore();
  const [result, setResult] = useState<SessionResult | null>(null);
  const [displayScore, setDisplayScore] = useState(10);
  const [expandedPart, setExpandedPart] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    stopAllSpeech();
    if (!sessionId) return;
    api.getResult(sessionId)
      .then((data) => {
        setResult(data);
        setLoading(false);
        if (data.parts.length > 0) {
          setExpandedPart(data.parts[0].part);
        }

        // Trigger confetti celebration
        const target = user?.targetScore || 58;
        if (data.overall.gse >= target) {
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.6 },
          });
        }
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [sessionId, user]);

  // Animated count-up over 800ms (Spec 11)
  useEffect(() => {
    if (!result) return;
    const target = result.overall.gse;
    const duration = 800;
    const start = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / duration);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayScore(Math.round(10 + (target - 10) * eased));

      if (progress >= 1) clearInterval(interval);
    }, 16);

    return () => clearInterval(interval);
  }, [result]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-sm text-zinc-500">Loading your evaluation...</div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 text-center max-w-md">
          <p className="text-zinc-700 dark:text-zinc-300 font-medium mb-4">Result not found or still grading.</p>
          <Link to="/dashboard">
            <Button size="md">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { overall, skills, parts, disclaimer, marks, mode, level } = result;
  const primarySection = parts[0];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Result Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="p-8 sm:p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-floating text-center relative overflow-hidden"
      >
        <div className="flex flex-wrap items-center justify-center gap-2 mb-4">
          <Badge variant="purple" size="md">
            {mode === 'part' && primarySection
              ? `Section Test • Part ${primarySection.part}: ${primarySection.name}`
              : 'Practice Estimate'}
          </Badge>
          {level && (
            <Badge variant="neutral" size="md" className="capitalize">
              {level} Level
            </Badge>
          )}
          <Badge variant="neutral" size="md">
            CEFR Level {overall.cefr}
          </Badge>
          <Badge variant="accent" size="md">
            Versant ~{overall.versant} eq.
          </Badge>
        </div>

        {/* Marks + GSE Hero Summary */}
        {marks && marks.total > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto my-6 items-center">
            <div className="p-6 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50">
              <h1 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                {mode === 'part' ? 'Section Marks' : 'Total Marks'}
              </h1>
              <div className="mt-2 flex items-baseline justify-center gap-2">
                <span className="text-5xl font-extrabold tracking-tight tabular-nums text-zinc-950 dark:text-white">
                  {marks.earned}
                </span>
                <span className="text-xl text-zinc-500 font-semibold">
                  / {marks.total}
                </span>
              </div>
              <div className="mt-2 text-sm font-bold text-indigo-700 dark:text-indigo-300">
                {marks.percentage}% Accuracy
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/70 dark:border-zinc-700/60">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Estimated GSE Score
              </h2>
              <div className="mt-2 flex items-baseline justify-center gap-2">
                <span className="text-5xl font-extrabold tracking-tight tabular-nums text-zinc-950 dark:text-white">
                  {displayScore}
                </span>
                <span className="text-base text-zinc-400 font-medium">/ 90</span>
              </div>
              <div className="mt-2 text-xs font-medium text-zinc-500">
                Range: <span className="font-bold text-zinc-800 dark:text-zinc-200">{overall.range[0]} – {overall.range[1]} GSE</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">
              Estimated Overall GSE Score
            </h1>

            <div className="my-4 flex items-baseline justify-center gap-3">
              <span className="text-6xl sm:text-7xl font-extrabold tracking-tight tabular-nums text-zinc-950 dark:text-white">
                {displayScore}
              </span>
              <span className="text-base sm:text-lg text-zinc-400 font-medium">
                / 90
              </span>
            </div>

            {/* Displayed Range Band (Spec 8.6 & 22.3) */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-700/60 text-xs font-medium text-zinc-700 dark:text-zinc-300">
              <span>Estimated Range:</span>
              <span className="font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {overall.range[0]} – {overall.range[1]} GSE
              </span>
              <span className="text-zinc-400 font-normal">
                (±{Math.round((overall.range[1] - overall.range[0]) / 2)} pts)
              </span>
            </div>
          </>
        )}

        <p className="mt-4 text-xs text-zinc-400 max-w-md mx-auto">
          {disclaimer}
        </p>

        {/* Quick action buttons */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/dashboard">
            <Button variant="secondary" size="md">
              <RotateCcw className="w-4 h-4 mr-1.5" />
              Practice Another Test
            </Button>
          </Link>
          <Link to="/history">
            <Button size="md">
              View Analytics & Trends
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </Link>
        </div>
      </motion.div>

      {/* 4 Skill Bars (Spec 8.5) */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card"
      >
        <h2 className="text-lg font-bold tracking-tight text-zinc-950 dark:text-white mb-6">
          Skill Breakdown
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(['reading', 'writing', 'listening', 'speaking'] as Skill[]).map((sk) => {
            const sData = skills[sk];
            const score = sData?.gse ?? 0;
            const cefr = sData?.cefr ?? '—';
            const range = sData?.range ? `${sData.range[0]}–${sData.range[1]}` : '—';

            return (
              <div
                key={sk}
                className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm capitalize text-zinc-900 dark:text-zinc-100">
                      {SKILL_LABEL[sk]}
                    </span>
                    <Badge variant="purple" size="sm" className="text-[10px]">
                      {cefr}
                    </Badge>
                  </div>
                  <div className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {score ? `${score} GSE` : '—'}
                  </div>
                </div>

                <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden mb-2">
                  <div
                    className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-700"
                    style={{ width: `${(score / 90) * 100}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-zinc-400">
                  <span>Confidence Band: {range}</span>
                  <span>CEFR Scale</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Part-by-part detailed feedback & model answers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Part-by-Part Evaluation & Model Answers
          </h2>
          <span className="text-xs text-zinc-400">Click a part to review item answers</span>
        </div>

        {parts.map((p) => {
          const isExpanded = expandedPart === p.part;

          return (
            <div
              key={p.part}
              className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card overflow-hidden transition-all"
            >
              <button
                type="button"
                onClick={() => setExpandedPart(isExpanded ? null : p.part)}
                className="w-full p-6 text-left flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-xl bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-bold flex items-center justify-center">
                    {p.part}
                  </span>
                  <div>
                    <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                      Part {p.part}: {p.name}
                    </h3>
                    <p className="text-xs text-zinc-500 mt-0.5">{p.feedback}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {p.earnedMarks !== undefined && p.totalMarks !== undefined && (
                    <Badge variant="purple" size="sm">
                      {p.earnedMarks} / {p.totalMarks} Marks
                    </Badge>
                  )}
                  <span className="font-bold text-base tabular-nums text-indigo-600 dark:text-indigo-400">
                    {p.score}%
                  </span>
                  <ChevronDown className={`w-5 h-5 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {isExpanded && (
                <div className="p-6 pt-0 border-t border-zinc-100 dark:border-zinc-800 space-y-6">
                  {p.items.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 space-y-4"
                    >
                      <div className="flex items-center justify-between pb-3 border-b border-zinc-200/50 dark:border-zinc-700/50 text-xs">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                          Item {idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          {item.gse && <Badge variant="neutral">{item.gse} GSE</Badge>}
                          <Badge variant={item.score >= 0.7 ? 'success' : item.score >= 0.4 ? 'warning' : 'neutral'}>
                            {Math.round(item.score * 10) / 10} / 1 mark ({Math.round(item.score * 100)}%)
                          </Badge>
                        </div>
                      </div>

                      {/* Prompt */}
                      <div>
                        <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                          Task Prompt
                        </span>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 whitespace-pre-line leading-relaxed">
                          {item.prompt}
                        </p>
                      </div>

                      {/* Candidate response */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block">
                            Your Answer
                          </span>
                          {item.transcript && (
                            <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-100 dark:border-indigo-900/50">
                              Groq Whisper Transcript
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-zinc-900 dark:text-zinc-100 font-mono bg-white dark:bg-zinc-800 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 whitespace-pre-wrap">
                          {item.response || (item.transcript ? item.transcript : 'No response provided')}
                        </p>

                        {/* Candidate Audio Playback for speaking items */}
                        {item.hasAudio && (
                          <div className="mt-3 p-3.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <Mic className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                              <span>Your Spoken Recording</span>
                            </div>
                            <audio
                              controls
                              preload="metadata"
                              src={apiUrl(`/api/audio/answer/${item.answerId}`)}
                              className="w-full h-9 rounded"
                            />
                          </div>
                        )}
                      </div>

                      {/* Word level alignment for Repeat / Dictation */}
                      {item.alignment && (
                        <div>
                          <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
                            Word Comparison
                          </span>
                          <div className="flex flex-wrap gap-1 p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 text-xs">
                            {item.alignment.map((op, opIdx) => {
                              if (op.op === 'ok') {
                                return (
                                  <span key={opIdx} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-medium">
                                    {op.ref}
                                  </span>
                                );
                              }
                              if (op.op === 'sub') {
                                return (
                                  <span key={opIdx} className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 line-through">
                                    {op.ref} ({op.hyp})
                                  </span>
                                );
                              }
                              if (op.op === 'del') {
                                return (
                                  <span key={opIdx} className="px-1.5 py-0.5 rounded bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300 line-through">
                                    {op.ref}
                                  </span>
                                );
                              }
                              return (
                                <span key={opIdx} className="px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                                  +{op.hyp}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Speech metrics if present */}
                      {item.metrics && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="text-zinc-400 block text-[10px]">Speech Rate</span>
                            <span className="font-semibold">{item.metrics.wpm} WPM</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="text-zinc-400 block text-[10px]">Pause Ratio</span>
                            <span className="font-semibold">{Math.round(item.metrics.pauseRatio * 100)}%</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="text-zinc-400 block text-[10px]">Long Pauses</span>
                            <span className="font-semibold">{item.metrics.longPauses}</span>
                          </div>
                          <div className="p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200/50 dark:border-zinc-700/50">
                            <span className="text-zinc-400 block text-[10px]">Fluency</span>
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {Math.round(item.metrics.fluency * 100)}%
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Feedback & tips */}
                      {item.feedback && (
                        <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 text-xs text-indigo-900 dark:text-indigo-200">
                          <span className="font-semibold">Feedback: </span>
                          {item.feedback}
                        </div>
                      )}

                      {item.tips && item.tips.length > 0 && (
                        <ul className="list-disc list-inside text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                          {item.tips.map((t, tIdx) => (
                            <li key={tIdx}>{t}</li>
                          ))}
                        </ul>
                      )}

                      {/* Model answer */}
                      {item.modelAnswer && (
                        <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 text-xs">
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300 block mb-1">
                            Model Answer
                          </span>
                          <p className="text-zinc-800 dark:text-zinc-200 leading-relaxed font-sans">
                            {item.modelAnswer}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
