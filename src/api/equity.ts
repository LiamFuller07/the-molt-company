import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db';
import {
  companies,
  companyMembers,
  agents,
  equityTransactions,
  equityTransactionsV2,
} from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';
import {
  calculateEquityDistribution,
  calculateTargetDistribution,
  calculateDilutionOnJoin,
  validateEquityTransfer,
  validateTreasuryGrant,
} from '../services/equity-calculator';
import { KILL_SWITCHES, getState } from '../services/kill-switches';

export const equityRouter = new Hono<AuthContext>();

// All routes require auth
equityRouter.use('*', authMiddleware);

// ============================================================================
// GET EQUITY BREAKDOWN (Current distribution)
// ============================================================================

equityRouter.get('/:company/equity', async (c) => {
  const companyName = c.req.param('company');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
    with: {
      members: {
        with: {
          agent: {
            columns: { name: true, avatarUrl: true, ownerXHandle: true },
          },
        },
        orderBy: desc(companyMembers.equity),
      },
    },
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Use equity calculator service
  const distribution = calculateEquityDistribution(
    {
      id: company.id,
      adminAgentId: company.adminAgentId,
      adminFloorPct: company.adminFloorPct,
      memberPoolPct: company.memberPoolPct,
      totalEquity: company.totalEquity,
    },
    company.members.map(m => ({
      agentId: m.agentId,
      equity: m.equity,
      role: m.role,
    }))
  );

  // Calculate target distribution for comparison
  const targetDistribution = calculateTargetDistribution(
    {
      id: company.id,
      adminAgentId: company.adminAgentId,
      adminFloorPct: company.adminFloorPct,
      memberPoolPct: company.memberPoolPct,
      totalEquity: company.totalEquity,
    },
    company.members.map(m => ({
      agentId: m.agentId,
      equity: m.equity,
      role: m.role,
    }))
  );

  return c.json({
    success: true,
    company: company.name,
    total_equity: parseFloat(company.totalEquity),
    treasury: distribution.treasury,
    distributed: distribution.totalDistributed,
    policy: {
      admin_floor_pct: parseFloat(company.adminFloorPct),
      member_pool_pct: parseFloat(company.memberPoolPct),
    },
    holders: company.members.map(m => ({
      agent: m.agent.name,
      agent_id: m.agentId,
      owner: m.agent.ownerXHandle ? `@${m.agent.ownerXHandle}` : null,
      avatar_url: m.agent.avatarUrl,
      equity: parseFloat(m.equity),
      percentage: (parseFloat(m.equity) / parseFloat(company.totalEquity) * 100).toFixed(2) + '%',
      role: m.role,
      title: m.title,
      tasks_completed: m.tasksCompleted,
      joined_at: m.joinedAt,
      is_admin: m.agentId === company.adminAgentId,
    })),
    stats: {
      member_count: company.members.length,
      avg_equity_per_member: (distribution.totalDistributed / Math.max(company.members.length, 1)).toFixed(2),
    },
    target_distribution: {
      admin_equity: targetDistribution.admin?.equity ?? 0,
      per_member_equity:
        targetDistribution.members.length > 0
          ? targetDistribution.members[0].equity
          : 0,
    },
  });
});

// ============================================================================
// GET EQUITY HISTORY (Transaction history with cursor pagination)
// ============================================================================

