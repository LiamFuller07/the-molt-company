/**
 * WebSocket Connection Handler
 *
 * Handles socket connections, authentication, and event subscriptions.
 */

import type { Socket, Server } from 'socket.io';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { agents } from '../../db/schema.js';
import { RoomManager } from '../rooms.js';
import { presenceManager } from '../presence.js';

// ============================================================================
// TYPES
// ============================================================================

export interface AuthenticatedSocket extends Socket {
  agentId?: string;
  agentName?: string;
  companies?: string[];
}

export interface ConnectionContext {
  io: Server;
  roomManager: RoomManager;
}

// ============================================================================
// AUTH MIDDLEWARE
// ============================================================================

/**
 * Authentication middleware for Socket.IO
 * Validates API key from handshake auth or authorization header
 */
export function authMiddleware(_context: ConnectionContext) {
  return async (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    const token =
      socket.handshake.auth.token ||
      socket.handshake.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      // Verify token and get agent
      const agent = await db.query.agents.findFirst({
        where: eq(agents.apiKey, token),
      });

      if (!agent) {
        return next(new Error('Invalid token'));
      }

      // Attach agent info to socket
      socket.agentId = agent.id;
      socket.agentName = agent.name;
      socket.companies = [];

      next();
    } catch (error) {
      console.error('WebSocket auth error:', error);
      next(new Error('Authentication failed'));
    }
  };
}

// ============================================================================
// CONNECTION HANDLER
// ============================================================================

/**
 * Handle new socket connections
 */
export function handleConnection(context: ConnectionContext) {
  const { roomManager } = context;

  return async (socket: AuthenticatedSocket) => {
    const agentId = socket.agentId;
    const agentName = socket.agentName;

    if (!agentId) {
      socket.disconnect();
      return;
    }

    console.log(`Agent connected: ${agentName} (${socket.id})`);

    // Set agent as online in presence manager
    presenceManager.setOnline(agentId, agentName);

    // Join all rooms agent has access to
    const joinedRooms = await roomManager.joinAllAgentRooms(socket, agentId);
    socket.companies = joinedRooms
      .filter((r: string) => r.startsWith('company:'))
      .map((r: string) => r.replace('company:', ''));

    // Send welcome message
    socket.emit('connected', {
      agent: agentName,
      agentId,
      companies: socket.companies,
      rooms: joinedRooms,
      timestamp: new Date().toISOString(),
    });

    // Send current presence list
    presenceManager.sendFullPresence(socket.id);

    // ========================================================================
    // EVENT HANDLERS
    // ========================================================================

    // Subscribe to a company
    socket.on('subscribe', async (companyName: string) => {
      if (!agentId) return;

      const success = await roomManager.joinCompany(socket, companyName, agentId);
      if (success) {
        socket.companies?.push(companyName);
        socket.emit('subscribed', { company: companyName });
      } else {
        socket.emit('error', { message: 'Not a member of this company' });
      }
    });

    // Unsubscribe from a company
    socket.on('unsubscribe', async (companyName: string) => {
      await roomManager.leaveCompany(socket, companyName);
      socket.companies = socket.companies?.filter((c) => c !== companyName);
      socket.emit('unsubscribed', { company: companyName });
    });

    // Join a specific room
    socket.on('join_room', async (data: { type: string; id: string }) => {
      if (!agentId) return;

      let success = false;
      switch (data.type) {
        case 'org':
          success = await roomManager.joinOrg(socket, data.id, agentId);
          break;
        case 'space':
          success = await roomManager.joinSpace(socket, data.id, agentId);
          break;
        case 'company':
          success = await roomManager.joinCompany(socket, data.id, agentId);
          break;
      }

      if (success) {
        socket.emit('room_joined', { type: data.type, id: data.id });
      } else {
        socket.emit('error', { message: `Cannot join ${data.type} room` });
      }
    });

    // Leave a specific room
    socket.on('leave_room', async (data: { type: string; id: string }) => {
      switch (data.type) {
        case 'org':
          await roomManager.leaveOrg(socket, data.id);
          break;
        case 'space':
          await roomManager.leaveSpace(socket, data.id);
          break;
        case 'company':
          await roomManager.leaveCompany(socket, data.id);
          break;
      }
      socket.emit('room_left', { type: data.type, id: data.id });
    });

    // Heartbeat
    socket.on('heartbeat', async () => {
      if (!agentId) return;

      // Update last active in database
      await db
        .update(agents)
        .set({ lastActiveAt: new Date() })
        .where(eq(agents.id, agentId));

      // Update presence
      presenceManager.heartbeat(agentId);

      socket.emit('heartbeat_ack', {
        timestamp: new Date().toISOString(),
      });
    });

    // Update presence status
    socket.on(
      'update_status',
      (data: { status: 'online' | 'working' | 'idle' | 'away'; taskId?: string; taskTitle?: string; company?: string }) => {
        if (!agentId) return;

        switch (data.status) {
          case 'working':
            if (data.taskId) {
              presenceManager.setWorking(agentId, data.taskId, data.taskTitle, data.company);
            }
            break;
          case 'idle':
            presenceManager.setIdle(agentId);
            break;
          case 'away':
            presenceManager.setAway(agentId);
            break;
          default:
            presenceManager.update(agentId, { status: 'online' });
        }

        socket.emit('status_updated', { status: data.status });
      }
    );

    // Check presence of other agents
    socket.on('presence', (agentNames: string[]) => {
      const result = presenceManager.checkPresenceByName(agentNames);
      socket.emit('presence_result', result);
    });

    // Get all online agents
    socket.on('get_online', () => {
      const online = presenceManager.getOnlineAgents();
      socket.emit('online_agents', {
        agents: online.map((p: { agentId: string; agentName?: string; status: string; currentTask?: string }) => ({
          agentId: p.agentId,
          agentName: p.agentName,
          status: p.status,
          currentTask: p.currentTask,
        })),
        timestamp: new Date().toISOString(),
      });
    });

    // ========================================================================
    // DISCONNECT
    // ========================================================================

    socket.on('disconnect', async () => {
      console.log(`Agent disconnected: ${agentName}`);

      // Clean up presence
      presenceManager.setOffline(agentId);

      // Leave all rooms
      await roomManager.leaveAllRooms(socket);
    });
  };
}

// ============================================================================
// CONNECTION TRACKER
// ============================================================================

/**
 * Track active connections for direct access
 */
class ConnectionTracker {
  private connections: Map<string, AuthenticatedSocket> = new Map();

  add(agentId: string, socket: AuthenticatedSocket): void {
    this.connections.set(agentId, socket);
  }

  remove(agentId: string): void {
    this.connections.delete(agentId);
  }

  get(agentId: string): AuthenticatedSocket | undefined {
    return this.connections.get(agentId);
  }

  has(agentId: string): boolean {
    return this.connections.has(agentId);
  }

  getAll(): AuthenticatedSocket[] {
    return Array.from(this.connections.values());
  }

  getAgentIds(): string[] {
    return Array.from(this.connections.keys());
  }

  count(): number {
    return this.connections.size;
  }

  clear(): void {
    this.connections.clear();
  }
}

export const connectionTracker = new ConnectionTracker();
