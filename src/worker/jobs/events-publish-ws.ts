/**
 * Event Jobs - WebSocket Publishing
 * Publishes events to connected agents via WebSocket
 */

import { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { events, spaces, companyMembers } from '../../db/schema.js';
import type { Server as SocketServer } from 'socket.io';

// WebSocket server instance (set during app initialization)
let io: SocketServer | null = null;

/**
 * Set the WebSocket server instance for event publishing
 */
export function setWebSocketServer(server: SocketServer): void {
  io = server;
}

/**
 * Get the WebSocket server instance
 */
export function getWebSocketServer(): SocketServer | null {
  return io;
}

/**
 * Event job data interface
 */
export interface EventPublishJobData {
  eventId: string;
}

/**
 * Determine target rooms based on event visibility
 */
async function determineRooms(event: {
  id: string;
  type: string;
  visibility: string;
  actorAgentId: string;
  spaceId: string | null;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
}): Promise<string[]> {
  const rooms: string[] = [];

  switch (event.visibility) {
    case 'global':
      // Broadcast to all connected clients
      rooms.push('global');
      break;

    case 'org':
      // Get the company/org from the actor's memberships or payload
      if (event.payload?.companyId) {
        rooms.push(`company:${event.payload.companyId}`);
      } else if (event.payload?.companyName) {
        rooms.push(`company:${event.payload.companyName}`);
      } else {
        // Find companies the actor belongs to
        const memberships = await db.query.companyMembers.findMany({
          where: eq(companyMembers.agentId, event.actorAgentId),
          columns: { companyId: true },
        });
        for (const membership of memberships) {
          rooms.push(`company:${membership.companyId}`);
        }
      }
      break;

    case 'space':
      // Broadcast to a specific space
      if (event.spaceId) {
        rooms.push(`space:${event.spaceId}`);

        // Also get space members for individual notifications
        const space = await db.query.spaces.findFirst({
          where: eq(spaces.id, event.spaceId),
          columns: { companyId: true },
        });

        if (space?.companyId) {
          rooms.push(`company:${space.companyId}`);
        }
      }
      break;

    case 'agent':
      // Direct notification to a specific agent
      if (event.targetType === 'agent' && event.targetId) {
        rooms.push(`agent:${event.targetId}`);
      }
      // Also notify the actor
      rooms.push(`agent:${event.actorAgentId}`);
      break;

    default:
      // Fallback to actor's room
      rooms.push(`agent:${event.actorAgentId}`);
  }

  return [...new Set(rooms)]; // Deduplicate
}

/**
 * Format event payload for WebSocket transmission
 */
function formatEventPayload(event: {
  id: string;
  type: string;
  visibility: string;
  actorAgentId: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown>;
  spaceId: string | null;
  createdAt: Date;
}): Record<string, unknown> {
  return {
    id: event.id,
    type: event.type,
    visibility: event.visibility,
    actor: event.actorAgentId,
    target: event.targetId ? {
      type: event.targetType,
      id: event.targetId,
    } : null,
    data: event.payload,
    spaceId: event.spaceId,
    timestamp: event.createdAt.toISOString(),
  };
}

/**
 * Publish event to WebSocket
 * Main job handler for the events queue
 */
export async function publishWsJob(job: Job<EventPublishJobData>): Promise<void> {
  if (!io) {
    console.warn('[EventsJob] WebSocket server not initialized, skipping publish');
    return;
  }

  const { eventId } = job.data;

  // Fetch the event from database
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    console.warn(`[EventsJob] Event ${eventId} not found, skipping`);
    return;
  }

  // Skip if already published
  if (event.wsPublishedAt) {
    console.log(`[EventsJob] Event ${eventId} already published, skipping`);
    return;
  }

  // Determine target rooms based on visibility
  const rooms = await determineRooms({
    ...event,
    payload: (event.payload as Record<string, unknown>) || {},
  });

  // Format the event payload
  const payload = formatEventPayload({
    ...event,
    payload: (event.payload as Record<string, unknown>) || {},
  });

  // Emit to each target room
  for (const room of rooms) {
    try {
      io.to(room).emit('event', payload);
      console.log(`[EventsJob] Published event ${eventId} to room ${room}`);
    } catch (error) {
      console.error(`[EventsJob] Failed to emit to room ${room}:`, error);
    }
  }

  // Mark as published
  await db.update(events)
    .set({ wsPublishedAt: new Date() })
    .where(eq(events.id, eventId));

  console.log(`[EventsJob] Event ${eventId} published to ${rooms.length} rooms`);
}

