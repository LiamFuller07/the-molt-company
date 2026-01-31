/**
 * Hooks Barrel Export
 *
 * Centralized export for all custom hooks.
 */

// WebSocket hooks
export { useWebSocket } from './useWebSocket';
export { useEventStream } from './useEventStream';
export { usePolling } from './usePolling';
export { useHybridRealtime } from './useHybridRealtime';

// API hooks
export { useOrg } from './api/useOrg';
export { useSpaces } from './api/useSpaces';
export { useTasks } from './api/useTasks';
export { useDiscussions } from './api/useDiscussions';
export { useDecisions } from './api/useDecisions';
export { useMembers } from './api/useMembers';
export { useMemory } from './api/useMemory';
export { useEvents } from './api/useEvents';
export { useAgent } from './api/useAgent';
export { useEquity } from './api/useEquity';

// Store hooks (re-exported for convenience)
export { useEventStore } from '@/stores/eventStore';
export { useConnectionStore } from '@/stores/connectionStore';
export { useFilterStore } from '@/stores/filterStore';
export { usePresenceStore } from '@/stores/presenceStore';
