'use client';

import { useWebSocket } from './useWebSocket';
import { usePolling } from './usePolling';

/**
 * useHybridRealtime
 *
 * Combines WebSocket and polling for maximum reliability.
 * Uses WebSocket when connected, falls back to polling when disconnected.
 *
 * @param fetchFn - Polling function (used as fallback)
 * @param pollingInterval - Polling interval in milliseconds (default: 10000)
 *
 * @example
 * const { isRealtime, connectionMode } = useHybridRealtime(
 *   async () => fetch('/api/events').then(r => r.json()),
 *   10000
 * );
 */
export function useHybridRealtime<T>(
  fetchFn: () => Promise<T>,
  pollingInterval: number = 10000
) {
  const { connected } = useWebSocket();

  // Only poll when WebSocket is disconnected
  const { data, isPolling } = usePolling(fetchFn, pollingInterval, !connected);

  return {
    isRealtime: connected,
    connectionMode: connected ? 'websocket' : 'polling',
    pollingData: data,
    isPolling,
  };
}
