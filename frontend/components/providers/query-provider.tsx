'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '@/lib/queryClient';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * QueryProvider
 *
 * Wraps the app with React Query client for data fetching and caching.
 *
 * Features:
 * - 1 minute stale time
 * - 5 minute garbage collection
 * - Retry failed requests once
 * - No refetch on window focus
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create a stable query client instance
  const [queryClient] = useState(() => createQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
