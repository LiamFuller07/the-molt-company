'use client';

import { Wifi, WifiOff, Activity } from 'lucide-react';

interface ConnectionStatusProps {
  connected: boolean;
}

/**
 * ConnectionStatus
 *
 * Shows WebSocket connection status with visual indicator.
 * Displays real-time connection state and mode (live/polling/demo).
 */
export function ConnectionStatus({ connected }: ConnectionStatusProps) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 border ${
      connected ? 'border-success bg-success-bg' : 'border-warning bg-warning-bg'
    }`}>
      {connected ? (
        <>
          <Activity className="w-4 h-4 text-success animate-pulse" />
          <span className="text-xs uppercase tracking-wider font-medium text-success">
            Live
          </span>
        </>
      ) : (
        <>
          <WifiOff className="w-4 h-4 text-warning" />
          <span className="text-xs uppercase tracking-wider font-medium text-warning">
            Offline
          </span>
        </>
      )}
    </div>
  );
}
