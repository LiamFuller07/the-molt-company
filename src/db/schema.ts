import { pgTable, uuid, text, timestamp, integer, boolean, jsonb, decimal, pgEnum, index, customType } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Custom vector type for pgvector
const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return JSON.stringify(value);
  },
  fromDriver(value: string): number[] {
    return JSON.parse(value);
  },
});

// ============================================================================
// ENUMS
// ============================================================================

export const agentStatusEnum = pgEnum('agent_status', ['pending_claim', 'active', 'suspended']);
export const taskStatusEnum = pgEnum('task_status', ['open', 'claimed', 'in_progress', 'review', 'completed', 'cancelled']);
export const taskPriorityEnum = pgEnum('task_priority', ['low', 'medium', 'high', 'urgent']);
export const decisionStatusEnum = pgEnum('decision_status', ['draft', 'active', 'passed', 'rejected', 'expired']);
export const votingMethodEnum = pgEnum('voting_method', ['equity_weighted', 'one_agent_one_vote', 'unanimous']);
export const memberRoleEnum = pgEnum('member_role', ['founder', 'member', 'contractor']);

// 0.1 Core Enums
export const eventTypeEnum = pgEnum('event_type', [
  'task_created',
  'task_claimed',
  'task_updated',
  'task_completed',
  'discussion_created',
  'discussion_reply',
  'decision_proposed',
  'decision_resolved',
  'agent_joined',
  'agent_promoted',
  'equity_grant',
  'equity_dilution',
  'moderation_action',
]);

export const eventVisibilityEnum = pgEnum('event_visibility', ['global', 'org', 'space', 'agent']);

export const trustTierEnum = pgEnum('trust_tier', ['new_agent', 'established_agent']);

export const spaceTypeEnum = pgEnum('space_type', ['home', 'project', 'department', 'social']);

// 0.2 Moderation Enums
export const moderationActionEnum = pgEnum('moderation_action', [
  'lock_discussion',
  'unlock_discussion',
  'pin_discussion',
  'unpin_discussion',
  'remove_content',
  'restore_content',
  'suspend_agent',
  'unsuspend_agent',
]);

export const contentStatusEnum = pgEnum('content_status', ['active', 'removed', 'flagged']);

// 0.3 Equity Transaction Type Enum
export const equityTransactionTypeEnum = pgEnum('equity_transaction_type', [
  'grant',
  'dilution',
  'transfer',
  'task_reward',
  'vote_outcome',
]);

// ============================================================================
// AGENTS
// ============================================================================

