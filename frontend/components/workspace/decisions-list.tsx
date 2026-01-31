'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Decision {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'passed' | 'rejected';
  votes_for: number;
  votes_against: number;
  votes_abstain: number;
  created_at: string;
  deadline: string;
}

interface DecisionsListProps {
  decisions: Decision[];
}

const statusConfig = {
  active: {
    icon: Clock,
    color: 'bg-[var(--accent-bg)] text-[var(--accent)]',
    label: 'Active',
  },
  passed: {
    icon: CheckCircle,
    color: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    label: 'Passed',
  },
  rejected: {
    icon: XCircle,
    color: 'bg-[var(--color-error-bg)] text-[var(--color-error)]',
    label: 'Rejected',
  },
};

export function DecisionsList({ decisions }: DecisionsListProps) {
  return (
    <div className="space-y-4">
      {decisions.map((decision) => {
        const config = statusConfig[decision.status];
        const Icon = config.icon;
        const totalVotes = decision.votes_for + decision.votes_against + decision.votes_abstain;
        const forPercent = totalVotes > 0 ? (decision.votes_for / totalVotes) * 100 : 0;
        const againstPercent = totalVotes > 0 ? (decision.votes_against / totalVotes) * 100 : 0;

        return (
          <div
            key={decision.id}
            className="border border-[var(--border-subtle)] p-5 hover:bg-[var(--bg-hover)] transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="font-medium text-lg">{decision.title}</h3>
              <Badge className={cn('text-xs flex items-center gap-1.5', config.color)}>
                <Icon className="w-3 h-3" />
                {config.label}
              </Badge>
            </div>

            <p className="text-sm text-[var(--text-secondary)] mb-4">
              {decision.description}
            </p>

            <div className="space-y-2 mb-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--text-secondary)]">For</span>
                <span className="text-[var(--color-success)]">{decision.votes_for} votes</span>
              </div>
              <div className="h-2 bg-[var(--bg-secondary)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-success)]"
                  style={{ width: `${forPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs mb-1 mt-3">
                <span className="text-[var(--text-secondary)]">Against</span>
                <span className="text-[var(--color-error)]">{decision.votes_against} votes</span>
              </div>
              <div className="h-2 bg-[var(--bg-secondary)] overflow-hidden">
                <div
                  className="h-full bg-[var(--color-error)]"
                  style={{ width: `${againstPercent}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Created {new Date(decision.created_at).toLocaleDateString()}</span>
              {decision.status === 'active' && (
                <span>Deadline: {new Date(decision.deadline).toLocaleDateString()}</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
