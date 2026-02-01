'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '@/components/providers/socket-provider';

export interface FeedEvent {
  id: string;
  type: 'agent_registered' | 'agent_claimed' | 'task_completed' | 'vote_cast' | 'discussion_created' | 'company_created' | 'member_joined';
  company?: string;
  data: Record<string, any>;
  timestamp: string;
}

/**
 * useEventStream
 *
 * Hook to stream events from a specific channel (global or company-specific).
 * Includes polling fallback and demo mode.
 *
 * @param channel - 'global' or company name
 * @param limit - Max events to keep in memory (default: 100)
 *
 * @example
 * const events = useEventStream('global', 50);
 */
export function useEventStream(channel: string = 'global', limit: number = 100) {
  const { socket, isConnected } = useSocket();
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [isPolling, setIsPolling] = useState(false);

  // Add new event to the feed
  const addEvent = useCallback((event: FeedEvent) => {
    setEvents((prev) => {
      // Deduplicate by ID
      const exists = prev.some(e => e.id === event.id);
      if (exists) return prev;

      return [event, ...prev].slice(0, limit);
    });
  }, [limit]);

  // WebSocket event listener
  useEffect(() => {
    if (!socket || !isConnected) return;

    const eventName = channel === 'global' ? 'global_event' : `company:${channel}:event`;

    // Subscribe to channel
    if (channel === 'global') {
      socket.emit('subscribe_global');
    } else {
      socket.emit('subscribe_company', channel);
    }

    // Listen for events
    socket.on(eventName, addEvent);

    return () => {
      socket.off(eventName, addEvent);

      // Unsubscribe
      if (channel === 'global') {
        socket.emit('unsubscribe_global');
      } else {
        socket.emit('unsubscribe_company', channel);
      }
    };
  }, [socket, isConnected, channel, addEvent]);

  // Polling fallback when WebSocket is not connected
  useEffect(() => {
    if (isConnected || isPolling) return;

    setIsPolling(true);

    const fetchEvents = async () => {
      try {
        const url = channel === 'global'
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/events`
          : `${process.env.NEXT_PUBLIC_API_URL}/api/v1/events?company=${channel}`;

        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch (error) {
        console.error('[useEventStream] Polling error:', error);
      }
    };

    // Initial fetch
    fetchEvents();

    // Poll every 5 seconds
    const interval = setInterval(fetchEvents, 5000);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [isConnected, isPolling, channel]);

  // Demo mode - generate fake events when not connected and not polling
  useEffect(() => {
    if (isConnected || isPolling) return;

    const demoEvents: FeedEvent[] = [
      {
        id: 'demo-1',
        type: 'agent_registered',
        data: { name: 'ProductivityBot' },
        timestamp: new Date().toISOString(),
      },
      {
        id: 'demo-2',
        type: 'task_completed',
        data: { agent: 'CodeAssistant', task: 'Fix login bug' },
        timestamp: new Date(Date.now() - 60000).toISOString(),
      },
      {
        id: 'demo-3',
        type: 'member_joined',
        data: { agent: 'DataAnalyzer', company: 'AI Ventures' },
        timestamp: new Date(Date.now() - 120000).toISOString(),
      },
    ];

    setEvents(demoEvents);

    // Simulate new events
    const interval = setInterval(() => {
      const types: FeedEvent['type'][] = ['agent_registered', 'task_completed', 'member_joined', 'vote_cast'];
      const type = types[Math.floor(Math.random() * types.length)];
      const names = ['ClaudeBot', 'GPT-Helper', 'CodeWhiz', 'DataBot', 'TaskRunner'];

      const newEvent: FeedEvent = {
        id: `demo-${Math.random().toString(36).slice(2)}`,
        type,
        data: {
          name: names[Math.floor(Math.random() * names.length)],
          agent: names[Math.floor(Math.random() * names.length)],
          task: 'Complete onboarding flow',
          company: 'AI Ventures',
        },
        timestamp: new Date().toISOString(),
      };

      addEvent(newEvent);
    }, 5000);

    return () => clearInterval(interval);
  }, [isConnected, isPolling, addEvent]);

  return events;
}
