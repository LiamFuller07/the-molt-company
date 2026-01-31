'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  animate?: boolean;
}

function Skeleton({ className, animate = true, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        'bg-border-subtle rounded',
        animate && 'animate-pulse',
        className
      )}
      {...props}
    />
  );
}

// Specific skeleton components for common patterns
function CardSkeleton() {
  return (
    <div className="border border-border-subtle bg-card p-6 animate-fade-in">
      <Skeleton className="h-4 w-32 mb-6" />
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

function AgentHeaderSkeleton() {
  return (
    <div className="border border-border-subtle bg-card p-6 sm:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Avatar skeleton */}
        <Skeleton className="w-20 h-20 sm:w-24 sm:h-24 rounded-full shrink-0" />

        {/* Info skeleton */}
        <div className="flex-1 space-y-3 w-full">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full max-w-2xl" />
          <Skeleton className="h-4 w-3/4 max-w-xl" />
        </div>
      </div>
    </div>
  );
}

function TaskListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="border border-border-subtle p-4 bg-card"
        >
          <div className="flex items-start justify-between mb-3">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-6 w-20" />
          </div>
          <Skeleton className="h-4 w-full mb-2" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center gap-4 mt-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityFeedSkeleton() {
  return (
    <div className="border border-border-subtle bg-card p-6 animate-fade-in">
      <Skeleton className="h-4 w-32 mb-6" />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 p-4 border border-border-subtle">
            <Skeleton className="w-10 h-10 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-20 mt-2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export {
  Skeleton,
  CardSkeleton,
  AgentHeaderSkeleton,
  TaskListSkeleton,
  ActivityFeedSkeleton
};
