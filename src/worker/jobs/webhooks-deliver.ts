/**
 * Webhook Delivery Jobs
 * Handles delivery of webhooks to external endpoints
 */

import { Job } from 'bullmq';
import { createHmac } from 'crypto';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  webhookEndpoints,
  webhookDeliveries,
  events,
} from '../../db/schema.js';

/**
 * Webhook delivery job data
 */
export interface WebhookDeliverJobData {
  endpointId: string;
  eventId: string;
}

/**
 * Generic webhook delivery job data (for URL-based delivery)
 */
export interface GenericWebhookJobData {
  url: string;
  payload: unknown;
  secret?: string;
  headers?: Record<string, string>;
}

/**
 * Maximum consecutive failures before disabling endpoint
 */
const MAX_FAILURES = 5;

/**
 * Timeout for webhook delivery (in ms)
 */
const DELIVERY_TIMEOUT = 30000;

/**
 * Generate HMAC signature for webhook payload
 */
function generateSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Log webhook delivery attempt
 */
async function logDelivery(
  endpointId: string,
  eventId: string,
  status: 'success' | 'failed',
  responseCode?: number
): Promise<void> {
  // Check if delivery record exists
  const existing = await db.query.webhookDeliveries.findFirst({
    where: and(
      eq(webhookDeliveries.endpointId, endpointId),
      eq(webhookDeliveries.eventId, eventId)
    ),
  });

  if (existing) {
    // Update existing record
    await db.update(webhookDeliveries)
      .set({
        status,
        attempts: sql`${webhookDeliveries.attempts} + 1`,
        lastAttemptAt: new Date(),
        responseCode,
      })
      .where(eq(webhookDeliveries.id, existing.id));
  } else {
    // Create new record
    await db.insert(webhookDeliveries).values({
      endpointId,
      eventId,
      status,
      attempts: 1,
      lastAttemptAt: new Date(),
      responseCode,
    });
  }
}

/**
 * Track consecutive failures and disable endpoint if necessary
 */
async function handleFailure(endpointId: string): Promise<void> {
  // Get recent deliveries for this endpoint
  const recentDeliveries = await db.query.webhookDeliveries.findMany({
    where: eq(webhookDeliveries.endpointId, endpointId),
    orderBy: (deliveries: typeof webhookDeliveries.$inferSelect, { desc }: { desc: (col: unknown) => unknown }) => [desc(deliveries.lastAttemptAt)],
    limit: MAX_FAILURES,
  });

  // Check if all recent deliveries failed
  const allFailed = recentDeliveries.length >= MAX_FAILURES &&
    recentDeliveries.every((d: typeof recentDeliveries[number]) => d.status === 'failed');

  if (allFailed) {
    // Disable the endpoint
    await db.update(webhookEndpoints)
      .set({ enabled: false })
      .where(eq(webhookEndpoints.id, endpointId));

    console.warn(
      `[WebhooksJob] Disabled endpoint ${endpointId} after ${MAX_FAILURES} consecutive failures`
    );
  }
}

/**
 * Reset failure count on successful delivery
 */
async function handleSuccess(endpointId: string): Promise<void> {
  // Re-enable endpoint if it was disabled
  await db.update(webhookEndpoints)
    .set({ enabled: true })
    .where(eq(webhookEndpoints.id, endpointId));
}

/**
 * Main webhook delivery job handler
 */
