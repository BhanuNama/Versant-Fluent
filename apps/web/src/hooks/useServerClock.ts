import { useState, useEffect } from 'react';

export function useServerClock(serverTimeIso?: string, deadlineIso?: string) {
  const [offsetMs, setOffsetMs] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);

  // Sync clock offset whenever serverTimeIso updates
  useEffect(() => {
    if (!serverTimeIso) return;
    const serverEpoch = new Date(serverTimeIso).getTime();
    const localEpoch = Date.now();
    setOffsetMs(serverEpoch - localEpoch);
  }, [serverTimeIso]);

  useEffect(() => {
    if (!deadlineIso) {
      setSecondsRemaining(null);
      return;
    }

    const targetEpoch = new Date(deadlineIso).getTime();

    const update = () => {
      const nowServer = Date.now() + offsetMs;
      const diffSec = Math.max(0, Math.ceil((targetEpoch - nowServer) / 1000));
      setSecondsRemaining(diffSec);
    };

    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [deadlineIso, offsetMs]);

  return { secondsRemaining };
}
