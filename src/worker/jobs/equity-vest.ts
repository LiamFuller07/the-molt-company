/**
 * Equity Vesting Jobs
 * Handles periodic equity operations: vesting, dilution, and grants
 */

import { Job } from 'bullmq';
import { eq, and } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  companies,
  companyMembers,
  events,
  equityTransactionsV2,
} from '../../db/schema.js';

/**
 * Equity vest job data
 */
export interface EquityVestJobData {
  companyId?: string; // Optional - if not provided, process all companies
}

/**
 * Equity grant job data
 */
export interface EquityGrantJobData {
  companyId: string;
  agentId: string;
  amount: number; // Percentage (e.g., 1.5 for 1.5%)
  reason: string;
  taskId?: string;
}

/**
 * Equity dilution job data
 */
export interface EquityDilutionJobData {
  companyId: string;
  newEquityPct: number; // Amount being added to pool
  reason: string;
}

/**
 * Process pending equity grants for a company
 */
async function processPendingGrants(companyId: string): Promise<number> {
  // In a full implementation, you might have a pending_grants table
  // For now, this is a placeholder that could be extended
  console.log(`[EquityJob] Processing pending grants for company ${companyId}`);
  return 0;
}

/**
 * Grant equity to an agent
 */
export async function grantEquityJob(job: Job<EquityGrantJobData>): Promise<void> {
  const { companyId, agentId, amount, reason, taskId } = job.data;

  console.log(
    `[EquityJob] Granting ${amount}% equity to agent ${agentId} in company ${companyId}`
  );

  // Get current membership
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, companyId),
      eq(companyMembers.agentId, agentId)
    ),
  });

  if (!membership) {
    console.warn(`[EquityJob] Agent ${agentId} is not a member of company ${companyId}`);
    return;
  }

  // Calculate new equity
  const currentEquity = parseFloat(membership.equity);
  const newEquity = currentEquity + amount;

  // Update member equity
  await db.update(companyMembers)
    .set({
      equity: newEquity.toFixed(4),
      updatedAt: new Date(),
    })
    .where(eq(companyMembers.id, membership.id));

  // Record transaction
  await db.insert(equityTransactionsV2).values({
    companyId,
    agentId,
    type: taskId ? 'task_reward' : 'grant',
    amountPct: amount.toFixed(4),
    reason,
  });

  // Create event
  await db.insert(events).values({
    type: 'equity_grant',
    visibility: 'org',
    actorAgentId: agentId,
    targetType: 'agent',
    targetId: agentId,
    payload: {
      companyId,
      amount,
      newTotal: newEquity,
      reason,
      taskId,
    },
  });

  console.log(
    `[EquityJob] Granted ${amount}% equity to agent ${agentId}, new total: ${newEquity}%`
  );
}

/**
 * Process equity dilution (when new equity is issued)
 */
export async function dilutionJob(job: Job<EquityDilutionJobData>): Promise<void> {
  const { companyId, newEquityPct, reason } = job.data;

  console.log(`[EquityJob] Processing ${newEquityPct}% dilution for company ${companyId}`);

  // Get company
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
  });

  if (!company) {
    console.warn(`[EquityJob] Company ${companyId} not found`);
    return;
  }

  // Calculate dilution factor
  const currentTotal = parseFloat(company.totalEquity);
  const newTotal = currentTotal + newEquityPct;
  const dilutionFactor = currentTotal / newTotal;

  // Get all members
  const members = await db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, companyId),
  });

  // Dilute each member's equity
  for (const member of members) {
    const currentEquity = parseFloat(member.equity);
    const newEquity = currentEquity * dilutionFactor;

    await db.update(companyMembers)
      .set({
        equity: newEquity.toFixed(4),
        updatedAt: new Date(),
      })
      .where(eq(companyMembers.id, member.id));

    // Record dilution transaction
    const dilutionAmount = currentEquity - newEquity;
    await db.insert(equityTransactionsV2).values({
      companyId,
      agentId: member.agentId,
      type: 'dilution',
      amountPct: (-dilutionAmount).toFixed(4),
      reason: `Dilution: ${reason}`,
    });
  }

  // Update company total equity
  await db.update(companies)
    .set({
      totalEquity: newTotal.toFixed(4),
      updatedAt: new Date(),
    })
    .where(eq(companies.id, companyId));

  // Create dilution event
  await db.insert(events).values({
    type: 'equity_dilution',
    visibility: 'org',
    actorAgentId: company.adminAgentId || members[0]?.agentId || '00000000-0000-0000-0000-000000000000',
    targetType: 'company',
    targetId: companyId,
    payload: {
      previousTotal: currentTotal,
      newTotal,
      dilutionFactor,
      membersAffected: members.length,
      reason,
    },
  });

  console.log(
    `[EquityJob] Dilution complete: ${members.length} members affected, ` +
    `total equity now ${newTotal}%`
  );
}

/**
 * Main equity vesting job
 * Processes pending vesting schedules and grants
 */
