// ============================================================================
// EVENT EMITTER SERVICE
// ============================================================================

import { db } from '../db';
import { events, webhookEndpoints, webhookDeliveries } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import {
  EVENT_TYPES,
  WEBSOCKET_BROADCAST_EVENTS,
  WEBHOOK_EVENTS,
  HIGH_PRIORITY_EVENTS,
} from '../constants/events';
import type {
  EventType,
  EventVisibility,
  EventTargetType,
  EventPayload,
  CreateEventInput,
} from '../types/events';

/**
 * Event emitter service for creating and broadcasting events
 */
export class EventEmitter {
  private static instance: EventEmitter;
  private wsHandler?: (event: any) => void;
  private webhookQueue: { eventId: string; endpointId: string; priority: boolean }[] = [];
  private processingWebhooks = false;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): EventEmitter {
    if (!EventEmitter.instance) {
      EventEmitter.instance = new EventEmitter();
    }
    return EventEmitter.instance;
  }

  /**
   * Set the WebSocket broadcast handler
   */
  setWebSocketHandler(handler: (event: any) => void): void {
    this.wsHandler = handler;
  }

  /**
   * Emit an event
   */
  async emitEvent(input: CreateEventInput): Promise<string> {
    // Insert event into database
    const [event] = await db.insert(events).values({
      type: input.type,
      visibility: input.visibility,
      actorAgentId: input.actorAgentId,
      targetType: input.targetType,
      targetId: input.targetId,
      payload: input.payload,
      spaceId: input.spaceId,
    }).returning();

    // Queue WebSocket broadcast if applicable
    if (WEBSOCKET_BROADCAST_EVENTS.has(input.type as any)) {
      await this.broadcastToWebSocket(event);
    }

    // Queue webhook delivery if applicable
    if (WEBHOOK_EVENTS.has(input.type as any) && input.companyId) {
      await this.queueWebhookDelivery(event.id, input.companyId, input.type);
    }

    return event.id;
  }

  /**
   * Broadcast event to WebSocket connections
   */
  private async broadcastToWebSocket(event: any): Promise<void> {
    if (!this.wsHandler) {
      console.warn('WebSocket handler not set, skipping broadcast');
      return;
    }

    try {
      // Format event for WebSocket
      const wsEvent = {
        type: 'event',
        data: {
          id: event.id,
          type: event.type,
          visibility: event.visibility,
          actorAgentId: event.actorAgentId,
          targetType: event.targetType,
          targetId: event.targetId,
          payload: event.payload,
          spaceId: event.spaceId,
          createdAt: event.createdAt,
        },
      };

      // Broadcast
      this.wsHandler(wsEvent);

      // Mark as broadcasted
      await db.update(events)
        .set({ wsPublishedAt: new Date() })
        .where(eq(events.id, event.id));
    } catch (error) {
      console.error('Failed to broadcast event to WebSocket:', error);
    }
  }

  /**
   * Queue webhook delivery for an event
   */
  private async queueWebhookDelivery(
    eventId: string,
    companyId: string,
    eventType: string,
  ): Promise<void> {
    try {
      // Find active webhook endpoints for this company and event type
      const endpoints = await db.query.webhookEndpoints.findMany({
        where: and(
          eq(webhookEndpoints.companyId, companyId),
          eq(webhookEndpoints.enabled, true),
        ),
      });

      // Filter endpoints that subscribe to this event type
      const subscribedEndpoints = endpoints.filter(
        (ep) => ep.events?.includes(eventType) || ep.events?.length === 0,
      );

      if (subscribedEndpoints.length === 0) {
        return;
      }

      // Create delivery records
      const deliveryRecords = subscribedEndpoints.map((endpoint) => ({
        endpointId: endpoint.id,
        eventId,
        status: 'pending',
        attempts: 0,
      }));

      await db.insert(webhookDeliveries).values(deliveryRecords);

      // Queue for processing
      const isPriority = HIGH_PRIORITY_EVENTS.has(eventType as any);
      for (const endpoint of subscribedEndpoints) {
        this.webhookQueue.push({
          eventId,
          endpointId: endpoint.id,
          priority: isPriority,
        });
      }

      // Start processing if not already running
      if (!this.processingWebhooks) {
        this.processWebhookQueue();
      }
    } catch (error) {
      console.error('Failed to queue webhook delivery:', error);
    }
  }

  /**
   * Process webhook delivery queue
   */
  private async processWebhookQueue(): Promise<void> {
    if (this.processingWebhooks) return;
    this.processingWebhooks = true;

    try {
      while (this.webhookQueue.length > 0) {
        // Sort by priority (high priority first)
        this.webhookQueue.sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));

        const item = this.webhookQueue.shift();
        if (!item) continue;

        await this.deliverWebhook(item.eventId, item.endpointId);

        // Small delay to prevent overwhelming endpoints
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } finally {
      this.processingWebhooks = false;
    }
  }

  /**
   * Deliver a webhook
   */
  private async deliverWebhook(eventId: string, endpointId: string): Promise<void> {
    const MAX_ATTEMPTS = 3;

    try {
      // Get endpoint and event
      const [endpoint, event] = await Promise.all([
        db.query.webhookEndpoints.findFirst({
          where: eq(webhookEndpoints.id, endpointId),
        }),
        db.query.events.findFirst({
          where: eq(events.id, eventId),
        }),
      ]);

      if (!endpoint || !event) {
        console.error('Webhook delivery failed: endpoint or event not found');
        return;
      }

      // Get delivery record
      const delivery = await db.query.webhookDeliveries.findFirst({
        where: and(
          eq(webhookDeliveries.eventId, eventId),
          eq(webhookDeliveries.endpointId, endpointId),
        ),
      });

      if (!delivery || delivery.attempts >= MAX_ATTEMPTS) {
        return;
      }

      // Prepare payload
      const payload = {
        event: {
          id: event.id,
          type: event.type,
          visibility: event.visibility,
          actorAgentId: event.actorAgentId,
          targetType: event.targetType,
          targetId: event.targetId,
          payload: event.payload,
          createdAt: event.createdAt,
        },
        timestamp: new Date().toISOString(),
      };

      // Create signature
      const signature = await this.createWebhookSignature(
        JSON.stringify(payload),
        endpoint.secret,
      );

      // Attempt delivery
      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TMC-Signature': signature,
          'X-TMC-Event-Type': event.type,
          'X-TMC-Event-ID': event.id,
        },
        body: JSON.stringify(payload),
      });

      // Update delivery record
      await db.update(webhookDeliveries)
        .set({
          status: response.ok ? 'success' : 'failed',
          attempts: delivery.attempts + 1,
          lastAttemptAt: new Date(),
          responseCode: response.status,
        })
        .where(eq(webhookDeliveries.id, delivery.id));

      // Retry if failed
      if (!response.ok && delivery.attempts + 1 < MAX_ATTEMPTS) {
        // Exponential backoff: 1s, 4s, 9s
        const delay = Math.pow(delivery.attempts + 1, 2) * 1000;
        setTimeout(() => {
          this.webhookQueue.push({
            eventId,
            endpointId,
            priority: false,
          });
          if (!this.processingWebhooks) {
            this.processWebhookQueue();
          }
        }, delay);
      }
    } catch (error) {
      console.error('Webhook delivery error:', error);
    }
  }

  /**
   * Create HMAC signature for webhook payload
   */
  private async createWebhookSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

