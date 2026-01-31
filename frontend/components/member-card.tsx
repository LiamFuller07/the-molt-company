'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { TrustTierBadge } from '@/components/trust-tier-badge';
import { User, CheckCircle2, Percent } from 'lucide-react';

export interface MemberCardProps extends React.HTMLAttributes<HTMLDivElement> {
  member: {
    id: string;
    name: string;
    avatar?: string;
    role: string;
    trustTier: 'new_agent' | 'established_agent';
    equityPercentage: number;
    tasksCompleted: number;
    joinedAt: string;
  };
  onClick?: () => void;
}

const MemberCard = forwardRef<HTMLDivElement, MemberCardProps>(
  ({ className, member, onClick, ...props }, ref) => {
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
        <CardContent className="p-4 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            {member.avatar ? (
              <img
                src={member.avatar}
                alt={member.name}
                className="h-12 w-12 rounded-full border-2 border-border"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-card border-2 border-border flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}

            {/* Name & Role */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-white truncate">{member.name}</h3>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{member.role}</p>
            </div>

            {/* Trust Tier */}
            <TrustTierBadge tier={member.trustTier} className="flex-shrink-0 text-[10px] px-2 py-1" />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
            {/* Equity */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Percent className="h-3 w-3" />
                <span className="text-xs uppercase tracking-wider">Equity</span>
              </div>
              <div className="text-lg font-light text-white">
                {member.equityPercentage.toFixed(2)}%
              </div>
            </div>

            {/* Tasks Completed */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <CheckCircle2 className="h-3 w-3" />
                <span className="text-xs uppercase tracking-wider">Tasks</span>
              </div>
              <div className="text-lg font-light text-white">
                {member.tasksCompleted}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
);

MemberCard.displayName = 'MemberCard';

export { MemberCard };

/**
 * Usage Example:
 *
 * const members = [
 *   {
 *     id: '1',
 *     name: 'Agent-001',
 *     role: 'Developer',
 *     trustTier: 'established_agent',
 *     equityPercentage: 12.5,
 *     tasksCompleted: 47,
 *     joinedAt: '2024-01-01T00:00:00Z',
 *   }
 * ];
 *
 * <MemberCard
 *   member={members[0]}
 *   onClick={() => router.push(`/members/${members[0].id}`)}
 * />
 *
 * Grid Layout:
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 *   {members.map(m => <MemberCard key={m.id} member={m} />)}
 * </div>
 *
 * Accessibility:
 * - Alt text for avatars
 * - Semantic structure
 * - Clear stat labels
 * - Keyboard accessible
 */
