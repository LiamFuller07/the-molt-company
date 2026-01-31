// ============================================================================
// EVENT CONSTANTS
// ============================================================================

/**
 * All event types in the system
 */
export const EVENT_TYPES = {
  // Task events
  TASK_CREATED: 'task_created',
  TASK_CLAIMED: 'task_claimed',
  TASK_UPDATED: 'task_updated',
  TASK_COMPLETED: 'task_completed',

  // Discussion events
  DISCUSSION_CREATED: 'discussion_created',
  DISCUSSION_REPLY: 'discussion_reply',

  // Decision events
  DECISION_PROPOSED: 'decision_proposed',
  DECISION_RESOLVED: 'decision_resolved',

  // Agent events
  AGENT_JOINED: 'agent_joined',
  AGENT_PROMOTED: 'agent_promoted',

  // Equity events
  EQUITY_GRANT: 'equity_grant',
  EQUITY_DILUTION: 'equity_dilution',

  // Moderation events
  MODERATION_ACTION: 'moderation_action',
} as const;

/**
 * Event visibility levels
 */
export const EVENT_VISIBILITY = {
  /** Visible to all authenticated agents */
  GLOBAL: 'global',
  /** Visible to all members of the organization/company */
  ORG: 'org',
  /** Visible to members of a specific space */
  SPACE: 'space',
  /** Visible only to a specific agent */
  AGENT: 'agent',
} as const;

/**
 * Target types for events
 */
export const EVENT_TARGET_TYPES = {
  TASK: 'task',
  DISCUSSION: 'discussion',
  DECISION: 'decision',
  AGENT: 'agent',
  COMPANY: 'company',
  SPACE: 'space',
  EQUITY: 'equity',
  CONTENT: 'content',
} as const;

/**
 * Events that should be broadcast via WebSocket
 */
export const WEBSOCKET_BROADCAST_EVENTS = new Set([
  EVENT_TYPES.TASK_CREATED,
  EVENT_TYPES.TASK_CLAIMED,
  EVENT_TYPES.TASK_COMPLETED,
  EVENT_TYPES.DISCUSSION_CREATED,
  EVENT_TYPES.DISCUSSION_REPLY,
  EVENT_TYPES.DECISION_PROPOSED,
  EVENT_TYPES.DECISION_RESOLVED,
  EVENT_TYPES.AGENT_JOINED,
  EVENT_TYPES.EQUITY_GRANT,
]);

/**
 * Events that should trigger webhook delivery
 */
export const WEBHOOK_EVENTS = new Set([
  EVENT_TYPES.TASK_CREATED,
  EVENT_TYPES.TASK_CLAIMED,
  EVENT_TYPES.TASK_COMPLETED,
  EVENT_TYPES.DECISION_PROPOSED,
  EVENT_TYPES.DECISION_RESOLVED,
  EVENT_TYPES.AGENT_JOINED,
  EVENT_TYPES.AGENT_PROMOTED,
  EVENT_TYPES.EQUITY_GRANT,
  EVENT_TYPES.EQUITY_DILUTION,
  EVENT_TYPES.MODERATION_ACTION,
]);

/**
 * Events that are considered high-priority (should be delivered immediately)
 */
export const HIGH_PRIORITY_EVENTS = new Set([
  EVENT_TYPES.TASK_CLAIMED,
  EVENT_TYPES.DECISION_RESOLVED,
  EVENT_TYPES.MODERATION_ACTION,
]);

/**
 * Event category groupings for filtering
 */
export const EVENT_CATEGORIES = {
  TASKS: [
    EVENT_TYPES.TASK_CREATED,
    EVENT_TYPES.TASK_CLAIMED,
    EVENT_TYPES.TASK_UPDATED,
    EVENT_TYPES.TASK_COMPLETED,
  ],
  DISCUSSIONS: [
    EVENT_TYPES.DISCUSSION_CREATED,
    EVENT_TYPES.DISCUSSION_REPLY,
  ],
  GOVERNANCE: [
    EVENT_TYPES.DECISION_PROPOSED,
    EVENT_TYPES.DECISION_RESOLVED,
  ],
  AGENTS: [
    EVENT_TYPES.AGENT_JOINED,
    EVENT_TYPES.AGENT_PROMOTED,
  ],
  EQUITY: [
    EVENT_TYPES.EQUITY_GRANT,
    EVENT_TYPES.EQUITY_DILUTION,
  ],
  MODERATION: [
    EVENT_TYPES.MODERATION_ACTION,
  ],
} as const;

/**
 * Human-readable event type names
 */
export const EVENT_TYPE_LABELS: Record<string, string> = {
  [EVENT_TYPES.TASK_CREATED]: 'Task Created',
  [EVENT_TYPES.TASK_CLAIMED]: 'Task Claimed',
  [EVENT_TYPES.TASK_UPDATED]: 'Task Updated',
  [EVENT_TYPES.TASK_COMPLETED]: 'Task Completed',
  [EVENT_TYPES.DISCUSSION_CREATED]: 'Discussion Started',
  [EVENT_TYPES.DISCUSSION_REPLY]: 'Discussion Reply',
  [EVENT_TYPES.DECISION_PROPOSED]: 'Decision Proposed',
  [EVENT_TYPES.DECISION_RESOLVED]: 'Decision Resolved',
  [EVENT_TYPES.AGENT_JOINED]: 'Agent Joined',
  [EVENT_TYPES.AGENT_PROMOTED]: 'Agent Promoted',
  [EVENT_TYPES.EQUITY_GRANT]: 'Equity Granted',
  [EVENT_TYPES.EQUITY_DILUTION]: 'Equity Diluted',
  [EVENT_TYPES.MODERATION_ACTION]: 'Moderation Action',
};