export async function equityVestJob(job: Job<EquityVestJobData>): Promise<void> {
  const { companyId } = job.data;

  console.log(
    '[EquityJob] Starting equity vesting job' +
    (companyId ? ` for company ${companyId}` : ' for all companies')
  );

  // Get companies to process
  let companiesToProcess: { id: string; name: string }[];

  if (companyId) {
    const company = await db.query.companies.findFirst({
      where: eq(companies.id, companyId),
      columns: { id: true, name: true },
    });
    companiesToProcess = company ? [company] : [];
  } else {
    companiesToProcess = await db.query.companies.findMany({
      columns: { id: true, name: true },
    });
  }

  console.log(`[EquityJob] Processing ${companiesToProcess.length} companies`);

  let totalGrantsProcessed = 0;

  for (const company of companiesToProcess) {
    try {
      const grants = await processPendingGrants(company.id);
      totalGrantsProcessed += grants;
    } catch (error) {
      console.error(`[EquityJob] Error processing company ${company.id}:`, error);
    }
  }

  console.log(
    `[EquityJob] Vesting complete: ${totalGrantsProcessed} grants processed ` +
    `across ${companiesToProcess.length} companies`
  );
}

/**
 * Equity transfer job
 */
export interface EquityTransferJobData {
  companyId: string;
  fromAgentId: string;
  toAgentId: string;
  amount: number;
  reason: string;
}

export async function equityTransferJob(job: Job<EquityTransferJobData>): Promise<void> {
  const { companyId, fromAgentId, toAgentId, amount, reason } = job.data;

  console.log(
    `[EquityJob] Transferring ${amount}% equity from ${fromAgentId} to ${toAgentId} ` +
    `in company ${companyId}`
  );

  // Get sender membership
  const fromMembership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, companyId),
      eq(companyMembers.agentId, fromAgentId)
    ),
  });

  if (!fromMembership) {
    throw new Error(`Sender ${fromAgentId} is not a member of company ${companyId}`);
  }

  const senderEquity = parseFloat(fromMembership.equity);
  if (senderEquity < amount) {
    throw new Error(`Insufficient equity: ${senderEquity}% available, ${amount}% requested`);
  }

  // Get receiver membership
  const toMembership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, companyId),
      eq(companyMembers.agentId, toAgentId)
    ),
  });

  if (!toMembership) {
    throw new Error(`Receiver ${toAgentId} is not a member of company ${companyId}`);
  }

  const receiverEquity = parseFloat(toMembership.equity);

  // Perform transfer
  await db.update(companyMembers)
    .set({
      equity: (senderEquity - amount).toFixed(4),
      updatedAt: new Date(),
    })
    .where(eq(companyMembers.id, fromMembership.id));

  await db.update(companyMembers)
    .set({
      equity: (receiverEquity + amount).toFixed(4),
      updatedAt: new Date(),
    })
    .where(eq(companyMembers.id, toMembership.id));

  // Record transactions
  await db.insert(equityTransactionsV2).values([
    {
      companyId,
      agentId: fromAgentId,
      type: 'transfer',
      amountPct: (-amount).toFixed(4),
      reason: `Transfer to ${toAgentId}: ${reason}`,
    },
    {
      companyId,
      agentId: toAgentId,
      type: 'transfer',
      amountPct: amount.toFixed(4),
      reason: `Transfer from ${fromAgentId}: ${reason}`,
    },
  ]);

  // Create event
  await db.insert(events).values({
    type: 'equity_grant', // Reusing event type
    visibility: 'org',
    actorAgentId: fromAgentId,
    targetType: 'agent',
    targetId: toAgentId,
    payload: {
      companyId,
      from: fromAgentId,
      to: toAgentId,
      amount,
      reason,
      type: 'transfer',
    },
  });

  console.log(
    `[EquityJob] Transfer complete: ${fromAgentId} (${senderEquity - amount}%) -> ` +
    `${toAgentId} (${receiverEquity + amount}%)`
  );
}

/**
 * Calculate and report equity summary for a company
 */
export interface EquitySummaryJobData {
  companyId: string;
}

export async function equitySummaryJob(job: Job<EquitySummaryJobData>): Promise<void> {
  const { companyId } = job.data;

  console.log(`[EquityJob] Generating equity summary for company ${companyId}`);

  // Get company details
  const company = await db.query.companies.findFirst({
    where: eq(companies.id, companyId),
    columns: {
      name: true,
      totalEquity: true,
      adminFloorPct: true,
      memberPoolPct: true,
    },
  });

  if (!company) {
    console.warn(`[EquityJob] Company ${companyId} not found`);
    return;
  }

  // Get all members with their equity
  const members = await db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, companyId),
    with: {
      agent: {
        columns: { name: true },
      },
    },
  });

  // Calculate totals
  const totalAllocated = members.reduce((sum: number, m: typeof members[number]) => sum + parseFloat(m.equity), 0);
  const totalEquity = parseFloat(company.totalEquity);
  const unallocated = totalEquity - totalAllocated;

  const summary = {
    company: company.name,
    totalEquity,
    allocated: totalAllocated,
    unallocated,
    memberCount: members.length,
    distribution: members.map((m: typeof members[number]) => ({
      agent: m.agent.name,
      equity: parseFloat(m.equity),
      percentage: (parseFloat(m.equity) / totalEquity * 100).toFixed(2) + '%',
    })).sort((a: { equity: number }, b: { equity: number }) => b.equity - a.equity),
  };

  console.log(`[EquityJob] Equity summary for ${company.name}:`, JSON.stringify(summary, null, 2));
}
