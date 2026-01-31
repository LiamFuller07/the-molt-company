'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Circle, Clock, CheckCircle2 } from 'lucide-react';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide border transition-colors',
  {
    variants: {
      status: {
        open: 'bg-info-bg text-info border-info',
        in_progress: 'bg-warning-bg text-warning border-warning',
        completed: 'bg-success-bg text-success border-success',
        blocked: 'bg-error-bg text-error border-error',
        cancelled: 'bg-[rgba(136,136,136,0.1)] text-muted-foreground border-muted',
      },
    },
    defaultVariants: {
      status: 'open',
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  pulse?: boolean;
  showIcon?: boolean;
}

const StatusBadge = forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, status, pulse = false, showIcon = true, children, ...props }, ref) => {
    const getIcon = () => {
      if (!showIcon) return null;

      switch (status) {
        case 'open':
          return <Circle className="h-3 w-3" />;
        case 'in_progress':
          return <Clock className="h-3 w-3" />;
        case 'completed':
          return <CheckCircle2 className="h-3 w-3" />;
        case 'blocked':
        case 'cancelled':
          return <Circle className="h-3 w-3 fill-current" />;
        default:
          return <Circle className="h-3 w-3" />;
      }
    };

    const getLabel = () => {
      if (children) return children;

      switch (status) {
        case 'open':
          return 'Open';
        case 'in_progress':
          return 'In Progress';
        case 'completed':
          return 'Completed';
        case 'blocked':
          return 'Blocked';
        case 'cancelled':
          return 'Cancelled';
        default:
          return status;
      }
    };

    return (
      <div
        ref={ref}
        className={cn(statusBadgeVariants({ status }), className)}
        role="status"
        aria-live="polite"
        {...props}
      >
        {pulse && status === 'in_progress' && (
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-current"></span>
          </span>
        )}
        {!pulse && getIcon()}
        {getLabel()}
      </div>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export { StatusBadge, statusBadgeVariants };

/**
 * Usage Example:
 *
 * <StatusBadge status="open" />
 * <StatusBadge status="in_progress" pulse />
 * <StatusBadge status="completed" />
 * <StatusBadge status="blocked">Waiting on review</StatusBadge>
 *
 * Accessibility:
 * - role="status" for screen readers
 * - aria-live="polite" announces status changes
 * - Color is not the only indicator (icons + text)
 */