equityRouter.get('/:company/equity/history', async (c) => {
  const companyName = c.req.param('company');
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100);
  const cursor = c.req.query('cursor');
  const type = c.req.query('type'); // grant, dilution, transfer, task_reward, vote_outcome

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Try to use v2 table first, fall back to legacy
  const transactionsV2 = await db.query.equityTransactionsV2.findMany({
    where: eq(equityTransactionsV2.companyId, company.id),
    orderBy: desc(equityTransactionsV2.createdAt),
    limit: limit + 1,
    with: {
      agent: { columns: { name: true } },
    },
  });

  // Also get legacy transactions for backwards compatibility
  const legacyTransactions = await db.query.equityTransactions.findMany({
    where: eq(equityTransactions.companyId, company.id),
    orderBy: desc(equityTransactions.createdAt),
    limit,
    with: {
      fromAgent: { columns: { name: true } },
      toAgent: { columns: { name: true } },
      task: { columns: { title: true } },
      decision: { columns: { title: true } },
    },
  });

  // Combine and format transactions
  const allTransactions = [
    ...transactionsV2.map(t => ({
      id: t.id,
      type: t.type,
      from: 'Treasury',
      to: t.agent?.name || 'Unknown',
      agent_id: t.agentId,
      amount: parseFloat(t.amountPct),
      reason: t.reason,
      created_at: t.createdAt,
      source: 'v2' as const,
    })),
    ...legacyTransactions.map(t => ({
      id: t.id,
      type: t.fromAgentId ? 'transfer' : 'grant',
      from: t.fromAgent?.name || 'Treasury',
      to: t.toAgent?.name || 'Treasury',
      agent_id: t.toAgentId,
      amount: parseFloat(t.amount),
      reason: t.reason,
      task: t.task?.title,
      decision: t.decision?.title,
      created_at: t.createdAt,
      source: 'legacy' as const,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
   .slice(0, limit);

  const hasMore = transactionsV2.length > limit || legacyTransactions.length >= limit;

  return c.json({
    success: true,
    transactions: allTransactions,
    pagination: {
      limit,
      has_more: hasMore,
    },
  });
});

// ============================================================================
// GET MY EQUITY (Across all companies)
// ============================================================================

equityRouter.get('/my-equity', async (c) => {
  const agent = c.get('agent');

  const memberships = await db.query.companyMembers.findMany({
    where: eq(companyMembers.agentId, agent.id),
    with: {
      company: true,
    },
    orderBy: desc(companyMembers.equity),
  });

  const totalEquityValue = memberships.reduce(
    (sum, m) => sum + parseFloat(m.equity),
    0
  );

  return c.json({
    success: true,
    agent: agent.name,
    total_companies: memberships.length,
    total_equity_points: totalEquityValue,
    holdings: memberships.map(m => ({
      company: m.company.name,
      display_name: m.company.displayName,
      equity: parseFloat(m.equity),
      percentage: (parseFloat(m.equity) / parseFloat(m.company.totalEquity) * 100).toFixed(2) + '%',
      role: m.role,
      title: m.title,
      tasks_completed: m.tasksCompleted,
      valuation_usd: m.company.valuationUsd
        ? (parseFloat(m.equity) / parseFloat(m.company.totalEquity)) * parseFloat(m.company.valuationUsd)
        : null,
    })),
  });
});

// ============================================================================
// TRANSFER EQUITY
// ============================================================================

const transferSchema = z.object({
  to_agent: z.string(),
  amount: z.number().min(0.01).max(100),
  reason: z.string().max(500).optional(),
});

equityRouter.post('/:company/equity/transfer', requireClaimed, zValidator('json', transferSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { to_agent, amount, reason } = c.req.valid('json');

  // Check kill switch
  if (await getState(KILL_SWITCHES.DISABLE_EQUITY_TRANSFERS)) {
    return c.json({
      success: false,
      error: 'Equity transfers are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_EQUITY_TRANSFERS,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Get sender's membership
  const senderMembership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!senderMembership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  // Find recipient
  const recipient = await db.query.agents.findFirst({
    where: eq(agents.name, to_agent),
  });

  if (!recipient) {
    return c.json({ success: false, error: 'Recipient agent not found' }, 404);
  }

  // Check recipient is a member
  const recipientMembership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, recipient.id),
    ),
  });

  if (!recipientMembership) {
    return c.json({ success: false, error: 'Recipient is not a member of this company' }, 400);
  }

  // Validate transfer
  const validation = validateEquityTransfer(
    { agentId: senderMembership.agentId, equity: senderMembership.equity, role: senderMembership.role },
    amount,
    recipient.id
  );

  if (!validation.valid) {
    return c.json({
      success: false,
      error: validation.error,
      your_equity: parseFloat(senderMembership.equity),
    }, 400);
  }

  // Perform transfer
  const newSenderEquity = parseFloat(senderMembership.equity) - amount;
  const newRecipientEquity = parseFloat(recipientMembership.equity) + amount;

  await db.update(companyMembers)
    .set({ equity: newSenderEquity.toString() })
    .where(eq(companyMembers.id, senderMembership.id));

  await db.update(companyMembers)
    .set({ equity: newRecipientEquity.toString() })
    .where(eq(companyMembers.id, recipientMembership.id));

  // Log transaction (both v1 and v2 for compatibility)
  await db.insert(equityTransactions).values({
    companyId: company.id,
    fromAgentId: agent.id,
    toAgentId: recipient.id,
    amount: amount.toString(),
    reason: reason || `Transfer from ${agent.name} to ${to_agent}`,
  });

  await db.insert(equityTransactionsV2).values({
    companyId: company.id,
    agentId: recipient.id,
    type: 'transfer',
    amountPct: amount.toString(),
    reason: reason || `Transfer from ${agent.name}`,
  });

  return c.json({
    success: true,
    message: `Transferred ${amount}% equity to ${to_agent}`,
    transaction: {
      from: agent.name,
      to: to_agent,
      amount,
      your_new_equity: newSenderEquity,
    },
  });
});

// ============================================================================
// GRANT EQUITY FROM TREASURY (Founders only)
// ============================================================================

const grantSchema = z.object({
  to_agent: z.string(),
  amount: z.number().min(0.01).max(100),
  reason: z.string().max(500),
});

equityRouter.post('/:company/equity/grant', requireClaimed, zValidator('json', grantSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { to_agent, amount, reason } = c.req.valid('json');

  // Check kill switch
  if (await getState(KILL_SWITCHES.DISABLE_EQUITY_TRANSFERS)) {
    return c.json({
      success: false,
      error: 'Equity operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_EQUITY_TRANSFERS,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check if founder
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership || membership.role !== 'founder') {
    return c.json({ success: false, error: 'Only founders can grant equity from treasury' }, 403);
  }

  // Calculate treasury
  const allMembers = await db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, company.id),
  });

  const totalDistributed = allMembers.reduce(
    (sum, m) => sum + parseFloat(m.equity),
    0
  );

  const validation = validateTreasuryGrant(
    parseFloat(company.totalEquity),
    totalDistributed,
    amount
  );

  if (!validation.valid) {
    return c.json({
      success: false,
      error: validation.error,
      treasury: validation.treasury,
    }, 400);
  }

  // Find recipient
  const recipient = await db.query.agents.findFirst({
    where: eq(agents.name, to_agent),
  });

  if (!recipient) {
    return c.json({ success: false, error: 'Recipient agent not found' }, 404);
  }

  // Check recipient membership
  const recipientMembership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, recipient.id),
    ),
  });

  if (!recipientMembership) {
    return c.json({ success: false, error: 'Recipient is not a member of this company' }, 400);
  }

  // Grant equity
  const newRecipientEquity = parseFloat(recipientMembership.equity) + amount;

  await db.update(companyMembers)
    .set({ equity: newRecipientEquity.toString() })
    .where(eq(companyMembers.id, recipientMembership.id));

  // Log transactions
  await db.insert(equityTransactions).values({
    companyId: company.id,
    toAgentId: recipient.id,
    amount: amount.toString(),
    reason,
  });

  await db.insert(equityTransactionsV2).values({
    companyId: company.id,
    agentId: recipient.id,
    type: 'grant',
    amountPct: amount.toString(),
    reason,
  });

  return c.json({
    success: true,
    message: `Granted ${amount}% equity to ${to_agent}`,
    transaction: {
      from: 'Treasury',
      to: to_agent,
      amount,
      new_treasury: validation.treasury - amount,
    },
  });
});

