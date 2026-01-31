/**
 * Equity Calculator Service
 *
 * Calculates equity distribution and dilution for company members
 */

export interface Agent {
  id: string;
  name?: string;
}

export interface Company {
  id: string;
  adminAgentId: string | null;
  adminFloorPct: string; // Decimal as string
  memberPoolPct: string; // Decimal as string
  totalEquity: string;
}

export interface Member {
  agentId: string;
  equity: string;
  role: 'founder' | 'member' | 'contractor';
}

export interface EquityHolder {
  agentId: string;
  equity: number;
  percentage: number;
}

export interface EquityDistribution {
  admin: EquityHolder | null;
  members: EquityHolder[];
  treasury: number;
  totalDistributed: number;
}

/**
 * Calculate the current equity distribution for a company
 */
export function calculateEquityDistribution(
  company: Company,
  members: Member[]
): EquityDistribution {
  const adminFloorPct = parseFloat(company.adminFloorPct);
  const memberPoolPct = parseFloat(company.memberPoolPct);
  const totalEquity = parseFloat(company.totalEquity);

  // Find admin agent
  const adminMember = members.find(m => m.agentId === company.adminAgentId);

  // Get non-admin members
  const nonAdminMembers = members.filter(m => m.agentId !== company.adminAgentId);

  // Calculate current distribution from actual member equity
  let totalDistributed = 0;
  const memberHolders: EquityHolder[] = [];

  for (const member of members) {
    const equity = parseFloat(member.equity);
    totalDistributed += equity;
    memberHolders.push({
      agentId: member.agentId,
      equity,
      percentage: totalEquity > 0 ? (equity / totalEquity) * 100 : 0,
    });
  }

  // Calculate treasury (unallocated equity)
  const treasury = totalEquity - totalDistributed;

  // Find admin holder
  const adminHolder = adminMember
    ? {
        agentId: adminMember.agentId,
        equity: parseFloat(adminMember.equity),
        percentage: totalEquity > 0 ? (parseFloat(adminMember.equity) / totalEquity) * 100 : 0,
      }
    : null;

  return {
    admin: adminHolder,
    members: memberHolders,
    treasury,
    totalDistributed,
  };
}

/**
 * Calculate the target equity distribution based on company policy
 * (admin floor + equal split of member pool)
 */
export function calculateTargetDistribution(
  company: Company,
  members: Member[]
): EquityDistribution {
  const adminFloorPct = parseFloat(company.adminFloorPct);
  const memberPoolPct = parseFloat(company.memberPoolPct);
  const totalEquity = parseFloat(company.totalEquity);

  // Get non-admin members
  const nonAdminMembers = members.filter(m => m.agentId !== company.adminAgentId);

  // Calculate target admin equity
  const adminTargetEquity = (adminFloorPct / 100) * totalEquity;

  // Calculate per-member share from member pool
  const perMemberShare =
    nonAdminMembers.length > 0 ? ((memberPoolPct / 100) * totalEquity) / nonAdminMembers.length : 0;

  // Build distribution
  let totalDistributed = 0;
  const memberHolders: EquityHolder[] = [];

  // Admin holder
  let adminHolder: EquityHolder | null = null;
  if (company.adminAgentId) {
    adminHolder = {
      agentId: company.adminAgentId,
      equity: adminTargetEquity,
      percentage: adminFloorPct,
    };
    totalDistributed += adminTargetEquity;
  }

  // Member holders
  for (const member of nonAdminMembers) {
    memberHolders.push({
      agentId: member.agentId,
      equity: perMemberShare,
      percentage: totalEquity > 0 ? (perMemberShare / totalEquity) * 100 : 0,
    });
    totalDistributed += perMemberShare;
  }

  // Treasury (remaining equity not in admin floor or member pool)
  const treasury = totalEquity - totalDistributed;

  return {
    admin: adminHolder,
    members: memberHolders,
    treasury,
    totalDistributed,
  };
}

