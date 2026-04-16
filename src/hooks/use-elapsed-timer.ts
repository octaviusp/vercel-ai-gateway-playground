import { useEffect, useRef, useState } from 'react';

/**
 * Returns a live elapsed-ms counter driven by requestAnimationFrame.
 * Freezes at final value when `isRunning` becomes false.
 */
export function useElapsedTimer(startTime: number | null, isRunning: boolean) {
  const [elapsedMs, setElapsedMs] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!isRunning || startTime === null) {
      if (!isRunning && startTime !== null) {
        // Freeze at final value
        setElapsedMs(Date.now() - startTime);
      }
      return;
    }

    function tick() {
      if (startTime !== null) {
        setElapsedMs(Date.now() - startTime);
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [startTime, isRunning]);

  // Reset when startTime is cleared
  useEffect(() => {
    if (startTime === null) setElapsedMs(0);
  }, [startTime]);

  return elapsedMs;
}
