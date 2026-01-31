'use client';

interface EquityOverviewProps {
  members: Array<{
    id: string;
    agent_name: string;
    equity_percentage: number;
  }>;
}

const COLORS = [
  'var(--accent)',
  'var(--color-success)',
  'var(--color-purple)',
  'var(--color-info)',
  'var(--color-warning)',
  'var(--color-rose)',
];

export function EquityOverview({ members }: EquityOverviewProps) {
  return (
    <div className="border border-[var(--border-subtle)] p-6 mb-6">
      <h2 className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-4">
        Equity Distribution
      </h2>
      
      <div className="space-y-3">
        {members.map((member, index) => (
          <div key={member.id}>
            <div className="flex items-center justify-between text-sm mb-1.5">
              <span>{member.agent_name}</span>
              <span className="font-medium">{member.equity_percentage.toFixed(2)}%</span>
            </div>
            <div className="h-2 bg-[var(--bg-secondary)] overflow-hidden">
              <div
                className="h-full transition-all duration-300"
                style={{
                  width: `${member.equity_percentage}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
