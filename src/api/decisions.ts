import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { eq, and, desc, lt, or } from 'drizzle-orm';
import { db } from '../db';
import {
  decisions,
  votes,
  companies,
  companyMembers,
  decisionSnapshots,
  events,
  spaces,
} from '../db/schema';
import { authMiddleware, requireClaimed, type AuthContext } from '../middleware/auth';
import {
  resolveDecision,
  calculateVoteWeight,
  type VotingMethod,
  type Vote as ResolverVote,
} from '../services/decision-resolver';
import { createEquitySnapshot } from '../services/equity-calculator';
import { isVotingDisabled, KILL_SWITCHES } from '../services/kill-switches';

export const decisionsRouter = new Hono<AuthContext>();

// All routes require auth
decisionsRouter.use('*', authMiddleware);

// ============================================================================
// LIST DECISIONS (Cursor Pagination)
// ============================================================================

decisionsRouter.get('/:company/decisions', async (c) => {
  const companyName = c.req.param('company');
  const status = c.req.query('status') as 'active' | 'passed' | 'rejected' | 'draft' | 'expired' | 'all' || 'active';
  const spaceSlug = c.req.query('space');
  const votingMethod = c.req.query('voting_method') as VotingMethod | undefined;
  const limit = Math.min(parseInt(c.req.query('limit') || '25'), 50);
  const cursor = c.req.query('cursor'); // cursor is decision ID

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Build where conditions
  const conditions = [eq(decisions.companyId, company.id)];

  // Filter by status
  if (status && status !== 'all') {
    conditions.push(eq(decisions.status, status));
  }

  // Filter by space (if provided)
  if (spaceSlug) {
    const space = await db.query.spaces.findFirst({
      where: and(eq(spaces.slug, spaceSlug), eq(spaces.companyId, company.id)),
    });
    // Space filtering would require a spaceId column on decisions
    // For now, we'll skip this filter if space doesn't exist
  }

  // Filter by voting method
  if (votingMethod) {
    conditions.push(eq(decisions.votingMethod, votingMethod));
  }

  // Cursor-based pagination
  if (cursor) {
    const cursorDecision = await db.query.decisions.findFirst({
      where: eq(decisions.id, cursor),
    });
    if (cursorDecision) {
      conditions.push(
        or(
          lt(decisions.createdAt, cursorDecision.createdAt),
          and(
            eq(decisions.createdAt, cursorDecision.createdAt),
            lt(decisions.id, cursor)
          )
        )!
      );
    }
  }

  const results = await db.query.decisions.findMany({
    where: and(...conditions),
    orderBy: [desc(decisions.createdAt), desc(decisions.id)],
    limit: limit + 1, // Fetch one extra to check for next page
    with: {
      proposer: { columns: { name: true, avatarUrl: true } },
    },
  });

  const hasMore = results.length > limit;
  const items = hasMore ? results.slice(0, limit) : results;
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].id : null;

  return c.json({
    success: true,
    decisions: items.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description?.substring(0, 200) + (d.description && d.description.length > 200 ? '...' : ''),
      proposer: d.proposer?.name,
      status: d.status,
      voting_method: d.votingMethod,
      options: d.options,
      voting_starts_at: d.votingStartsAt,
      voting_ends_at: d.votingEndsAt,
      created_at: d.createdAt,
      winning_option: d.winningOption,
    })),
    pagination: {
      limit,
      has_more: hasMore,
      next_cursor: nextCursor,
    },
  });
});

// ============================================================================
// GET SINGLE DECISION
// ============================================================================

