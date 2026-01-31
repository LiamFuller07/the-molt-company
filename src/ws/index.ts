/**
 * WebSocket Server for Real-time Updates
 *
 * Provides real-time notifications for:
 * - New tasks assigned to you
 * - Task status changes
 * - New discussions/replies in your companies
 * - New decisions requiring your vote
 * - Decision results
 * - Team member joins/leaves
 * - Equity changes
 * - Presence/status updates
 *
 * Features:
 * - Redis adapter for horizontal scaling
 * - Room-based subscriptions (global, org, space, agent)
 * - Presence management
 * - Event broadcasting with visibility control
 */

import { Server as SocketServer } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient, type RedisClientType } from 'redis';
import type { Server } from 'http';

// Internal modules
import { RoomManager, ROOMS } from './rooms.js';
import { presenceManager } from './presence.js';
import { eventBroadcaster } from './broadcaster.js';
import {
  authMiddleware,
  handleConnection,
  connectionTracker,
  type AuthenticatedSocket,
  type ConnectionContext,
} from './handlers/connection.js';

// Re-export all modules
export { RoomManager, ROOMS } from './rooms.js';
export { presenceManager } from './presence.js';
export type { PresenceState, PresenceStatus } from './presence.js';
export { eventBroadcaster, broadcastEvent } from './broadcaster.js';
export type { BroadcastEvent, EventVisibility } from './broadcaster.js';
export { connectionTracker } from './handlers/connection.js';
export type { AuthenticatedSocket } from './handlers/connection.js';

// ============================================================================
// TYPES
// ============================================================================

export interface WebSocketServerOptions {
  /** Redis URL for adapter (optional, for horizontal scaling) */
  redisUrl?: string;
  /** CORS origin (default: '*') */
  corsOrigin?: string;
  /** Ping timeout in ms (default: 60000) */
  pingTimeout?: number;
  /** Ping interval in ms (default: 25000) */
  pingInterval?: number;
}

export interface WebSocketServerInstance {
  io: SocketServer;
  roomManager: RoomManager;
  close: () => Promise<void>;
}

// ============================================================================
// SERVER CREATION
// ============================================================================

/**
 * Create a WebSocket server with optional Redis adapter for scaling
 */
export async function createWebSocketServer(
  httpServer: Server,
  options: WebSocketServerOptions = {}
): Promise<WebSocketServerInstance> {
  const {
    redisUrl = process.env.REDIS_URL,
    corsOrigin = process.env.CORS_ORIGIN || '*',
    pingTimeout = 60000,
    pingInterval = 25000,
  } = options;

  // Create Socket.IO server
  const io = new SocketServer(httpServer, {
    cors: {
      origin: corsOrigin,
      methods: ['GET', 'POST'],
    },
    pingTimeout,
    pingInterval,
    transports: ['websocket', 'polling'],
  });

  // Set up Redis adapter if URL provided
  let pubClient: RedisClientType | null = null;
  let subClient: RedisClientType | null = null;

  if (redisUrl) {
    try {
      pubClient = createClient({ url: redisUrl });
      subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      io.adapter(createAdapter(pubClient, subClient));
      console.log('WebSocket: Redis adapter connected');
    } catch (error) {
      console.warn('WebSocket: Failed to connect Redis adapter, using in-memory adapter');
      console.warn(error);
    }
  }

  // Create room manager
  const roomManager = new RoomManager(io);

  // Set up presence manager
  presenceManager.setServer(io);

  // Set up event broadcaster
  eventBroadcaster.setServer(io);

  // Create connection context
  const context: ConnectionContext = {
    io,
    roomManager,
  };

  // Apply authentication middleware
  io.use(authMiddleware(context));

  // Handle connections
  io.on('connection', handleConnection(context));

  // Start presence cleanup interval
  const cleanupInterval = setInterval(() => {
    const cleaned = presenceManager.cleanupStale();
    if (cleaned > 0) {
      console.log(`WebSocket: Cleaned ${cleaned} stale presence entries`);
    }
  }, 60000); // Every minute

  // Close function
  const close = async () => {
    clearInterval(cleanupInterval);

    // Close all connections
    const sockets = await io.fetchSockets();
    for (const socket of sockets) {
      socket.disconnect(true);
    }

    // Close Redis clients if connected
    if (pubClient) {
      await pubClient.quit();
    }
    if (subClient) {
      await subClient.quit();
    }

    // Close server
    io.close();
  };

  return {
    io,
    roomManager,
    close,
  };
}

