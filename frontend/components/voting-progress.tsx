'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, XCircle } from 'lucide-react';

export interface VotingProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  quorum?: number;
  showCounts?: boolean;
  showPercentages?: boolean;
}

const VotingProgress = forwardRef<HTMLDivElement, VotingProgressProps>(
  (
    {
      className,
      votesFor,
      votesAgainst,
      totalVotes,
      quorum,
      showCounts = true,
      showPercentages = true,
      ...props
    },
    ref
  ) => {
    const percentFor = totalVotes > 0 ? (votesFor / totalVotes) * 100 : 0;
    const percentAgainst = totalVotes > 0 ? (votesAgainst / totalVotes) * 100 : 0;
    const percentAbstain = 100 - percentFor - percentAgainst;

    const hasQuorum = quorum ? totalVotes >= quorum : true;

    return (
      <div ref={ref} className={cn('space-y-3', className)} {...props}>
        {/* Vote Counts */}
        {showCounts && (
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span className="text-success font-medium">{votesFor} For</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-error" />
              <span className="text-error font-medium">{votesAgainst} Against</span>
            </div>
          </div>
        )}

        {/* Progress Bar */}
        <div className="relative h-8 bg-card border border-border overflow-hidden">
          {/* For Votes */}
          <div
            className="absolute top-0 left-0 h-full bg-success transition-all duration-500"
            style={{ width: `${percentFor}%` }}
          />

          {/* Against Votes */}
          <div
            className="absolute top-0 right-0 h-full bg-error transition-all duration-500"
            style={{ width: `${percentAgainst}%` }}
          />

          {/* Percentages Overlay */}
          {showPercentages && (
            <div className="absolute inset-0 flex items-center justify-between px-3 text-xs font-mono font-medium">
              {percentFor > 0 && (
                <span className="text-black mix-blend-difference">{percentFor.toFixed(0)}%</span>
              )}
              {percentAgainst > 0 && (
                <span className="text-black mix-blend-difference">
                  {percentAgainst.toFixed(0)}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Quorum Indicator */}
        {quorum && (
          <div className="flex items-center justify-between text-xs text-muted-foreground uppercase tracking-wider">
            <span>
              Total Votes: {totalVotes} / {quorum}
            </span>
            {hasQuorum ? (
              <span className="text-success">Quorum Met</span>
            ) : (
              <span className="text-warning">Quorum Not Met</span>
            )}
          </div>
        )}
      </div>
    );
  }
);

VotingProgress.displayName = 'VotingProgress';

export { VotingProgress };

/**
 * Usage Example:
 *
 * <VotingProgress
 *   votesFor={7}
 *   votesAgainst={2}
 *   totalVotes={9}
 *   quorum={5}
 *   showCounts
 *   showPercentages
 * />
 *
 * Accessibility:
 * - Color is not the only indicator (text + icons)
 * - Percentages provide numeric context
 * - Quorum status is explicitly stated
 * - Semantic HTML structure
 *
 * Performance:
 * - CSS transitions for smooth bar animations
 * - No heavy computations
 */
