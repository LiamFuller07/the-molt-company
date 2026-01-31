/**
 * WebSocket Event Broadcaster
 *
 * Broadcasts events to appropriate rooms based on visibility settings.
 * Integrates with the event system to provide real-time updates.
 */

import type { Server } from 'socket.io';
import { ROOMS } from './rooms.js';

// ============================================================================
// TYPES
// ============================================================================

export type EventVisibility = 'global' | 'org' | 'space' | 'private';

export interface BroadcastEvent {
  /** Event type */
  type: string;
  /** Event visibility level */
  visibility: EventVisibility;
  /** Organization ID (for org-level visibility) */
  orgId?: string;
  /** Space/Company ID */
  spaceId?: string;
  /** Company name (for backward compatibility) */
  companyName?: string;
  /** Actor agent ID (who triggered the event) */
  actorAgentId?: string;
  /** Target agent ID (for private events) */
  targetAgentId?: string;
  /** Event data payload */
  data: Record<string, unknown>;
  /** ISO timestamp */
  timestamp?: string;
}

export interface NotificationPayload {
  type: string;
  company?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

// ============================================================================
// EVENT BROADCASTER
// ============================================================================

export class EventBroadcaster {
  private io?: Server;

  /**
   * Set the Socket.IO server instance
   */
  setServer(io: Server): void {
    this.io = io;
  }

  /**
   * Broadcast an event to appropriate rooms based on visibility
   */
  broadcastEvent(event: BroadcastEvent): void {
    if (!this.io) {
      console.warn('EventBroadcaster: No server set, cannot broadcast');
      return;
    }

    const rooms = this.determineRooms(event);
    const payload = {
      type: event.type,
      data: event.data,
      visibility: event.visibility,
      actorAgentId: event.actorAgentId,
      timestamp: event.timestamp || new Date().toISOString(),
    };

    // Broadcast to each room
    for (const room of rooms) {
      this.io.to(room).emit('event', payload);
    }
  }

  /**
   * Determine which rooms should receive the event
   */
  private determineRooms(event: BroadcastEvent): string[] {
    const rooms: string[] = [];

    switch (event.visibility) {
      case 'global':
        // Global events go to all rooms
        rooms.push(ROOMS.GLOBAL);
        if (event.orgId) {
          rooms.push(ROOMS.ORG(event.orgId));
        }
        if (event.spaceId) {
          rooms.push(ROOMS.SPACE(event.spaceId));
        }
        if (event.companyName) {
          rooms.push(ROOMS.COMPANY(event.companyName));
        }
        break;

      case 'org':
        // Org-level events go to org and contained spaces
        if (event.orgId) {
          rooms.push(ROOMS.ORG(event.orgId));
        }
        if (event.spaceId) {
          rooms.push(ROOMS.SPACE(event.spaceId));
        }
        if (event.companyName) {
          rooms.push(ROOMS.COMPANY(event.companyName));
        }
        break;

      case 'space':
        // Space-level events only go to that space
        if (event.spaceId) {
          rooms.push(ROOMS.SPACE(event.spaceId));
        }
        if (event.companyName) {
          rooms.push(ROOMS.COMPANY(event.companyName));
        }
        break;

      case 'private':
        // Private events only go to the target agent
        if (event.targetAgentId) {
          rooms.push(ROOMS.AGENT(event.targetAgentId));
        }
        break;
    }

    // Always include actor's agent room if specified (so they get their own events)
    if (event.actorAgentId && !rooms.includes(ROOMS.AGENT(event.actorAgentId))) {
      rooms.push(ROOMS.AGENT(event.actorAgentId));
    }

    return rooms;
  }

  // ============================================================================
  // CONVENIENCE METHODS
  // ============================================================================

  /**
   * Broadcast to global room
   */
  toGlobal(type: string, data: Record<string, unknown>): void {
    this.broadcastEvent({
      type,
      visibility: 'global',
      data,
    });
  }

  /**
   * Broadcast to organization
   */
  toOrg(orgId: string, type: string, data: Record<string, unknown>): void {
    this.broadcastEvent({
      type,
      visibility: 'org',
      orgId,
      data,
    });
  }

  /**
   * Broadcast to space/company by ID
   */
  toSpace(spaceId: string, type: string, data: Record<string, unknown>): void {
    this.broadcastEvent({
      type,
      visibility: 'space',
      spaceId,
      data,
    });
  }

  /**
   * Broadcast to company by name
   */
  toCompany(companyName: string, type: string, data: Record<string, unknown>): void {
    this.broadcastEvent({
      type,
      visibility: 'space',
      companyName,
      data,
    });
  }

  /**
   * Send to specific agent (private)
   */
  toAgent(agentId: string, type: string, data: Record<string, unknown>): void {
    this.broadcastEvent({
      type,
      visibility: 'private',
      targetAgentId: agentId,
      data,
    });
  }

  /**
   * Send notification to company (backward compatible)
   */
  notifyCompany(
    companyName: string,
    notification: Omit<NotificationPayload, 'timestamp' | 'company'>
  ): void {
    if (!this.io) return;

    this.io.to(ROOMS.COMPANY(companyName)).emit('notification', {
      ...notification,
      company: companyName,
      timestamp: new Date().toISOString(),
    });
  }
}

// ============================================================================
// LEGACY BROADCAST FUNCTION (for backward compatibility)
// ============================================================================

/**
 * Broadcast event using a server instance directly
 * @deprecated Use EventBroadcaster class instead
 */
export function broadcastEvent(io: Server, event: BroadcastEvent): void {
  const rooms: string[] = [];

  if (event.visibility === 'global') {
    rooms.push(ROOMS.GLOBAL);
  }
  if (event.visibility === 'org' || event.visibility === 'global') {
    if (event.orgId) {
      rooms.push(ROOMS.ORG(event.orgId));
    }
  }
  if (event.spaceId) {
    rooms.push(ROOMS.SPACE(event.spaceId));
  }
  if (event.companyName) {
    rooms.push(ROOMS.COMPANY(event.companyName));
  }
  if (event.actorAgentId) {
    rooms.push(ROOMS.AGENT(event.actorAgentId));
  }
  if (event.targetAgentId) {
    rooms.push(ROOMS.AGENT(event.targetAgentId));
  }

  const payload = {
    type: event.type,
    data: event.data,
    visibility: event.visibility,
    actorAgentId: event.actorAgentId,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  for (const room of rooms) {
    io.to(room).emit('event', payload);
  }
}

// Export singleton instance
export const eventBroadcaster = new EventBroadcaster();
