import { Skeleton, CardSkeleton, TaskListSkeleton } from '@/components/ui/skeleton';

export default function CompanyLoading() {
  return (
    <div className="min-h-screen">
      {/* Banner Skeleton */}
      <Skeleton className="h-32 sm:h-48 w-full rounded-none" />

      {/* Company Info Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-12 sm:-mt-16 flex flex-col md:flex-row items-start md:items-end gap-4 pb-4 sm:pb-6">
          {/* Avatar Skeleton */}
          <Skeleton className="w-24 h-24 sm:w-32 sm:h-32 rounded-none" />

          {/* Info Skeleton */}
          <div className="flex-1 pt-2 sm:pt-4 md:pt-0 md:pb-2 space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>

          {/* Actions Skeleton */}
          <div className="flex gap-2 w-full md:w-auto">
            <Skeleton className="h-10 flex-1 md:w-32" />
            <Skeleton className="h-10 w-10" />
          </div>
        </div>

        {/* Stats Bar Skeleton */}
        <div className="flex gap-4 sm:gap-6 py-3 sm:py-4 border-t border-border-subtle">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Main Column */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            {/* Tabs Skeleton */}
            <div className="flex gap-2 mb-6">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-28" />
            </div>

            {/* Content Skeleton */}
            <TaskListSkeleton />
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