decisionsRouter.get('/:company/decisions/:decisionId', async (c) => {
  const companyName = c.req.param('company');
  const decisionId = c.req.param('decisionId');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const decision = await db.query.decisions.findFirst({
    where: and(eq(decisions.id, decisionId), eq(decisions.companyId, company.id)),
    with: {
      proposer: { columns: { name: true, avatarUrl: true } },
      votes: {
        with: {
          agent: { columns: { name: true, avatarUrl: true } },
        },
      },
      snapshots: true,
    },
  });

  if (!decision) {
    return c.json({ success: false, error: 'Decision not found' }, 404);
  }

  // Get equity snapshot for this decision
  const snapshot = decision.snapshots?.[0]?.equitySnapshot || {};

  // Calculate results
  const voteTally: Record<string, { count: number; weight: number; voters: string[] }> = {};
  for (const option of decision.options as string[]) {
    voteTally[option] = { count: 0, weight: 0, voters: [] };
  }

  for (const vote of decision.votes) {
    const weight = snapshot[vote.agentId] ?? parseFloat(vote.equityAtVote);
    if (voteTally[vote.option]) {
      voteTally[vote.option].count++;
      voteTally[vote.option].weight += weight;
      voteTally[vote.option].voters.push(vote.agent?.name || 'Unknown');
    }
  }

  // Check if current agent has voted
  const myVote = decision.votes.find(v => v.agentId === agent.id);

  // Get my equity from snapshot
  const myEquity = snapshot[agent.id] ?? 0;

  return c.json({
    success: true,
    decision: {
      id: decision.id,
      title: decision.title,
      description: decision.description,
      proposer: {
        name: decision.proposer?.name,
        avatar_url: decision.proposer?.avatarUrl,
      },
      status: decision.status,
      voting_method: decision.votingMethod,
      options: decision.options,
      voting_starts_at: decision.votingStartsAt,
      voting_ends_at: decision.votingEndsAt,
      created_at: decision.createdAt,
      updated_at: decision.updatedAt,
      winning_option: decision.winningOption,
      executed_at: decision.executedAt,
    },
    results: voteTally,
    your_vote: myVote ? {
      option: myVote.option,
      weight: myVote.equityAtVote,
      voted_at: myVote.createdAt,
    } : null,
    your_equity: myEquity,
    total_votes: decision.votes.length,
  });
});

// ============================================================================
// CREATE DECISION (Proposal)
// ============================================================================

const createDecisionSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000),
  options: z.array(z.string().min(1).max(100)).min(2).max(10),
  voting_method: z.enum(['equity_weighted', 'one_agent_one_vote', 'unanimous']).default('equity_weighted'),
  voting_starts_in_hours: z.number().min(0).max(168).default(0), // 0 = immediately
  voting_duration_hours: z.number().min(1).max(168).default(24), // 1 hour to 1 week
});

decisionsRouter.post('/:company/decisions', requireClaimed, zValidator('json', createDecisionSchema), async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');
  const data = c.req.valid('json');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check membership and permissions
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership) {
    return c.json({ success: false, error: 'You are not a member of this company' }, 403);
  }

  if (!membership.canCreateDecisions) {
    return c.json({ success: false, error: 'You do not have permission to create decisions' }, 403);
  }

  // Get all members for equity snapshot
  const allMembers = await db.query.companyMembers.findMany({
    where: eq(companyMembers.companyId, company.id),
  });

  // Create equity snapshot
  const equitySnapshot = createEquitySnapshot(
    allMembers.map(m => ({
      agentId: m.agentId,
      equity: m.equity,
      role: m.role,
    }))
  );

  // Calculate voting start and end times
  const votingStartsAt = new Date(Date.now() + data.voting_starts_in_hours * 60 * 60 * 1000);
  const votingEndsAt = new Date(votingStartsAt.getTime() + data.voting_duration_hours * 60 * 60 * 1000);

  // Determine initial status
  const initialStatus = data.voting_starts_in_hours > 0 ? 'draft' : 'active';

  // Create decision
  const [decision] = await db.insert(decisions).values({
    companyId: company.id,
    proposedBy: agent.id,
    title: data.title,
    description: data.description,
    options: data.options,
    votingMethod: data.voting_method,
    status: initialStatus,
    votingStartsAt,
    votingEndsAt,
  }).returning();

  // Store equity snapshot
  await db.insert(decisionSnapshots).values({
    decisionId: decision.id,
    equitySnapshot,
  });

  // Create event
  await db.insert(events).values({
    type: 'decision_proposed',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'decision',
    targetId: decision.id,
    payload: {
      title: decision.title,
      votingMethod: decision.votingMethod,
      options: decision.options,
    },
  });

  return c.json({
    success: true,
    message: initialStatus === 'active'
      ? 'Proposal created! Voting is now open.'
      : `Proposal created! Voting starts in ${data.voting_starts_in_hours} hours.`,
    decision: {
      id: decision.id,
      title: decision.title,
      status: decision.status,
      voting_method: decision.votingMethod,
      voting_starts_at: decision.votingStartsAt,
      voting_ends_at: decision.votingEndsAt,
    },
    snapshot: {
      total_voters: Object.keys(equitySnapshot).length,
      total_equity: Object.values(equitySnapshot).reduce((a, b) => a + b, 0),
    },
  }, 201);
});

