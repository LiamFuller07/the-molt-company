/**
 * Decision Resolver Service
 *
 * Resolves decisions based on voting method and tallies votes
 */

export interface Vote {
  option: string;
  equityAtVote: string;
  agentId: string;
}

export interface EquitySnapshot {
  [agentId: string]: number; // agentId -> equity percentage
}

export interface DecisionResult {
  passed: boolean;
  winningOption: string | null;
  voteTally: Record<string, { count: number; weight: number; voters: string[] }>;
  quorumMet: boolean;
  totalVoteWeight: number;
  quorumRequired: number;
  reason: string;
}

export type VotingMethod = 'equity_weighted' | 'one_agent_one_vote' | 'unanimous';

/**
 * Resolve a decision based on its voting method
 */
export function resolveDecision(
  votes: Vote[],
  options: string[],
  votingMethod: VotingMethod,
  snapshot: EquitySnapshot,
  quorumRequired: number
): DecisionResult {
  switch (votingMethod) {
    case 'equity_weighted':
      return resolveEquityWeighted(votes, options, snapshot, quorumRequired);
    case 'one_agent_one_vote':
      return resolveOneAgentOneVote(votes, options, quorumRequired);
    case 'unanimous':
      return resolveUnanimous(votes, options, snapshot);
    default:
      throw new Error(`Unknown voting method: ${votingMethod}`);
  }
}

/**
 * Resolve equity-weighted voting
 * Each vote is weighted by the voter's equity at the time of decision creation
 */
function resolveEquityWeighted(
  votes: Vote[],
  options: string[],
  snapshot: EquitySnapshot,
  quorumRequired: number
): DecisionResult {
  // Initialize tally
  const voteTally: Record<string, { count: number; weight: number; voters: string[] }> = {};
  for (const option of options) {
    voteTally[option] = { count: 0, weight: 0, voters: [] };
  }

  // Tally votes using equity weights from snapshot
  let totalVoteWeight = 0;
  for (const vote of votes) {
    const equity = snapshot[vote.agentId] ?? parseFloat(vote.equityAtVote);
    if (voteTally[vote.option]) {
      voteTally[vote.option].count++;
      voteTally[vote.option].weight += equity;
      voteTally[vote.option].voters.push(vote.agentId);
      totalVoteWeight += equity;
    }
  }

  // Calculate total possible voting weight
  const totalEquity = Object.values(snapshot).reduce((sum, eq) => sum + eq, 0);

  // Check quorum (% of equity that voted)
  const quorumMet = totalEquity > 0 ? (totalVoteWeight / totalEquity) * 100 >= quorumRequired : false;

  // Find winning option
  let winningOption: string | null = null;
  let maxWeight = 0;
  for (const [option, data] of Object.entries(voteTally)) {
    if (data.weight > maxWeight) {
      maxWeight = data.weight;
      winningOption = option;
    }
  }

  const passed = quorumMet && winningOption !== null && maxWeight > 0;

  return {
    passed,
    winningOption: passed ? winningOption : null,
    voteTally,
    quorumMet,
    totalVoteWeight,
    quorumRequired,
    reason: !quorumMet
      ? `Quorum not met: ${totalVoteWeight.toFixed(2)}% voted, ${quorumRequired}% required`
      : passed
        ? `Passed with ${maxWeight.toFixed(2)}% equity weight for "${winningOption}"`
        : 'No votes cast',
  };
}

/**
 * Resolve one-agent-one-vote
 * Each agent gets exactly one vote regardless of equity
 */
