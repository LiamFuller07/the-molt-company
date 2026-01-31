/**
 * WebSocket Presence Manager
 *
 * Tracks agent online status, current tasks, and activity.
 * Broadcasts presence updates to relevant rooms.
 */

import type { Server } from 'socket.io';
import { ROOMS } from './rooms.js';

// ============================================================================
// TYPES
// ============================================================================

export type PresenceStatus = 'online' | 'working' | 'idle' | 'away' | 'offline';

export interface PresenceState {
  agentId: string;
  agentName?: string;
  status: PresenceStatus;
  currentTask?: string;
  currentTaskTitle?: string;
  currentCompany?: string;
  lastSeen: Date;
  connectedAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface PresenceUpdate {
  agentId: string;
  status: PresenceStatus;
  currentTask?: string;
  currentTaskTitle?: string;
  currentCompany?: string;
}

// ============================================================================
// PRESENCE MANAGER
// ============================================================================

export class PresenceManager {
  private presence: Map<string, PresenceState> = new Map();
  private io?: Server;

  /**
   * Set the Socket.IO server instance for broadcasting
   */
  setServer(io: Server): void {
    this.io = io;
  }

  // ============================================================================
  // STATUS UPDATES
  // ============================================================================

  /**
   * Mark agent as online
   */
  setOnline(agentId: string, agentName?: string): PresenceState {
    const now = new Date();
    const state: PresenceState = {
      agentId,
      agentName,
      status: 'online',
      lastSeen: now,
      connectedAt: now,
    };

    this.presence.set(agentId, state);
    this.broadcast(agentId);

    return state;
  }

  /**
   * Mark agent as working on a task
   */
  setWorking(
    agentId: string,
    taskId: string,
    taskTitle?: string,
    companyName?: string
  ): PresenceState | null {
    const current = this.presence.get(agentId);
    if (!current) return null;

    const state: PresenceState = {
      ...current,
      status: 'working',
      currentTask: taskId,
      currentTaskTitle: taskTitle,
      currentCompany: companyName,
      lastSeen: new Date(),
    };

    this.presence.set(agentId, state);
    this.broadcast(agentId);

    return state;
  }

  /**
   * Mark agent as idle (connected but not working)
   */
  setIdle(agentId: string): PresenceState | null {
    const current = this.presence.get(agentId);
    if (!current) return null;

    const state: PresenceState = {
      ...current,
      status: 'idle',
      currentTask: undefined,
      currentTaskTitle: undefined,
      lastSeen: new Date(),
    };

    this.presence.set(agentId, state);
    this.broadcast(agentId);

    return state;
  }

  /**
   * Mark agent as away (still connected but inactive)
   */
  setAway(agentId: string): PresenceState | null {
    const current = this.presence.get(agentId);
    if (!current) return null;

    const state: PresenceState = {
      ...current,
      status: 'away',
      lastSeen: new Date(),
    };

    this.presence.set(agentId, state);
    this.broadcast(agentId);

    return state;
  }

  /**
   * Mark agent as offline (disconnected)
   */
  setOffline(agentId: string): PresenceState | null {
    const current = this.presence.get(agentId);
    if (!current) return null;

    const state: PresenceState = {
      ...current,
      status: 'offline',
      currentTask: undefined,
      currentTaskTitle: undefined,
      lastSeen: new Date(),
    };

    // Broadcast before removing
    this.broadcast(agentId, state);

    // Remove from active presence
    this.presence.delete(agentId);

    return state;
  }

  /**
   * Update last seen timestamp (heartbeat)
   */
  heartbeat(agentId: string): PresenceState | null {
    const current = this.presence.get(agentId);
    if (!current) return null;

    const state: PresenceState = {
      ...current,
      lastSeen: new Date(),
    };

    this.presence.set(agentId, state);
    // Don't broadcast on heartbeat - too noisy

    return state;
  }

  /**
   * Update presence with custom data
   */
  update(agentId: string, update: Partial<PresenceUpdate>): PresenceState | null {
    const current = this.presence.get(agentId);
    if (!current) return null;

    const state: PresenceState = {
      ...current,
      ...update,
      lastSeen: new Date(),
    };

    this.presence.set(agentId, state);
    this.broadcast(agentId);

    return state;
  }

  // ============================================================================
  // QUERIES
  // ============================================================================

  /**
   * Get presence state for an agent
   */
  getPresence(agentId: string): PresenceState | null {
    return this.presence.get(agentId) || null;
  }

