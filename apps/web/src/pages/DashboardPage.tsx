import React, { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  Target,
  Trophy,
  BarChart2,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Volume2,
  Mic,
  FileText,
  SlidersHorizontal,
  Play,
  Minus,
  Plus,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../components/common/Button.tsx';
import { Badge } from '../components/common/Badge.tsx';
import { PARTS, PART_META, itemLimitSec, type PartId, type HistoryEntry } from '@fluentpath/shared';
import { useAuthStore } from '../store/useAuthStore.ts';
import { api } from '../lib/api.ts';

export function DashboardPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, initialized, loginGuest } = useAuthStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<'easy' | 'medium' | 'hard'>('medium');

  const paramPart = searchParams.get('part')?.toUpperCase() as PartId | undefined;
  const initialPart: PartId = paramPart && PARTS.includes(paramPart) ? paramPart : 'A';
  const [sectionPart, setSectionPart] = useState<PartId>(initialPart);
  const [questionCount, setQuestionCount] = useState<number>(PART_META[initialPart].practiceCount);

  useEffect(() => {
    if (paramPart && PARTS.includes(paramPart)) {
      setSectionPart(paramPart);
      setQuestionCount(PART_META[paramPart].practiceCount);
    }
  }, [paramPart]);

  useEffect(() => {
    if (!initialized || !user) {
      if (initialized) setLoading(false);
      return;
    }
    Promise.all([api.getHistory(), api.getProgress()])
      .then(([hRes, pRes]) => {
        setHistory(hRes.history);
        setProgress(pRes);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [initialized, user]);

  const handleSelectSection = (part: PartId) => {
    setSectionPart(part);
    setQuestionCount(PART_META[part].practiceCount);
  };

  const handleStartFull = async () => {
    setStarting(true);
    setStartError(null);
    try {
      if (!user) {
        await loginGuest();
      }
      const session = await api.createSession({ mode: 'full', level: selectedLevel });
      navigate(`/test/${session.sessionId}`);
    } catch (err: any) {
      setStartError(err.message || 'Could not start session. Please try again.');
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  const handleStartPractice = async (part: PartId, count?: number) => {
    setStarting(true);
    setStartError(null);
    try {
      if (!user) {
        await loginGuest();
      }
      const session = await api.createSession({
        mode: 'part',
        part,
        level: selectedLevel,
        questionCount: count,
      });
      navigate(`/test/${session.sessionId}`);
    } catch (err: any) {
      setStartError(err.message || 'Could not start section test. Please try again.');
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  const activeSectionMeta = PART_META[sectionPart];
  const estMinutes = Math.max(1, Math.ceil((questionCount * itemLimitSec(sectionPart)) / 60));
  const totalSectionMarks = sectionPart === 'G' ? questionCount * 3 : questionCount;

  const targetScore = user?.targetScore || 58;
  const currentGse = progress?.currentGse || (history.length > 0 ? history[0].gse : null);
  const gap = currentGse !== null ? currentGse - targetScore : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-zinc-200/80 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Welcome, {user?.name || 'Candidate'}
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Prepare for company communication screening with realistic AI-graded tasks.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Level Switcher */}
          <div className="flex items-center p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs">
            {[
              { id: 'easy', label: 'Easy' },
              { id: 'medium', label: 'Medium' },
              { id: 'hard', label: 'Hard' },
            ].map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                onClick={() => setSelectedLevel(lvl.id as any)}
                className={`px-3 py-1.5 rounded-xl font-semibold transition-all ${
                  selectedLevel === lvl.id
                    ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {lvl.label}
              </button>
            ))}
          </div>

          <Button onClick={handleStartFull} disabled={starting} size="md" className="shadow-card">
            <Sparkles className="w-4 h-4 mr-1.5 text-indigo-400" />
            {starting ? 'Starting...' : `Start Full Test (${selectedLevel})`}
          </Button>
        </div>
      </div>

      {/* Target Cutoff & Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Cutoff Card */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4 text-indigo-500" /> Target Cutoff
              </span>
              <Link to="/settings" className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
                Edit Cutoff
              </Link>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                {targetScore}
              </span>
              <span className="text-xs text-zinc-500">GSE points required</span>
            </div>
            <p className="text-xs text-zinc-400 mt-1">Profile: {user?.targetProfile || 'Customer / Voice Role'}</p>
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            {gap !== null ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Gap to Target:</span>
                <span className={`font-bold ${gap >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                  {gap >= 0 ? `+${gap} (Met Target)` : `${gap} pts needed`}
                </span>
              </div>
            ) : (
              <span className="text-xs text-zinc-400">Take a test to see your target gap.</span>
            )}
          </div>
        </div>

        {/* Latest Result Card */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Trophy className="w-4 h-4 text-amber-500" /> Latest Score
              </span>
              <Link to="/history" className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300">
                View History
              </Link>
            </div>

            {currentGse !== null ? (
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {currentGse}
                  </span>
                  <span className="text-xs text-zinc-500">GSE Estimate</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="purple" size="sm">
                    {history[0]?.cefr || 'B1'} Band
                  </Badge>
                  <span className="text-xs text-zinc-400">Practice result</span>
                </div>
              </div>
            ) : (
              <div className="py-2 text-sm text-zinc-500">
                No tests completed yet. Start your first session!
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-400">
            {history.length} completed session{history.length === 1 ? '' : 's'} recorded.
          </div>
        </div>

        {/* Skill Overview Card */}
        <div className="p-6 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4 text-purple-500" /> Skills Average
            </span>
          </div>

          <div className="space-y-2.5">
            {['Reading', 'Writing', 'Listening', 'Speaking'].map((sk) => {
              const val = progress?.skillAverages?.[sk.toLowerCase()] || 0;
              return (
                <div key={sk} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">{sk}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${val}%` }} />
                    </div>
                    <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200 w-6 text-right">
                      {val || '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section-Specific Custom Test Builder */}
      <div
        id="section-test"
        className="p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-indigo-200/70 dark:border-indigo-900/50 shadow-card space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Custom Section Test
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
              Choose Section, Questions & Difficulty
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Target any single part with your preferred question count and level — scored with exact marks, percentage, and GSE.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="purple" size="sm">
              {totalSectionMarks} {totalSectionMarks === 1 ? 'Mark' : 'Marks'}
            </Badge>
            <Badge variant="neutral" size="sm">
              <Clock className="w-3 h-3 mr-1" />~{estMinutes} min
            </Badge>
          </div>
        </div>

        {/* Step 1: Pick Section */}
        <div className="space-y-2.5">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
            1. Select Section (Part A – J)
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
            {PARTS.map((p) => {
              const m = PART_META[p];
              const active = sectionPart === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSelectSection(p)}
                  className={`p-2.5 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    active
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : 'border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/40 hover:border-zinc-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                        active
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      {p}
                    </span>
                    <span className="text-[10px] capitalize text-zinc-400">{m.skill}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-zinc-900 dark:text-zinc-100 leading-tight line-clamp-2">
                    {m.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Section Info */}
        <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Part {sectionPart}: {activeSectionMeta.name}
              </span>
              <Badge variant="neutral" size="sm" className="capitalize">
                {activeSectionMeta.skill}
              </Badge>
            </div>
            <p className="text-xs text-zinc-500 mt-1">{activeSectionMeta.instructions}</p>
          </div>
          <span className="text-xs font-medium text-zinc-500 shrink-0">
            {activeSectionMeta.timeLabel}
          </span>
        </div>

        {/* Step 2 & 3: Number of Questions + Difficulty + GO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-end">
          {/* Number of Questions */}
          <div className="lg:col-span-5 space-y-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
              2. Number of Questions {sectionPart === 'G' ? '(Passages × 3 Qs)' : ''}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {[1, 3, 5, 8, 10, 15].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQuestionCount(n)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    questionCount === n
                      ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-white dark:text-zinc-900 dark:border-white shadow-sm'
                      : 'bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700 hover:border-zinc-400'
                  }`}
                >
                  {n}
                </button>
              ))}

              {/* Custom numeric stepper */}
              <div className="inline-flex items-center rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setQuestionCount((c) => Math.max(1, c - 1))}
                  className="px-2.5 py-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700"
                  aria-label="Decrease question count"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={questionCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!Number.isNaN(val)) {
                      setQuestionCount(Math.max(1, Math.min(20, val)));
                    }
                  }}
                  className="w-11 text-center text-xs font-bold bg-transparent focus:outline-none tabular-nums text-zinc-900 dark:text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => setQuestionCount((c) => Math.min(20, c + 1))}
                  className="px-2.5 py-2 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700"
                  aria-label="Increase question count"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Difficulty */}
          <div className="lg:col-span-4 space-y-2">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block">
              3. Difficulty Level
            </span>
            <div className="grid grid-cols-3 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 text-xs">
              {[
                { id: 'easy', label: 'Easy', sub: 'A2–B1' },
                { id: 'medium', label: 'Medium', sub: 'B1–B2' },
                { id: 'hard', label: 'Hard', sub: 'B2–C1' },
              ].map((lvl) => (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setSelectedLevel(lvl.id as any)}
                  className={`py-1.5 px-2 rounded-xl font-semibold transition-all flex flex-col items-center ${
                    selectedLevel === lvl.id
                      ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <span>{lvl.label}</span>
                  <span className="text-[10px] opacity-70 font-normal">{lvl.sub}</span>
                </button>
              ))}
            </div>
          </div>

          {/* GO CTA */}
          <div className="lg:col-span-3">
            <Button
              onClick={() => handleStartPractice(sectionPart, questionCount)}
              disabled={starting}
              size="lg"
              className="w-full shadow-floating"
            >
              <Play className="w-4 h-4 mr-2 fill-current" />
              {starting ? 'Generating Test...' : `GO — Start (${questionCount})`}
            </Button>
          </div>
        </div>

        {startError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{startError}</span>
          </div>
        )}
      </div>

      {/* Practice by Part Grid */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              All 10 Assessment Parts
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Quick-select any section above or launch directly with {selectedLevel} difficulty.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {PARTS.map((p) => {
            const meta = PART_META[p];
            const isSelected = sectionPart === p;
            return (
              <div
                key={p}
                className={`p-5 bg-white dark:bg-zinc-900 rounded-2xl border shadow-sm flex flex-col justify-between group transition-colors ${
                  isSelected
                    ? 'border-indigo-500 dark:border-indigo-500 ring-1 ring-indigo-500/20'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-400'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold flex items-center justify-center text-zinc-800 dark:text-zinc-200">
                      {p}
                    </span>
                    <span className="text-[11px] text-zinc-400">{meta.timeLabel}</span>
                  </div>
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                    {meta.name}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">
                    {meta.task}
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <Button
                    onClick={() => handleSelectSection(p)}
                    variant={isSelected ? 'primary' : 'secondary'}
                    size="sm"
                    className="flex-1 text-xs"
                  >
                    {isSelected ? 'Selected' : 'Configure'}
                  </Button>
                  <Button
                    onClick={() => handleStartPractice(p, meta.practiceCount)}
                    disabled={starting}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2.5"
                    title={`Quick start Part ${p} (${meta.practiceCount} questions, ${selectedLevel})`}
                  >
                    GO
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
