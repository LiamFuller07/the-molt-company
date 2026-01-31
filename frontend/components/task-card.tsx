'use client';

import { forwardRef } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { Flag, User } from 'lucide-react';

export interface TaskCardProps extends React.HTMLAttributes<HTMLDivElement> {
  task: {
    id: string;
    title: string;
    description?: string;
    status: 'open' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    assignee?: {
      id: string;
      name: string;
      avatar?: string;
    };
    createdAt: string;
    dueDate?: string;
  };
  onClick?: () => void;
}

const TaskCard = forwardRef<HTMLDivElement, TaskCardProps>(
  ({ className, task, onClick, ...props }, ref) => {
    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'urgent':
          return 'text-error';
        case 'high':
          return 'text-warning';
        case 'medium':
          return 'text-info';
        case 'low':
          return 'text-muted-foreground';
        default:
          return 'text-muted-foreground';
      }
    };

    return (
      <Card
        ref={ref}
        className={cn(
          'cursor-pointer transition-all hover:border-white/20',
          className
        )}
        onClick={onClick}
        {...props}
      >
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-white truncate">{task.title}</h3>
              {task.description && (
                <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                  {task.description}
                </p>
              )}
            </div>

            {/* Priority Indicator */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <Flag className={cn('h-3 w-3', getPriorityColor(task.priority))} />
              <span
                className={cn(
                  'text-xs uppercase tracking-wider',
                  getPriorityColor(task.priority)
                )}
              >
                {task.priority}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-3">
            {/* Status */}
            <StatusBadge
              status={task.status}
              pulse={task.status === 'in_progress'}
              className="text-[10px] px-2 py-1"
            />

            {/* Assignee */}
            {task.assignee ? (
              <div className="flex items-center gap-2">
                {task.assignee.avatar ? (
                  <img
                    src={task.assignee.avatar}
                    alt={task.assignee.name}
                    className="h-6 w-6 rounded-full border border-border"
                  />
                ) : (
                  <div className="h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
                <span className="text-xs text-muted-foreground">{task.assignee.name}</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Unassigned</span>
            )}
          </div>

          {/* Due Date */}
          {task.dueDate && (
            <div className="pt-2 border-t border-border">
              <time className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                Due {formatRelativeTime(task.dueDate)}
              </time>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

TaskCard.displayName = 'TaskCard';

export { TaskCard };

/**
 * Usage Example:
 *
 * const tasks = [
 *   {
 *     id: '1',
 *     title: 'Implement authentication',
 *     description: 'Add JWT-based authentication to API',
 *     status: 'in_progress',
 *     priority: 'high',
 *     assignee: { id: '1', name: 'Agent-001' },
 *     createdAt: '2024-01-30T10:00:00Z',
 *     dueDate: '2024-02-05T10:00:00Z',
 *   }
 * ];
 *
 * <TaskCard
 *   task={tasks[0]}
 *   onClick={() => router.push(`/tasks/${tasks[0].id}`)}
 * />
 *
 * Grid Layout:
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 *   {tasks.map(task => <TaskCard key={task.id} task={task} />)}
 * </div>
 *
 * Accessibility:
 * - Semantic HTML with proper heading hierarchy
 * - Color + icon for priority (not just color)
 * - Time element for dates
 * - Alt text for avatars
 * - Keyboard accessible (card is clickable)
 */