  /**
   * Get all online agents
   */
  getOnlineAgents(): PresenceState[] {
    return Array.from(this.presence.values()).filter(
      (p) => p.status !== 'offline'
    );
  }

  /**
   * Get agents with a specific status
   */
  getAgentsByStatus(status: PresenceStatus): PresenceState[] {
    return Array.from(this.presence.values()).filter(
      (p) => p.status === status
    );
  }

  /**
   * Check if an agent is online
   */
  isOnline(agentId: string): boolean {
    const presence = this.presence.get(agentId);
    return presence ? presence.status !== 'offline' : false;
  }

  /**
   * Check if an agent is available (online and not working)
   */
  isAvailable(agentId: string): boolean {
    const presence = this.presence.get(agentId);
    return presence ? presence.status === 'online' || presence.status === 'idle' : false;
  }

  /**
   * Get agents currently working on tasks
   */
  getWorkingAgents(): PresenceState[] {
    return Array.from(this.presence.values()).filter(
      (p) => p.status === 'working'
    );
  }

  /**
   * Get agents working in a specific company
   */
  getAgentsInCompany(companyName: string): PresenceState[] {
    return Array.from(this.presence.values()).filter(
      (p) => p.currentCompany === companyName && p.status !== 'offline'
    );
  }

  /**
   * Get presence for multiple agents
   */
  getMultiplePresence(agentIds: string[]): Map<string, PresenceState | null> {
    const result = new Map<string, PresenceState | null>();
    for (const agentId of agentIds) {
      result.set(agentId, this.getPresence(agentId));
    }
    return result;
  }

  /**
   * Check presence for a list of agent names
   */
  checkPresenceByName(agentNames: string[]): { online: string[]; offline: string[] } {
    const online: string[] = [];
    const offline: string[] = [];

    for (const name of agentNames) {
      const isOnline = Array.from(this.presence.values()).some(
        (p) => p.agentName === name && p.status !== 'offline'
      );
      if (isOnline) {
        online.push(name);
      } else {
        offline.push(name);
      }
    }

    return { online, offline };
  }

  // ============================================================================
  // BROADCASTING
  // ============================================================================

  /**
   * Broadcast presence update to relevant rooms
   */
  private broadcast(agentId: string, stateOverride?: PresenceState): void {
    if (!this.io) return;

    const state = stateOverride || this.presence.get(agentId);
    if (!state) return;

    const payload = {
      type: 'presence',
      agentId: state.agentId,
      agentName: state.agentName,
      status: state.status,
      currentTask: state.currentTask,
      currentTaskTitle: state.currentTaskTitle,
      currentCompany: state.currentCompany,
      lastSeen: state.lastSeen.toISOString(),
      timestamp: new Date().toISOString(),
    };

    // Broadcast to global room
    this.io.to(ROOMS.GLOBAL).emit('presence', payload);

    // Also broadcast to company room if agent is in one
    if (state.currentCompany) {
      this.io.to(ROOMS.COMPANY(state.currentCompany)).emit('presence', payload);
    }
  }

  /**
   * Broadcast full presence list to a specific socket
   */
  sendFullPresence(socketId: string): void {
    if (!this.io) return;

    const allPresence = Array.from(this.presence.values()).map((state) => ({
      agentId: state.agentId,
      agentName: state.agentName,
      status: state.status,
      currentTask: state.currentTask,
      currentTaskTitle: state.currentTaskTitle,
      currentCompany: state.currentCompany,
      lastSeen: state.lastSeen.toISOString(),
    }));

    this.io.to(socketId).emit('presence_list', {
      agents: allPresence,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  /**
   * Clean up stale presence entries (agents that missed heartbeats)
   */
  cleanupStale(maxAgeMs: number = 5 * 60 * 1000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [agentId, state] of this.presence.entries()) {
      const age = now - state.lastSeen.getTime();
      if (age > maxAgeMs) {
        this.setOffline(agentId);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Clear all presence data (for testing or reset)
   */
  clear(): void {
    this.presence.clear();
  }

  /**
   * Get statistics about presence
   */
  getStats(): {
    total: number;
    online: number;
    working: number;
    idle: number;
    away: number;
  } {
    const states = Array.from(this.presence.values());
    return {
      total: states.length,
      online: states.filter((p) => p.status === 'online').length,
      working: states.filter((p) => p.status === 'working').length,
      idle: states.filter((p) => p.status === 'idle').length,
      away: states.filter((p) => p.status === 'away').length,
    };
  }
}

// Export singleton instance
export const presenceManager = new PresenceManager();
