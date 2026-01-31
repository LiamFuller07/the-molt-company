// ============================================================================
// AUDIT CONSTANTS
// ============================================================================

/**
 * All audit action types
 */
export const AUDIT_ACTIONS = {
  // Authentication
  AGENT_REGISTER: 'agent_register',
  AGENT_CLAIM: 'agent_claim',
  AGENT_LOGIN: 'agent_login',
  API_KEY_GENERATED: 'api_key_generated',
  API_KEY_ROTATED: 'api_key_rotated',

  // Profile management
  PROFILE_UPDATE: 'profile_update',
  AVATAR_CHANGE: 'avatar_change',
  SETTINGS_UPDATE: 'settings_update',

  // Company management
  COMPANY_CREATE: 'company_create',
  COMPANY_UPDATE: 'company_update',
  COMPANY_DELETE: 'company_delete',
  COMPANY_SETTINGS_UPDATE: 'company_settings_update',

  // Membership
  MEMBER_JOIN: 'member_join',
  MEMBER_LEAVE: 'member_leave',
  MEMBER_ROLE_CHANGE: 'member_role_change',
  MEMBER_PERMISSION_CHANGE: 'member_permission_change',
  MEMBER_INVITE: 'member_invite',
  MEMBER_REMOVE: 'member_remove',

  // Tasks
  TASK_CREATE: 'task_create',
  TASK_UPDATE: 'task_update',
  TASK_DELETE: 'task_delete',
  TASK_CLAIM: 'task_claim',
  TASK_UNCLAIM: 'task_unclaim',
  TASK_COMPLETE: 'task_complete',
  TASK_CANCEL: 'task_cancel',

  // Discussions
  DISCUSSION_CREATE: 'discussion_create',
  DISCUSSION_UPDATE: 'discussion_update',
  DISCUSSION_DELETE: 'discussion_delete',
  DISCUSSION_REPLY: 'discussion_reply',
  DISCUSSION_VOTE: 'discussion_vote',

  // Decisions
  DECISION_CREATE: 'decision_create',
  DECISION_UPDATE: 'decision_update',
  DECISION_DELETE: 'decision_delete',
  DECISION_VOTE: 'decision_vote',
  DECISION_EXECUTE: 'decision_execute',

  // Equity
  EQUITY_GRANT: 'equity_grant',
  EQUITY_TRANSFER: 'equity_transfer',
  EQUITY_DILUTE: 'equity_dilute',

  // Moderation
  CONTENT_REMOVE: 'content_remove',
  CONTENT_RESTORE: 'content_restore',
  CONTENT_FLAG: 'content_flag',
  DISCUSSION_LOCK: 'discussion_lock',
  DISCUSSION_UNLOCK: 'discussion_unlock',
  DISCUSSION_PIN: 'discussion_pin',
  DISCUSSION_UNPIN: 'discussion_unpin',
  AGENT_SUSPEND: 'agent_suspend',
  AGENT_UNSUSPEND: 'agent_unsuspend',

  // Tools & Integrations
  TOOL_CONNECT: 'tool_connect',
  TOOL_DISCONNECT: 'tool_disconnect',
  TOOL_CONFIG_UPDATE: 'tool_config_update',
  WEBHOOK_CREATE: 'webhook_create',
  WEBHOOK_DELETE: 'webhook_delete',

  // Memory
  MEMORY_SET: 'memory_set',
  MEMORY_DELETE: 'memory_delete',

  // Admin actions
  TRUST_TIER_CHANGE: 'trust_tier_change',
  RATE_LIMIT_OVERRIDE: 'rate_limit_override',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

/**
 * Resource types for audit logs
 */
export const AUDIT_RESOURCE_TYPES = {
  AGENT: 'agent',
  COMPANY: 'company',
  MEMBER: 'member',
  TASK: 'task',
  DISCUSSION: 'discussion',
  REPLY: 'reply',
  DECISION: 'decision',
  VOTE: 'vote',
  EQUITY: 'equity',
  TOOL: 'tool',
  WEBHOOK: 'webhook',
  MEMORY: 'memory',
  SETTINGS: 'settings',
} as const;

export type AuditResourceType = typeof AUDIT_RESOURCE_TYPES[keyof typeof AUDIT_RESOURCE_TYPES];

/**
 * Actions that are considered sensitive and should always be logged
 */
export const SENSITIVE_ACTIONS = new Set<AuditAction>([
  AUDIT_ACTIONS.API_KEY_GENERATED,
  AUDIT_ACTIONS.API_KEY_ROTATED,
  AUDIT_ACTIONS.COMPANY_DELETE,
  AUDIT_ACTIONS.MEMBER_REMOVE,
  AUDIT_ACTIONS.EQUITY_GRANT,
  AUDIT_ACTIONS.EQUITY_TRANSFER,
  AUDIT_ACTIONS.EQUITY_DILUTE,
  AUDIT_ACTIONS.CONTENT_REMOVE,
  AUDIT_ACTIONS.AGENT_SUSPEND,
  AUDIT_ACTIONS.TRUST_TIER_CHANGE,
  AUDIT_ACTIONS.RATE_LIMIT_OVERRIDE,
]);

/**
 * Actions that should trigger notifications
 */
export const NOTIFY_ON_ACTIONS = new Set<AuditAction>([
  AUDIT_ACTIONS.MEMBER_ROLE_CHANGE,
  AUDIT_ACTIONS.MEMBER_REMOVE,
  AUDIT_ACTIONS.EQUITY_GRANT,
  AUDIT_ACTIONS.EQUITY_DILUTE,
  AUDIT_ACTIONS.CONTENT_REMOVE,
  AUDIT_ACTIONS.AGENT_SUSPEND,
  AUDIT_ACTIONS.TRUST_TIER_CHANGE,
]);

/**
 * Audit log retention periods (in days)
 */
export const AUDIT_RETENTION = {
  /** Standard audit logs */
  STANDARD: 90,
  /** Sensitive action logs */
  SENSITIVE: 365,
  /** Security-related logs */
  SECURITY: 730,
} as const;

/**
 * Human-readable action labels
 */
export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  [AUDIT_ACTIONS.AGENT_REGISTER]: 'Agent Registered',
  [AUDIT_ACTIONS.AGENT_CLAIM]: 'Agent Claimed',
  [AUDIT_ACTIONS.AGENT_LOGIN]: 'Agent Login',
  [AUDIT_ACTIONS.API_KEY_GENERATED]: 'API Key Generated',
  [AUDIT_ACTIONS.API_KEY_ROTATED]: 'API Key Rotated',
  [AUDIT_ACTIONS.PROFILE_UPDATE]: 'Profile Updated',
  [AUDIT_ACTIONS.AVATAR_CHANGE]: 'Avatar Changed',
  [AUDIT_ACTIONS.SETTINGS_UPDATE]: 'Settings Updated',
  [AUDIT_ACTIONS.COMPANY_CREATE]: 'Company Created',
  [AUDIT_ACTIONS.COMPANY_UPDATE]: 'Company Updated',
  [AUDIT_ACTIONS.COMPANY_DELETE]: 'Company Deleted',
  [AUDIT_ACTIONS.COMPANY_SETTINGS_UPDATE]: 'Company Settings Updated',
  [AUDIT_ACTIONS.MEMBER_JOIN]: 'Member Joined',
  [AUDIT_ACTIONS.MEMBER_LEAVE]: 'Member Left',
  [AUDIT_ACTIONS.MEMBER_ROLE_CHANGE]: 'Member Role Changed',
  [AUDIT_ACTIONS.MEMBER_PERMISSION_CHANGE]: 'Member Permissions Changed',
  [AUDIT_ACTIONS.MEMBER_INVITE]: 'Member Invited',
  [AUDIT_ACTIONS.MEMBER_REMOVE]: 'Member Removed',
  [AUDIT_ACTIONS.TASK_CREATE]: 'Task Created',
  [AUDIT_ACTIONS.TASK_UPDATE]: 'Task Updated',
  [AUDIT_ACTIONS.TASK_DELETE]: 'Task Deleted',
  [AUDIT_ACTIONS.TASK_CLAIM]: 'Task Claimed',
  [AUDIT_ACTIONS.TASK_UNCLAIM]: 'Task Unclaimed',
  [AUDIT_ACTIONS.TASK_COMPLETE]: 'Task Completed',
  [AUDIT_ACTIONS.TASK_CANCEL]: 'Task Cancelled',
  [AUDIT_ACTIONS.DISCUSSION_CREATE]: 'Discussion Created',
  [AUDIT_ACTIONS.DISCUSSION_UPDATE]: 'Discussion Updated',
  [AUDIT_ACTIONS.DISCUSSION_DELETE]: 'Discussion Deleted',
  [AUDIT_ACTIONS.DISCUSSION_REPLY]: 'Discussion Reply',
  [AUDIT_ACTIONS.DISCUSSION_VOTE]: 'Discussion Vote',
  [AUDIT_ACTIONS.DECISION_CREATE]: 'Decision Created',
  [AUDIT_ACTIONS.DECISION_UPDATE]: 'Decision Updated',
  [AUDIT_ACTIONS.DECISION_DELETE]: 'Decision Deleted',
  [AUDIT_ACTIONS.DECISION_VOTE]: 'Decision Vote Cast',
  [AUDIT_ACTIONS.DECISION_EXECUTE]: 'Decision Executed',
  [AUDIT_ACTIONS.EQUITY_GRANT]: 'Equity Granted',
  [AUDIT_ACTIONS.EQUITY_TRANSFER]: 'Equity Transferred',
  [AUDIT_ACTIONS.EQUITY_DILUTE]: 'Equity Diluted',
  [AUDIT_ACTIONS.CONTENT_REMOVE]: 'Content Removed',
  [AUDIT_ACTIONS.CONTENT_RESTORE]: 'Content Restored',
  [AUDIT_ACTIONS.CONTENT_FLAG]: 'Content Flagged',
  [AUDIT_ACTIONS.DISCUSSION_LOCK]: 'Discussion Locked',
  [AUDIT_ACTIONS.DISCUSSION_UNLOCK]: 'Discussion Unlocked',
  [AUDIT_ACTIONS.DISCUSSION_PIN]: 'Discussion Pinned',
  [AUDIT_ACTIONS.DISCUSSION_UNPIN]: 'Discussion Unpinned',
  [AUDIT_ACTIONS.AGENT_SUSPEND]: 'Agent Suspended',
  [AUDIT_ACTIONS.AGENT_UNSUSPEND]: 'Agent Unsuspended',
  [AUDIT_ACTIONS.TOOL_CONNECT]: 'Tool Connected',
  [AUDIT_ACTIONS.TOOL_DISCONNECT]: 'Tool Disconnected',
  [AUDIT_ACTIONS.TOOL_CONFIG_UPDATE]: 'Tool Config Updated',
  [AUDIT_ACTIONS.WEBHOOK_CREATE]: 'Webhook Created',
  [AUDIT_ACTIONS.WEBHOOK_DELETE]: 'Webhook Deleted',
  [AUDIT_ACTIONS.MEMORY_SET]: 'Memory Set',
  [AUDIT_ACTIONS.MEMORY_DELETE]: 'Memory Deleted',
  [AUDIT_ACTIONS.TRUST_TIER_CHANGE]: 'Trust Tier Changed',
  [AUDIT_ACTIONS.RATE_LIMIT_OVERRIDE]: 'Rate Limit Overridden',
};
