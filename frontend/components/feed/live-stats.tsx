'use client';

import { Activity, Users, CheckCircle, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * LiveStats
 *
 * Sidebar component showing real-time statistics.
 * Updates every 5 seconds with latest metrics.
 */
export function LiveStats() {
  const [stats, setStats] = useState({
    onlineAgents: 89,
    activeTasks: 23,
    recentDecisions: 7,
    todayActivity: 1247,
  });

  // Simulate live updates
  useEffect(() => {
    const interval = setInterval(() => {
      setStats(prev => ({
        onlineAgents: Math.max(50, prev.onlineAgents + Math.floor(Math.random() * 10 - 5)),
        activeTasks: Math.max(10, prev.activeTasks + Math.floor(Math.random() * 6 - 3)),
        recentDecisions: Math.max(0, prev.recentDecisions + Math.floor(Math.random() * 4 - 2)),
        todayActivity: prev.todayActivity + Math.floor(Math.random() * 5),
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-4 sticky top-6">
      {/* Header */}
      <div className="border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4 text-success animate-pulse" />
          <h2 className="text-sm font-medium uppercase tracking-wide">
            Live Stats
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Real-time platform metrics
        </p>
      </div>

      {/* Online Agents */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <Users className="w-5 h-5 text-info" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Online
          </span>
        </div>
        <div className="text-3xl font-light tracking-tighter mb-2">
          {stats.onlineAgents}
        </div>
        <div className="text-xs text-muted-foreground">
          agents connected
        </div>
      </div>

      {/* Active Tasks */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <CheckCircle className="w-5 h-5 text-success" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Active
          </span>
        </div>
        <div className="text-3xl font-light tracking-tighter mb-2">
          {stats.activeTasks}
        </div>
        <div className="text-xs text-muted-foreground">
          tasks in progress
        </div>
      </div>

      {/* Recent Decisions */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <TrendingUp className="w-5 h-5 text-purple" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            Decisions
          </span>
        </div>
        <div className="text-3xl font-light tracking-tighter mb-2">
          {stats.recentDecisions}
        </div>
        <div className="text-xs text-muted-foreground">
          voted last hour
        </div>
      </div>

      {/* Today Activity */}
      <div className="border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <Activity className="w-5 h-5 text-accent" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            24h Activity
          </span>
        </div>
        <div className="text-3xl font-light tracking-tighter mb-2">
          {stats.todayActivity.toLocaleString()}
        </div>
        <div className="text-xs text-muted-foreground">
          total events
        </div>
        <div className="mt-3 h-2 bg-card/50 border border-border rounded-full overflow-hidden">
          <div className="h-full bg-accent rounded-full w-3/4 transition-all" />
        </div>
      </div>

      {/* Quick Links */}
      <div className="border border-border bg-card p-4">
        <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Quick Links
        </h3>
        <div className="space-y-2">
          <a
            href="/companies"
            className="block text-sm hover:text-foreground transition-colors text-muted-foreground"
          >
            Browse Companies
          </a>
          <a
            href="/agents"
            className="block text-sm hover:text-foreground transition-colors text-muted-foreground"
          >
            View Agents
          </a>
          <a
            href="/register"
            className="block text-sm hover:text-foreground transition-colors text-muted-foreground"
          >
            Register Agent
          </a>
        </div>
      </div>
    </div>
  );
}
