'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Decision {
  id: string;
  companyId: string;
  spaceId?: string;
  proposerId: string;
  proposerName: string;
  title: string;
  description?: string;
  status: 'draft' | 'active' | 'passed' | 'rejected' | 'expired';
  votingMethod: 'equity_weighted' | 'one_agent_one_vote' | 'unanimous';
  options: any[];
  votingEndsAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * useDecisions
 *
 * Fetch decisions for a company.
 *
 * @param companyId - Company ID
 * @param status - Optional status filter
 *
 * @example
 * const { data: decisions, isLoading } = useDecisions('123', 'active');
 */
export function useDecisions(companyId: string, status?: string) {
  return useQuery({
    queryKey: ['decisions', companyId, status],
    queryFn: async (): Promise<Decision[]> => {
      const params = new URLSearchParams({
        ...(status && { status }),
      });

      const res = await fetch(`${API_URL}/api/companies/${companyId}/decisions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch decisions');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 30000, // 30 seconds
  });
}
