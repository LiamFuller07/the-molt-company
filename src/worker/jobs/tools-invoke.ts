/**
 * Tool Invocation Jobs
 * Handles MCP tool invocations and external integrations
 */

import { Job } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  agents,
  companyTools,
  toolInvocations,
  events,
} from '../../db/schema.js';

/**
 * Tool invocation job data
 */
export interface ToolInvokeJobData {
  toolName: string;
  agentId: string;
  params: Record<string, unknown>;
  companyId?: string;
}

/**
 * Batch tool invocation job data
 */
export interface BatchToolInvokeJobData {
  tools: Array<{
    name: string;
    params: Record<string, unknown>;
  }>;
  agentId: string;
  companyId?: string;
}

/**
 * Tool registry - maps tool names to their handlers
 */
const toolHandlers: Record<string, (params: unknown, context: ToolContext) => Promise<unknown>> = {
  // Placeholder handlers - in production these would integrate with actual services
  'github.create_issue': async (params, context) => {
    console.log('[ToolsJob] Creating GitHub issue:', params);
    return { id: 'mock-issue-id', url: 'https://github.com/example/repo/issues/1' };
  },

  'github.create_pr': async (params, context) => {
    console.log('[ToolsJob] Creating GitHub PR:', params);
    return { id: 'mock-pr-id', url: 'https://github.com/example/repo/pull/1' };
  },

  'slack.send_message': async (params, context) => {
    console.log('[ToolsJob] Sending Slack message:', params);
    return { ok: true, ts: '1234567890.123456' };
  },

  'notion.create_page': async (params, context) => {
    console.log('[ToolsJob] Creating Notion page:', params);
    return { id: 'mock-page-id', url: 'https://notion.so/page' };
  },

  'linear.create_issue': async (params, context) => {
    console.log('[ToolsJob] Creating Linear issue:', params);
    return { id: 'mock-linear-id', identifier: 'PROJ-123' };
  },

  'email.send': async (params, context) => {
    console.log('[ToolsJob] Sending email:', params);
    return { messageId: 'mock-message-id', sent: true };
  },
};

/**
 * Context passed to tool handlers
 */
interface ToolContext {
  agentId: string;
  agentName?: string;
  companyId?: string;
  credentials?: Record<string, string>;
}

/**
 * Get credentials for a tool from company configuration
 */
async function getToolCredentials(
  toolName: string,
  companyId?: string
): Promise<Record<string, string> | null> {
  if (!companyId) return null;

  // Extract the service name from tool name (e.g., 'github' from 'github.create_issue')
  const serviceName = toolName.split('.')[0];

  const tool = await db.query.companyTools.findFirst({
    where: eq(companyTools.toolName, serviceName),
    columns: {
      accessToken: true,
      config: true,
    },
  });

  if (!tool || !tool.accessToken) return null;

  return {
    accessToken: tool.accessToken,
    ...(tool.config as Record<string, string> || {}),
  };
}

/**
 * Log tool invocation to database
 */
async function logInvocation(
  agentId: string,
  toolName: string,
  input: Record<string, unknown>,
  output: Record<string, unknown>,
  success: boolean
): Promise<void> {
  await db.insert(toolInvocations).values({
    agentId,
    toolName,
    input,
    output,
    success,
  });
}

/**
 * Main tool invocation job handler
 */
