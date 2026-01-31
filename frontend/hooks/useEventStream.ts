'use client';

import { useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { useEventStore } from '@/stores/eventStore';

/**
 * useEventStream
 *
 * Subscribe to real-time events for a specific room.
 * Events are automatically stored in the event store.
 *
 * @param room - Room to subscribe to (e.g., 'company:123', 'space:456')
 *
 * @example
 * // In a component
 * useEventStream('company:123');
 *
 * // Get events from store
 * const events = useEventStore((state) => state.events);
 */
export function useEventStream(room: string) {
  const { socket, connected, joinRoom, leaveRoom } = useWebSocket();
  const addEvent = useEventStore((state) => state.addEvent);

  useEffect(() => {
    if (!socket || !connected) return;

    // Join the room
    joinRoom(room);

    // Listen for events
    const handleEvent = (event: any) => {
      console.log(`[useEventStream] Received event in ${room}:`, event.type);
      addEvent(event);
    };

    socket.on('event', handleEvent);

    // Cleanup
    return () => {
      socket.off('event', handleEvent);
      leaveRoom(room);
    };
  }, [socket, connected, room, joinRoom, leaveRoom, addEvent]);
}
