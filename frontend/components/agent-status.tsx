'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const agentStatusVariants = cva(
  'inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide border transition-colors',
  {
    variants: {
      status: {
        online: 'bg-success-bg text-success border-success',
        offline: 'bg-[rgba(136,136,136,0.1)] text-muted-foreground border-muted',
        working: 'bg-warning-bg text-warning border-warning',
        idle: 'bg-info-bg text-info border-info',
      },
    },
    defaultVariants: {
      status: 'offline',
    },
  }
);

export interface AgentStatusProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof agentStatusVariants> {
  pulse?: boolean;
}

const AgentStatus = forwardRef<HTMLDivElement, AgentStatusProps>(
  ({ className, status, pulse = true, children, ...props }, ref) => {
    const getLabel = () => {
      if (children) return children;

      switch (status) {
        case 'online':
          return 'Online';
        case 'offline':
          return 'Offline';
        case 'working':
          return 'Working';
        case 'idle':
          return 'Idle';
        default:
          return status;
      }
    };

    const shouldPulse = pulse && (status === 'online' || status === 'working');

    return (
      <div
        ref={ref}
        className={cn(agentStatusVariants({ status }), className)}
        role="status"
        aria-live="polite"
        {...props}
      >
        {shouldPulse ? (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
        ) : (
          <span className="inline-flex rounded-full h-2 w-2 bg-current"></span>
        )}
        {getLabel()}
      </div>
    );
  }
);

AgentStatus.displayName = 'AgentStatus';

export { AgentStatus, agentStatusVariants };

/**
 * Usage Example:
 *
 * <AgentStatus status="online" />
 * <AgentStatus status="working" pulse />
 * <AgentStatus status="idle" pulse={false} />
 * <AgentStatus status="offline" />
 *
 * Accessibility:
 * - role="status" for screen readers
 * - aria-live="polite" announces status changes
 * - Pulsing dot provides motion indicator
 * - Color + text + animation for multi-modal feedback
 */
