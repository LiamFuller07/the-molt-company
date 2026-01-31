/**
 * E2E Test Helpers
 * Provides high-level API client functions for end-to-end testing
 */
import { Hono } from 'hono';
import app from '../../src/index';

// ============================================================================
// TYPES
// ============================================================================

export interface RegisteredAgent {
  id: string;
  name: string;
  apiKey: string;
  claimUrl: string;
  verificationCode: string;
  trustTier: string;
}

export interface ClaimedAgent extends RegisteredAgent {
  status: 'active';
  ownerXId: string;
  ownerXHandle: string;
}

export interface Company {
  name: string;
  displayName: string;
  totalEquity: string;
}

export interface Membership {
  role: string;
  title: string;
  equity: string;
  permissions: {
    canCreateTasks: boolean;
    canAssignTasks: boolean;
    canCreateDecisions: boolean;
    canInviteMembers: boolean;
    canManageSettings: boolean;
  };
}

export interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  equityReward?: string;
  karmaReward?: number;
}

export interface Decision {
  id: string;
  title: string;
  status: string;
  options: string[];
  votingMethod: string;
}

export interface HeartbeatResponse {
  success: boolean;
  status: string;
  rateLimit: {
    remaining: number;
    limit: number;
    resetsAt: string;
  };
}

export interface EquityInfo {
  totalEquity: number;
  treasury: number;
  distributed: number;
  myShare: number;
  myPercentage: string;
  holders: Array<{
    agent: string;
    equity: number;
    percentage: string;
    role: string;
  }>;
}

export interface Space {
  slug: string;
  name: string;
  type: string;
  companyId?: string;
}

// ============================================================================
// TEST APP
// ============================================================================

/**
 * Create a test app instance for making requests
 */
export function createTestApp(): typeof app {
  return app;
}

// ============================================================================
// AGENT API FUNCTIONS
// ============================================================================

/**
 * Register a new agent
 */
export async function registerAgent(
  app: Hono,
  name: string,
  options?: { description?: string; skills?: string[] }
): Promise<RegisteredAgent> {
  const response = await app.request('/api/v1/agents/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      description: options?.description || `Test agent ${name}`,
      skills: options?.skills || [],
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to register agent: ${data.error}`);
  }

  return {
    id: data.agent.id,
    name: data.agent.name,
    apiKey: data.agent.api_key,
    claimUrl: data.agent.claim_url,
    verificationCode: data.agent.verification_code,
    trustTier: data.agent.trust_tier,
  };
}

/**
 * Claim an agent (simulate X OAuth completion)
 */
export async function claimAgent(
  app: Hono,
  claimToken: string,
  xUser: { id: string; handle: string; name: string; avatar?: string }
): Promise<void> {
  const response = await app.request('/api/v1/agents/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      claim_token: claimToken,
      x_id: xUser.id,
      x_handle: xUser.handle,
      x_name: xUser.name,
      x_avatar: xUser.avatar || 'https://example.com/avatar.jpg',
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to claim agent: ${data.error}`);
  }
}

/**
 * Get agent status
 */
export async function getAgentStatus(
  app: Hono,
  apiKey: string
): Promise<{ status: string; agent: any }> {
  const response = await app.request('/api/v1/agents/status', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to get agent status: ${data.error}`);
  }

  return data;
}

/**
 * Send heartbeat
 */
export async function sendHeartbeat(
  app: Hono,
  apiKey: string
): Promise<HeartbeatResponse> {
  const response = await app.request('/api/v1/agents/heartbeat', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to send heartbeat: ${data.error}`);
  }

  return {
    success: data.success,
    status: data.status,
    rateLimit: {
      remaining: data.rate_limits.daily_writes.limit - data.rate_limits.daily_writes.used,
      limit: data.rate_limits.daily_writes.limit,
      resetsAt: data.rate_limits.daily_writes.resets_at,
    },
  };
}

/**
 * Get agent profile
 */
export async function getAgentProfile(
  app: Hono,
  apiKey: string
): Promise<any> {
  const response = await app.request('/api/v1/agents/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to get agent profile: ${data.error}`);
  }

  return data;
}

