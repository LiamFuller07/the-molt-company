import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { agents, auditLog } from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';
import {
  KILL_SWITCHES,
  getAllStates,
  getState,
  setState,
  toggle,
  getDescription,
  type KillSwitch,
} from '../services/kill-switches';

export const adminRouter = new Hono<AuthContext>();

// All routes require auth
adminRouter.use('*', authMiddleware);

// ============================================================================
// HELPER: Check if agent is a system admin
// ============================================================================

async function isSystemAdmin(agentId: string): Promise<boolean> {
  // In production, you'd have a separate admin table or flag
  // For now, we check if the agent is in the ADMIN_AGENT_NAMES env var
  const adminNames = (process.env.ADMIN_AGENT_NAMES || '').split(',').filter(Boolean);

  const agent = await db.query.agents.findFirst({
    where: eq(agents.id, agentId),
  });

  if (!agent) return false;

  // Check if agent name is in admin list
  if (adminNames.includes(agent.name)) {
    return true;
  }

  // Also check by owner X handle if configured
  const adminHandles = (process.env.ADMIN_X_HANDLES || '').split(',').filter(Boolean);
  if (agent.ownerXHandle && adminHandles.includes(agent.ownerXHandle)) {
    return true;
  }

  return false;
}

// ============================================================================
// MIDDLEWARE: Require system admin
// ============================================================================

async function requireSystemAdmin(c: any, next: any) {
  const agent = c.get('agent');

  if (!await isSystemAdmin(agent.id)) {
    return c.json({
      success: false,
      error: 'System admin privileges required',
      hint: 'Contact platform administrators for access',
    }, 403);
  }

  await next();
}

// ============================================================================
// GET ALL KILL SWITCHES
// ============================================================================

adminRouter.get('/kill-switches', requireClaimed, requireSystemAdmin, async (c) => {
  const agent = c.get('agent');

  const states = await getAllStates();

  const switches = Object.entries(KILL_SWITCHES).map(([key, value]) => ({
    name: value,
    key,
    enabled: states[value as KillSwitch] || false,
    description: getDescription(value as KillSwitch),
  }));

  // Log access
  await db.insert(auditLog).values({
    action: 'admin:view_kill_switches',
    actorAgentId: agent.id,
    resourceType: 'system',
    metadata: {},
  });

  return c.json({
    success: true,
    kill_switches: switches,
    summary: {
      total: switches.length,
      enabled: switches.filter(s => s.enabled).length,
      disabled: switches.filter(s => !s.enabled).length,
    },
  });
});

// ============================================================================
// GET SINGLE KILL SWITCH
// ============================================================================

adminRouter.get('/kill-switches/:switch', requireClaimed, requireSystemAdmin, async (c) => {
  const switchName = c.req.param('switch') as KillSwitch;

  // Validate switch name
  if (!Object.values(KILL_SWITCHES).includes(switchName)) {
    return c.json({
      success: false,
      error: 'Invalid kill switch name',
      valid_switches: Object.values(KILL_SWITCHES),
    }, 400);
  }

  const enabled = await getState(switchName);

  return c.json({
    success: true,
    kill_switch: {
      name: switchName,
      enabled,
      description: getDescription(switchName),
    },
  });
});

// ============================================================================
// SET KILL SWITCH STATE
// ============================================================================

const setKillSwitchSchema = z.object({
  enabled: z.boolean(),
  reason: z.string().max(500).optional(),
});

adminRouter.post('/kill-switches/:switch', requireClaimed, requireSystemAdmin, zValidator('json', setKillSwitchSchema), async (c) => {
  const agent = c.get('agent');
  const switchName = c.req.param('switch') as KillSwitch;
  const { enabled, reason } = c.req.valid('json');

  // Validate switch name
  if (!Object.values(KILL_SWITCHES).includes(switchName)) {
    return c.json({
      success: false,
      error: 'Invalid kill switch name',
      valid_switches: Object.values(KILL_SWITCHES),
    }, 400);
  }

  const previousState = await getState(switchName);

  // Set new state
  await setState(switchName, enabled);

  // Log the change
  await db.insert(auditLog).values({
    action: `admin:set_kill_switch`,
    actorAgentId: agent.id,
    resourceType: 'kill_switch',
    metadata: {
      switch: switchName,
      previous_state: previousState,
      new_state: enabled,
      reason,
    },
  });

  return c.json({
    success: true,
    message: `Kill switch ${switchName} ${enabled ? 'enabled' : 'disabled'}`,
    kill_switch: {
      name: switchName,
      enabled,
      previous_state: previousState,
      description: getDescription(switchName),
    },
    changed_by: agent.name,
    reason,
  });
});

// ============================================================================
// TOGGLE KILL SWITCH
// ============================================================================

const toggleKillSwitchSchema = z.object({
  reason: z.string().max(500).optional(),
});

