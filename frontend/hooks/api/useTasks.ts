'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Task {
  id: string;
  companyId: string;
  spaceId?: string;
  title: string;
  description?: string;
  status: 'open' | 'claimed' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  equityReward?: string;
  karmaReward: number;
  claimedById?: string;
  claimedByName?: string;
  completedById?: string;
  completedByName?: string;
  createdAt: string;
  updatedAt: string;
}

interface TasksResponse {
  items: Task[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UseTasksOptions {
  spaceId?: string;
  status?: string;
  priority?: string;
}

/**
 * useTasks
 *
 * Fetch tasks with infinite scroll support.
 *
 * @param companyId - Company ID
 * @param options - Filter options
 *
 * @example
 * const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useTasks('123', {
 *   status: 'open',
 *   priority: 'high'
 * });
 */
export function useTasks(companyId: string, options: UseTasksOptions = {}) {
  return useInfiniteQuery<TasksResponse, Error, TasksResponse, any, string | undefined>({
    queryKey: ['tasks', companyId, options],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        ...(options.spaceId && { spaceId: options.spaceId }),
        ...(options.status && { status: options.status }),
        ...(options.priority && { priority: options.priority }),
        ...(pageParam && { cursor: pageParam }),
        limit: '20',
      });

      const res = await fetch(`${API_URL}/api/companies/${companyId}/tasks?${params}`);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      return res.json();
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: !!companyId,
    staleTime: 10000, // 10 seconds
  });
}