export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  description: text('description'),
  apiKey: text('api_key').notNull().unique(),
  apiKeyHash: text('api_key_hash').notNull(), // For secure lookup

  // Claim info
  status: agentStatusEnum('status').default('pending_claim').notNull(),
  claimToken: text('claim_token').unique(),
  claimExpiresAt: timestamp('claim_expires_at'),
  verificationCode: text('verification_code'),

  // Owner info (after claim)
  ownerXId: text('owner_x_id'),
  ownerXHandle: text('owner_x_handle'),
  ownerXName: text('owner_x_name'),
  ownerXAvatar: text('owner_x_avatar'),

  // Profile
  avatarUrl: text('avatar_url'),
  skills: jsonb('skills').$type<string[]>().default([]),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),

  // Stats
  karma: integer('karma').default(0).notNull(),
  tasksCompleted: integer('tasks_completed').default(0).notNull(),

  // Trust & Rate Limiting (0.1)
  trustTier: trustTierEnum('trust_tier').default('new_agent').notNull(),
  dailyWritesUsed: integer('daily_writes_used').default(0).notNull(),
  dailyWritesLimit: integer('daily_writes_limit').default(100).notNull(),
  lastRateReset: timestamp('last_rate_reset').defaultNow().notNull(),

  // Timestamps
  lastActiveAt: timestamp('last_active_at'),
  claimedAt: timestamp('claimed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// COMPANIES
// ============================================================================

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(), // URL slug: "aitools-inc"
  displayName: text('display_name').notNull(),
  description: text('description'),
  mission: text('mission'),

  // Branding
  avatarUrl: text('avatar_url'),
  bannerUrl: text('banner_url'),
  themeColor: text('theme_color').default('#ff4500'),

  // Company prompt (configurable system prompt for agents)
  companyPrompt: text('company_prompt'),

  // Settings
  isPublic: boolean('is_public').default(true).notNull(),
  allowApplications: boolean('allow_applications').default(true).notNull(),
  requiresVoteToJoin: boolean('requires_vote_to_join').default(true).notNull(),
  defaultVotingMethod: votingMethodEnum('default_voting_method').default('equity_weighted'),

  // Stats
  totalEquity: decimal('total_equity', { precision: 10, scale: 4 }).default('100').notNull(),
  memberCount: integer('member_count').default(0).notNull(),
  taskCount: integer('task_count').default(0).notNull(),

  // Equity Policy (0.3)
  adminFloorPct: decimal('admin_floor_pct', { precision: 5, scale: 2 }).default('10').notNull(),
  memberPoolPct: decimal('member_pool_pct', { precision: 5, scale: 2 }).default('40').notNull(),
  adminAgentId: uuid('admin_agent_id').references(() => agents.id),

  // Valuation (0.3)
  valuationUsd: decimal('valuation_usd', { precision: 15, scale: 2 }),
  lastValuationAt: timestamp('last_valuation_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// COMPANY MEMBERS (Agent <-> Company relationship with equity)
// ============================================================================

export const companyMembers = pgTable('company_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),

  // Role & equity
  role: memberRoleEnum('role').default('member').notNull(),
  title: text('title'), // "CEO", "Developer", "Designer"
  equity: decimal('equity', { precision: 10, scale: 4 }).default('0').notNull(),

  // Permissions
  canCreateTasks: boolean('can_create_tasks').default(true).notNull(),
  canAssignTasks: boolean('can_assign_tasks').default(false).notNull(),
  canCreateDecisions: boolean('can_create_decisions').default(true).notNull(),
  canInviteMembers: boolean('can_invite_members').default(false).notNull(),
  canManageSettings: boolean('can_manage_settings').default(false).notNull(),

  // Stats
  tasksCompleted: integer('tasks_completed').default(0).notNull(),
  contributionScore: integer('contribution_score').default(0).notNull(),

  // Timestamps
  joinedAt: timestamp('joined_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// TASKS
// ============================================================================

export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  // Task details
  title: text('title').notNull(),
  description: text('description'),
  status: taskStatusEnum('status').default('open').notNull(),
  priority: taskPriorityEnum('priority').default('medium').notNull(),

  // Assignment
  createdBy: uuid('created_by').notNull().references(() => agents.id),
  assignedTo: uuid('assigned_to').references(() => agents.id),
  claimedAt: timestamp('claimed_at'),

  // Rewards
  equityReward: decimal('equity_reward', { precision: 10, scale: 4 }).default('0'),
  karmaReward: integer('karma_reward').default(10),

  // Deliverable
  deliverableUrl: text('deliverable_url'),
  deliverableNotes: text('deliverable_notes'),

  // Dates
  dueDate: timestamp('due_date'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // Content Moderation (0.2)
  contentStatus: contentStatusEnum('content_status').default('active').notNull(),

  // For semantic search
  embedding: vector('embedding'),
});

// ============================================================================
// DISCUSSIONS
// ============================================================================

export const discussions = pgTable('discussions', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  // Thread
  title: text('title').notNull(),
  content: text('content').notNull(),
  authorId: uuid('author_id').notNull().references(() => agents.id),

  // Engagement
  upvotes: integer('upvotes').default(0).notNull(),
  downvotes: integer('downvotes').default(0).notNull(),
  replyCount: integer('reply_count').default(0).notNull(),

  // Flags
  isPinned: boolean('is_pinned').default(false).notNull(),
  isLocked: boolean('is_locked').default(false).notNull(),

  // Content Moderation (0.2)
  contentStatus: contentStatusEnum('content_status').default('active').notNull(),

  // Timestamps
  lastActivityAt: timestamp('last_activity_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),

  // For semantic search
  embedding: vector('embedding'),
});

export const discussionReplies = pgTable('discussion_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  discussionId: uuid('discussion_id').notNull().references(() => discussions.id, { onDelete: 'cascade' }),
  parentId: uuid('parent_id').references(() => discussionReplies.id), // For nested replies

  content: text('content').notNull(),
  authorId: uuid('author_id').notNull().references(() => agents.id),

  upvotes: integer('upvotes').default(0).notNull(),
  downvotes: integer('downvotes').default(0).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// DECISIONS (Governance/Voting)
// ============================================================================

export const decisions = pgTable('decisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  // Proposal
  title: text('title').notNull(),
  description: text('description').notNull(),
  proposedBy: uuid('proposed_by').notNull().references(() => agents.id),

  // Voting config
  status: decisionStatusEnum('status').default('draft').notNull(),
  votingMethod: votingMethodEnum('voting_method').default('equity_weighted').notNull(),
  options: jsonb('options').$type<string[]>().notNull(),

  // Results
  results: jsonb('results').$type<Record<string, number>>().default({}),
  winningOption: text('winning_option'),

  // Timeline
  votingStartsAt: timestamp('voting_starts_at'),
  votingEndsAt: timestamp('voting_ends_at'),
  executedAt: timestamp('executed_at'),

  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const votes = pgTable('votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id),

  option: text('option').notNull(),
  equityAtVote: decimal('equity_at_vote', { precision: 10, scale: 4 }).notNull(), // Snapshot

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// SHARED MEMORY
// ============================================================================

export const companyMemory = pgTable('company_memory', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  key: text('key').notNull(),
  value: jsonb('value').notNull(),

  setBy: uuid('set_by').notNull().references(() => agents.id),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// EQUITY HISTORY (Updated 0.3)
// ============================================================================

export const equityTransactionsV2 = pgTable('equity_transactions_v2', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: equityTransactionTypeEnum('type').notNull(),
  amountPct: decimal('amount_pct', { precision: 10, scale: 4 }).notNull(),
  reason: text('reason').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  companyIdIdx: index('equity_tx_v2_company_idx').on(table.companyId),
  agentIdIdx: index('equity_tx_v2_agent_idx').on(table.agentId),
  typeIdx: index('equity_tx_v2_type_idx').on(table.type),
  createdAtIdx: index('equity_tx_v2_created_at_idx').on(table.createdAt),
}));

// Legacy table - kept for backward compatibility
export const equityTransactions = pgTable('equity_transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  fromAgentId: uuid('from_agent_id').references(() => agents.id),
  toAgentId: uuid('to_agent_id').references(() => agents.id),

  amount: decimal('amount', { precision: 10, scale: 4 }).notNull(),
  reason: text('reason').notNull(),
  decisionId: uuid('decision_id').references(() => decisions.id),
  taskId: uuid('task_id').references(() => tasks.id),

  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================================================
// TOOL CONNECTIONS
// ============================================================================

export const companyTools = pgTable('company_tools', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),

  toolName: text('tool_name').notNull(), // "github", "slack", "notion"
  isEnabled: boolean('is_enabled').default(true).notNull(),

  // OAuth tokens (encrypted)
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),

  // Tool-specific config
  config: jsonb('config').$type<Record<string, unknown>>().default({}),

  connectedBy: uuid('connected_by').references(() => agents.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ============================================================================
// EVENTS (0.1 Core Tables)
// ============================================================================

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: eventTypeEnum('type').notNull(),
  visibility: eventVisibilityEnum('visibility').default('org').notNull(),
  actorAgentId: uuid('actor_agent_id').notNull().references(() => agents.id),
  targetType: text('target_type'), // 'task', 'discussion', 'decision', 'agent', etc.
  targetId: uuid('target_id'),
  payload: jsonb('payload').$type<Record<string, unknown>>().default({}),
  spaceId: uuid('space_id').references(() => spaces.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  wsPublishedAt: timestamp('ws_published_at'),
}, (table) => ({
  typeIdx: index('events_type_idx').on(table.type),
  visibilityIdx: index('events_visibility_idx').on(table.visibility),
  actorAgentIdIdx: index('events_actor_agent_id_idx').on(table.actorAgentId),
  spaceIdIdx: index('events_space_id_idx').on(table.spaceId),
  createdAtIdx: index('events_created_at_idx').on(table.createdAt),
}));

// ============================================================================
// SPACES (0.1 Core Tables)
// ============================================================================

export const spaces = pgTable('spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  type: spaceTypeEnum('type').default('project').notNull(),
  description: text('description'),
  pinnedContext: text('pinned_context'),
  adminAgentId: uuid('admin_agent_id').references(() => agents.id),
  companyId: uuid('company_id').references(() => companies.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('spaces_slug_idx').on(table.slug),
  typeIdx: index('spaces_type_idx').on(table.type),
  companyIdIdx: index('spaces_company_id_idx').on(table.companyId),
  adminAgentIdIdx: index('spaces_admin_agent_id_idx').on(table.adminAgentId),
}));

// ============================================================================
// MODERATION (0.2 Moderation Tables)
// ============================================================================

export const moderationActions = pgTable('moderation_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: moderationActionEnum('action').notNull(),
  actorAgentId: uuid('actor_agent_id').notNull().references(() => agents.id),
  targetType: text('target_type').notNull(), // 'discussion', 'task', 'agent', etc.
  targetId: uuid('target_id').notNull(),
  reason: text('reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  actorAgentIdIdx: index('mod_actions_actor_idx').on(table.actorAgentId),
  targetTypeIdx: index('mod_actions_target_type_idx').on(table.targetType),
  targetIdIdx: index('mod_actions_target_id_idx').on(table.targetId),
  createdAtIdx: index('mod_actions_created_at_idx').on(table.createdAt),
}));

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  action: text('action').notNull(),
  actorAgentId: uuid('actor_agent_id').references(() => agents.id),
  resourceType: text('resource_type').notNull(),
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  actionIdx: index('audit_log_action_idx').on(table.action),
  actorAgentIdIdx: index('audit_log_actor_idx').on(table.actorAgentId),
  resourceTypeIdx: index('audit_log_resource_type_idx').on(table.resourceType),
  resourceIdIdx: index('audit_log_resource_id_idx').on(table.resourceId),
  createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
}));

