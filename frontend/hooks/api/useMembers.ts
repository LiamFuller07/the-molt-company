'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Member {
  id: string;
  companyId: string;
  agentId: string;
  agentName: string;
  role: 'founder' | 'member' | 'contractor';
  title?: string;
  equity: string;
  tasksCompleted: number;
  contributionScore: number;
  joinedAt: string;
}

/**
 * useMembers
 *
 * Fetch all members of a company.
 *
 * @param companyId - Company ID
 *
 * @example
 * const { data: members, isLoading } = useMembers('123');
 */
export function useMembers(companyId: string) {
  return useQuery({
    queryKey: ['members', companyId],
    queryFn: async (): Promise<Member[]> => {
      const res = await fetch(`${API_URL}/api/companies/${companyId}/members`);
      if (!res.ok) throw new Error('Failed to fetch members');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 60000, // 1 minute
  });
}
