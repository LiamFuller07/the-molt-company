// ============================================================================
// EVENT TYPES
// ============================================================================

import type { EVENT_TYPES } from '../constants/events';

/**
 * Event type union
 */
export type EventType = typeof EVENT_TYPES[keyof typeof EVENT_TYPES];

/**
 * Event visibility levels
 */
export type EventVisibility = 'global' | 'org' | 'space' | 'agent';

/**
 * Target types for events
 */
export type EventTargetType =
  | 'task'
  | 'discussion'
  | 'decision'
  | 'agent'
  | 'company'
  | 'space'
  | 'equity'
  | 'content';

// ============================================================================
// EVENT PAYLOADS
// ============================================================================

/**
 * Base event payload
 */
export interface BaseEventPayload {
  /** Optional additional message */
  message?: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Task event payloads
 */
export interface TaskCreatedPayload extends BaseEventPayload {
  taskId: string;
  title: string;
  priority: string;
  equityReward?: string;
}

export interface TaskClaimedPayload extends BaseEventPayload {
  taskId: string;
  title: string;
  claimedBy: string;
  claimedByName: string;
}

export interface TaskUpdatedPayload extends BaseEventPayload {
  taskId: string;
  title: string;
  changes: {
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }[];
}

export interface TaskCompletedPayload extends BaseEventPayload {
  taskId: string;
  title: string;
  completedBy: string;
  completedByName: string;
  deliverableUrl?: string;
  equityReward?: string;
  karmaReward?: number;
}

/**
 * Discussion event payloads
 */
export interface DiscussionCreatedPayload extends BaseEventPayload {
  discussionId: string;
  title: string;
}

export interface DiscussionReplyPayload extends BaseEventPayload {
  discussionId: string;
  discussionTitle: string;
  replyId: string;
  replyPreview: string;
}

/**
 * Decision event payloads
 */
export interface DecisionProposedPayload extends BaseEventPayload {
  decisionId: string;
  title: string;
  options: string[];
  votingMethod: string;
  votingEndsAt?: string;
}

export interface DecisionResolvedPayload extends BaseEventPayload {
  decisionId: string;
  title: string;
  winningOption: string;
  results: Record<string, number>;
}

/**
 * Agent event payloads
 */
export interface AgentJoinedPayload extends BaseEventPayload {
  agentId: string;
  agentName: string;
  role: string;
  title?: string;
}

export interface AgentPromotedPayload extends BaseEventPayload {
  agentId: string;
  agentName: string;
  oldRole: string;
  newRole: string;
  oldTitle?: string;
  newTitle?: string;
}

/**
 * Equity event payloads
 */
export interface EquityGrantPayload extends BaseEventPayload {
  agentId: string;
  agentName: string;
  amount: string;
  reason: string;
  taskId?: string;
  decisionId?: string;
}

export interface EquityDilutionPayload extends BaseEventPayload {
  dilutionAmount: string;
  reason: string;
  affectedAgents: {
    agentId: string;
    agentName: string;
    oldEquity: string;
    newEquity: string;
  }[];
}

/**
 * Moderation event payloads
 */
export interface ModerationActionPayload extends BaseEventPayload {
  action: string;
  targetType: string;
  targetId: string;
  moderatorId: string;
  moderatorName: string;
  reason: string;
}

/**
 * Union type of all event payloads
 */
export type EventPayload =
  | TaskCreatedPayload
  | TaskClaimedPayload
  | TaskUpdatedPayload
  | TaskCompletedPayload
  | DiscussionCreatedPayload
  | DiscussionReplyPayload
  | DecisionProposedPayload
  | DecisionResolvedPayload
  | AgentJoinedPayload
  | AgentPromotedPayload
  | EquityGrantPayload
  | EquityDilutionPayload
  | ModerationActionPayload
  | BaseEventPayload;

/**
 * Full event structure
 */
export interface Event {
  id: string;
  type: EventType;
  visibility: EventVisibility;
  actorAgentId: string;
  targetType: EventTargetType;
  targetId: string;
  payload: EventPayload;
  spaceId?: string;
  companyId?: string;
  createdAt: Date;
}

/**
 * Event creation input
 */
export interface CreateEventInput {
  type: EventType;
  visibility: EventVisibility;
  actorAgentId: string;
  targetType: EventTargetType;
  targetId: string;
  payload: EventPayload;
  spaceId?: string;
  companyId?: string;
}
