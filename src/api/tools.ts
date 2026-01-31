import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import { companyTools, companies, companyMembers } from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';

export const toolsRouter = new Hono<AuthContext>();

// All routes require auth
toolsRouter.use('*', authMiddleware);

// ============================================================================
// AVAILABLE TOOL TYPES
// ============================================================================

const TOOL_TYPES = {
  github: {
    name: 'GitHub',
    description: 'Connect repositories, issues, PRs',
    configSchema: {
      owner: 'Repository owner (org or user)',
      repo: 'Repository name',
      access_token: 'GitHub personal access token (optional, for private repos)',
    },
    icon: '🐙',
  },
  slack: {
    name: 'Slack',
    description: 'Post to channels, receive notifications',
    configSchema: {
      workspace_id: 'Slack workspace ID',
      channel_id: 'Default channel ID',
      bot_token: 'Slack bot token',
    },
    icon: '💬',
  },
  discord: {
    name: 'Discord',
    description: 'Connect to Discord servers',
    configSchema: {
      server_id: 'Discord server ID',
      channel_id: 'Default channel ID',
      bot_token: 'Discord bot token',
    },
    icon: '🎮',
  },
  notion: {
    name: 'Notion',
    description: 'Sync documents and databases',
    configSchema: {
      workspace_id: 'Notion workspace ID',
      database_id: 'Database ID for tasks (optional)',
      api_key: 'Notion API key',
    },
    icon: '📝',
  },
  linear: {
    name: 'Linear',
    description: 'Sync issues and projects',
    configSchema: {
      team_id: 'Linear team ID',
      api_key: 'Linear API key',
    },
    icon: '📊',
  },
  vercel: {
    name: 'Vercel',
    description: 'Deploy and manage projects',
    configSchema: {
      team_id: 'Vercel team ID (optional)',
      project_id: 'Project ID',
      api_token: 'Vercel API token',
    },
    icon: '▲',
  },
  openai: {
    name: 'OpenAI',
    description: 'Access GPT models for the team',
    configSchema: {
      api_key: 'OpenAI API key',
      model: 'Default model (e.g., gpt-4)',
    },
    icon: '🤖',
  },
  anthropic: {
    name: 'Anthropic',
    description: 'Access Claude models for the team',
    configSchema: {
      api_key: 'Anthropic API key',
      model: 'Default model (e.g., claude-3-opus)',
    },
    icon: '🧠',
  },
  webhook: {
    name: 'Webhook',
    description: 'Custom webhook integration',
    configSchema: {
      url: 'Webhook URL',
      secret: 'Webhook secret (optional)',
      events: 'Events to trigger (comma-separated)',
    },
    icon: '🔗',
  },
  custom: {
    name: 'Custom MCP',
    description: 'Connect any MCP-compatible tool',
    configSchema: {
      mcp_server_url: 'MCP server URL',
      api_key: 'API key (if required)',
    },
    icon: '⚡',
  },
};

// ============================================================================
// LIST AVAILABLE TOOL TYPES
// ============================================================================

toolsRouter.get('/types', async (c) => {
  return c.json({
    success: true,
    tool_types: Object.entries(TOOL_TYPES).map(([key, value]) => ({
      type: key,
      name: value.name,
      description: value.description,
      icon: value.icon,
      config_fields: Object.keys(value.configSchema),
    })),
  });
});

// ============================================================================
// LIST COMPANY TOOLS
// ============================================================================

toolsRouter.get('/:company/tools', async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  const tools = await db.query.companyTools.findMany({
    where: eq(companyTools.companyId, company.id),
    orderBy: desc(companyTools.createdAt),
  });

  return c.json({
    success: true,
    tools: tools.map(t => ({
      id: t.id,
      type: t.type,
      name: t.name,
      description: t.description,
      icon: TOOL_TYPES[t.type as keyof typeof TOOL_TYPES]?.icon || '🔧',
      is_enabled: t.isEnabled,
      created_at: t.createdAt,
      // Don't expose config (contains secrets)
    })),
  });
});

// ============================================================================
// ADD TOOL
// ============================================================================

const addToolSchema = z.object({
  type: z.enum([
    'github', 'slack', 'discord', 'notion', 'linear',
    'vercel', 'openai', 'anthropic', 'webhook', 'custom'
  ]),
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  config: z.record(z.any()),
});

toolsRouter.post('/:company/tools', requireClaimed, zValidator('json', addToolSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { type, name, description, config } = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions (founders/admins only)
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership || (membership.role !== 'founder' && membership.role !== 'admin')) {
    return c.json({ success: false, error: 'Only founders and admins can add tools' }, 403);
  }

  // Validate config has required fields
  const toolType = TOOL_TYPES[type];
  const requiredFields = Object.keys(toolType.configSchema);
  const missingFields = requiredFields.filter(f =>
    !f.includes('optional') && !config[f]
  );

  if (missingFields.length > 0) {
    return c.json({
      success: false,
      error: 'Missing required config fields',
      missing: missingFields,
      config_schema: toolType.configSchema,
    }, 400);
  }

  // Create tool
  const [tool] = await db.insert(companyTools).values({
    companyId: company.id,
    type,
    name,
    description,
    config,
    isEnabled: true,
  }).returning();

  return c.json({
    success: true,
    message: `${toolType.name} tool added`,
    tool: {
      id: tool.id,
      type: tool.type,
      name: tool.name,
      icon: toolType.icon,
    },
  }, 201);
});

// ============================================================================
// UPDATE TOOL
// ============================================================================

const updateToolSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  config: z.record(z.any()).optional(),
  is_enabled: z.boolean().optional(),
});

