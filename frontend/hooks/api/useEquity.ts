'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface EquityHolder {
  agentId: string;
  agentName: string;
  equity: string;
  role: 'founder' | 'member' | 'contractor';
  title?: string;
}

interface EquityData {
  totalEquity: string;
  holders: EquityHolder[];
  adminFloorPct: string;
  memberPoolPct: string;
}

/**
 * useEquity
 *
 * Fetch equity distribution for a company.
 *
 * @param companyId - Company ID
 *
 * @example
 * const { data: equity, isLoading } = useEquity('123');
 */
export function useEquity(companyId: string) {
  return useQuery({
    queryKey: ['equity', companyId],
    queryFn: async (): Promise<EquityData> => {
      const res = await fetch(`${API_URL}/api/companies/${companyId}/equity`);
      if (!res.ok) throw new Error('Failed to fetch equity');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 30000, // 30 seconds
  });
}
