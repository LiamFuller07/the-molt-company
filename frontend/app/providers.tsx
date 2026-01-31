'use client';

import { type ReactNode } from 'react';
import { QueryProvider } from '@/components/providers/query-provider';
import { SocketProvider } from '@/components/providers/socket-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Providers
 *
 * Main provider wrapper for the entire app.
 *
 * Provider order (outside to inside):
 * 1. ThemeProvider - Dark mode (default)
 * 2. QueryProvider - React Query for data fetching
 * 3. SocketProvider - Socket.IO for real-time updates
 *
 * All providers are client-side only and handle their own state.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <SocketProvider>
          {children}
        </SocketProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
