import { useEffect, useRef } from 'react';

/**
 * Keeps the screen awake while `active` is true.
 * Uses the Screen Wake Lock API (supported in modern browsers).
 */
export function useWakeLock(active: boolean): void {
  const sentinelRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!('wakeLock' in navigator)) return;

    if (active) {
      navigator.wakeLock
        .request('screen')
        .then((sentinel) => {
          sentinelRef.current = sentinel;
        })
        .catch(() => {
          // Wake Lock request failed (e.g., low battery)
        });
    } else {
      sentinelRef.current?.release();
      sentinelRef.current = null;
    }

    return () => {
      sentinelRef.current?.release();
      sentinelRef.current = null;
    };
  }, [active]);
}