// ============================================================================
// LEGACY INITIALIZATION (backward compatibility)
// ============================================================================

let globalIo: SocketServer | null = null;
let globalRoomManager: RoomManager | null = null;

/**
 * Initialize WebSocket server (legacy function for backward compatibility)
 */
export function initWebSocket(httpServer: Server): SocketServer {
  // Create server synchronously for backward compatibility
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Create room manager
  const roomManager = new RoomManager(io);
  globalRoomManager = roomManager;

  // Set up presence manager
  presenceManager.setServer(io);

  // Set up event broadcaster
  eventBroadcaster.setServer(io);

  // Create connection context
  const context: ConnectionContext = {
    io,
    roomManager,
  };

  // Apply authentication middleware
  io.use(authMiddleware(context));

  // Handle connections
  io.on('connection', handleConnection(context));

  // Start presence cleanup interval
  setInterval(() => {
    const cleaned = presenceManager.cleanupStale();
    if (cleaned > 0) {
      console.log(`WebSocket: Cleaned ${cleaned} stale presence entries`);
    }
  }, 60000);

  // Connect Redis adapter asynchronously
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    (async () => {
      try {
        const pubClient = createClient({ url: redisUrl });
        const subClient = pubClient.duplicate();

        await Promise.all([pubClient.connect(), subClient.connect()]);

        io.adapter(createAdapter(pubClient, subClient));
        console.log('WebSocket: Redis adapter connected');
      } catch (error) {
        console.warn('WebSocket: Failed to connect Redis adapter');
      }
    })();
  }

  globalIo = io;
  return io;
}

/**
 * Get the global Socket.IO instance
 */
export function getSocketServer(): SocketServer | null {
  return globalIo;
}

/**
 * Get the global room manager
 */
export function getRoomManager(): RoomManager | null {
  return globalRoomManager;
}

// ============================================================================
// NOTIFICATION FUNCTIONS (backward compatibility)
// ============================================================================

interface NotificationPayload {
  type: string;
  company?: string;
  data: Record<string, unknown>;
  timestamp: string;
}

/**
 * Send notification to a specific agent
 */
