import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Shield,
  Zap,
  CheckCircle,
  Clock,
  Sparkles,
  Volume2,
  Mic,
  FileText,
  Layers,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Button } from '../components/common/Button.tsx';
import { Badge } from '../components/common/Badge.tsx';
import { PARTS, PART_META, DISCLAIMER } from '@fluentpath/shared';
import { useAuthStore } from '../store/useAuthStore.ts';
import { api } from '../lib/api.ts';

export function LandingPage() {
  const navigate = useNavigate();
  const { user, loginGuest } = useAuthStore();
  const [starting, setStarting] = React.useState(false);
  const [selectedLevel, setSelectedLevel] = React.useState<'easy' | 'medium' | 'hard'>('medium');

  const handleStartFullTest = async () => {
    setStarting(true);
    try {
      if (!user) {
        await loginGuest();
      }
      const session = await api.createSession({ mode: 'full', level: selectedLevel });
      navigate(`/test/${session.sessionId}`);
    } catch (err: any) {
      console.error('Failed to start test:', err);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background ambient glow matching Framer inspiration */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] ambient-glow pointer-events-none -z-10" />

      {/* Hero Section */}
      <section className="pt-16 sm:pt-24 pb-16 px-4 max-w-5xl mx-auto text-center flex flex-col items-center">
        {/* Pill Tag */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 dark:bg-zinc-800/90 border border-purple-200/60 dark:border-purple-900/50 shadow-sm mb-8 text-xs font-medium text-zinc-800 dark:text-zinc-200"
        >
          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="font-semibold text-purple-700 dark:text-purple-300">New</span>
          <span className="text-zinc-400">|</span>
          <span>10-Part Assessment Practice Engine</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl font-bold tracking-tight text-zinc-950 dark:text-white max-w-3xl leading-[1.12]"
        >
          Speak with confidence. Score with precision.
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-lg sm:text-xl text-zinc-600 dark:text-zinc-400 max-w-2xl leading-relaxed"
        >
          Faithful 10-part assessment format in the style of Pearson Versant. Timed tasks, play-once listening, speech metrics, and honest estimated GSE 10–90 & CEFR bands.
        </motion.p>

        {/* Difficulty Level Selector */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          className="mt-6 flex flex-col items-center gap-2"
        >
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Select Difficulty Level
          </span>
          <div className="flex flex-wrap items-center justify-center p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 shadow-sm gap-1">
            {[
              { id: 'easy', label: 'Easy', sub: 'Foundational • A2–B1' },
              { id: 'medium', label: 'Medium (Default)', sub: 'Standard Versant • B1–B2' },
              { id: 'hard', label: 'Hard', sub: 'Executive / Advanced • B2–C1' },
            ].map((lvl) => {
              const active = selectedLevel === lvl.id;
              return (
                <button
                  key={lvl.id}
                  type="button"
                  onClick={() => setSelectedLevel(lvl.id as any)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex flex-col items-center ${
                    active
                      ? 'bg-white dark:bg-zinc-900 text-indigo-600 dark:text-indigo-400 shadow-card font-bold scale-[1.02]'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  <span>{lvl.label}</span>
                  <span className="text-[10px] opacity-70 font-normal">{lvl.sub}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto"
        >
          <Button
            onClick={handleStartFullTest}
            disabled={starting}
            size="lg"
            className="w-full sm:w-auto px-8 shadow-floating"
          >
            {starting ? 'Starting Test...' : 'Take Full Practice Test'}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>

          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button variant="secondary" size="lg" className="w-full">
              Practice a Single Part
            </Button>
          </Link>
        </motion.div>

        {/* Honest Accuracy Notice */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-6 text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto flex items-center justify-center gap-1.5"
        >
          <Shield className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
          <span>{DISCLAIMER} Zero paid APIs. Fully private.</span>
        </motion.div>

        {/* Floating UI Hero Card inspired by attached screenshot */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mt-14 w-full p-4 sm:p-8 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-xl rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-floating grid grid-cols-1 md:grid-cols-3 gap-4 text-left"
        >
          <div className="p-5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Estimated Score</span>
                <Badge variant="purple" size="sm">GSE Scale</Badge>
              </div>
              <div className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-baseline gap-2">
                68 <span className="text-sm font-normal text-zinc-500">± 5 pts</span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">CEFR Band: B2 (Upper Intermediate)</p>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-200/60 dark:border-zinc-700/60 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <Check className="w-3.5 h-3.5" /> Target Role Qualified (58+ required)
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Skill Breakdown</span>
              <Badge variant="neutral" size="sm">4 Core Skills</Badge>
            </div>
            <div className="space-y-2">
              {[
                { name: 'Speaking', score: 66, color: 'bg-indigo-500' },
                { name: 'Listening', score: 71, color: 'bg-emerald-500' },
                { name: 'Writing', score: 64, color: 'bg-purple-500' },
                { name: 'Reading', score: 73, color: 'bg-blue-500' },
              ].map((s) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <span className="text-zinc-600 dark:text-zinc-400">{s.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-zinc-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden">
                      <div className={`h-full ${s.color}`} style={{ width: `${s.score}%` }} />
                    </div>
                    <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">{s.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-200/60 dark:border-zinc-700/60 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Speech Metrics</span>
                <Badge variant="accent" size="sm">Speech-to-Text</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50">
                  <span className="text-zinc-400 block text-[10px]">Pace (WPM)</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">142</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50">
                  <span className="text-zinc-400 block text-[10px]">Pause Ratio</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">18%</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50">
                  <span className="text-zinc-400 block text-[10px]">Long Pauses</span>
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">0</span>
                </div>
                <div className="p-2 rounded-xl bg-white dark:bg-zinc-800/80 border border-zinc-200/50 dark:border-zinc-700/50">
                  <span className="text-zinc-400 block text-[10px]">Fluency</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">92%</span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-zinc-400 mt-3">Whisper word-level timestamps & fluency curve.</p>
          </div>
        </motion.div>
      </section>

      {/* 10 Assessment Parts Grid */}
      <section className="py-16 px-4 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="purple" size="sm" className="mb-3">
            Full 10-Part Assessment
          </Badge>
          <h2 className="text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
            Everything Tested, Part by Part
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 max-w-xl mx-auto">
            Practice individual tasks or run the complete authentic sequence from Part A to Part J.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {PARTS.map((p) => {
            const meta = PART_META[p];
            const isSpeaking = meta.speaking;
            const isListening = meta.listening;

            return (
              <Link
                key={p}
                to={`/test/practice/${p}`}
                className="group p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 hover:border-indigo-400 dark:hover:border-indigo-600 transition-all shadow-sm hover:shadow-card flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs font-bold flex items-center justify-center text-zinc-800 dark:text-zinc-200 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      {p}
                    </span>
                    <span className="text-[11px] font-medium text-zinc-400">
                      {meta.timeLabel}
                    </span>
                  </div>

                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {meta.name}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                    {meta.task}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
                  <span className="capitalize">{meta.skill}</span>
                  <div className="flex items-center gap-1.5 text-zinc-500">
                    {isListening && <Volume2 className="w-3 h-3" />}
                    {isSpeaking && <Mic className="w-3 h-3" />}
                    {!isListening && !isSpeaking && <FileText className="w-3 h-3" />}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-zinc-200/80 dark:border-zinc-800 mt-16 px-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
        <p className="max-w-xl mx-auto mb-2">
          FluentPath is an independent educational tool. Not affiliated with or endorsed by Pearson PLC or the Versant brand.
        </p>
        <p>© 2026 FluentPath. Built for ambitious job candidates and test takers.</p>
      </footer>
    </div>
  );
}
