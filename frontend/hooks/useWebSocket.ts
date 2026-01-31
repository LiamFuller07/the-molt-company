'use client';

import { useEffect, useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '@/lib/socket';

/**
 * useWebSocket
 *
 * Core WebSocket hook that provides socket connection management.
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Connection status tracking
 * - Room management (join/leave)
 * - Reconnection attempt counting
 *
 * @example
 * const { socket, connected, joinRoom, leaveRoom } = useWebSocket();
 *
 * useEffect(() => {
 *   joinRoom('company:123');
 *   return () => leaveRoom('company:123');
 * }, []);
 */
export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

  useEffect(() => {
    // Get or create socket instance
    const s = getSocket();
    setSocket(s);

    // Set initial state
    setConnected(s.connected);

    // Connection handlers
    const handleConnect = () => {
      setConnected(true);
      setReconnectAttempt(0);
      console.log('[useWebSocket] Connected');
    };

    const handleDisconnect = (reason: string) => {
      setConnected(false);
      console.log('[useWebSocket] Disconnected:', reason);
    };

    const handleReconnectAttempt = (attempt: number) => {
      setReconnectAttempt(attempt);
      console.log(`[useWebSocket] Reconnection attempt #${attempt}`);
    };

    const handleReconnect = (attempt: number) => {
      setReconnectAttempt(0);
      console.log(`[useWebSocket] Reconnected after ${attempt} attempts`);
    };

    const handleReconnectFailed = () => {
      console.error('[useWebSocket] Failed to reconnect after max attempts');
    };

    const handleError = (error: Error) => {
      console.error('[useWebSocket] Socket error:', error);
    };

    // Attach listeners
    s.on('connect', handleConnect);
    s.on('disconnect', handleDisconnect);
    s.on('reconnect_attempt', handleReconnectAttempt);
    s.on('reconnect', handleReconnect);
    s.on('reconnect_failed', handleReconnectFailed);
    s.on('error', handleError);

    // Cleanup
    return () => {
      s.off('connect', handleConnect);
      s.off('disconnect', handleDisconnect);
      s.off('reconnect_attempt', handleReconnectAttempt);
      s.off('reconnect', handleReconnect);
      s.off('reconnect_failed', handleReconnectFailed);
      s.off('error', handleError);
    };
  }, []);

  // Room management
  const joinRoom = useCallback(
    (room: string) => {
      if (!socket || !connected) {
        console.warn('[useWebSocket] Cannot join room - not connected');
        return;
      }
      socket.emit('join', room);
      console.log(`[useWebSocket] Joined room: ${room}`);
    },
    [socket, connected]
  );

  const leaveRoom = useCallback(
    (room: string) => {
      if (!socket) {
        console.warn('[useWebSocket] Cannot leave room - no socket');
        return;
      }
      socket.emit('leave', room);
      console.log(`[useWebSocket] Left room: ${room}`);
    },
    [socket]
  );

  return {
    socket,
    connected,
    reconnectAttempt,
    joinRoom,
    leaveRoom,
  };
}