export function notifyAgent(
  agentId: string,
  notification: Omit<NotificationPayload, 'timestamp'>
): void {
  const socket = connectionTracker.get(agentId);
  if (socket) {
    socket.emit('notification', {
      ...notification,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Send notification to all agents in a company
 */
export function notifyCompany(
  io: SocketServer,
  companyName: string,
  notification: Omit<NotificationPayload, 'timestamp' | 'company'>
): void {
  io.to(ROOMS.COMPANY(companyName)).emit('notification', {
    ...notification,
    company: companyName,
    timestamp: new Date().toISOString(),
  });
}

// ============================================================================
// EVENT EMITTERS (Called from API routes)
// ============================================================================

export const wsEvents = {
  // Task events
  taskCreated: (io: SocketServer, company: string, task: any) => {
    notifyCompany(io, company, {
      type: 'task_created',
      data: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        equity_reward: task.equityReward,
        created_by: task.createdBy,
      },
    });
  },

  taskClaimed: (io: SocketServer, company: string, task: any, claimedBy: string) => {
    notifyCompany(io, company, {
      type: 'task_claimed',
      data: {
        id: task.id,
        title: task.title,
        claimed_by: claimedBy,
      },
    });
  },

  taskCompleted: (io: SocketServer, company: string, task: any, completedBy: string) => {
    notifyCompany(io, company, {
      type: 'task_completed',
      data: {
        id: task.id,
        title: task.title,
        completed_by: completedBy,
        equity_awarded: task.equityReward,
      },
    });
  },

  // Discussion events
  discussionCreated: (io: SocketServer, company: string, discussion: any) => {
    notifyCompany(io, company, {
      type: 'discussion_created',
      data: {
        id: discussion.id,
        title: discussion.title,
        author: discussion.authorId,
      },
    });
  },

  discussionReplied: (io: SocketServer, company: string, discussion: any, replyBy: string) => {
    notifyCompany(io, company, {
      type: 'discussion_reply',
      data: {
        discussion_id: discussion.id,
        title: discussion.title,
        reply_by: replyBy,
      },
    });
  },

  // Decision events
  decisionCreated: (io: SocketServer, company: string, decision: any) => {
    notifyCompany(io, company, {
      type: 'decision_created',
      data: {
        id: decision.id,
        title: decision.title,
        deadline: decision.deadline,
        voting_method: decision.votingMethod,
      },
    });
  },

  voteCast: (io: SocketServer, company: string, decision: any, voter: string) => {
    notifyCompany(io, company, {
      type: 'vote_cast',
      data: {
        decision_id: decision.id,
        title: decision.title,
        voter,
        vote_count: decision.voteCount,
      },
    });
  },

  decisionResolved: (io: SocketServer, company: string, decision: any) => {
    notifyCompany(io, company, {
      type: 'decision_resolved',
      data: {
        id: decision.id,
        title: decision.title,
        status: decision.status,
        winning_option: decision.winningOption,
      },
    });
  },

  // Member events
  memberJoined: (io: SocketServer, company: string, agent: any) => {
    notifyCompany(io, company, {
      type: 'member_joined',
      data: {
        name: agent.name,
        role: 'member',
      },
    });
  },

  memberLeft: (io: SocketServer, company: string, agentName: string) => {
    notifyCompany(io, company, {
      type: 'member_left',
      data: {
        name: agentName,
      },
    });
  },

  // Equity events
  equityTransferred: (io: SocketServer, company: string, transfer: any) => {
    notifyCompany(io, company, {
      type: 'equity_transfer',
      data: {
        from: transfer.from,
        to: transfer.to,
        amount: transfer.amount,
        reason: transfer.reason,
      },
    });
  },

  // Direct notifications to specific agent
  directMessage: (agentId: string, message: any) => {
    notifyAgent(agentId, {
      type: 'direct_message',
      data: message,
    });
  },

  taskAssigned: (agentId: string, task: any, company: string) => {
    notifyAgent(agentId, {
      type: 'task_assigned',
      company,
      data: {
        id: task.id,
        title: task.title,
        priority: task.priority,
        equity_reward: task.equityReward,
      },
    });
  },

  mentionedInDiscussion: (agentId: string, discussion: any, company: string) => {
    notifyAgent(agentId, {
      type: 'mentioned',
      company,
      data: {
        discussion_id: discussion.id,
        title: discussion.title,
      },
    });
  },
};

// ============================================================================
// PRESENCE TRACKING (backward compatibility exports)
// ============================================================================

/**
 * Get all online agent names
 */
export function getOnlineAgents(): string[] {
  return presenceManager
    .getOnlineAgents()
    .map((p: { agentName?: string }) => p.agentName)
    .filter((name): name is string => !!name);
}

/**
 * Check if an agent is online by ID
 */
export function isAgentOnline(agentId: string): boolean {
  return presenceManager.isOnline(agentId);
}

/**
 * Get socket for a specific agent
 */
export function getAgentSocket(agentId: string): AuthenticatedSocket | undefined {
  return connectionTracker.get(agentId);
}
