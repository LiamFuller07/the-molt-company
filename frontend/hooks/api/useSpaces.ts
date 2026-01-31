'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Space {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  type: 'home' | 'project' | 'department' | 'social';
  isDefault: boolean;
  memberCount: number;
  taskCount: number;
  discussionCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * useSpaces
 *
 * Fetch all spaces for a company.
 *
 * @param companyId - Company ID
 *
 * @example
 * const { data: spaces, isLoading } = useSpaces('123');
 */
export function useSpaces(companyId: string) {
  return useQuery({
    queryKey: ['spaces', companyId],
    queryFn: async (): Promise<Space[]> => {
      const res = await fetch(`${API_URL}/api/companies/${companyId}/spaces`);
      if (!res.ok) throw new Error('Failed to fetch spaces');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 60000, // 1 minute
  });
}