// ============================================================================
// COMPANY API FUNCTIONS
// ============================================================================

/**
 * Create a company
 */
export async function createCompany(
  app: Hono,
  apiKey: string,
  name: string,
  options?: {
    displayName?: string;
    description?: string;
    mission?: string;
    initialEquity?: number;
    isPublic?: boolean;
  }
): Promise<Company> {
  const response = await app.request('/api/v1/companies', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      display_name: options?.displayName || `Test Company ${name}`,
      description: options?.description || 'A test company',
      mission: options?.mission || 'Testing purposes',
      initial_equity: options?.initialEquity || 100,
      is_public: options?.isPublic ?? true,
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to create company: ${data.error}`);
  }

  return {
    name: data.company.name,
    displayName: data.company.display_name,
    totalEquity: String(options?.initialEquity || 100),
  };
}

/**
 * Get company details
 */
export async function getCompany(
  app: Hono,
  apiKey: string,
  companyName: string
): Promise<any> {
  const response = await app.request(`/api/v1/companies/${companyName}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to get company: ${data.error}`);
  }

  return data;
}

/**
 * Join a company
 */
export async function joinCompany(
  app: Hono,
  apiKey: string,
  companyName: string,
  pitch: string,
  role?: string
): Promise<Membership> {
  const response = await app.request(`/api/v1/companies/${companyName}/join`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      pitch,
      role: role || 'Member',
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to join company: ${data.error}`);
  }

  return {
    role: data.membership.role,
    title: data.membership.title,
    equity: String(data.membership.equity),
    permissions: {
      canCreateTasks: true,
      canAssignTasks: false,
      canCreateDecisions: true,
      canInviteMembers: false,
      canManageSettings: false,
    },
  };
}

/**
 * Leave a company
 */
export async function leaveCompany(
  app: Hono,
  apiKey: string,
  companyName: string
): Promise<void> {
  const response = await app.request(`/api/v1/companies/${companyName}/membership`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to leave company: ${data.error}`);
  }
}

// ============================================================================
// EQUITY API FUNCTIONS
// ============================================================================

/**
 * Get equity breakdown for a company
 */
export async function getEquity(
  app: Hono,
  apiKey: string,
  companyName: string
): Promise<EquityInfo> {
  const response = await app.request(`/api/v1/equity/${companyName}/equity`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to get equity: ${data.error}`);
  }

  // Find current agent's equity
  const profile = await getAgentProfile(app, apiKey);
  const myHolding = data.holders.find((h: any) => h.agent === profile.agent.name);

  return {
    totalEquity: data.total_equity,
    treasury: data.treasury,
    distributed: data.distributed,
    myShare: myHolding?.equity || 0,
    myPercentage: myHolding?.percentage || '0%',
    holders: data.holders,
  };
}

/**
 * Get my equity across all companies
 */
export async function getMyEquity(
  app: Hono,
  apiKey: string
): Promise<any> {
  const response = await app.request('/api/v1/equity/my-equity', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to get my equity: ${data.error}`);
  }

  return data;
}

/**
 * Grant equity from treasury
 */
export async function grantEquity(
  app: Hono,
  apiKey: string,
  companyName: string,
  toAgent: string,
  amount: number,
  reason: string
): Promise<void> {
  const response = await app.request(`/api/v1/equity/${companyName}/equity/grant`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to_agent: toAgent,
      amount,
      reason,
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to grant equity: ${data.error}`);
  }
}

/**
 * Transfer equity between members
 */
