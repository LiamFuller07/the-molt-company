'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  loadingThreshold?: number;
  className?: string;
  itemKey?: (item: T, index: number) => string | number;
}

/**
 * VirtualList - Efficiently render large lists by only rendering visible items
 * Perfect for long event feeds, chat messages, logs
 */
export function VirtualList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  onLoadMore,
  hasMore = false,
  loading = false,
  loadingThreshold = 100,
  className,
  itemKey,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);

  // Calculate visible range
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);

  // Apply overscan
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(items.length, visibleEnd + overscan);

  // Get visible items
  const visibleItems = items.slice(startIndex, endIndex);

  // Total height of all items
  const totalHeight = items.length * itemHeight;

  // Offset to position visible items correctly
  const offsetY = startIndex * itemHeight;

  // Handle scroll
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);

      // Infinite scroll - load more when near bottom
      if (onLoadMore && hasMore && !loading) {
        const scrollBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
        if (scrollBottom < loadingThreshold) {
          onLoadMore();
        }
      }
    },
    [onLoadMore, hasMore, loading, loadingThreshold]
  );

  return (
    <div
      ref={containerRef}
      className={cn('overflow-y-auto overflow-x-hidden relative', className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      {/* Total height spacer */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* Visible items container */}
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => {
            const actualIndex = startIndex + index;
            const key = itemKey ? itemKey(item, actualIndex) : actualIndex;
            return (
              <div
                key={key}
                style={{ height: itemHeight }}
                className="border-b border-border last:border-0"
              >
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="flex items-center justify-center py-4 border-t border-border">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* End of list message */}
      {!hasMore && items.length > 0 && (
        <div className="text-center py-4 text-xs text-muted-foreground uppercase tracking-wider border-t border-border">
          End of list
        </div>
      )}
    </div>
  );
}

/**
 * Usage Example:
 *
 * interface Event {
 *   id: string;
 *   actor: string;
 *   action: string;
 *   timestamp: string;
 * }
 *
 * const [events, setEvents] = useState<Event[]>([]);
 * const [loading, setLoading] = useState(false);
 * const [hasMore, setHasMore] = useState(true);
 *
 * const loadMore = async () => {
 *   setLoading(true);
 *   const newEvents = await fetchEvents();
 *   setEvents([...events, ...newEvents]);
 *   setHasMore(newEvents.length > 0);
 *   setLoading(false);
 * };
 *
 * <VirtualList
 *   items={events}
 *   itemHeight={80}
 *   containerHeight={600}
 *   renderItem={(event) => <EventCard event={event} />}
 *   onLoadMore={loadMore}
 *   hasMore={hasMore}
 *   loading={loading}
 *   itemKey={(event) => event.id}
 * />
 */
