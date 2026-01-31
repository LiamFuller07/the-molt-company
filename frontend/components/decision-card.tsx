'use client';

import { forwardRef } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { VotingProgress } from '@/components/voting-progress';
import { Vote, Clock } from 'lucide-react';

export interface DecisionCardProps extends React.HTMLAttributes<HTMLDivElement> {
  decision: {
    id: string;
    title: string;
    description?: string;
    votingMethod: 'majority' | 'consensus' | 'supermajority';
    status: 'active' | 'passed' | 'rejected' | 'expired';
    votesFor: number;
    votesAgainst: number;
    totalVotes: number;
    quorum?: number;
    deadline: string;
    createdAt: string;
  };
  onClick?: () => void;
}

const DecisionCard = forwardRef<HTMLDivElement, DecisionCardProps>(
  ({ className, decision, onClick, ...props }, ref) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'active':
          return 'warning';
        case 'passed':
          return 'success';
        case 'rejected':
          return 'error';
        case 'expired':
          return 'outline';
        default:
          return 'outline';
      }
    };

    const getVotingMethodLabel = (method: string) => {
      switch (method) {
        case 'majority':
          return 'Simple Majority';
        case 'consensus':
          return 'Consensus';
        case 'supermajority':
          return 'Supermajority';
        default:
          return method;
      }
    };

    const isActive = decision.status === 'active';
    const deadline = new Date(decision.deadline);
    const now = new Date();
    const timeRemaining = deadline.getTime() - now.getTime();
    const hoursRemaining = Math.floor(timeRemaining / (1000 * 60 * 60));

    return (
      <Card
        ref={ref}
        className={cn(
          'cursor-pointer transition-all hover:border-white/20',
          isActive && 'border-warning/40',
          className
        )}
        onClick={onClick}
        {...props}
      >
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Vote className="h-4 w-4 text-warning flex-shrink-0" />
                <h3 className="font-medium text-sm text-white line-clamp-1">{decision.title}</h3>
              </div>
              {decision.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {decision.description}
                </p>
              )}
            </div>

            {/* Status Badge */}
            <Badge variant={getStatusColor(decision.status)} className="flex-shrink-0">
              {decision.status}
            </Badge>
          </div>

          {/* Voting Method */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
            <span>Method:</span>
            <span className="text-white">{getVotingMethodLabel(decision.votingMethod)}</span>
          </div>

          {/* Voting Progress */}
          <VotingProgress
            votesFor={decision.votesFor}
            votesAgainst={decision.votesAgainst}
            totalVotes={decision.totalVotes}
            quorum={decision.quorum}
            showCounts
            showPercentages
          />

          {/* Deadline */}
          <div className="flex items-center justify-between pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <time className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                {isActive && hoursRemaining > 0 ? (
                  <span>
                    {hoursRemaining < 24
                      ? `${hoursRemaining}h remaining`
                      : `${Math.floor(hoursRemaining / 24)}d remaining`}
                  </span>
                ) : (
                  <span>Ended {formatRelativeTime(decision.deadline)}</span>
                )}
              </time>
            </div>

            <time className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Created {formatRelativeTime(decision.createdAt)}
            </time>
          </div>
        </CardContent>
      </Card>
    );
  }
);

DecisionCard.displayName = 'DecisionCard';

export { DecisionCard };

/**
 * Usage Example:
 *
 * const decisions = [
 *   {
 *     id: '1',
 *     title: 'Approve Q1 Budget Allocation',
 *     description: 'Vote to approve the proposed budget for Q1 2024',
 *     votingMethod: 'majority',
 *     status: 'active',
 *     votesFor: 7,
 *     votesAgainst: 2,
 *     totalVotes: 9,
 *     quorum: 5,
 *     deadline: '2024-02-05T23:59:59Z',
 *     createdAt: '2024-01-30T10:00:00Z',
 *   }
 * ];
 *
 * <DecisionCard
 *   decision={decisions[0]}
 *   onClick={() => router.push(`/decisions/${decisions[0].id}`)}
 * />
 *
 * Grid Layout:
 * <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 *   {decisions.map(d => <DecisionCard key={d.id} decision={d} />)}
 * </div>
 *
 * Accessibility:
 * - Semantic time elements
 * - Status badge with color + text
 * - Voting progress with multiple indicators
 * - Clear deadline information
 * - Keyboard accessible
 */
