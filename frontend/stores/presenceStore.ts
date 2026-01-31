'use client';

import { create } from 'zustand';

interface AgentPresence {
  agentId: string;
  agentName: string;
  status: 'online' | 'idle' | 'offline';
  lastSeenAt: Date;
  currentSpace?: string;
}

interface PresenceStore {
  // State
  agents: Map<string, AgentPresence>;

  // Actions
  setAgentOnline: (agentId: string, agentName: string, currentSpace?: string) => void;
  setAgentOffline: (agentId: string) => void;
  setAgentIdle: (agentId: string) => void;
  updateAgentSpace: (agentId: string, spaceId: string) => void;
  clearPresence: () => void;

  // Selectors
  getOnlineAgents: () => AgentPresence[];
  getAgentsInSpace: (spaceId: string) => AgentPresence[];
  getAgentStatus: (agentId: string) => 'online' | 'idle' | 'offline';
  getOnlineCount: () => number;
}

/**
 * presenceStore
 *
 * Zustand store for tracking agent presence/online status.
 *
 * @example
 * const onlineAgents = usePresenceStore((state) => state.getOnlineAgents());
 * const onlineCount = usePresenceStore((state) => state.getOnlineCount());
 */
export const usePresenceStore = create<PresenceStore>((set, get) => ({
  // Initial state
  agents: new Map(),

  // Set agent online
  setAgentOnline: (agentId, agentName, currentSpace) =>
    set((state) => {
      const newAgents = new Map(state.agents);
      newAgents.set(agentId, {
        agentId,
        agentName,
        status: 'online',
        lastSeenAt: new Date(),
        currentSpace,
      });
      return { agents: newAgents };
    }),

  // Set agent offline
  setAgentOffline: (agentId) =>
    set((state) => {
      const newAgents = new Map(state.agents);
      const agent = newAgents.get(agentId);
      if (agent) {
        newAgents.set(agentId, {
          ...agent,
          status: 'offline',
          lastSeenAt: new Date(),
        });
      }
      return { agents: newAgents };
    }),

  // Set agent idle
  setAgentIdle: (agentId) =>
    set((state) => {
      const newAgents = new Map(state.agents);
      const agent = newAgents.get(agentId);
      if (agent) {
        newAgents.set(agentId, {
          ...agent,
          status: 'idle',
          lastSeenAt: new Date(),
        });
      }
      return { agents: newAgents };
    }),

  // Update agent's current space
  updateAgentSpace: (agentId, spaceId) =>
    set((state) => {
      const newAgents = new Map(state.agents);
      const agent = newAgents.get(agentId);
      if (agent) {
        newAgents.set(agentId, {
          ...agent,
          currentSpace: spaceId,
          lastSeenAt: new Date(),
        });
      }
      return { agents: newAgents };
    }),

  // Clear all presence data
  clearPresence: () => set({ agents: new Map() }),

  // Get all online agents
  getOnlineAgents: () => {
    return Array.from(get().agents.values()).filter((a) => a.status === 'online');
  },

  // Get agents in a specific space
  getAgentsInSpace: (spaceId) => {
    return Array.from(get().agents.values()).filter(
      (a) => a.status === 'online' && a.currentSpace === spaceId
    );
  },

  // Get agent status
  getAgentStatus: (agentId) => {
    return get().agents.get(agentId)?.status ?? 'offline';
  },

  // Get online agent count
  getOnlineCount: () => {
    return Array.from(get().agents.values()).filter((a) => a.status === 'online').length;
  },
}));
