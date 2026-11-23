import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
} from 'lucide-react';
import { Button } from '../components/common/Button.tsx';
import { Badge } from '../components/common/Badge.tsx';
import { PARTS, PART_META, type PartId, type HistoryEntry } from '@fluentpath/shared';
import { useAuthStore } from '../store/useAuthStore.ts';
import { api } from '../lib/api.ts';

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, initialized, loginGuest } = useAuthStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<'easy' | 'medium' | 'hard'>('medium');

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

  const handleStartFull = async () => {
    setStarting(true);
    try {
      if (!user) {
        await loginGuest();
      }
      const session = await api.createSession({ mode: 'full', level: selectedLevel });
      navigate(`/test/${session.sessionId}`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

  const handleStartPractice = async (part: PartId) => {
    setStarting(true);
    try {
      if (!user) {
        await loginGuest();
      }
      const session = await api.createSession({ mode: 'part', part, level: selectedLevel });
      navigate(`/test/${session.sessionId}`);
    } catch (err: any) {
      console.error(err);
    } finally {
      setStarting(false);
    }
  };

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

      {/* Practice by Part Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
              Practice by Specific Part
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Focus on specific skills or rehearse individual timed tasks.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {PARTS.map((p) => {
            const meta = PART_META[p];
            return (
              <div
                key={p}
                className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm flex flex-col justify-between group hover:border-zinc-400 transition-colors"
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

                <Button
                  onClick={() => handleStartPractice(p)}
                  disabled={starting}
                  variant="secondary"
                  size="sm"
                  className="mt-4 w-full text-xs"
                >
                  Practice Part {p}
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
