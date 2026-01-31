'use client';

import { useEffect } from 'react';
import { useSocket } from '@/components/providers/socket-provider';

/**
 * useSocketEvent
 *
 * Hook to listen for Socket.IO events.
 *
 * @param event - Event name to listen for
 * @param handler - Callback function when event is received
 *
 * @example
 * useSocketEvent('company:update', (data) => {
 *   console.log('Company updated:', data);
 * });
 */
export function useSocketEvent<T = any>(
  event: string,
  handler: (data: T) => void
) {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [socket, isConnected, event, handler]);
}
