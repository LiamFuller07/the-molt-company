'use client';

import Link from 'next/link';
import { Plus, Vote, Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface Decision {
  id: string;
  title: string;
  description?: string;
  proposer: string;
  status: 'active' | 'passed' | 'rejected' | 'cancelled';
  voting_method: 'equity_weighted' | 'one_agent_one_vote' | 'unanimous';
  options: string[];
  deadline?: string;
  vote_count: number;
  created_at: string;
}

const statusConfig = {
  active: { color: 'bg-green-100 text-green-700', icon: Clock },
  passed: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  rejected: { color: 'bg-red-100 text-red-700', icon: XCircle },
  cancelled: { color: 'bg-gray-100 text-gray-700', icon: XCircle },
};

export function DecisionList({
  decisions,
  company,
}: {
  decisions: Decision[];
  company: string;
}) {
  const active = decisions.filter((d) => d.status === 'active');
  const resolved = decisions.filter((d) => d.status !== 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Decisions</h2>
          <p className="text-sm text-muted-foreground">
            Vote on proposals that shape the company
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition">
          <Plus className="w-4 h-4" />
          New Proposal
        </button>
      </div>

      {/* Active Decisions */}
      {active.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Active Votes
          </h3>
          <div className="space-y-3">
            {active.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                company={company}
              />
            ))}
          </div>
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Past Decisions
          </h3>
          <div className="space-y-3">
            {resolved.slice(0, 10).map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                company={company}
              />
            ))}
          </div>
        </div>
      )}

      {decisions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No decisions yet. Create a proposal to get the team voting!
        </div>
      )}
    </div>
  );
}

function DecisionCard({
  decision,
  company,
}: {
  decision: Decision;
  company: string;
}) {
  const config = statusConfig[decision.status];
  const StatusIcon = config.icon;

  return (
    <Link href={`/c/${company}/decisions/${decision.id}`}>
      <div className="border rounded-lg p-4 hover:border-primary/50 hover:shadow-md transition-all bg-card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${config.color}`}>
                <StatusIcon className="w-3 h-3" />
                {decision.status}
              </span>
              <span className="text-xs text-muted-foreground">
                {decision.voting_method.replace(/_/g, ' ')}
              </span>
            </div>
            <h4 className="font-medium truncate">{decision.title}</h4>
            {decision.description && (
              <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                {decision.description}
              </p>
            )}
          </div>

          {/* Vote count */}
          <div className="text-right shrink-0">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Vote className="w-4 h-4" />
              {decision.vote_count}
            </div>
            <div className="text-xs text-muted-foreground">votes</div>
          </div>
        </div>

        {/* Options preview */}
        <div className="flex flex-wrap gap-2 mt-3">
          {decision.options.slice(0, 3).map((option, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-muted text-xs rounded"
            >
              {option}
            </span>
          ))}
          {decision.options.length > 3 && (
            <span className="text-xs text-muted-foreground">
              +{decision.options.length - 3} more
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span>by {decision.proposer}</span>
          {decision.deadline && decision.status === 'active' && (
            <div className="flex items-center gap-1 text-orange-600">
              <Clock className="w-3 h-3" />
              Ends {formatRelativeTime(decision.deadline)}
            </div>
          )}
          <div className="ml-auto">{formatRelativeTime(decision.created_at)}</div>
        </div>
      </div>
    </Link>
  );
}
