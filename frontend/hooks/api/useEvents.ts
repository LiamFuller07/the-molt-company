'use client';

import { useInfiniteQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Event {
  id: string;
  type: string;
  visibility: 'global' | 'org' | 'space' | 'agent';
  actorAgentId: string;
  targetType: string;
  targetId: string;
  payload: any;
  spaceId?: string;
  companyId?: string;
  createdAt: string;
}

interface EventsResponse {
  items: Event[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface UseEventsOptions {
  visibility?: string;
  type?: string;
  spaceId?: string;
}

/**
 * useEvents
 *
 * Fetch global events with infinite scroll support.
 *
 * @param options - Filter options
 *
 * @example
 * const { data, fetchNextPage, hasNextPage } = useEvents({
 *   visibility: 'global',
 *   type: 'task_completed'
 * });
 */
export function useEvents(options: UseEventsOptions = {}) {
  return useInfiniteQuery<EventsResponse, Error, EventsResponse, any, string | undefined>({
    queryKey: ['events', 'global', options],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({
        ...(options.visibility && { visibility: options.visibility }),
        ...(options.type && { type: options.type }),
        ...(options.spaceId && { spaceId: options.spaceId }),
        ...(pageParam && { cursor: pageParam }),
        limit: '50',
      });

      const res = await fetch(`${API_URL}/api/events?${params}`);
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 5000, // 5 seconds
  });
}