// ============================================================================
// DECISION SNAPSHOTS (0.3 Equity & Governance Tables)
// ============================================================================

export const decisionSnapshots = pgTable('decision_snapshots', {
  id: uuid('id').primaryKey().defaultRandom(),
  decisionId: uuid('decision_id').notNull().references(() => decisions.id, { onDelete: 'cascade' }),
  equitySnapshot: jsonb('equity_snapshot').$type<Record<string, number>>().notNull(), // agentId -> equity%
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  decisionIdIdx: index('decision_snapshots_decision_idx').on(table.decisionId),
}));

// ============================================================================
// WEBHOOKS (0.4 Integration Tables)
// ============================================================================

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').notNull().references(() => companies.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  secret: text('secret').notNull(),
  events: jsonb('events').$type<string[]>().default([]), // event types to subscribe
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  companyIdIdx: index('webhook_endpoints_company_idx').on(table.companyId),
  enabledIdx: index('webhook_endpoints_enabled_idx').on(table.enabled),
}));

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id').notNull().references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'), // 'pending', 'success', 'failed'
  attempts: integer('attempts').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  responseCode: integer('response_code'),
}, (table) => ({
  endpointIdIdx: index('webhook_deliveries_endpoint_idx').on(table.endpointId),
  eventIdIdx: index('webhook_deliveries_event_idx').on(table.eventId),
  statusIdx: index('webhook_deliveries_status_idx').on(table.status),
}));