/**
 * Calculate the new per-member share when a new member joins
 */
export function calculateDilutionOnJoin(
  currentMemberCount: number,
  memberPoolPct: number = 40
): number {
  // Each new member dilutes existing member shares equally
  // The member pool is split among all non-admin members
  const newMemberCount = currentMemberCount + 1;
  const newPerMemberShare = memberPoolPct / newMemberCount;

  return newPerMemberShare;
}

/**
 * Calculate the equity changes needed when a new member joins
 */
export function calculateEquityOnNewMember(
  company: Company,
  existingMembers: Member[],
  newMemberId: string
): {
  newMemberEquity: number;
  dilutionPerMember: number;
  memberAdjustments: Array<{ agentId: string; oldEquity: number; newEquity: number }>;
} {
  const memberPoolPct = parseFloat(company.memberPoolPct);
  const totalEquity = parseFloat(company.totalEquity);

  // Get non-admin members (excluding the new one)
  const nonAdminMembers = existingMembers.filter(m => m.agentId !== company.adminAgentId);

  // Calculate new per-member share
  const oldMemberCount = nonAdminMembers.length;
  const newMemberCount = oldMemberCount + 1;

  const newPerMemberShare = ((memberPoolPct / 100) * totalEquity) / newMemberCount;

  // Calculate adjustments
  const memberAdjustments = nonAdminMembers.map(member => ({
    agentId: member.agentId,
    oldEquity: parseFloat(member.equity),
    newEquity: newPerMemberShare,
  }));

  return {
    newMemberEquity: newPerMemberShare,
    dilutionPerMember: oldMemberCount > 0 ? (newPerMemberShare / oldMemberCount) : 0,
    memberAdjustments,
  };
}

/**
 * Create an equity snapshot for a decision
 * Maps agent IDs to their current equity percentage
 */
export function createEquitySnapshot(members: Member[]): Record<string, number> {
  const snapshot: Record<string, number> = {};

  for (const member of members) {
    snapshot[member.agentId] = parseFloat(member.equity);
  }

  return snapshot;
}

/**
 * Calculate vote weight based on equity
 */
export function calculateVoteWeight(
  agentId: string,
  snapshot: Record<string, number>,
  votingMethod: 'equity_weighted' | 'one_agent_one_vote' | 'unanimous'
): number {
  if (votingMethod === 'one_agent_one_vote' || votingMethod === 'unanimous') {
    return 1;
  }

  return snapshot[agentId] ?? 0;
}

/**
 * Validate equity transfer
 */
export function validateEquityTransfer(
  fromMember: Member | null,
  amount: number,
  toMemberId: string
): { valid: boolean; error?: string } {
  if (!fromMember) {
    return { valid: false, error: 'Source member not found' };
  }

  const sourceEquity = parseFloat(fromMember.equity);

  if (amount <= 0) {
    return { valid: false, error: 'Amount must be positive' };
  }

  if (amount > sourceEquity) {
    return {
      valid: false,
      error: `Insufficient equity: have ${sourceEquity}, requested ${amount}`,
    };
  }

  if (fromMember.agentId === toMemberId) {
    return { valid: false, error: 'Cannot transfer to self' };
  }

  return { valid: true };
}

/**
 * Calculate the total equity that would be needed for a grant from treasury
 */
export function validateTreasuryGrant(
  totalEquity: number,
  currentDistributed: number,
  grantAmount: number
): { valid: boolean; treasury: number; error?: string } {
  const treasury = totalEquity - currentDistributed;

  if (grantAmount <= 0) {
    return { valid: false, treasury, error: 'Amount must be positive' };
  }

  if (grantAmount > treasury) {
    return {
      valid: false,
      treasury,
      error: `Insufficient treasury: have ${treasury}, requested ${grantAmount}`,
    };
  }

  return { valid: true, treasury };
}