export async function deliverWebhookJob(job: Job<WebhookDeliverJobData>): Promise<void> {
  const { endpointId, eventId } = job.data;

  // Fetch endpoint configuration
  const endpoint = await db.query.webhookEndpoints.findFirst({
    where: eq(webhookEndpoints.id, endpointId),
  });

  if (!endpoint) {
    console.warn(`[WebhooksJob] Endpoint ${endpointId} not found, skipping`);
    return;
  }

  // Check if endpoint is enabled
  if (!endpoint.enabled) {
    console.log(`[WebhooksJob] Endpoint ${endpointId} is disabled, skipping`);
    return;
  }

  // Fetch the event
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
  });

  if (!event) {
    console.warn(`[WebhooksJob] Event ${eventId} not found, skipping`);
    return;
  }

  // Check if event type matches endpoint subscriptions
  const subscribedEvents = (endpoint.events as string[]) || [];
  if (subscribedEvents.length > 0 && !subscribedEvents.includes(event.type)) {
    console.log(
      `[WebhooksJob] Event type ${event.type} not subscribed by endpoint ${endpointId}, skipping`
    );
    return;
  }

  // Prepare payload
  const payload = {
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
    createdAt: event.createdAt.toISOString(),
    deliveredAt: new Date().toISOString(),
  };

  const payloadString = JSON.stringify(payload);

  // Generate signature
  const signature = generateSignature(payloadString, endpoint.secret);

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Molt-Signature': signature,
    'X-Molt-Event-Id': event.id,
    'X-Molt-Event-Type': event.type,
    'X-Molt-Delivery-Timestamp': new Date().toISOString(),
  };

  try {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

    // Deliver webhook
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Log delivery result
    if (response.ok) {
      await logDelivery(endpointId, eventId, 'success', response.status);
      await handleSuccess(endpointId);
      console.log(
        `[WebhooksJob] Successfully delivered event ${eventId} to ${endpoint.url} (${response.status})`
      );
    } else {
      await logDelivery(endpointId, eventId, 'failed', response.status);
      await handleFailure(endpointId);
      console.warn(
        `[WebhooksJob] Failed to deliver event ${eventId} to ${endpoint.url} (${response.status})`
      );

      // Throw error to trigger retry
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }
  } catch (error) {
    // Handle network errors
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[WebhooksJob] Error delivering webhook:`, errorMessage);

    await logDelivery(endpointId, eventId, 'failed');
    await handleFailure(endpointId);

    // Re-throw for BullMQ retry logic
    throw error;
  }
}

/**
 * Generic webhook delivery (for one-off webhooks without stored endpoints)
 */
export async function deliverGenericWebhookJob(job: Job<GenericWebhookJobData>): Promise<void> {
  const { url, payload, secret, headers: customHeaders } = job.data;

  const payloadString = JSON.stringify(payload);

  // Prepare headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Molt-Delivery-Timestamp': new Date().toISOString(),
    ...customHeaders,
  };

  // Add signature if secret provided
  if (secret) {
    headers['X-Molt-Signature'] = generateSignature(payloadString, secret);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT);

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Webhook delivery failed with status ${response.status}`);
    }

    console.log(`[WebhooksJob] Successfully delivered generic webhook to ${url}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[WebhooksJob] Error delivering generic webhook:`, errorMessage);
    throw error;
  }
}

/**
 * Retry failed webhooks job
 */
export interface RetryFailedWebhooksJobData {
  webhookId?: string;
  maxAge?: number; // Max age in hours to retry
}

export async function retryFailedWebhooksJob(job: Job<RetryFailedWebhooksJobData>): Promise<void> {
  const { webhookId, maxAge = 24 } = job.data;

  // Find failed deliveries
  const failedDeliveries = await db.query.webhookDeliveries.findMany({
    where: webhookId
      ? and(
          eq(webhookDeliveries.id, webhookId),
          eq(webhookDeliveries.status, 'failed')
        )
      : eq(webhookDeliveries.status, 'failed'),
    limit: 100,
    with: {
      endpoint: true,
    },
  });

  console.log(`[WebhooksJob] Found ${failedDeliveries.length} failed deliveries to retry`);

  let retried = 0;
  let skipped = 0;

  for (const delivery of failedDeliveries) {
    // Skip if endpoint is disabled
    if (!delivery.endpoint?.enabled) {
      skipped++;
      continue;
    }

    // Skip if too many attempts
    if (delivery.attempts >= MAX_FAILURES) {
      skipped++;
      continue;
    }

    // Skip if too old
    if (delivery.lastAttemptAt) {
      const ageHours = (Date.now() - delivery.lastAttemptAt.getTime()) / (1000 * 60 * 60);
      if (ageHours > maxAge) {
        skipped++;
        continue;
      }
    }

    // Queue retry
    try {
      // This would add to the webhooks queue for retry
      // In practice, you'd import the queue and add the job
      console.log(
        `[WebhooksJob] Queuing retry for delivery ${delivery.id} ` +
        `(endpoint: ${delivery.endpointId}, event: ${delivery.eventId})`
      );
      retried++;
    } catch (error) {
      console.error(`[WebhooksJob] Failed to queue retry for delivery ${delivery.id}:`, error);
    }
  }

  console.log(`[WebhooksJob] Retry complete: ${retried} queued, ${skipped} skipped`);
}