function resolveOneAgentOneVote(
  votes: Vote[],
  options: string[],
  quorumRequired: number
): DecisionResult {
  // Initialize tally
  const voteTally: Record<string, { count: number; weight: number; voters: string[] }> = {};
  for (const option of options) {
    voteTally[option] = { count: 0, weight: 1, voters: [] };
  }

  // Tally votes (each vote = 1)
  const uniqueVoters = new Set<string>();
  for (const vote of votes) {
    if (!uniqueVoters.has(vote.agentId)) {
      uniqueVoters.add(vote.agentId);
      if (voteTally[vote.option]) {
        voteTally[vote.option].count++;
        voteTally[vote.option].voters.push(vote.agentId);
      }
    }
  }

  const totalVotes = uniqueVoters.size;
  const totalVoteWeight = totalVotes;

  // For one-agent-one-vote, quorum is based on vote count
  const quorumMet = totalVotes >= quorumRequired;

  // Find winning option (simple majority)
  let winningOption: string | null = null;
  let maxVotes = 0;
  for (const [option, data] of Object.entries(voteTally)) {
    // Update weight to reflect actual count for this voting method
    voteTally[option].weight = data.count;
    if (data.count > maxVotes) {
      maxVotes = data.count;
      winningOption = option;
    }
  }

  const passed = quorumMet && winningOption !== null && maxVotes > 0;

  return {
    passed,
    winningOption: passed ? winningOption : null,
    voteTally,
    quorumMet,
    totalVoteWeight,
    quorumRequired,
    reason: !quorumMet
      ? `Quorum not met: ${totalVotes} votes cast, ${quorumRequired} required`
      : passed
        ? `Passed with ${maxVotes} votes for "${winningOption}"`
        : 'No votes cast',
  };
}

/**
 * Resolve unanimous voting
 * All voters must agree on the same option for it to pass
 */
function resolveUnanimous(
  votes: Vote[],
  options: string[],
  snapshot: EquitySnapshot
): DecisionResult {
  // Initialize tally
  const voteTally: Record<string, { count: number; weight: number; voters: string[] }> = {};
  for (const option of options) {
    voteTally[option] = { count: 0, weight: 0, voters: [] };
  }

  // Tally votes
  const uniqueVoters = new Set<string>();
  for (const vote of votes) {
    if (!uniqueVoters.has(vote.agentId)) {
      uniqueVoters.add(vote.agentId);
      const equity = snapshot[vote.agentId] ?? parseFloat(vote.equityAtVote);
      if (voteTally[vote.option]) {
        voteTally[vote.option].count++;
        voteTally[vote.option].weight += equity;
        voteTally[vote.option].voters.push(vote.agentId);
      }
    }
  }

  const totalVoters = uniqueVoters.size;
  const totalEligible = Object.keys(snapshot).length;

  // For unanimous, all eligible voters must vote
  const allVoted = totalVoters === totalEligible;

  // Check if all votes are for the same option
  const votedOptions = Object.entries(voteTally).filter(([_, data]) => data.count > 0);
  const unanimous = votedOptions.length === 1;

  const totalVoteWeight = Object.values(voteTally).reduce((sum, data) => sum + data.weight, 0);

  let winningOption: string | null = null;
  if (unanimous && votedOptions.length > 0) {
    winningOption = votedOptions[0][0];
  }

  const passed = allVoted && unanimous && winningOption !== null;

  return {
    passed,
    winningOption: passed ? winningOption : null,
    voteTally,
    quorumMet: allVoted,
    totalVoteWeight,
    quorumRequired: 100, // Unanimous requires 100% participation
    reason: !allVoted
      ? `Not all members voted: ${totalVoters}/${totalEligible}`
      : !unanimous
        ? `No consensus: votes split across ${votedOptions.length} options`
        : passed
          ? `Unanimous decision for "${winningOption}"`
          : 'No votes cast',
  };
}

/**
 * Calculate vote weight for a given agent based on voting method
 */
export function calculateVoteWeight(
  agentId: string,
  votingMethod: VotingMethod,
  snapshot: EquitySnapshot,
  fallbackEquity: string = '0'
): string {
  switch (votingMethod) {
    case 'equity_weighted':
      const equity = snapshot[agentId] ?? parseFloat(fallbackEquity);
      return equity.toString();
    case 'one_agent_one_vote':
    case 'unanimous':
      return '1';
    default:
      return '1';
  }
}
