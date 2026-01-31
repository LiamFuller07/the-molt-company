'use client';

import Link from 'next/link';
import { Plus, Clock, User, TrendingUp } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'open' | 'claimed' | 'in_progress' | 'review' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  equity_reward?: string;
  karma_reward?: number;
  assigned_to?: string;
  due_date?: string;
  created_at: string;
}

const priorityColors = {
  low: 'bg-info-bg text-info border border-info',
  medium: 'bg-warning-bg text-warning border border-warning',
  high: 'bg-orange-bg text-orange border border-orange',
  urgent: 'bg-error-bg text-error border border-error',
};

const statusColors = {
  open: 'bg-success-bg text-success border border-success',
  claimed: 'bg-warning-bg text-warning border border-warning',
  in_progress: 'bg-info-bg text-info border border-info',
  review: 'bg-purple-bg text-purple border border-purple',
  completed: 'bg-border-subtle text-muted-foreground border border-border-subtle',
};

export function TaskList({ tasks, company }: { tasks: Task[]; company: string }) {
  const openTasks = tasks.filter((t) => t.status === 'open');
  const inProgressTasks = tasks.filter((t) =>
    ['claimed', 'in_progress', 'review'].includes(t.status)
  );
  const completedTasks = tasks.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold">Tasks</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {openTasks.length} open, {inProgressTasks.length} in progress
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-white text-black border border-white text-xs sm:text-sm font-medium uppercase tracking-wide hover:bg-black hover:text-white transition-all w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" />
          New Task
        </button>
      </div>

      {/* Open Tasks */}
      {openTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Open Tasks
          </h3>
          <div className="space-y-3">
            {openTasks.map((task) => (
              <TaskCard key={task.id} task={task} company={company} />
            ))}
          </div>
        </div>
      )}

      {/* In Progress */}
      {inProgressTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            In Progress
          </h3>
          <div className="space-y-3">
            {inProgressTasks.map((task) => (
              <TaskCard key={task.id} task={task} company={company} />
            ))}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedTasks.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Recently Completed
          </h3>
          <div className="space-y-3">
            {completedTasks.slice(0, 5).map((task) => (
              <TaskCard key={task.id} task={task} company={company} />
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No tasks yet. Create one to get started!
        </div>
      )}
    </div>
  );
}

function TaskCard({ task, company }: { task: Task; company: string }) {
  return (
    <Link href={`/c/${company}/tasks/${task.id}`}>
      <div className="border border-border-subtle p-4 hover:border-border-focus hover:shadow-glow-blue transition-all bg-card group">
        <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span
                className={`px-2 py-1 text-[10px] uppercase tracking-wide font-medium ${
                  priorityColors[task.priority]
                }`}
              >
                {task.priority}
              </span>
              <span
                className={`px-2 py-1 text-[10px] uppercase tracking-wide font-medium ${
                  statusColors[task.status]
                }`}
              >
                {task.status.replace('_', ' ')}
              </span>
            </div>
            <h4 className="font-medium group-hover:text-foreground transition-colors">{task.title}</h4>
            {task.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                {task.description}
              </p>
            )}
          </div>

          {/* Reward */}
          {(task.equity_reward || task.karma_reward) && (
            <div className="text-left sm:text-right shrink-0 w-full sm:w-auto">
              {task.equity_reward && (
                <div className="flex items-center gap-1 text-sm font-medium text-success">
                  <TrendingUp className="w-4 h-4" />
                  {task.equity_reward}%
                </div>
              )}
              {task.karma_reward && (
                <div className="text-xs text-muted-foreground font-mono">
                  +{task.karma_reward} karma
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs text-muted-foreground font-mono">
          {task.assigned_to && (
            <div className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span className="truncate max-w-[120px]">{task.assigned_to}</span>
            </div>
          )}
          {task.due_date && (
            <div className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Due {formatRelativeTime(task.due_date)}
            </div>
          )}
          <div className="ml-auto">{formatRelativeTime(task.created_at)}</div>
        </div>
      </div>
    </Link>
  );
}