/**
 * Broadcast job for bulk messaging
 */
export interface BroadcastJobData {
  type: string;
  payload: unknown;
  targets?: string[]; // Optional specific room targets
}

export async function broadcastJob(job: Job<BroadcastJobData>): Promise<void> {
  if (!io) {
    console.warn('[EventsJob] WebSocket server not initialized, skipping broadcast');
    return;
  }

  const { type, payload, targets } = job.data;

  const message = {
    type,
    data: payload,
    timestamp: new Date().toISOString(),
  };

  if (targets && targets.length > 0) {
    // Emit to specific targets
    for (const target of targets) {
      io.to(target).emit('broadcast', message);
    }
    console.log(`[EventsJob] Broadcast ${type} to ${targets.length} targets`);
  } else {
    // Emit to all connected clients
    io.emit('broadcast', message);
    console.log(`[EventsJob] Global broadcast: ${type}`);
  }
}

/**
 * Agent action notification job
 */
export interface AgentActionJobData {
  agentId: string;
  action: string;
  data: unknown;
}

export async function agentActionJob(job: Job<AgentActionJobData>): Promise<void> {
  if (!io) {
    console.warn('[EventsJob] WebSocket server not initialized, skipping agent action');
    return;
  }

  const { agentId, action, data } = job.data;

  // Get agent's companies to notify
  const memberships = await db.query.companyMembers.findMany({
    where: eq(companyMembers.agentId, agentId),
    columns: { companyId: true },
  });

  const payload = {
    type: 'agent_action',
    agent: agentId,
    action,
    data,
    timestamp: new Date().toISOString(),
  };

  // Notify each company the agent belongs to
  for (const membership of memberships) {
    io.to(`company:${membership.companyId}`).emit('agent_action', payload);
  }

  console.log(`[EventsJob] Agent action ${action} published for agent ${agentId}`);
}

/**
 * Decision update notification job
 */
export interface DecisionUpdateJobData {
  decisionId: string;
  status: string;
  companyId?: string;
}

export async function decisionUpdateJob(job: Job<DecisionUpdateJobData>): Promise<void> {
  if (!io) {
    console.warn('[EventsJob] WebSocket server not initialized, skipping decision update');
    return;
  }

  const { decisionId, status, companyId } = job.data;

  const payload = {
    type: 'decision_update',
    decisionId,
    status,
    timestamp: new Date().toISOString(),
  };

  if (companyId) {
    io.to(`company:${companyId}`).emit('decision_update', payload);
    console.log(`[EventsJob] Decision ${decisionId} update published to company ${companyId}`);
  } else {
    // Broadcast to all if no company specified
    io.emit('decision_update', payload);
    console.log(`[EventsJob] Decision ${decisionId} update broadcast globally`);
  }
}

/**
 * Company metric update notification job
 */
export interface CompanyMetricJobData {
  companyId: string;
  metric: string;
  value: number;
}

export async function companyMetricJob(job: Job<CompanyMetricJobData>): Promise<void> {
  if (!io) {
    console.warn('[EventsJob] WebSocket server not initialized, skipping metric update');
    return;
  }

  const { companyId, metric, value } = job.data;

  const payload = {
    type: 'company_metric',
    companyId,
    metric,
    value,
    timestamp: new Date().toISOString(),
  };

  io.to(`company:${companyId}`).emit('metric_update', payload);
  console.log(`[EventsJob] Metric ${metric}=${value} published for company ${companyId}`);
}
