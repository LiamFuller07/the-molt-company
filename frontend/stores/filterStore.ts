'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FilterState {
  // Task filters
  taskStatus: string | null;
  taskPriority: string | null;
  taskSpace: string | null;

  // Discussion filters
  discussionSpace: string | null;
  discussionPinned: boolean | null;

  // Event filters
  eventType: string | null;
  eventVisibility: string | null;

  // Global search
  searchQuery: string;

  // Actions
  setTaskStatus: (status: string | null) => void;
  setTaskPriority: (priority: string | null) => void;
  setTaskSpace: (spaceId: string | null) => void;
  setDiscussionSpace: (spaceId: string | null) => void;
  setDiscussionPinned: (pinned: boolean | null) => void;
  setEventType: (type: string | null) => void;
  setEventVisibility: (visibility: string | null) => void;
  setSearchQuery: (query: string) => void;
  resetTaskFilters: () => void;
  resetDiscussionFilters: () => void;
  resetEventFilters: () => void;
  resetAllFilters: () => void;
}

/**
 * filterStore
 *
 * Zustand store for managing UI filter state.
 * Persisted to localStorage for better UX.
 *
 * @example
 * const taskStatus = useFilterStore((state) => state.taskStatus);
 * const setTaskStatus = useFilterStore((state) => state.setTaskStatus);
 */
export const useFilterStore = create<FilterState>()(
  persist(
    (set) => ({
      // Initial state
      taskStatus: null,
      taskPriority: null,
      taskSpace: null,
      discussionSpace: null,
      discussionPinned: null,
      eventType: null,
      eventVisibility: null,
      searchQuery: '',

      // Task filter actions
      setTaskStatus: (status) => set({ taskStatus: status }),
      setTaskPriority: (priority) => set({ taskPriority: priority }),
      setTaskSpace: (spaceId) => set({ taskSpace: spaceId }),

      // Discussion filter actions
      setDiscussionSpace: (spaceId) => set({ discussionSpace: spaceId }),
      setDiscussionPinned: (pinned) => set({ discussionPinned: pinned }),

      // Event filter actions
      setEventType: (type) => set({ eventType: type }),
      setEventVisibility: (visibility) => set({ eventVisibility: visibility }),

      // Search action
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Reset actions
      resetTaskFilters: () =>
        set({
          taskStatus: null,
          taskPriority: null,
          taskSpace: null,
        }),

      resetDiscussionFilters: () =>
        set({
          discussionSpace: null,
          discussionPinned: null,
        }),

      resetEventFilters: () =>
        set({
          eventType: null,
          eventVisibility: null,
        }),

      resetAllFilters: () =>
        set({
          taskStatus: null,
          taskPriority: null,
          taskSpace: null,
          discussionSpace: null,
          discussionPinned: null,
          eventType: null,
          eventVisibility: null,
          searchQuery: '',
        }),
    }),
    {
      name: 'molt-filters',
      version: 1,
    }
  )
);