export async function transferEquity(
  app: Hono,
  apiKey: string,
  companyName: string,
  toAgent: string,
  amount: number,
  reason?: string
): Promise<void> {
  const response = await app.request(`/api/v1/equity/${companyName}/equity/transfer`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to_agent: toAgent,
      amount,
      reason: reason || 'Transfer',
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to transfer equity: ${data.error}`);
  }
}

// ============================================================================
// TASK API FUNCTIONS
// ============================================================================

/**
 * Create a task
 */
export async function createTask(
  app: Hono,
  apiKey: string,
  companyName: string,
  title: string,
  options?: {
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    equityReward?: number;
    karmaReward?: number;
    assignedTo?: string;
    dueDate?: string;
  }
): Promise<Task> {
  const response = await app.request(`/api/v1/tasks/${companyName}/tasks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      description: options?.description || 'Test task description',
      priority: options?.priority || 'medium',
      equity_reward: options?.equityReward,
      karma_reward: options?.karmaReward || 10,
      assigned_to: options?.assignedTo,
      due_date: options?.dueDate,
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to create task: ${data.error}`);
  }

  return {
    id: data.task.id,
    title: data.task.title,
    status: data.task.status,
    priority: options?.priority || 'medium',
    equityReward: options?.equityReward?.toString(),
    karmaReward: options?.karmaReward || 10,
  };
}

/**
 * Get task details
 */
export async function getTask(
  app: Hono,
  apiKey: string,
  companyName: string,
  taskId: string
): Promise<any> {
  const response = await app.request(`/api/v1/tasks/${companyName}/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to get task: ${data.error}`);
  }

  return data.task;
}

/**
 * Claim a task
 */
export async function claimTask(
  app: Hono,
  apiKey: string,
  companyName: string,
  taskId: string
): Promise<void> {
  const response = await app.request(`/api/v1/tasks/${companyName}/tasks/${taskId}/claim`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to claim task: ${data.error}`);
  }
}

/**
 * Update task (status, deliverable, etc.)
 */
export async function updateTask(
  app: Hono,
  apiKey: string,
  companyName: string,
  taskId: string,
  updates: {
    status?: 'open' | 'claimed' | 'in_progress' | 'review' | 'completed' | 'cancelled';
    deliverableUrl?: string;
    deliverableNotes?: string;
    title?: string;
    description?: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
  }
): Promise<void> {
  const response = await app.request(`/api/v1/tasks/${companyName}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      status: updates.status,
      deliverable_url: updates.deliverableUrl,
      deliverable_notes: updates.deliverableNotes,
      title: updates.title,
      description: updates.description,
      priority: updates.priority,
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to update task: ${data.error}`);
  }
}

/**
 * Complete a task with deliverable
 */
export async function completeTask(
  app: Hono,
  apiKey: string,
  companyName: string,
  taskId: string,
  deliverable: { url?: string; notes: string }
): Promise<void> {
  await updateTask(app, apiKey, companyName, taskId, {
    status: 'completed',
    deliverableUrl: deliverable.url,
    deliverableNotes: deliverable.notes,
  });
}

/**
 * List tasks
 */
export async function listTasks(
  app: Hono,
  apiKey: string,
  companyName: string,
  options?: {
    status?: string;
    limit?: number;
    cursor?: string;
  }
): Promise<{ tasks: any[]; hasMore: boolean; nextCursor: string | null }> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.cursor) params.set('cursor', options.cursor);

  const url = `/api/v1/tasks/${companyName}/tasks${params.toString() ? '?' + params.toString() : ''}`;

  const response = await app.request(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to list tasks: ${data.error}`);
  }

  return {
    tasks: data.tasks,
    hasMore: data.pagination.has_more,
    nextCursor: data.pagination.next_cursor,
  };
}

// ============================================================================
// DECISION API FUNCTIONS
// ============================================================================

/**
 * Create a decision/proposal
 */
export async function createDecision(
  app: Hono,
  apiKey: string,
  companyName: string,
  title: string,
  options: {
    description?: string;
    options: string[];
    votingMethod?: 'equity_weighted' | 'one_agent_one_vote' | 'unanimous';
    deadlineHours?: number;
    quorumRequired?: number;
  }
): Promise<Decision> {
  const response = await app.request(`/api/v1/decisions/${companyName}/decisions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      description: options.description || 'Test decision',
      options: options.options,
      voting_method: options.votingMethod || 'equity_weighted',
      deadline_hours: options.deadlineHours || 24,
      quorum_required: options.quorumRequired || 50,
    }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to create decision: ${data.error}`);
  }

  return {
    id: data.decision.id,
    title: data.decision.title,
    status: 'active',
    options: options.options,
    votingMethod: options.votingMethod || 'equity_weighted',
  };
}

/**
 * Get decision details
 */
export async function getDecision(
  app: Hono,
  apiKey: string,
  companyName: string,
  decisionId: string
): Promise<any> {
  const response = await app.request(`/api/v1/decisions/${companyName}/decisions/${decisionId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to get decision: ${data.error}`);
  }

  return data;
}

/**
 * Cast a vote
 */
export async function castVote(
  app: Hono,
  apiKey: string,
  companyName: string,
  decisionId: string,
  option: string
): Promise<{ option: string; weight: string }> {
  const response = await app.request(`/api/v1/decisions/${companyName}/decisions/${decisionId}/vote`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ option }),
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to cast vote: ${data.error}`);
  }

  return {
    option: data.your_vote.option,
    weight: data.your_vote.weight,
  };
}

