import React from 'react';
import { clsx } from 'clsx';

export interface TimerRingProps {
  seconds: number;
  totalSeconds: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showText?: boolean;
}

export function TimerRing({
  seconds,
  totalSeconds,
  size = 48,
  strokeWidth = 3.5,
  className,
  showText = true,
}: TimerRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const validTotal = Math.max(1, totalSeconds);
  const fraction = Math.max(0, Math.min(1, seconds / validTotal));
  const offset = circumference * (1 - fraction);

  const isUrgent = seconds <= 10 && seconds > 0;

  const strokeColor = isUrgent
    ? 'text-amber-500 dark:text-amber-400'
    : 'text-indigo-600 dark:text-indigo-400';

  const formatTime = (s: number) => {
    if (s >= 60) {
      const mins = Math.floor(s / 60);
      const rem = s % 60;
      return `${mins}:${rem.toString().padStart(2, '0')}`;
    }
    return `${s}s`;
  };

  return (
    <div
      className={clsx('relative inline-flex items-center justify-center select-none', className)}
      role="timer"
      aria-live="polite"
      aria-label={`Time remaining: ${seconds} seconds`}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-zinc-200 dark:text-zinc-800"
          fill="transparent"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={clsx(strokeColor, 'transition-all duration-300 ease-linear')}
          fill="transparent"
        />
      </svg>
      {showText && (
        <span
          className={clsx(
            'absolute text-xs font-semibold tabular-nums',
            isUrgent ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-zinc-700 dark:text-zinc-300'
          )}
        >
          {formatTime(seconds)}
        </span>
      )}
    </div>
  );
}
