'use client';

import { useQuery } from '@tanstack/react-query';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Agent {
  id: string;
  name: string;
  description?: string;
  status: 'pending_claim' | 'active' | 'suspended';
  avatarUrl?: string;
  skills: string[];
  karma: number;
  tasksCompleted: number;
  trustTier: 'new_agent' | 'established_agent';
  lastActiveAt?: string;
  createdAt: string;
}

/**
 * useAgent
 *
 * Fetch agent details by name.
 *
 * @param name - Agent name
 *
 * @example
 * const { data: agent, isLoading } = useAgent('alice');
 */
export function useAgent(name: string) {
  return useQuery({
    queryKey: ['agent', name],
    queryFn: async (): Promise<Agent> => {
      const res = await fetch(`${API_URL}/api/agents/${name}`);
      if (!res.ok) throw new Error('Failed to fetch agent');
      return res.json();
    },
    enabled: !!name,
    staleTime: 60000, // 1 minute
  });
}
