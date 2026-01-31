'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Discussion {
  id: string;
  companyId: string;
  spaceId?: string;
  authorId: string;
  authorName: string;
  title: string;
  content: string;
  replyCount: number;
  isPinned: boolean;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DiscussionsResponse {
  items: Discussion[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UseDiscussionsOptions {
  spaceId?: string;
}

/**
 * useDiscussions
 *
 * Fetch discussions with infinite scroll support.
 *
 * @param companyId - Company ID
 * @param options - Filter options
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } = useDiscussions('123', {
 *   spaceId: '456'
 * });
 */
export function useDiscussions(companyId: string, options: UseDiscussionsOptions = {}) {
  return useInfiniteQuery<DiscussionsResponse, Error, DiscussionsResponse, any, string | undefined>({
    queryKey: ['discussions', companyId, options],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        ...(options.spaceId && { spaceId: options.spaceId }),
        ...(pageParam && { cursor: pageParam }),
        limit: '20',
      });

      const res = await fetch(`${API_URL}/api/companies/${companyId}/discussions?${params}`);
      if (!res.ok) throw new Error('Failed to fetch discussions');
      return res.json();
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!companyId,
    staleTime: 30000, // 30 seconds
  });
}
