'use client';

import { forwardRef } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';
import {
  CheckCircle2,
  Circle,
  MessageSquare,
  Users,
  FileText,
  Vote,
  Coins,
  AlertCircle,
} from 'lucide-react';

export interface EventCardProps extends React.HTMLAttributes<HTMLDivElement> {
  event: {
    id: string;
    type: string;
    actor: string;
    action: string;
    target?: string;
    timestamp: string;
    metadata?: Record<string, any>;
  };
  compact?: boolean;
}

const EventCard = forwardRef<HTMLDivElement, EventCardProps>(
  ({ className, event, compact = false, ...props }, ref) => {
    const getEventIcon = (type: string) => {
      const iconClass = 'h-4 w-4';
      switch (type) {
        case 'task':
          return <CheckCircle2 className={iconClass} />;
        case 'discussion':
          return <MessageSquare className={iconClass} />;
        case 'decision':
          return <Vote className={iconClass} />;
        case 'member':
          return <Users className={iconClass} />;
        case 'equity':
          return <Coins className={iconClass} />;
        case 'document':
          return <FileText className={iconClass} />;
        case 'error':
          return <AlertCircle className={iconClass} />;
        default:
          return <Circle className={iconClass} />;
      }
    };

    const getEventColor = (type: string) => {
      switch (type) {
        case 'task':
          return '#4ade80';
        case 'discussion':
          return '#60a5fa';
        case 'decision':
          return '#a855f7';
        case 'member':
          return '#fb923c';
        case 'equity':
          return '#f59e0b';
        case 'document':
          return '#6366f1';
        case 'error':
          return '#f87171';
        default:
          return '#888888';
      }
    };

    const color = getEventColor(event.type);

    return (
      <div
        ref={ref}
        className={cn(
          'flex gap-3 p-4 hover:bg-[#0f0f0f] transition-colors',
          compact && 'p-3',
          className
        )}
        {...props}
      >
        {/* Icon */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background flex-shrink-0"
          style={{ borderColor: color, color }}
        >
          {getEventIcon(event.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm', compact && 'text-xs')}>
            <span className="font-medium text-white">{event.actor}</span>
            <span className="text-muted-foreground mx-1">{event.action}</span>
            {event.target && <span className="font-medium text-white">{event.target}</span>}
          </div>

          {event.metadata && Object.keys(event.metadata).length > 0 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {Object.entries(event.metadata).map(([key, value]) => (
                <div key={key}>
                  <span className="font-mono">{key}:</span> {String(value)}
                </div>
              ))}
            </div>
          )}

          <time className="mt-1 block text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {formatRelativeTime(event.timestamp)}
          </time>
        </div>
      </div>
    );
  }
);

EventCard.displayName = 'EventCard';

export { EventCard };

/**
 * Usage Example:
 *
 * const events = [
 *   {
 *     id: '1',
 *     type: 'task',
 *     actor: 'Agent-001',
 *     action: 'completed',
 *     target: 'Deploy to production',
 *     timestamp: '2024-01-31T10:00:00Z',
 *     metadata: { duration: '5 minutes' }
 *   }
 * ];
 *
 * <EventCard event={events[0]} />
 * <EventCard event={events[0]} compact />
 *
 * With VirtualList:
 * <VirtualList
 *   items={events}
 *   itemHeight={80}
 *   containerHeight={600}
 *   renderItem={(event) => <EventCard event={event} />}
 *   itemKey={(event) => event.id}
 * />
 *
 * Accessibility:
 * - Semantic <time> element for timestamps
 * - Color-coded icons with clear visual meaning
 * - Text description of action
 * - Hover state for interactivity
 */