/**
 * Resolve a decision
 */
export async function resolveDecision(
  app: Hono,
  apiKey: string,
  companyName: string,
  decisionId: string
): Promise<{ status: string; winningOption: string | null; voteTally: Record<string, number> }> {
  const response = await app.request(`/api/v1/decisions/${companyName}/decisions/${decisionId}/resolve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to resolve decision: ${data.error}`);
  }

  return {
    status: data.result.status,
    winningOption: data.result.winning_option,
    voteTally: data.result.vote_tally,
  };
}

/**
 * Cancel a decision
 */
export async function cancelDecision(
  app: Hono,
  apiKey: string,
  companyName: string,
  decisionId: string
): Promise<void> {
  const response = await app.request(`/api/v1/decisions/${companyName}/decisions/${decisionId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json() as any;

  if (!data.success) {
    throw new Error(`Failed to cancel decision: ${data.error}`);
  }
}

// ============================================================================
// SPACES API FUNCTIONS
// ============================================================================

/**
 * Get spaces for a company
 */
export async function getSpaces(
  app: Hono,
  apiKey: string
): Promise<Space[]> {
  // First get the agent's companies
  const profile = await getAgentProfile(app, apiKey);

  if (!profile.companies || profile.companies.length === 0) {
    return [];
  }

  // For each company, get its spaces
  const spaces: Space[] = [];

  for (const company of profile.companies) {
    const companyData = await getCompany(app, apiKey, company.name);
    // Companies may have associated spaces
    if (companyData.spaces) {
      spaces.push(...companyData.spaces);
    }
  }

  // If no explicit spaces, create a virtual "home" space per company
  if (spaces.length === 0) {
    for (const company of profile.companies) {
      spaces.push({
        slug: company.name,
        name: company.display_name,
        type: 'home',
        companyId: undefined,
      });
    }
  }

  return spaces;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate a unique test name
 */
export function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract claim token from claim URL
 */
export function extractClaimToken(claimUrl: string): string {
  const parts = claimUrl.split('/');
  return parts[parts.length - 1];
}

/**
 * Wait for a condition to be true
 */
export async function waitForCondition(
  condition: () => Promise<boolean>,
  options?: { timeout?: number; interval?: number }
): Promise<void> {
  const timeout = options?.timeout || 5000;
  const interval = options?.interval || 100;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(`Condition not met within ${timeout}ms`);
}

/**
 * Create a claimed agent in one step (for convenience in tests)
 */
export async function createClaimedAgent(
  app: Hono,
  name: string,
  xUser?: { id: string; handle: string; name: string }
): Promise<ClaimedAgent> {
  const agent = await registerAgent(app, name);
  const claimToken = extractClaimToken(agent.claimUrl);

  const defaultXUser = {
    id: `x-${Date.now()}`,
    handle: `${name}_human`,
    name: `${name} Human`,
  };

  await claimAgent(app, claimToken, xUser || defaultXUser);

  return {
    ...agent,
    status: 'active',
    ownerXId: (xUser || defaultXUser).id,
    ownerXHandle: (xUser || defaultXUser).handle,
  };
}
