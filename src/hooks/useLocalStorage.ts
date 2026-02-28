import { useState, useCallback, useEffect } from 'react';

/** Custom event name used to sync useLocalStorage across components in the same tab. */
const LOCAL_STORAGE_SYNC = 'local-storage-sync';

interface SyncDetail {
  key: string;
  value: string | null;
}

/**
 * A generic hook for persisting state in localStorage.
 * Syncs state across all hook instances sharing the same key,
 * both within the same tab (custom event) and across tabs (storage event).
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Listen for same-tab and cross-tab sync events
  useEffect(() => {
    const handleSync = (e: Event) => {
      const detail = (e as CustomEvent<SyncDetail>).detail;
      if (detail.key !== key) return;
      const parsed = detail.value ? (JSON.parse(detail.value) as T) : initialValue;
      setStoredValue((prev) =>
        JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed
      );
    };

    const handleStorage = (e: StorageEvent) => {
      if (e.key !== key) return;
      const parsed = e.newValue ? (JSON.parse(e.newValue) as T) : initialValue;
      setStoredValue((prev) =>
        JSON.stringify(prev) === JSON.stringify(parsed) ? prev : parsed
      );
    };

    window.addEventListener(LOCAL_STORAGE_SYNC, handleSync);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(LOCAL_STORAGE_SYNC, handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, [key, initialValue]);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        } catch {
          // Storage full or unavailable — silently fail
        }
        return valueToStore;
      });
      // Notify other hook instances OUTSIDE the updater (updaters must be pure)
      queueMicrotask(() => {
        const stored = window.localStorage.getItem(key);
        window.dispatchEvent(
          new CustomEvent<SyncDetail>(LOCAL_STORAGE_SYNC, {
            detail: { key, value: stored },
          })
        );
      });
    },
    [key]
  );

  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Ignore
    }
    setStoredValue(initialValue);
    queueMicrotask(() => {
      window.dispatchEvent(
        new CustomEvent<SyncDetail>(LOCAL_STORAGE_SYNC, {
          detail: { key, value: null },
        })
      );
    });
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}