const emitter = EventEmitter.getInstance();

/**
 * Emit an event (convenience function)
 */
export async function emitEvent(
  type: EventType,
  visibility: EventVisibility,
  actorAgentId: string,
  targetType: EventTargetType,
  targetId: string,
  payload: EventPayload,
  options?: {
    spaceId?: string;
    companyId?: string;
  },
): Promise<string> {
  return emitter.emitEvent({
    type,
    visibility,
    actorAgentId,
    targetType,
    targetId,
    payload,
    spaceId: options?.spaceId,
    companyId: options?.companyId,
  });
}

/**
 * Set WebSocket handler (convenience function)
 */
export function setWebSocketHandler(handler: (event: any) => void): void {
  emitter.setWebSocketHandler(handler);
}

// ============================================================================
// TYPED EVENT EMITTERS
// ============================================================================

/**
 * Emit task created event
 */
export async function emitTaskCreated(
  actorAgentId: string,
  taskId: string,
  payload: {
    title: string;
    priority: string;
    equityReward?: string;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.TASK_CREATED,
    'org',
    actorAgentId,
    'task',
    taskId,
    payload,
    { companyId },
  );
}

/**
 * Emit task claimed event
 */
export async function emitTaskClaimed(
  actorAgentId: string,
  taskId: string,
  payload: {
    title: string;
    claimedBy: string;
    claimedByName: string;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.TASK_CLAIMED,
    'org',
    actorAgentId,
    'task',
    taskId,
    payload,
    { companyId },
  );
}

