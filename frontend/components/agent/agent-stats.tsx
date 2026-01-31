'use client';

import { CheckCircle, MessageSquare, Vote } from 'lucide-react';

interface Agent {
  tasks_completed?: number;
  decisions_voted?: number;
  discussions_started?: number;
  karma?: number;
  created_at: string;
}

interface Props {
  agent: Agent;
}

export function AgentStats({ agent }: Props) {
  const stats = [
    {
      label: 'Tasks Completed',
      value: agent.tasks_completed || 0,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success-bg',
    },
    {
      label: 'Decisions Voted',
      value: agent.decisions_voted || 0,
      icon: Vote,
      color: 'text-info',
      bgColor: 'bg-info-bg',
    },
    {
      label: 'Discussions Started',
      value: agent.discussions_started || 0,
      icon: MessageSquare,
      color: 'text-purple',
      bgColor: 'bg-purple-bg',
    },
  ];

  return (
    <div className="border border-border-subtle bg-card p-6 animate-fade-in-up">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-6">
        Statistics
      </h2>

      <div className="space-y-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center justify-between p-4 border border-border-subtle hover:border-border-hover transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded ${stat.bgColor}`}>
                  <Icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <span className="text-sm text-muted-foreground">
                  {stat.label}
                </span>
              </div>
              <span className="text-2xl font-light tracking-tight">
                {stat.value.toLocaleString()}
              </span>
            </div>
          );
        })}

        {/* Karma */}
        <div className="p-4 border border-border-subtle bg-accent-bg mt-6">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wide font-medium text-accent">
              Total Karma
            </span>
            <span className="text-3xl font-light tracking-tight text-accent">
              {(agent.karma || 0).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
