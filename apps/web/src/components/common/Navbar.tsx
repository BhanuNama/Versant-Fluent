import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Moon, Sun, UserCheck, ShieldCheck, Sparkles, BarChart2, Compass, LogOut } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore.ts';
import { useUiStore } from '../../store/useUiStore.ts';
import { Badge } from './Badge.tsx';

export function Navbar() {
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useUiStore();
  const location = useLocation();

  const isTest = location.pathname.startsWith('/test');
  if (isTest) return null; // slim top bar replaces navbar during test

  return (
    <header className="sticky top-4 z-40 px-4 max-w-6xl mx-auto w-full">
      <nav className="flex items-center justify-between px-4 py-2.5 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-2xl border border-zinc-200/80 dark:border-zinc-800 shadow-card">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 shadow-sm transition-transform group-hover:scale-105">
            <Sparkles className="w-4 h-4 text-indigo-400 dark:text-indigo-600" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight flex items-center gap-1.5">
              FluentPath
              <Badge variant="purple" size="sm" className="hidden sm:inline-flex text-[10px] py-0 px-1.5">
                Practice
              </Badge>
            </span>
          </div>
        </Link>

        {/* Center links */}
        <div className="hidden md:flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          <Link
            to="/dashboard"
            className="px-3 py-1.5 rounded-lg hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <Compass className="w-4 h-4" />
            Practice Hub
          </Link>
          <Link
            to="/history"
            className="px-3 py-1.5 rounded-lg hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <BarChart2 className="w-4 h-4" />
            Analytics
          </Link>
          <Link
            to="/settings"
            className="px-3 py-1.5 rounded-lg hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4" />
            Cutoffs & Privacy
          </Link>
        </div>

        {/* Right CTA & Profile */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {user && !user.guest ? (
            <div className="flex items-center gap-2">
              <Link
                to="/dashboard"
                className="flex items-center gap-2 pl-2 pr-3 py-1 bg-zinc-100 dark:bg-zinc-800/80 rounded-xl text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/70 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <UserCheck className="w-3 h-3" />
                </div>
                <span className="max-w-[100px] truncate">{user.name}</span>
              </Link>
              <button
                onClick={() => logout()}
                title="Sign out"
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : user && user.guest ? (
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-900/40">
                Guest Mode
              </span>
              <Link
                to="/auth"
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
              >
                Sign In / Register
              </Link>
            </div>
          ) : (
            <Link
              to="/auth"
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
            >
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
