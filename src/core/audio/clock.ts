// The times that run while something records: "Listening · 0:42", "Recording · 1:12".
import { useEffect, useState } from 'react';

/** "1:12". */
export const clockTime = (ms: number) => {
  const seconds = Math.floor(ms / 1_000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** Re-renders every half second while `on`, for the times that run. */
export const useTicking = (on: boolean) => {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!on) {
      return undefined;
    }
    const timer = setInterval(() => setTick(tick => tick + 1), 500);
    return () => clearInterval(timer);
  }, [on]);
};
