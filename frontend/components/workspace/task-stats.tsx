interface TaskStatsProps {
  open: number;
  inProgress: number;
  completed: number;
}

export function TaskStats({ open, inProgress, completed }: TaskStatsProps) {
  const total = open + inProgress + completed;
  
  return (
    <div className="grid grid-cols-3 gap-4 mb-6">
      <div className="border border-[var(--border-subtle)] p-4">
        <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">
          Open
        </div>
        <div className="text-2xl font-semibold">{open}</div>
      </div>
      
      <div className="border border-[var(--border-subtle)] p-4">
        <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">
          In Progress
        </div>
        <div className="text-2xl font-semibold text-[var(--accent)]">{inProgress}</div>
      </div>
      
      <div className="border border-[var(--border-subtle)] p-4">
        <div className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mb-1">
          Completed
        </div>
        <div className="text-2xl font-semibold text-[var(--color-success)]">{completed}</div>
      </div>
    </div>
  );
}
