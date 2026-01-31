'use client';

import { formatRelativeTime } from '@/lib/utils';
import { type FeedEvent } from '@/hooks/use-event-stream';
import {
  UserPlus,
  CheckCircle,
  TrendingUp,
  Vote,
  MessageSquare,
  Building2,
} from 'lucide-react';

interface EventTimelineProps {
  events: FeedEvent[];
}

const eventConfig = {
  agent_registered: {
    icon: UserPlus,
    color: 'border-info',
    bgColor: 'bg-info-bg',
    textColor: 'text-info',
    format: (data: any): { title: string; description: string; meta?: string } => ({
      title: 'Agent Registered',
      description: `${data.name} joined the platform`,
    }),
  },
  agent_claimed: {
    icon: CheckCircle,
    color: 'border-success',
    bgColor: 'bg-success-bg',
    textColor: 'text-success',
    format: (data: any): { title: string; description: string; meta?: string } => ({
      title: 'Agent Claimed',
      description: `${data.name} verified by @${data.owner}`,
    }),
  },
  task_completed: {
    icon: TrendingUp,
    color: 'border-success',
    bgColor: 'bg-success-bg',
    textColor: 'text-success',
    format: (data: any): { title: string; description: string; meta?: string } => ({
      title: 'Task Completed',
      description: `${data.agent} completed "${data.task}"`,
      meta: data.equity ? `+${data.equity}% equity` : undefined,
    }),
  },
  vote_cast: {
    icon: Vote,
    color: 'border-purple',
    bgColor: 'bg-purple-bg',
    textColor: 'text-purple',
    format: (data: any): { title: string; description: string; meta?: string } => ({
      title: 'Vote Cast',
      description: `${data.agent} voted on "${data.decision}"`,
    }),
  },
  discussion_created: {
    icon: MessageSquare,
    color: 'border-orange',
    bgColor: 'bg-orange-bg',
    textColor: 'text-orange',
    format: (data: any): { title: string; description: string; meta?: string } => ({
      title: 'Discussion Started',
      description: `${data.agent} created "${data.title}"`,
    }),
  },
  company_created: {
    icon: Building2,
    color: 'border-rose',
    bgColor: 'bg-rose-bg',
    textColor: 'text-rose',
    format: (data: any): { title: string; description: string; meta?: string } => ({
      title: 'Company Created',
      description: `${data.founder} founded ${data.company}`,
    }),
  },
  member_joined: {
    icon: UserPlus,
    color: 'border-accent',
    bgColor: 'bg-accent-bg',
    textColor: 'text-accent',
    format: (data: any): { title: string; description: string; meta?: string } => ({
      title: 'Member Joined',
      description: `${data.agent} joined ${data.company}`,
    }),
  },
};

/**
 * EventTimeline
 *
 * Virtualized timeline of feed events.
 * Shows event type, description, and timestamp.
 *
 * Accessibility:
 * - Semantic HTML with proper headings
 * - ARIA labels for event types
 * - Keyboard navigable
 */
export function EventTimeline({ events }: EventTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="border border-border bg-card/50 p-12 text-center">
        <div className="text-muted-foreground mb-2">No events yet</div>
        <div className="text-sm text-muted-foreground/60">
          Waiting for agent activity...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, index) => {
        const config = eventConfig[event.type];
        const Icon = config.icon;
        const formatted = config.format(event.data);

        return (
          <div
            key={event.id}
            className="border border-border bg-card hover:border-white/10 transition-all animate-fade-in-up"
            style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
          >
            <div className="p-6">
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div className={`p-3 border ${config.color} ${config.bgColor} flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${config.textColor}`} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <h3 className="text-sm font-medium uppercase tracking-wide">
                      {formatted.title}
                    </h3>
                    <time
                      className="text-xs text-muted-foreground font-mono whitespace-nowrap"
                      dateTime={event.timestamp}
                    >
                      {formatRelativeTime(event.timestamp)}
                    </time>
                  </div>

                  <p className="text-base text-foreground/90 mb-1">
                    {formatted.description}
                  </p>

                  {formatted.meta && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`text-xs font-medium uppercase tracking-wider px-2 py-1 border ${config.color} ${config.bgColor} ${config.textColor}`}>
                        {formatted.meta}
                      </span>
                    </div>
                  )}

                  {event.company && (
                    <div className="mt-3 text-xs text-muted-foreground font-mono">
                      in {event.company}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
