'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CheckSquare, Circle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee?: string;
  created_at: string;
  due_date?: string;
}

interface TasksListProps {
  tasks: Task[];
}

const priorityColors = {
  low: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  medium: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  high: 'bg-[var(--color-orange-bg)] text-[var(--color-orange)]',
  urgent: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
};

const statusIcons = {
  open: Circle,
  in_progress: Clock,
  completed: CheckSquare,
};

export function TasksList({ tasks }: TasksListProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  return (
    <>
      <div className="space-y-2">
        {tasks.map((task) => {
          const StatusIcon = statusIcons[task.status];
          
          return (
            <div
              key={task.id}
              onClick={() => setSelectedTask(task)}
              className={cn(
                'border border-[var(--border-subtle)] p-4 cursor-pointer transition-colors',
                'hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <StatusIcon className="w-5 h-5 mt-0.5 text-[var(--text-secondary)]" />
                  <div className="flex-1">
                    <h3 className="font-medium mb-1">{task.title}</h3>
                    <p className="text-sm text-[var(--text-secondary)] line-clamp-2">
                      {task.description}
                    </p>
                    <div className="flex items-center gap-3 mt-3">
                      <Badge className={cn('text-xs', priorityColors[task.priority])}>
                        {task.priority}
                      </Badge>
                      {task.assignee && (
                        <span className="text-xs text-[var(--text-muted)]">
                          {task.assignee}
                        </span>
                      )}
                      <span className="text-xs text-[var(--text-muted)]">
                        {new Date(task.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Sheet open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <SheetContent side="right" className="w-[600px]">
          {selectedTask && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedTask.title}</SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                <div>
                  <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">
                    Description
                  </label>
                  <p className="mt-2 text-sm">{selectedTask.description}</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">
                      Status
                    </label>
                    <p className="mt-2 capitalize">{selectedTask.status.replace('_', ' ')}</p>
                  </div>
                  
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">
                      Priority
                    </label>
                    <p className="mt-2">
                      <Badge className={cn('text-xs', priorityColors[selectedTask.priority])}>
                        {selectedTask.priority}
                      </Badge>
                    </p>
                  </div>
                </div>

                {selectedTask.assignee && (
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">
                      Assignee
                    </label>
                    <p className="mt-2">{selectedTask.assignee}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">
                      Created
                    </label>
                    <p className="mt-2 text-sm">
                      {new Date(selectedTask.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  
                  {selectedTask.due_date && (
                    <div>
                      <label className="text-xs text-[var(--text-secondary)] uppercase tracking-wide">
                        Due Date
                      </label>
                      <p className="mt-2 text-sm">
                        {new Date(selectedTask.due_date).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
