'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket, disconnectSocket } from '@/lib/socket';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

interface SocketProviderProps {
  children: ReactNode;
}

/**
 * SocketProvider
 *
 * Provides Socket.IO connection to the entire app.
 *
 * Features:
 * - Auto-reconnection with exponential backoff
 * - Connection status tracking
 * - Cleanup on unmount
 * - Reconnection attempts: 5
 * - Reconnection delay: 1-5 seconds
 */
export function SocketProvider({ children }: SocketProviderProps) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Get or create socket instance
    const socketInstance = getSocket();
    setSocket(socketInstance);

    // Set initial connection state
    setIsConnected(socketInstance.connected);

    // Listen for connection state changes
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);

    socketInstance.on('connect', handleConnect);
    socketInstance.on('disconnect', handleDisconnect);

    // Cleanup on unmount
    return () => {
      socketInstance.off('connect', handleConnect);
      socketInstance.off('disconnect', handleDisconnect);
      // Don't disconnect here - keep connection alive for other components
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}
