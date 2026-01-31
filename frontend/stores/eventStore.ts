'use client';

import { create } from 'zustand';

interface Event {
  id: string;
  type: string;
  visibility: 'global' | 'org' | 'space' | 'agent';
  actorAgentId: string;
  targetType: string;
  targetId: string;
  payload: any;
  spaceId?: string;
  companyId?: string;
  createdAt: string;
}

interface EventStore {
  // State
  events: Event[];
  maxEvents: number;

  // Actions
  addEvent: (event: Event) => void;
  addEvents: (events: Event[]) => void;
  clearEvents: () => void;
  setMaxEvents: (max: number) => void;

  // Selectors
  getEventsByType: (type: string) => Event[];
  getEventsBySpace: (spaceId: string) => Event[];
  getRecentEvents: (limit: number) => Event[];
}

/**
 * eventStore
 *
 * Zustand store for managing real-time events.
 * Events are stored in memory with a configurable max limit.
 *
 * @example
 * // Add event
 * useEventStore.getState().addEvent(event);
 *
 * // Get events in component
 * const events = useEventStore((state) => state.events);
 * const recentEvents = useEventStore((state) => state.getRecentEvents(10));
 */
export const useEventStore = create<EventStore>((set, get) => ({
  // Initial state
  events: [],
  maxEvents: 100,

  // Add single event
  addEvent: (event) =>
    set((state) => {
      // Check for duplicates
      const exists = state.events.some((e) => e.id === event.id);
      if (exists) return state;

      // Add to front, keep max limit
      const newEvents = [event, ...state.events].slice(0, state.maxEvents);
      return { events: newEvents };
    }),

  // Add multiple events
  addEvents: (events) =>
    set((state) => {
      const existingIds = new Set(state.events.map((e) => e.id));
      const newEvents = events.filter((e) => !existingIds.has(e.id));

      // Merge and sort by createdAt, keep max limit
      const merged = [...newEvents, ...state.events]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, state.maxEvents);

      return { events: merged };
    }),

  // Clear all events
  clearEvents: () => set({ events: [] }),

  // Set max events limit
  setMaxEvents: (max) =>
    set((state) => ({
      maxEvents: max,
      events: state.events.slice(0, max),
    })),

  // Get events by type
  getEventsByType: (type) => {
    return get().events.filter((e) => e.type === type);
  },

  // Get events by space
  getEventsBySpace: (spaceId) => {
    return get().events.filter((e) => e.spaceId === spaceId);
  },

  // Get recent events
  getRecentEvents: (limit) => {
    return get().events.slice(0, limit);
  },
}));
