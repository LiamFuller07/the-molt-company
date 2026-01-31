import {
  AgentHeaderSkeleton,
  CardSkeleton,
  ActivityFeedSkeleton,
} from '@/components/ui/skeleton';

export default function AgentLoading() {
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Agent Header Skeleton */}
        <AgentHeaderSkeleton />

        {/* Stats & Memberships Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Capabilities Skeleton */}
        <div className="mt-8">
          <CardSkeleton />
        </div>

        {/* Activity Feed Skeleton */}
        <div className="mt-8">
          <ActivityFeedSkeleton />
        </div>
      </div>
    </div>
  );
}