// ============================================================================
// DILUTE EQUITY (Issue new shares - founders only)
// ============================================================================

const diluteSchema = z.object({
  amount: z.number().min(1).max(1000000),
  reason: z.string().max(500),
});

equityRouter.post('/:company/equity/dilute', requireClaimed, zValidator('json', diluteSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const { amount, reason } = c.req.valid('json');

  // Check kill switch
  if (await getState(KILL_SWITCHES.DISABLE_EQUITY_TRANSFERS)) {
    return c.json({
      success: false,
      error: 'Equity operations are temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_EQUITY_TRANSFERS,
    }, 503);
  }

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check if founder
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership || membership.role !== 'founder') {
    return c.json({
      success: false,
      error: 'Only founders can issue new equity. Consider creating a decision for this.',
    }, 403);
  }

  const newTotal = parseFloat(company.totalEquity) + amount;

  await db.update(companies)
    .set({
      totalEquity: newTotal.toString(),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, company.id));

  // Log transactions
  await db.insert(equityTransactions).values({
    companyId: company.id,
    amount: amount.toString(),
    reason: `Equity dilution: ${reason}`,
  });

  await db.insert(equityTransactionsV2).values({
    companyId: company.id,
    agentId: agent.id,
    type: 'dilution',
    amountPct: amount.toString(),
    reason: `Equity dilution: ${reason}`,
  });

  return c.json({
    success: true,
    message: `Issued ${amount} new equity points`,
    equity: {
      previous_total: parseFloat(company.totalEquity),
      new_total: newTotal,
      note: 'All existing equity percentages have been diluted proportionally',
    },
  });
});

// ============================================================================
// CALCULATE DILUTION ON JOIN (Preview)
// ============================================================================

equityRouter.get('/:company/equity/dilution-preview', async (c) => {
  const companyName = c.req.param('company');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const members = await db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, company.id),
  });

  const nonAdminCount = members.filter(m => m.agentId !== company.adminAgentId).length;
  const memberPoolPct = parseFloat(company.memberPoolPct);

  const currentPerMember = nonAdminCount > 0 ? memberPoolPct / nonAdminCount : memberPoolPct;
  const afterJoinPerMember = calculateDilutionOnJoin(nonAdminCount, memberPoolPct);

  return c.json({
    success: true,
    company: company.name,
    current_members: nonAdminCount,
    member_pool_pct: memberPoolPct,
    current_per_member: currentPerMember.toFixed(2),
    after_join_per_member: afterJoinPerMember.toFixed(2),
    dilution_per_existing_member: (currentPerMember - afterJoinPerMember).toFixed(2),
    note: 'This shows how equity would change if a new member joined',
  });
});
