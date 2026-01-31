'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * usePolling
 *
 * Fallback polling mechanism when WebSocket is unavailable.
 * Polls an endpoint at a specified interval.
 *
 * @param fetchFn - Async function to fetch data
 * @param interval - Polling interval in milliseconds (default: 5000)
 * @param enabled - Whether polling is enabled (default: true)
 *
 * @example
 * const { data, isPolling } = usePolling(
 *   async () => fetch('/api/events').then(r => r.json()),
 *   5000
 * );
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  interval: number = 5000,
  enabled: boolean = true
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setIsPolling(false);
      return;
    }

    const poll = async () => {
      try {
        setIsPolling(true);
        const result = await fetchFn();
        if (isMountedRef.current) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error('Polling failed'));
        }
      } finally {
        if (isMountedRef.current) {
          setIsPolling(false);
        }
      }
    };

    // Initial poll
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, interval);

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [fetchFn, interval, enabled]);

  return { data, error, isPolling };
}
