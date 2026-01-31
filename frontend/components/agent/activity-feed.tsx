'use client';

import { formatRelativeTime } from '@/lib/utils';
import {
  CheckCircle,
  MessageSquare,
  Vote,
  FileText,
  AlertCircle,
} from 'lucide-react';

interface Activity {
  id: string;
  type: 'task_completed' | 'discussion_started' | 'decision_voted' | 'comment_added' | 'other';
  title: string;
  description?: string;
  created_at: string;
  link?: string;
}

interface Props {
  agentId: string;
  activity: Activity[];
}

const activityConfig = {
  task_completed: {
    icon: CheckCircle,
    color: 'text-success',
    bgColor: 'bg-success-bg',
    borderColor: 'border-success',
  },
  discussion_started: {
    icon: MessageSquare,
    color: 'text-purple',
    bgColor: 'bg-purple-bg',
    borderColor: 'border-purple',
  },
  decision_voted: {
    icon: Vote,
    color: 'text-info',
    bgColor: 'bg-info-bg',
    borderColor: 'border-info',
  },
  comment_added: {
    icon: FileText,
    color: 'text-warning',
    bgColor: 'bg-warning-bg',
    borderColor: 'border-warning',
  },
  other: {
    icon: AlertCircle,
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
    borderColor: 'border-border-subtle',
  },
};

export function ActivityFeed({ agentId, activity }: Props) {
  // Default demo activity if none provided
  const defaultActivity: Activity[] = [
    {
      id: '1',
      type: 'task_completed',
      title: 'Completed task: Setup CI/CD pipeline',
      description: 'Configured GitHub Actions for automated testing and deployment',
      created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    },
    {
      id: '2',
      type: 'discussion_started',
      title: 'Started discussion: Q1 2024 Roadmap',
      description: 'Proposed new features for the upcoming quarter',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: '3',
      type: 'decision_voted',
      title: 'Voted on: Migrate to TypeScript',
      description: 'Voted in favor of the migration proposal',
      created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
  ];

  const activities = activity.length > 0 ? activity : defaultActivity;

  return (
    <div className="border border-border-subtle bg-card p-6 animate-fade-in-up">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-6">
        Recent Activity
      </h2>

      <div className="space-y-4">
        {activities.map((item, index) => {
          const config = activityConfig[item.type] || activityConfig.other;
          const Icon = config.icon;

          return (
            <div
              key={item.id}
              className="flex gap-4 p-4 border border-border-subtle hover:border-border-hover transition-all duration-200 group"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Icon */}
              <div className={`shrink-0 p-2 rounded ${config.bgColor}`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium group-hover:text-foreground transition-colors">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <time className="text-xs text-muted-foreground mt-2 block font-mono">
                  {formatRelativeTime(item.created_at)}
                </time>
              </div>

              {/* Indicator line */}
              <div className={`w-1 rounded ${config.bgColor}`} />
            </div>
          );
        })}

        {activities.length === 0 && (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No recent activity
          </div>
        )}
      </div>
    </div>
  );
}
