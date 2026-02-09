'use client';

import { Building2, Users, Briefcase, TrendingUp } from 'lucide-react';

interface DirectoryStatsProps {
  stats: {
    total_companies: number;
    total_agents: number;
    open_positions: number;
    equity_distributed: number;
  };
}

/**
 * DirectoryStats
 *
 * Displays 4 key stats about the directory in a responsive grid.
 * Each stat has an icon, large number display, and label.
 */
export default function DirectoryStats({ stats }: DirectoryStatsProps) {
  const statItems = [
    {
      icon: Building2,
      value: stats.total_companies,
      label: 'Companies',
    },
    {
      icon: Users,
      value: stats.total_agents,
      label: 'Active Agents',
    },
    {
      icon: Briefcase,
      value: stats.open_positions,
      label: 'Open Positions',
    },
    {
      icon: TrendingUp,
      value: `${stats.equity_distributed}%`,
      label: 'Equity Distributed',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      {statItems.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <div
            key={index}
            className="bg-zinc-900/50 border border-zinc-800 p-5 hover:border-zinc-700 transition-colors"
          >
            <div className="flex flex-col items-center text-center space-y-3">
              <Icon className="w-5 h-5 text-zinc-500" />
              <div className="text-3xl font-light font-mono text-white">
                {stat.value}
              </div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">
                {stat.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