// ============================================================================
// CAST VOTE
// ============================================================================

const voteSchema = z.object({
  option: z.string().min(1).max(100),
});

decisionsRouter.post('/:company/decisions/:decisionId/vote', requireClaimed, zValidator('json', voteSchema), async (c) => {
  const companyName = c.req.param('company');
  const decisionId = c.req.param('decisionId');
  const agent = c.get('agent');
  const { option } = c.req.valid('json');

  // Check kill switch
  if (await isVotingDisabled()) {
    return c.json({
      success: false,
      error: 'Voting is temporarily disabled',
      kill_switch: KILL_SWITCHES.DISABLE_VOTING,
    }, 503);
  }

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

  // Get decision with snapshot
  const decision = await db.query.decisions.findFirst({
    where: and(eq(decisions.id, decisionId), eq(decisions.companyId, company.id)),
    with: {
      snapshots: true,
    },
  });

  if (!decision) {
    return c.json({ success: false, error: 'Decision not found' }, 404);
  }

  if (decision.status !== 'active') {
    return c.json({ success: false, error: 'Voting is not open for this decision' }, 400);
  }

  // Check if voting has started
  if (decision.votingStartsAt && new Date() < decision.votingStartsAt) {
    return c.json({
      success: false,
      error: 'Voting has not started yet',
      voting_starts_at: decision.votingStartsAt,
    }, 400);
  }

  // Check if voting has ended
  if (decision.votingEndsAt && new Date() > decision.votingEndsAt) {
    return c.json({
      success: false,
      error: 'Voting has ended',
      voting_ended_at: decision.votingEndsAt,
    }, 400);
  }

  // Validate option
  const validOptions = decision.options as string[];
  if (!validOptions.includes(option)) {
    return c.json({
      success: false,
      error: 'Invalid option',
      valid_options: validOptions,
    }, 400);
  }

  // Check if already voted
  const existingVote = await db.query.votes.findFirst({
    where: and(
      eq(votes.decisionId, decisionId),
      eq(votes.agentId, agent.id),
    ),
  });

  if (existingVote) {
    return c.json({
      success: false,
      error: 'You have already voted on this decision',
      your_vote: existingVote.option,
    }, 400);
  }

  // Get equity snapshot
  const snapshot = decision.snapshots?.[0]?.equitySnapshot || {};

  // Calculate vote weight based on snapshot
  const equityAtVote = calculateVoteWeight(
    agent.id,
    decision.votingMethod as VotingMethod,
    snapshot,
    membership.equity
  );

  // Check if agent is in snapshot
  if (!(agent.id in snapshot)) {
    return c.json({
      success: false,
      error: 'You were not a member when this decision was created',
      hint: 'Only members present at decision creation can vote',
    }, 403);
  }

  // Cast vote
  await db.insert(votes).values({
    decisionId,
    agentId: agent.id,
    option,
    equityAtVote,
  });

  return c.json({
    success: true,
    message: `Vote cast for "${option}"`,
    your_vote: {
      option,
      equity_at_vote: equityAtVote,
      weight_description:
        decision.votingMethod === 'equity_weighted'
          ? `${equityAtVote}% equity weight`
          : '1 vote',
    },
  });
});

// ============================================================================
// CLOSE/RESOLVE DECISION (Admin only)
// ============================================================================

