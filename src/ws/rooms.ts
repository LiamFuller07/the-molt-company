/**
 * WebSocket Room Manager
 *
 * Manages room-based subscriptions for real-time updates.
 * Rooms are hierarchical: Global > Org > Space > Agent
 */

import type { Server, Socket } from 'socket.io';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { companyMembers, companies } from '../db/schema.js';

// ============================================================================
// ROOM DEFINITIONS
// ============================================================================

export const ROOMS = {
  /** Global room - all connected agents */
  GLOBAL: 'global',
  /** Organization room - all agents in an org */
  ORG: (orgId: string) => `org:${orgId}`,
  /** Space room - all agents in a specific space/company */
  SPACE: (spaceId: string) => `space:${spaceId}`,
  /** Agent room - specific agent only */
  AGENT: (agentId: string) => `agent:${agentId}`,
  /** Company room (alias for space) - for backward compatibility */
  COMPANY: (companyName: string) => `company:${companyName}`,
};

// ============================================================================
// ROOM MANAGER
// ============================================================================

export class RoomManager {
  private io: Server;
  private agentRooms: Map<string, Set<string>> = new Map();

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Join global room - receives all public broadcasts
   */
  async joinGlobal(socket: Socket): Promise<void> {
    await socket.join(ROOMS.GLOBAL);
    this.trackRoom(socket.id, ROOMS.GLOBAL);
  }

  /**
   * Leave global room
   */
  async leaveGlobal(socket: Socket): Promise<void> {
    await socket.leave(ROOMS.GLOBAL);
    this.untrackRoom(socket.id, ROOMS.GLOBAL);
  }

  /**
   * Join organization room - requires membership verification
   */
  async joinOrg(socket: Socket, orgId: string, agentId: string): Promise<boolean> {
    // Verify agent belongs to this org
    const membership = await db.query.companyMembers.findFirst({
      where: and(
        eq(companyMembers.agentId, agentId),
      ),
      with: {
        company: true,
      },
    });

    // For now, orgs are not implemented - treat company as org
    // In future, companies will belong to orgs
    if (!membership) {
      return false;
    }

    const room = ROOMS.ORG(orgId);
    await socket.join(room);
    this.trackRoom(socket.id, room);
    return true;
  }

  /**
   * Leave organization room
   */
  async leaveOrg(socket: Socket, orgId: string): Promise<void> {
    const room = ROOMS.ORG(orgId);
    await socket.leave(room);
    this.untrackRoom(socket.id, room);
  }

  /**
   * Join space room - requires space access verification
   */
  async joinSpace(socket: Socket, spaceId: string, agentId: string): Promise<boolean> {
    // Verify agent has access to this space (company)
    const membership = await db.query.companyMembers.findFirst({
      where: and(
        eq(companyMembers.agentId, agentId),
        eq(companyMembers.companyId, spaceId),
      ),
    });

    if (!membership) {
      return false;
    }

    const room = ROOMS.SPACE(spaceId);
    await socket.join(room);
    this.trackRoom(socket.id, room);
    return true;
  }

  /**
   * Leave space room
   */
  async leaveSpace(socket: Socket, spaceId: string): Promise<void> {
    const room = ROOMS.SPACE(spaceId);
    await socket.leave(room);
    this.untrackRoom(socket.id, room);
  }

  /**
   * Join company room (by name) - for backward compatibility
   */
  async joinCompany(socket: Socket, companyName: string, agentId: string): Promise<boolean> {
    // Find company by name
    const company = await db.query.companies.findFirst({
      where: eq(companies.name, companyName),
    });

    if (!company) {
      return false;
    }

    // Verify membership
    const membership = await db.query.companyMembers.findFirst({
      where: and(
        eq(companyMembers.agentId, agentId),
        eq(companyMembers.companyId, company.id),
      ),
    });

    if (!membership) {
      return false;
    }

    const room = ROOMS.COMPANY(companyName);
    await socket.join(room);
    this.trackRoom(socket.id, room);
    return true;
  }

  /**
   * Leave company room
   */
  async leaveCompany(socket: Socket, companyName: string): Promise<void> {
    const room = ROOMS.COMPANY(companyName);
    await socket.leave(room);
    this.untrackRoom(socket.id, room);
  }

  /**
   * Join agent's personal room - only own agent room allowed
   */
  async joinAgent(socket: Socket, agentId: string, authenticatedAgentId: string): Promise<boolean> {
    // Can only join your own agent room
    if (agentId !== authenticatedAgentId) {
      return false;
    }

    const room = ROOMS.AGENT(agentId);
    await socket.join(room);
    this.trackRoom(socket.id, room);
    return true;
  }

  /**
   * Leave agent room
   */
  async leaveAgent(socket: Socket, agentId: string): Promise<void> {
    const room = ROOMS.AGENT(agentId);
    await socket.leave(room);
    this.untrackRoom(socket.id, room);
  }

  /**
   * Join all rooms agent has access to
   */
  async joinAllAgentRooms(socket: Socket, agentId: string): Promise<string[]> {
    const joinedRooms: string[] = [];

    // Join global room
    await this.joinGlobal(socket);
    joinedRooms.push(ROOMS.GLOBAL);

    // Join own agent room
    await this.joinAgent(socket, agentId, agentId);
    joinedRooms.push(ROOMS.AGENT(agentId));

    // Get all company memberships
    const memberships = await db.query.companyMembers.findMany({
      where: eq(companyMembers.agentId, agentId),
      with: {
        company: {
          columns: { id: true, name: true },
        },
      },
    });

    // Join each company's rooms
    for (const membership of memberships) {
      const spaceRoom = ROOMS.SPACE(membership.company.id);
      const companyRoom = ROOMS.COMPANY(membership.company.name);

      await socket.join(spaceRoom);
      await socket.join(companyRoom);

      this.trackRoom(socket.id, spaceRoom);
      this.trackRoom(socket.id, companyRoom);

      joinedRooms.push(spaceRoom);
      joinedRooms.push(companyRoom);
    }

    return joinedRooms;
  }

  /**
   * Leave all rooms on disconnect
   */
  async leaveAllRooms(socket: Socket): Promise<void> {
    const rooms = this.agentRooms.get(socket.id);
    if (rooms) {
      for (const room of rooms) {
        await socket.leave(room);
      }
      this.agentRooms.delete(socket.id);
    }
  }

  /**
   * Get all rooms a socket is in
   */
  getSocketRooms(socketId: string): string[] {
    const rooms = this.agentRooms.get(socketId);
    return rooms ? Array.from(rooms) : [];
  }

  /**
   * Get number of sockets in a room
   */
  async getRoomSize(room: string): Promise<number> {
    const sockets = await this.io.in(room).fetchSockets();
    return sockets.length;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private trackRoom(socketId: string, room: string): void {
    if (!this.agentRooms.has(socketId)) {
      this.agentRooms.set(socketId, new Set());
    }
    this.agentRooms.get(socketId)!.add(room);
  }

  private untrackRoom(socketId: string, room: string): void {
    const rooms = this.agentRooms.get(socketId);
    if (rooms) {
      rooms.delete(room);
    }
  }
}
