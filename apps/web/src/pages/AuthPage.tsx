import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, UserPlus, LogIn, UserCheck, AlertCircle } from 'lucide-react';
import { Button } from '../components/common/Button.tsx';
import { useAuthStore } from '../store/useAuthStore.ts';
import { api } from '../lib/api.ts';

export function AuthPage() {
  const navigate = useNavigate();
  const { setUser, loginGuest } = useAuthStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegister) {
        const { user, token } = await api.register({ email, password, name });
        if (token) localStorage.setItem('fp_auth_token', token);
        setUser(user);
      } else {
        const { user, token } = await api.login({ email, password });
        if (token) localStorage.setItem('fp_auth_token', token);
        setUser(user);
      }
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginGuest();
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to start guest session');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md p-8 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-card"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center mb-4 shadow-sm">
            <Sparkles className="w-6 h-6 text-indigo-400 dark:text-indigo-600" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {isRegister ? 'Create an account' : 'Welcome back'}
          </h2>
          <p className="text-xs text-zinc-500 mt-1">
            {isRegister
              ? 'Track your test scores and track progress over time.'
              : 'Sign in to access your previous test history and target cutoffs.'}
          </p>
        </div>

        {error && (
          <div className="p-3 mb-6 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Candidate name"
                className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={8}
              className="w-full px-4 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/80 focus:bg-white dark:focus:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <Button type="submit" disabled={loading} size="md" className="w-full mt-2">
            {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </form>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
          </div>
          <span className="relative px-3 bg-white dark:bg-zinc-900 text-xs text-zinc-400">
            or try without signing up
          </span>
        </div>

        <Button
          type="button"
          onClick={handleGuest}
          disabled={loading}
          variant="secondary"
          size="md"
          className="w-full"
        >
          <UserCheck className="w-4 h-4 mr-2 text-indigo-500" />
          Continue as Guest
        </Button>

        <div className="mt-6 text-center text-xs text-zinc-500">
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            type="button"
            onClick={() => setIsRegister(!isRegister)}
            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
          >
            {isRegister ? 'Sign In' : 'Create one'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