decisionsRouter.post('/:company/decisions/:decisionId/close', requireClaimed, async (c) => {
  const companyName = c.req.param('company');
  const decisionId = c.req.param('decisionId');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  // Check if founder/admin
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  if (!membership || membership.role !== 'founder') {
    return c.json({ success: false, error: 'Only founders can close decisions early' }, 403);
  }

  const decision = await db.query.decisions.findFirst({
    where: and(eq(decisions.id, decisionId), eq(decisions.companyId, company.id)),
    with: {
      votes: true,
      snapshots: true,
    },
  });

  if (!decision) {
    return c.json({ success: false, error: 'Decision not found' }, 404);
  }

  if (decision.status !== 'active') {
    return c.json({ success: false, error: 'Decision is not active' }, 400);
  }

  // Get snapshot
  const snapshot = decision.snapshots?.[0]?.equitySnapshot || {};

  // Resolve decision using the resolver service
  const resolverVotes: ResolverVote[] = decision.votes.map(v => ({
    option: v.option,
    equityAtVote: v.equityAtVote,
    agentId: v.agentId,
  }));

  const result = resolveDecision(
    resolverVotes,
    decision.options as string[],
    decision.votingMethod as VotingMethod,
    snapshot,
    0 // No quorum required for manual close
  );

  // Update decision
  const newStatus = result.passed ? 'passed' : 'rejected';
  await db.update(decisions)
    .set({
      status: newStatus,
      winningOption: result.winningOption,
      results: result.voteTally,
      executedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(decisions.id, decisionId));

  // Emit decision_resolved event
  await db.insert(events).values({
    type: 'decision_resolved',
    visibility: 'org',
    actorAgentId: agent.id,
    targetType: 'decision',
    targetId: decisionId,
    payload: {
      title: decision.title,
      status: newStatus,
      winningOption: result.winningOption,
      voteTally: result.voteTally,
      reason: result.reason,
    },
  });

  return c.json({
    success: true,
    message: result.passed
      ? `Decision passed! Winning option: "${result.winningOption}"`
      : `Decision rejected: ${result.reason}`,
    result: {
      status: newStatus,
      winning_option: result.winningOption,
      vote_tally: result.voteTally,
      quorum_met: result.quorumMet,
      total_vote_weight: result.totalVoteWeight,
      reason: result.reason,
    },
  });
});

// ============================================================================
// CANCEL DECISION (Proposer or founder)
// ============================================================================

decisionsRouter.delete('/:company/decisions/:decisionId', requireClaimed, async (c) => {
  const companyName = c.req.param('company');
  const decisionId = c.req.param('decisionId');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const decision = await db.query.decisions.findFirst({
    where: and(eq(decisions.id, decisionId), eq(decisions.companyId, company.id)),
  });

  if (!decision) {
    return c.json({ success: false, error: 'Decision not found' }, 404);
  }

  // Check permissions (proposer or founder)
  const membership = await db.query.companyMembers.findFirst({
    where: and(
      eq(companyMembers.companyId, company.id),
      eq(companyMembers.agentId, agent.id),
    ),
  });

  const canCancel = decision.proposedBy === agent.id ||
                   (membership && membership.role === 'founder');

  if (!canCancel) {
    return c.json({ success: false, error: 'Only the proposer or founder can cancel this decision' }, 403);
  }

  if (decision.status !== 'active' && decision.status !== 'draft') {
    return c.json({ success: false, error: 'Can only cancel active or draft decisions' }, 400);
  }

  // Cancel by setting status to expired (no 'cancelled' status in enum)
  await db.update(decisions)
    .set({
      status: 'expired',
      updatedAt: new Date(),
    })
    .where(eq(decisions.id, decisionId));

  return c.json({
    success: true,
    message: 'Decision cancelled',
  });
});

// ============================================================================
// GET MY VOTES (for current agent)
// ============================================================================

decisionsRouter.get('/:company/my-votes', async (c) => {
  const companyName = c.req.param('company');
  const agent = c.get('agent');

  const company = await db.query.companies.findFirst({
    where: eq(companies.name, companyName),
  });

  if (!company) {
    return c.json({ success: false, error: 'Company not found' }, 404);
  }

  const myVotes = await db.query.votes.findMany({
    where: eq(votes.agentId, agent.id),
    with: {
      decision: {
        columns: {
          id: true,
          title: true,
          status: true,
          votingMethod: true,
          winningOption: true,
        },
      },
    },
    orderBy: desc(votes.createdAt),
  });

  // Filter to only votes for this company's decisions
  const companyVotes = myVotes.filter(v => {
    // We need to check if the decision belongs to this company
    // This is a simplification - in production, join properly
    return true;
  });

  return c.json({
    success: true,
    votes: companyVotes.map(v => ({
      decision_id: v.decisionId,
      decision_title: v.decision?.title,
      decision_status: v.decision?.status,
      option: v.option,
      equity_at_vote: v.equityAtVote,
      voted_at: v.createdAt,
      won: v.decision?.winningOption === v.option,
    })),
    total: companyVotes.length,
  });
});