export async function invokeToolJob(job: Job<ToolInvokeJobData>): Promise<unknown> {
  const { toolName, agentId, params, companyId } = job.data;

  console.log(`[ToolsJob] Invoking tool ${toolName} for agent ${agentId}`);

  // Get agent info
  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
    columns: { name: true, status: true },
  });

  if (!agent) {
    throw new Error(`Agent ${agentId} not found`);
  }

  if (agent.status !== 'active') {
    throw new Error(`Agent ${agentId} is not active`);
  }

  // Get tool handler
  const handler = toolHandlers[toolName];
  if (!handler) {
    console.warn(`[ToolsJob] Unknown tool: ${toolName}`);
    await logInvocation(agentId, toolName, params, { error: 'Unknown tool' }, false);
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Get credentials if available
  const credentials = await getToolCredentials(toolName, companyId);

  // Build context
  const context: ToolContext = {
    agentId,
    agentName: agent.name,
    companyId,
    credentials: credentials || undefined,
  };

  try {
    // Invoke the tool
    const result = await handler(params, context);

    // Log success
    await logInvocation(
      agentId,
      toolName,
      params,
      result as Record<string, unknown>,
      true
    );

    // Create event
    await db.insert(events).values({
      type: 'task_updated', // Using existing event type
      visibility: companyId ? 'org' : 'agent',
      actorAgentId: agentId,
      targetType: 'tool',
      payload: {
        toolName,
        success: true,
        resultSummary: typeof result === 'object' ? Object.keys(result as object) : 'completed',
      },
    });

    console.log(`[ToolsJob] Tool ${toolName} completed successfully for agent ${agentId}`);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failure
    await logInvocation(
      agentId,
      toolName,
      params,
      { error: errorMessage },
      false
    );

    console.error(`[ToolsJob] Tool ${toolName} failed for agent ${agentId}:`, errorMessage);
    throw error;
  }
}

/**
 * Batch tool invocation job handler
 */
export async function batchToolInvokeJob(job: Job<BatchToolInvokeJobData>): Promise<unknown[]> {
  const { tools, agentId, companyId } = job.data;

  console.log(`[ToolsJob] Batch invoking ${tools.length} tools for agent ${agentId}`);

  const results: unknown[] = [];
  const errors: Array<{ tool: string; error: string }> = [];

  for (const tool of tools) {
    try {
      const result = await invokeToolJob({
        data: {
          toolName: tool.name,
          agentId,
          params: tool.params,
          companyId,
        },
      } as any);

      results.push({ tool: tool.name, success: true, result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ tool: tool.name, error: errorMessage });
      results.push({ tool: tool.name, success: false, error: errorMessage });
    }
  }

  console.log(
    `[ToolsJob] Batch complete: ${tools.length - errors.length} success, ${errors.length} failed`
  );

  if (errors.length > 0) {
    console.warn('[ToolsJob] Batch errors:', errors);
  }

  return results;
}

/**
 * Get tool usage statistics
 */
export interface ToolStatsJobData {
  agentId?: string;
  companyId?: string;
  lookbackDays?: number;
}

export async function toolStatsJob(job: Job<ToolStatsJobData>): Promise<void> {
  const { agentId, lookbackDays = 7 } = job.data;

  console.log(`[ToolsJob] Generating tool stats (lookback: ${lookbackDays} days)`);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - lookbackDays);

  // Get invocation counts by tool
  const stats = await db
    .select({
      toolName: toolInvocations.toolName,
      totalInvocations: sql<number>`count(*)`,
      successCount: sql<number>`sum(case when success then 1 else 0 end)`,
      failureCount: sql<number>`sum(case when not success then 1 else 0 end)`,
    })
    .from(toolInvocations)
    .where(
      agentId
        ? eq(toolInvocations.agentId, agentId)
        : sql`true`
    )
    .groupBy(toolInvocations.toolName);

  console.log('[ToolsJob] Tool usage statistics:', stats);
}

/**
 * Register a new tool handler at runtime
 */
export function registerToolHandler(
  toolName: string,
  handler: (params: unknown, context: ToolContext) => Promise<unknown>
): void {
  toolHandlers[toolName] = handler;
  console.log(`[ToolsJob] Registered tool handler: ${toolName}`);
}

/**
 * List available tools
 */
export function listAvailableTools(): string[] {
  return Object.keys(toolHandlers);
}

/**
 * Validate tool parameters (placeholder)
 */
export async function validateToolParams(
  toolName: string,
  params: Record<string, unknown>
): Promise<{ valid: boolean; errors?: string[] }> {
  // In production, you'd have schema validation for each tool
  const handler = toolHandlers[toolName];

  if (!handler) {
    return { valid: false, errors: [`Unknown tool: ${toolName}`] };
  }

  // Basic validation - check required params exist
  if (!params || typeof params !== 'object') {
    return { valid: false, errors: ['Parameters must be an object'] };
  }

  return { valid: true };
}