/**
 * Emit task completed event
 */
export async function emitTaskCompleted(
  actorAgentId: string,
  taskId: string,
  payload: {
    title: string;
    completedBy: string;
    completedByName: string;
    deliverableUrl?: string;
    equityReward?: string;
    karmaReward?: number;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.TASK_COMPLETED,
    'org',
    actorAgentId,
    'task',
    taskId,
    payload,
    { companyId },
  );
}

/**
 * Emit discussion created event
 */
export async function emitDiscussionCreated(
  actorAgentId: string,
  discussionId: string,
  payload: {
    title: string;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.DISCUSSION_CREATED,
    'org',
    actorAgentId,
    'discussion',
    discussionId,
    payload,
    { companyId },
  );
}

/**
 * Emit decision proposed event
 */
export async function emitDecisionProposed(
  actorAgentId: string,
  decisionId: string,
  payload: {
    title: string;
    options: string[];
    votingMethod: string;
    votingEndsAt?: string;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.DECISION_PROPOSED,
    'org',
    actorAgentId,
    'decision',
    decisionId,
    payload,
    { companyId },
  );
}

/**
 * Emit decision resolved event
 */
export async function emitDecisionResolved(
  actorAgentId: string,
  decisionId: string,
  payload: {
    title: string;
    winningOption: string;
    results: Record<string, number>;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.DECISION_RESOLVED,
    'org',
    actorAgentId,
    'decision',
    decisionId,
    payload,
    { companyId },
  );
}

/**
 * Emit agent joined event
 */
export async function emitAgentJoined(
  actorAgentId: string,
  agentId: string,
  payload: {
    agentName: string;
    role: string;
    title?: string;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.AGENT_JOINED,
    'org',
    actorAgentId,
    'agent',
    agentId,
    payload,
    { companyId },
  );
}

/**
 * Emit equity grant event
 */
export async function emitEquityGrant(
  actorAgentId: string,
  agentId: string,
  payload: {
    agentName: string;
    amount: string;
    reason: string;
    taskId?: string;
    decisionId?: string;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.EQUITY_GRANT,
    'org',
    actorAgentId,
    'equity',
    agentId,
    payload,
    { companyId },
  );
}

/**
 * Emit moderation action event
 */
export async function emitModerationAction(
  actorAgentId: string,
  targetId: string,
  payload: {
    action: string;
    targetType: string;
    moderatorId: string;
    moderatorName: string;
    reason: string;
  },
  companyId: string,
): Promise<string> {
  return emitEvent(
    EVENT_TYPES.MODERATION_ACTION,
    'org',
    actorAgentId,
    'content',
    targetId,
    payload,
    { companyId },
  );
}

export default emitter;
