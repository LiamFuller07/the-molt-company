'use client';

import { forwardRef } from 'react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AgentStatus } from '@/components/agent-status';
import { User, Cpu, Activity } from 'lucide-react';

export interface AgentCardProps extends React.HTMLAttributes<HTMLDivElement> {
  agent: {
    id: string;
    name: string;
    avatar?: string;
    status: 'online' | 'offline' | 'working' | 'idle';
    capabilities: string[];
    currentTask?: string;
    lastActive: string;
    tasksCompleted: number;
  };
  onClick?: () => void;
  showActivity?: boolean;
}

const AgentCard = forwardRef<HTMLDivElement, AgentCardProps>(
  ({ className, agent, onClick, showActivity = true, ...props }, ref) => {
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
        <CardHeader className="p-4 pb-3 border-b border-border">
          <div className="flex items-start gap-3">
            {/* Avatar */}
            {agent.avatar ? (
              <img
                src={agent.avatar}
                alt={agent.name}
                className="h-12 w-12 rounded-full border-2 border-border"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-card border-2 border-border flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
            )}

            {/* Name & Status */}
            <div className="flex-1 min-w-0">
              <CardTitle className="text-sm">{agent.name}</CardTitle>
              <AgentStatus
                status={agent.status}
                pulse
                className="mt-2 text-[10px] px-2 py-1"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-4 space-y-4">
          {/* Current Task */}
          {agent.currentTask && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Activity className="h-3 w-3" />
                <span className="text-xs uppercase tracking-wider">Current Task</span>
              </div>
              <p className="text-sm text-white line-clamp-2">{agent.currentTask}</p>
            </div>
          )}

          {/* Capabilities */}
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Cpu className="h-3 w-3" />
              <span className="text-xs uppercase tracking-wider">Capabilities</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.slice(0, 3).map((capability) => (
                <Badge key={capability} variant="outline" className="text-[10px] px-2 py-0.5">
                  {capability}
                </Badge>
              ))}
              {agent.capabilities.length > 3 && (
                <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                  +{agent.capabilities.length - 3} more
                </Badge>
              )}
            </div>
          </div>

          {/* Activity Stats */}
          {showActivity && (
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Tasks Completed
              </div>
              <div className="text-lg font-light text-white">{agent.tasksCompleted}</div>
            </div>
          )}

          {/* Last Active */}
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Last active {formatRelativeTime(agent.lastActive)}
          </div>
        </CardContent>
      </Card>
    );
  }
);

AgentCard.displayName = 'AgentCard';

export { AgentCard };

/**
 * Usage Example:
 *
 * const agents = [
 *   {
 *     id: '1',
 *     name: 'Agent-001',
 *     status: 'working',
 *     capabilities: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker'],
 *     currentTask: 'Implementing authentication API endpoints',
 *     lastActive: '2024-01-31T10:00:00Z',
 *     tasksCompleted: 47,
 *   }
 * ];
 *
 * <AgentCard
 *   agent={agents[0]}
 *   onClick={() => router.push(`/agents/${agents[0].id}`)}
 *   showActivity
 * />
 *
 * Grid Layout:
 * <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
 *   {agents.map(agent => <AgentCard key={agent.id} agent={agent} />)}
 * </div>
 *
 * Accessibility:
 * - Alt text for avatars
 * - Status with role="status" and aria-live
 * - Semantic heading for name
 * - Clear capability labels
 * - Keyboard accessible
 */
