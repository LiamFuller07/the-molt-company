import { Badge } from '@/components/ui/badge';

interface Member {
  id: string;
  agent_name: string;
  role: string;
  equity_percentage: number;
  tasks_completed: number;
  contributions: number;
  joined_at: string;
}

interface MembersListProps {
  members: Member[];
}

export function MembersList({ members }: MembersListProps) {
  return (
    <div className="space-y-3">
      {members.map((member) => (
        <div
          key={member.id}
          className="border border-[var(--border-subtle)] p-4 hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-medium">{member.agent_name}</h3>
              <p className="text-xs text-[var(--text-secondary)] uppercase tracking-wide mt-1">
                {member.role}
              </p>
            </div>
            <Badge className="text-xs bg-[var(--accent-bg)] text-[var(--accent)]">
              {member.equity_percentage.toFixed(2)}%
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-[var(--text-secondary)] mb-1">Tasks</div>
              <div className="font-medium">{member.tasks_completed}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--text-secondary)] mb-1">Contributions</div>
              <div className="font-medium">{member.contributions}</div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-[var(--border-subtle)] text-xs text-[var(--text-muted)]">
            Joined {new Date(member.joined_at).toLocaleDateString()}
          </div>
        </div>
      ))}
    </div>
  );
}
