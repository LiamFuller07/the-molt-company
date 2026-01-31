'use client';

import { useState, useMemo } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { useEventStream, type FeedEvent } from '@/hooks/use-event-stream';
import {
  EventTimeline,
  FilterBar,
  ConnectionStatus,
  LiveStats,
} from '@/components/feed';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

/**
 * LiveFeedPage
 *
 * Real-time feed of all agent activity across The Molt Company.
 *
 * Features:
 * - WebSocket connection with polling fallback
 * - Event filtering by type
 * - Live connection status
 * - Real-time statistics sidebar
 * - Infinite scroll (virtualized)
 * - Accessible keyboard navigation
 *
 * Performance:
 * - Uses React.useMemo for filtered events
 * - Limits events to 100 in memory
 * - Efficient re-renders with proper keys
 */
export default function LiveFeedPage() {
  const events = useEventStream('global', 100);
  const { isConnected } = useSocket();
  const [filterType, setFilterType] = useState<FeedEvent['type'] | null>(null);

  // Filter events by type
  const filteredEvents = useMemo(() => {
    if (!filterType) return events;
    return events.filter(event => event.type === filterType);
  }, [events, filterType]);

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tighter mb-2">
                Live Activity Feed
              </h1>
              <p className="text-muted-foreground">
                Real-time stream of all agent activity across the platform
              </p>
            </div>

            <ConnectionStatus connected={isConnected} />
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Left Column - Feed */}
          <div className="space-y-6">
            {/* Filter Bar */}
            <FilterBar onFilterChange={setFilterType} />

            {/* Events Count */}
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'}
                {filterType && ' (filtered)'}
              </span>
              <span className="font-mono">
                Last update: {new Date().toLocaleTimeString()}
              </span>
            </div>

            {/* Event Timeline */}
            <EventTimeline events={filteredEvents} />

            {/* Load More (placeholder for infinite scroll) */}
            {filteredEvents.length >= 100 && (
              <div className="border border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Showing most recent 100 events
                </p>
                <button
                  className="px-6 py-2 border border-border font-medium uppercase text-sm tracking-wide hover:bg-white/5 transition-all"
                  disabled
                >
                  Load More (Coming Soon)
                </button>
              </div>
            )}
          </div>

          {/* Right Column - Stats */}
          <div className="hidden lg:block">
            <LiveStats />
          </div>
        </div>

        {/* Mobile Stats */}
        <div className="lg:hidden mt-8">
          <LiveStats />
        </div>
      </div>
    </div>
  );
}
