import React, { useState } from 'react';
import { Target, Shield, Trash2, Moon, Sun, Check, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '../components/common/Button.tsx';
import { Badge } from '../components/common/Badge.tsx';
import { TARGET_PRESETS } from '@fluentpath/shared';
import { useAuthStore } from '../store/useAuthStore.ts';
import { useUiStore } from '../store/useUiStore.ts';
import { api } from '../lib/api.ts';

export function SettingsPage() {
  const { user, setUser, logout } = useAuthStore();
  const { theme, toggleTheme } = useUiStore();

  const [targetScore, setTargetScore] = useState(user?.targetScore || 58);
  const [targetProfile, setTargetProfile] = useState(user?.targetProfile || 'voice');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Official calibration form
  const [officialScore, setOfficialScore] = useState('');
  const [officialScale, setOfficialScale] = useState<'gse' | 'versant'>('versant');
  const [calibSubmitted, setCalibSubmitted] = useState(false);

  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const handleSaveTarget = async () => {
    try {
      const { user: updated } = await api.updateMe({
        targetScore,
        targetProfile,
      });
      setUser(updated);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2000);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleOfficialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(officialScore);
    if (!num) return;

    try {
      await api.submitOfficialScore({
        scale: officialScale,
        score: num,
      });
      setCalibSubmitted(true);
      setOfficialScore('');
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleDeleteData = async () => {
    if (!confirm('Are you sure you want to permanently delete all your practice results and recorded audios? This cannot be undone.')) {
      return;
    }

    setDeleting(true);
    try {
      const res = await api.deleteMyData();
      setDeleteMsg(res.message);
      if (user?.guest) {
        await logout();
      }
    } catch (err: any) {
      setDeleteMsg(err.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
          Settings & Preferences
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Customize target cutoffs, theme appearance, and personal data management.
        </p>
      </div>

      {/* Target Cutoff Goals */}
      <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-500" /> Target Cutoff Score
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Set your target communication score for campus placements or company screening cutoffs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TARGET_PRESETS.map((preset) => {
            const isSelected = targetProfile === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setTargetProfile(preset.id);
                  setTargetScore(preset.score);
                }}
                className={`p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                }`}
              >
                <div>
                  <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 block">
                    {preset.label}
                  </span>
                  <span className="text-xs text-zinc-400">Recommended cutoff</span>
                </div>
                <span className="text-lg font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                  {preset.score}+
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 pt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Custom Target:</span>
            <input
              type="number"
              min={10}
              max={90}
              value={targetScore}
              onChange={(e) => setTargetScore(Number(e.target.value))}
              className="w-20 px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-semibold text-center"
            />
          </div>

          <Button onClick={handleSaveTarget} size="sm">
            {savedSuccess ? 'Saved!' : 'Save Cutoff'}
          </Button>
        </div>
      </div>

      {/* Official Score Calibration */}
      <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" /> Official Score Calibration
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Have you taken the official test? Submit your official score to calibrate FluentPath's model mappings.
          </p>
        </div>

        {calibSubmitted ? (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4" />
            <span>Thank you! Your official score was recorded for model calibration.</span>
          </div>
        ) : (
          <form onSubmit={handleOfficialSubmit} className="flex flex-wrap items-center gap-3">
            <select
              value={officialScale}
              onChange={(e) => setOfficialScale(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
            >
              <option value="versant">Versant Scale (20–80)</option>
              <option value="gse">GSE Scale (10–90)</option>
            </select>

            <input
              type="number"
              required
              min={10}
              max={90}
              value={officialScore}
              onChange={(e) => setOfficialScore(e.target.value)}
              placeholder="e.g. 62"
              className="w-28 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
            />

            <Button type="submit" size="sm">
              Submit Score
            </Button>
          </form>
        )}
      </div>

      {/* Privacy & Data Deletion */}
      <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-red-600 dark:text-red-400">
            <Trash2 className="w-5 h-5" /> Privacy & Data Deletion
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Your audio and answers are kept strictly for scoring and your review window. You can permanently erase all your data at any time.
          </p>
        </div>

        {deleteMsg && (
          <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-700 dark:text-zinc-300">
            {deleteMsg}
          </div>
        )}

        <Button
          onClick={handleDeleteData}
          disabled={deleting}
          variant="danger"
          size="sm"
        >
          {deleting ? 'Erasing...' : 'Delete All My Practice Data'}
        </Button>
      </div>
    </div>
  );
}