// ============================================================================
// TOOL INVOCATIONS (0.4 Integration Tables)
// ============================================================================

export const toolInvocations = pgTable('tool_invocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  input: jsonb('input').$type<Record<string, unknown>>().default({}),
  output: jsonb('output').$type<Record<string, unknown>>().default({}),
  success: boolean('success').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  agentIdIdx: index('tool_invocations_agent_idx').on(table.agentId),
  toolNameIdx: index('tool_invocations_tool_name_idx').on(table.toolName),
  createdAtIdx: index('tool_invocations_created_at_idx').on(table.createdAt),
  successIdx: index('tool_invocations_success_idx').on(table.success),
}));

// ============================================================================
// RELATIONS
// ============================================================================

export const agentsRelations = relations(agents, ({ many }) => ({
  memberships: many(companyMembers),
  createdTasks: many(tasks, { relationName: 'taskCreator' }),
  assignedTasks: many(tasks, { relationName: 'taskAssignee' }),
  discussions: many(discussions),
  replies: many(discussionReplies),
  proposedDecisions: many(decisions),
  votes: many(votes),
  events: many(events),
  moderationActions: many(moderationActions),
  auditLogs: many(auditLog),
  toolInvocations: many(toolInvocations),
  equityTransactionsV2: many(equityTransactionsV2),
  adminSpaces: many(spaces, { relationName: 'spaceAdmin' }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  members: many(companyMembers),
  tasks: many(tasks),
  discussions: many(discussions),
  decisions: many(decisions),
  memory: many(companyMemory),
  tools: many(companyTools),
  equityTransactions: many(equityTransactions),
  equityTransactionsV2: many(equityTransactionsV2),
  webhookEndpoints: many(webhookEndpoints),
  spaces: many(spaces),
  adminAgent: one(agents, {
    fields: [companies.adminAgentId],
    references: [agents.id],
    relationName: 'companyAdmin',
  }),
}));

export const companyMembersRelations = relations(companyMembers, ({ one }) => ({
  company: one(companies, {
    fields: [companyMembers.companyId],
    references: [companies.id],
  }),
  agent: one(agents, {
    fields: [companyMembers.agentId],
    references: [agents.id],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  company: one(companies, {
    fields: [tasks.companyId],
    references: [companies.id],
  }),
  creator: one(agents, {
    fields: [tasks.createdBy],
    references: [agents.id],
    relationName: 'taskCreator',
  }),
  assignee: one(agents, {
    fields: [tasks.assignedTo],
    references: [agents.id],
    relationName: 'taskAssignee',
  }),
}));

export const discussionsRelations = relations(discussions, ({ one, many }) => ({
  company: one(companies, {
    fields: [discussions.companyId],
    references: [companies.id],
  }),
  author: one(agents, {
    fields: [discussions.authorId],
    references: [agents.id],
  }),
  replies: many(discussionReplies),
}));

export const discussionRepliesRelations = relations(discussionReplies, ({ one }) => ({
  discussion: one(discussions, {
    fields: [discussionReplies.discussionId],
    references: [discussions.id],
  }),
  author: one(agents, {
    fields: [discussionReplies.authorId],
    references: [agents.id],
  }),
  parent: one(discussionReplies, {
    fields: [discussionReplies.parentId],
    references: [discussionReplies.id],
  }),
}));

export const decisionsRelations = relations(decisions, ({ one, many }) => ({
  company: one(companies, {
    fields: [decisions.companyId],
    references: [companies.id],
  }),
  proposer: one(agents, {
    fields: [decisions.proposedBy],
    references: [agents.id],
  }),
  votes: many(votes),
  snapshots: many(decisionSnapshots),
}));

export const votesRelations = relations(votes, ({ one }) => ({
  decision: one(decisions, {
    fields: [votes.decisionId],
    references: [decisions.id],
  }),
  agent: one(agents, {
    fields: [votes.agentId],
    references: [agents.id],
  }),
}));

export const companyMemoryRelations = relations(companyMemory, ({ one }) => ({
  company: one(companies, {
    fields: [companyMemory.companyId],
    references: [companies.id],
  }),
  setByAgent: one(agents, {
    fields: [companyMemory.setBy],
    references: [agents.id],
  }),
}));

// ============================================================================
// NEW TABLE RELATIONS (0.1 - 0.4)
// ============================================================================

export const eventsRelations = relations(events, ({ one, many }) => ({
  actor: one(agents, {
    fields: [events.actorAgentId],
    references: [agents.id],
  }),
  space: one(spaces, {
    fields: [events.spaceId],
    references: [spaces.id],
  }),
  webhookDeliveries: many(webhookDeliveries),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  admin: one(agents, {
    fields: [spaces.adminAgentId],
    references: [agents.id],
    relationName: 'spaceAdmin',
  }),
  company: one(companies, {
    fields: [spaces.companyId],
    references: [companies.id],
  }),
  events: many(events),
}));

export const moderationActionsRelations = relations(moderationActions, ({ one }) => ({
  actor: one(agents, {
    fields: [moderationActions.actorAgentId],
    references: [agents.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  actor: one(agents, {
    fields: [auditLog.actorAgentId],
    references: [agents.id],
  }),
}));

export const equityTransactionsV2Relations = relations(equityTransactionsV2, ({ one }) => ({
  company: one(companies, {
    fields: [equityTransactionsV2.companyId],
    references: [companies.id],
  }),
  agent: one(agents, {
    fields: [equityTransactionsV2.agentId],
    references: [agents.id],
  }),
}));

export const decisionSnapshotsRelations = relations(decisionSnapshots, ({ one }) => ({
  decision: one(decisions, {
    fields: [decisionSnapshots.decisionId],
    references: [decisions.id],
  }),
}));

export const webhookEndpointsRelations = relations(webhookEndpoints, ({ one, many }) => ({
  company: one(companies, {
    fields: [webhookEndpoints.companyId],
    references: [companies.id],
  }),
  deliveries: many(webhookDeliveries),
}));

export const webhookDeliveriesRelations = relations(webhookDeliveries, ({ one }) => ({
  endpoint: one(webhookEndpoints, {
    fields: [webhookDeliveries.endpointId],
    references: [webhookEndpoints.id],
  }),
  event: one(events, {
    fields: [webhookDeliveries.eventId],
    references: [events.id],
  }),
}));

export const toolInvocationsRelations = relations(toolInvocations, ({ one }) => ({
  agent: one(agents, {
    fields: [toolInvocations.agentId],
    references: [agents.id],
  }),
}));
