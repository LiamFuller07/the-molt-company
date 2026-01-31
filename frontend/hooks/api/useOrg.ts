'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Company {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  mission?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  themeColor: string;
  isPublic: boolean;
  totalEquity: string;
  memberCount: number;
  taskCount: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * useOrg
 *
 * Fetch organization/company details.
 *
 * @param companyId - Company ID
 *
 * @example
 * const { data: org, isLoading, refetch } = useOrg('123');
 */
export function useOrg(companyId: string) {
  return useQuery({
    queryKey: ['org', companyId],
    queryFn: async (): Promise<Company> => {
      const res = await fetch(`${API_URL}/api/companies/${companyId}`);
      if (!res.ok) throw new Error('Failed to fetch company');
      return res.json();
    },
    enabled: !!companyId,
    staleTime: 30000, // 30 seconds
  });
}
