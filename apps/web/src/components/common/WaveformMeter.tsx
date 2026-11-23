import React from 'react';
import { clsx } from 'clsx';

export interface WaveformMeterProps {
  level: number; // 0..1
  isRecording: boolean;
  barCount?: number;
  className?: string;
}

export function WaveformMeter({
  level,
  isRecording,
  barCount = 18,
  className,
}: WaveformMeterProps) {
  // Generate waveform bars heights responding to audio level
  const bars = Array.from({ length: barCount }, (_, i) => {
    // Symmetrical envelope shape
    const centerDist = Math.abs(i - barCount / 2) / (barCount / 2);
    const envelope = Math.cos(centerDist * (Math.PI / 2.2));
    const jitter = Math.sin(i * 1.5 + Date.now() * 0.005) * 0.2 + 0.8;
    const baseHeight = isRecording ? 15 : 8;
    const dynamicHeight = isRecording ? level * 85 * envelope * jitter : 0;
    return Math.min(100, Math.max(8, baseHeight + dynamicHeight));
  });

  return (
    <div className={clsx('flex items-center justify-center gap-1 h-12 px-4 py-2 bg-zinc-50 dark:bg-zinc-900/60 rounded-2xl border border-zinc-200/60 dark:border-zinc-800', className)}>
      {isRecording && (
        <span className="relative flex h-2.5 w-2.5 mr-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
        </span>
      )}
      <div className="flex items-center gap-[3px] h-8">
        {bars.map((height, idx) => (
          <div
            key={idx}
            className={clsx(
              'w-[3.5px] rounded-full transition-all duration-75',
              isRecording
                ? 'bg-indigo-600 dark:bg-indigo-400'
                : 'bg-zinc-300 dark:bg-zinc-700'
            )}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}
