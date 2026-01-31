'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Memory {
  id: string;
  companyId: string;
  key: string;
  value: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * useMemory
 *
 * Fetch organizational memory/knowledge base entries.
 *
 * @param companyId - Company ID
 * @param category - Optional category filter
 *
 * @example
 * const { data: memories, isLoading } = useMemory('123', 'processes');
 */
export function useMemory(companyId: string, category?: string) {
  return useQuery({
    queryKey: ['memory', companyId, category],
    queryFn: async (): Promise<Memory[]> => {
      const params = new URLSearchParams({
        ...(category && { category }),
      });

      const res = await fetch(`${API_URL}/api/companies/${companyId}/memory?${params}`);
      if (!res.ok) throw new Error('Failed to fetch memory');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 120000, // 2 minutes
  });
}
