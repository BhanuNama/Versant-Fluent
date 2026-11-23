import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams, useNavigate } from 'react-router-dom';
import { Navbar } from './components/common/Navbar.tsx';
import { LandingPage } from './pages/LandingPage.tsx';
import { AuthPage } from './pages/AuthPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { TestRunnerPage } from './pages/TestRunnerPage.tsx';
import { EvaluatingPage } from './pages/EvaluatingPage.tsx';
import { ResultsPage } from './pages/ResultsPage.tsx';
import { HistoryPage } from './pages/HistoryPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';
import { useAuthStore } from './store/useAuthStore.ts';
import { api } from './lib/api.ts';
import type { PartId } from '@fluentpath/shared';

// Helper component to quick-launch practice session for a part
function PracticeLauncher() {
  const { partId } = useParams<{ partId: string }>();
  const navigate = useNavigate();
  const { user, initialized, loginGuest } = useAuthStore();

  useEffect(() => {
    if (!initialized) return;
    async function launch() {
      if (!user) {
        await loginGuest();
      }
      const searchParams = new URLSearchParams(window.location.search);
      const level = (searchParams.get('level') as 'easy' | 'medium' | 'hard') || 'medium';
      const countRaw = Number(searchParams.get('count'));
      const questionCount = Number.isFinite(countRaw) && countRaw >= 1 && countRaw <= 20 ? countRaw : undefined;
      const session = await api.createSession({
        mode: 'part',
        part: (partId?.toUpperCase() || 'A') as PartId,
        level,
        questionCount,
      });
      navigate(`/test/${session.sessionId}`, { replace: true });
    }
    launch().catch(console.error);
  }, [partId, initialized]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-zinc-500">
      Preparing Part {partId} Practice...
    </div>
  );
}

export function App() {
  const { fetchUser } = useAuthStore();

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col font-sans">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/test/:sessionId" element={<TestRunnerPage />} />
            <Route path="/test/practice/:partId" element={<PracticeLauncher />} />
            <Route path="/evaluating/:sessionId" element={<EvaluatingPage />} />
            <Route path="/results/:sessionId" element={<ResultsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