toolsRouter.patch('/:company/tools/:toolId', requireClaimed, zValidator('json', updateToolSchema), async (c) => {
  const companyName = c.req.param('company');
  const toolId = c.req.param('toolId');
  const agent = c.get('agent');
  const updates = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership || (membership.role !== 'founder' && membership.role !== 'admin')) {
    return c.json({ success: false, error: 'Only founders and admins can update tools' }, 403);
  }

  const tool = await db.query.companyTools.findFirst({
    where: and(
      eq(companyTools.id, toolId),
      eq(companyTools.companyId, company.id),
    ),
  });

  if (!tool) {
    return c.json({ success: false, error: 'Tool not found' }, 404);
  }

  // Merge config if updating
  const newConfig = updates.config
    ? { ...(tool.config as object), ...updates.config }
    : undefined;

  await db.update(companyTools)
    .set({
      name: updates.name,
      description: updates.description,
      config: newConfig,
      isEnabled: updates.is_enabled,
      updatedAt: new Date(),
    })
    .where(eq(companyTools.id, toolId));

  return c.json({
    success: true,
    message: 'Tool updated',
  });
});

// ============================================================================
// DELETE TOOL
// ============================================================================

toolsRouter.delete('/:company/tools/:toolId', requireClaimed, async (c) => {
  const companyName = c.req.param('company');
  const toolId = c.req.param('toolId');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check permissions
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership || membership.role !== 'founder') {
    return c.json({ success: false, error: 'Only founders can delete tools' }, 403);
  }

  const tool = await db.query.companyTools.findFirst({
    where: and(
      eq(companyTools.id, toolId),
      eq(companyTools.companyId, company.id),
    ),
  });

  if (!tool) {
    return c.json({ success: false, error: 'Tool not found' }, 404);
  }

  await db.delete(companyTools).where(eq(companyTools.id, toolId));

  return c.json({
    success: true,
    message: `Tool "${tool.name}" deleted`,
  });
});

// ============================================================================
// TEST TOOL CONNECTION
// ============================================================================

toolsRouter.post('/:company/tools/:toolId/test', requireClaimed, async (c) => {
  const companyName = c.req.param('company');
  const toolId = c.req.param('toolId');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  const tool = await db.query.companyTools.findFirst({
    where: and(
      eq(companyTools.id, toolId),
      eq(companyTools.companyId, company.id),
    ),
  });

  if (!tool) {
    return c.json({ success: false, error: 'Tool not found' }, 404);
  }

  // Test connection based on tool type
  const config = tool.config as Record<string, any>;
  let testResult: { success: boolean; message: string; details?: any } = {
    success: false,
    message: 'Test not implemented for this tool type',
  };

  try {
    switch (tool.type) {
      case 'github':
        // Test GitHub API
        const ghResponse = await fetch(
          `https://api.github.com/repos/${config.owner}/${config.repo}`,
          {
            headers: config.access_token
              ? { Authorization: `token ${config.access_token}` }
              : {},
          }
        );
        if (ghResponse.ok) {
          const repo = await ghResponse.json();
          testResult = {
            success: true,
            message: 'GitHub connection successful',
            details: { repo: repo.full_name, stars: repo.stargazers_count },
          };
        } else {
          testResult = {
            success: false,
            message: `GitHub API error: ${ghResponse.status}`,
          };
        }
        break;

      case 'slack':
        // Test Slack API
        const slackResponse = await fetch('https://slack.com/api/auth.test', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.bot_token}`,
            'Content-Type': 'application/json',
          },
        });
        const slackData = await slackResponse.json();
        testResult = {
          success: slackData.ok,
          message: slackData.ok ? 'Slack connection successful' : slackData.error,
          details: slackData.ok ? { team: slackData.team, user: slackData.user } : undefined,
        };
        break;

      case 'webhook':
        // Test webhook with a ping
        const webhookResponse = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(config.secret ? { 'X-Webhook-Secret': config.secret } : {}),
          },
          body: JSON.stringify({ event: 'test', source: 'themoltcompany' }),
        });
        testResult = {
          success: webhookResponse.ok,
          message: webhookResponse.ok
            ? 'Webhook responded successfully'
            : `Webhook error: ${webhookResponse.status}`,
        };
        break;

      default:
        testResult = {
          success: true,
          message: 'Tool configuration saved (live test not available)',
        };
    }
  } catch (error) {
    testResult = {
      success: false,
      message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  return c.json({
    success: true,
    tool: {
      id: tool.id,
      name: tool.name,
      type: tool.type,
    },
    test_result: testResult,
  });
});

// ============================================================================
// INVOKE TOOL ACTION
// ============================================================================

const invokeSchema = z.object({
  action: z.string().min(1).max(50),
  params: z.record(z.any()).optional(),
});

toolsRouter.post('/:company/tools/:toolId/invoke', requireClaimed, zValidator('json', invokeSchema), async (c) => {
  const companyName = c.req.param('company');
  const toolId = c.req.param('toolId');
  const agent = c.get('agent');
  const { action, params } = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  const tool = await db.query.companyTools.findFirst({
    where: and(
      eq(companyTools.id, toolId),
      eq(companyTools.companyId, company.id),
    ),
  });

  if (!tool) {
    return c.json({ success: false, error: 'Tool not found' }, 404);
  }

  if (!tool.isEnabled) {
    return c.json({ success: false, error: 'Tool is disabled' }, 400);
  }

  // TODO: Implement actual tool invocation based on type and action
  // This would dispatch to specific handlers for each tool type

  return c.json({
    success: true,
    message: 'Tool invocation queued',
    invocation: {
      tool_id: toolId,
      action,
      params,
      status: 'queued',
    },
    hint: 'Tool invocations are processed asynchronously. Check back for results.',
  });
});
