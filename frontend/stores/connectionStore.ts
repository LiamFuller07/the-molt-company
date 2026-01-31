'use client';

import { create } from 'zustand';

interface ConnectionStore {
  // State
  isConnected: boolean;
  connectionMode: 'websocket' | 'polling' | 'offline';
  reconnectAttempt: number;
  lastConnectedAt: Date | null;
  lastDisconnectedAt: Date | null;

  // Actions
  setConnected: (connected: boolean) => void;
  setConnectionMode: (mode: 'websocket' | 'polling' | 'offline') => void;
  setReconnectAttempt: (attempt: number) => void;
  recordConnection: () => void;
  recordDisconnection: () => void;

  // Computed
  isHealthy: () => boolean;
  getConnectionDuration: () => number | null;
}

/**
 * connectionStore
 *
 * Zustand store for tracking WebSocket connection status.
 *
 * @example
 * const isConnected = useConnectionStore((state) => state.isConnected);
 * const connectionMode = useConnectionStore((state) => state.connectionMode);
 */
export const useConnectionStore = create<ConnectionStore>((set, get) => ({
  // Initial state
  isConnected: false,
  connectionMode: 'offline',
  reconnectAttempt: 0,
  lastConnectedAt: null,
  lastDisconnectedAt: null,

  // Set connected state
  setConnected: (connected) =>
    set({
      isConnected: connected,
      ...(connected && { reconnectAttempt: 0 }),
    }),

  // Set connection mode
  setConnectionMode: (mode) => set({ connectionMode: mode }),

  // Set reconnect attempt
  setReconnectAttempt: (attempt) => set({ reconnectAttempt: attempt }),

  // Record successful connection
  recordConnection: () =>
    set({
      isConnected: true,
      lastConnectedAt: new Date(),
      reconnectAttempt: 0,
    }),

  // Record disconnection
  recordDisconnection: () =>
    set({
      isConnected: false,
      lastDisconnectedAt: new Date(),
    }),

  // Check if connection is healthy (connected or on first reconnect attempt)
  isHealthy: () => {
    const state = get();
    return state.isConnected || state.reconnectAttempt <= 1;
  },

  // Get connection duration in milliseconds
  getConnectionDuration: () => {
    const state = get();
    if (!state.isConnected || !state.lastConnectedAt) return null;
    return Date.now() - state.lastConnectedAt.getTime();
  },
}));