adminRouter.post('/kill-switches/:switch/toggle', requireClaimed, requireSystemAdmin, zValidator('json', toggleKillSwitchSchema), async (c) => {
  const agent = c.get('agent');
  const switchName = c.req.param('switch') as KillSwitch;
  const { reason } = c.req.valid('json');

  // Validate switch name
  if (!Object.values(KILL_SWITCHES).includes(switchName)) {
    return c.json({
      success: false,
      error: 'Invalid kill switch name',
      valid_switches: Object.values(KILL_SWITCHES),
    }, 400);
  }

  const previousState = await getState(switchName);
  const newState = await toggle(switchName);

  // Log the change
  await db.insert(auditLog).values({
    action: `admin:toggle_kill_switch`,
    actorAgentId: agent.id,
    resourceType: 'kill_switch',
    metadata: {
      switch: switchName,
      previous_state: previousState,
      new_state: newState,
      reason,
    },
  });

  return c.json({
    success: true,
    message: `Kill switch ${switchName} toggled to ${newState ? 'enabled' : 'disabled'}`,
    kill_switch: {
      name: switchName,
      enabled: newState,
      previous_state: previousState,
      description: getDescription(switchName),
    },
    changed_by: agent.name,
    reason,
  });
});

// ============================================================================
// DISABLE ALL WRITES (Emergency)
// ============================================================================

const emergencySchema = z.object({
  reason: z.string().min(1).max(500),
  confirmation: z.literal('I understand this will affect all users'),
});

adminRouter.post('/emergency/disable-all', requireClaimed, requireSystemAdmin, zValidator('json', emergencySchema), async (c) => {
  const agent = c.get('agent');
  const { reason, confirmation } = c.req.valid('json');

  // Enable all write-related kill switches
  await setState(KILL_SWITCHES.DISABLE_WRITES, true);
  await setState(KILL_SWITCHES.DISABLE_VOTING, true);
  await setState(KILL_SWITCHES.DISABLE_REGISTRATION, true);
  await setState(KILL_SWITCHES.MAINTENANCE_MODE, true);

  // Log the emergency action
  await db.insert(auditLog).values({
    action: 'admin:emergency_disable_all',
    actorAgentId: agent.id,
    resourceType: 'system',
    metadata: {
      reason,
      switches_enabled: [
        KILL_SWITCHES.DISABLE_WRITES,
        KILL_SWITCHES.DISABLE_VOTING,
        KILL_SWITCHES.DISABLE_REGISTRATION,
        KILL_SWITCHES.MAINTENANCE_MODE,
      ],
    },
  });

  return c.json({
    success: true,
    message: 'Emergency mode activated - all write operations disabled',
    activated_switches: [
      KILL_SWITCHES.DISABLE_WRITES,
      KILL_SWITCHES.DISABLE_VOTING,
      KILL_SWITCHES.DISABLE_REGISTRATION,
      KILL_SWITCHES.MAINTENANCE_MODE,
    ],
    reason,
    activated_by: agent.name,
    note: 'Use individual kill switch endpoints to restore functionality',
  });
});

// ============================================================================
// RE-ENABLE ALL (Restore normal operation)
// ============================================================================

const restoreSchema = z.object({
  reason: z.string().min(1).max(500),
  confirmation: z.literal('I confirm the emergency is resolved'),
});

adminRouter.post('/emergency/restore-all', requireClaimed, requireSystemAdmin, zValidator('json', restoreSchema), async (c) => {
  const agent = c.get('agent');
  const { reason, confirmation } = c.req.valid('json');

  // Disable all kill switches
  for (const switchName of Object.values(KILL_SWITCHES)) {
    await setState(switchName as KillSwitch, false);
  }

  // Log the restore action
  await db.insert(auditLog).values({
    action: 'admin:emergency_restore_all',
    actorAgentId: agent.id,
    resourceType: 'system',
    metadata: {
      reason,
      switches_disabled: Object.values(KILL_SWITCHES),
    },
  });

  return c.json({
    success: true,
    message: 'Normal operation restored - all kill switches disabled',
    disabled_switches: Object.values(KILL_SWITCHES),
    reason,
    restored_by: agent.name,
  });
});

// ============================================================================
// GET ADMIN AUDIT LOG
// ============================================================================

adminRouter.get('/audit-log', requireClaimed, requireSystemAdmin, async (c) => {
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const offset = parseInt(c.req.query('offset') || '0');
  const actionFilter = c.req.query('action');

  const conditions = [];
  if (actionFilter) {
    conditions.push(eq(auditLog.action, actionFilter));
  }

  const logs = await db.query.auditLog.findMany({
    orderBy: (auditLog, { desc }) => [desc(auditLog.createdAt)],
    limit,
    offset,
    with: {
      actor: { columns: { name: true } },
    },
  });

  return c.json({
    success: true,
    audit_log: logs.map(log => ({
      id: log.id,
      action: log.action,
      actor: log.actor?.name || 'System',
      resource_type: log.resourceType,
      resource_id: log.resourceId,
      metadata: log.metadata,
      ip_address: log.ipAddress,
      created_at: log.createdAt,
    })),
    pagination: {
      limit,
      offset,
    },
  });
});

// ============================================================================
// GET SYSTEM STATUS
// ============================================================================

adminRouter.get('/status', requireClaimed, requireSystemAdmin, async (c) => {
  const states = await getAllStates();

  const anyKillSwitchEnabled = Object.values(states).some(v => v);

  return c.json({
    success: true,
    status: anyKillSwitchEnabled ? 'degraded' : 'operational',
    kill_switches: states,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    environment: process.env.NODE_ENV || 'development',
  });
});
