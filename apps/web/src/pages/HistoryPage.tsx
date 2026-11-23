import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { BarChart2, Calendar, ArrowUpRight, Trophy, ChevronRight } from 'lucide-react';
import { Badge } from '../components/common/Badge.tsx';
import { Button } from '../components/common/Button.tsx';
import type { HistoryEntry } from '@fluentpath/shared';
import { api } from '../lib/api.ts';
import { useAuthStore } from '../store/useAuthStore.ts';

export function HistoryPage() {
  const { user, initialized } = useAuthStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const chartData = (progress?.timeline || []).map((t: any, idx: number) => ({
    session: `#${idx + 1} (${t.date.slice(5)})`,
    overall: t.gse,
    reading: t.reading,
    writing: t.writing,
    listening: t.listening,
    speaking: t.speaking,
  }));

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
          Score History & Trends
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Review your estimated GSE progression across full tests and individual practice parts.
        </p>
      </div>

      {/* Progress Line Chart */}
      <div className="p-6 sm:p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card">
        <div className="flex items-center justify-between mb-6">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
            <BarChart2 className="w-4 h-4 text-indigo-500" /> GSE Progress Over Time
          </span>
          <span className="text-xs text-zinc-400">Scale: GSE 10 to 90</span>
        </div>

        {chartData.length > 0 ? (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E4E4E7" opacity={0.5} />
                <XAxis dataKey="session" stroke="#A1A1AA" fontSize={12} tickLine={false} />
                <YAxis domain={[10, 90]} stroke="#A1A1AA" fontSize={12} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181B',
                    borderColor: '#27272A',
                    borderRadius: '12px',
                    color: '#FAFAFA',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="overall" name="Overall GSE" stroke="#3B5BDB" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="speaking" name="Speaking" stroke="#845EC2" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
                <Line type="monotone" dataKey="writing" name="Writing" stroke="#00C9A7" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-48 flex items-center justify-center text-sm text-zinc-400">
            Take a few tests to see your progress chart!
          </div>
        )}
      </div>

      {/* History List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
          All Test Sessions
        </h2>

        {history.length > 0 ? (
          <div className="space-y-3">
            {history.map((h) => (
              <Link
                key={h.sessionId}
                to={`/results/${h.sessionId}`}
                className="p-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-sm hover:border-zinc-400 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-sm text-zinc-800 dark:text-zinc-200">
                    {h.mode === 'full' ? 'Full' : `Pt ${h.parts[0]}`}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {h.mode === 'full' ? 'Full 10-Part Assessment' : `Part ${h.parts[0]} Practice`}
                      </span>
                      <Badge variant="purple" size="sm">
                        {h.cefr}
                      </Badge>
                    </div>
                    <span className="text-xs text-zinc-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(h.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4">
                  <div className="text-right">
                    <span className="text-xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100 block">
                      {h.gse} GSE
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Range: {h.range[0]}–{h.range[1]}
                    </span>
                  </div>

                  <ChevronRight className="w-5 h-5 text-zinc-400" />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 text-sm text-zinc-500">
            No test sessions recorded yet.
          </div>
        )}
      </div>
    </div>
  );
}
