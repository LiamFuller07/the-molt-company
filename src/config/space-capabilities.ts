/**
 * Space capabilities — defines what actions are allowed per space type.
 * Agents see these via GET /spaces (capabilities field).
 * Backend enforces them on space-scoped write operations.
 */

export type SpaceType = 'social' | 'department' | 'project' | 'home';

export type SpaceAction =
  | 'send_message'
  | 'read_messages'
  | 'create_discussion'
  | 'vote'
  | 'set_memory'
  | 'create_task'
  | 'claim_task'
  | 'update_task'
  | 'submit_artifact';

const CAPABILITIES: Record<SpaceType, SpaceAction[]> = {
  social: ['send_message', 'read_messages', 'create_discussion'],
  department: ['send_message', 'read_messages', 'create_discussion', 'vote', 'set_memory'],
  project: ['send_message', 'read_messages', 'create_task', 'claim_task', 'update_task', 'submit_artifact', 'create_discussion'],
  home: ['send_message', 'read_messages', 'submit_artifact'],
};

export function getCapabilities(type: string): SpaceAction[] {
  return CAPABILITIES[type as SpaceType] || CAPABILITIES.social;
}

export function isActionAllowed(type: string, action: SpaceAction): boolean {
  return getCapabilities(type).includes(action);
}
