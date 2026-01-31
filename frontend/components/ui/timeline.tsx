'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const timelineItemVariants = cva('relative flex gap-4 pb-8 last:pb-0', {
  variants: {
    variant: {
      default: '',
      compact: 'pb-4',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

// Timeline Container
export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {}

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('relative', className)} {...props}>
        {children}
      </div>
    );
  }
);

Timeline.displayName = 'Timeline';

// Timeline Item
export interface TimelineItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof timelineItemVariants> {
  icon?: React.ReactNode;
  iconColor?: string;
  isLast?: boolean;
}

export const TimelineItem = forwardRef<HTMLDivElement, TimelineItemProps>(
  ({ className, variant, icon, iconColor = '#ffffff', isLast, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn(timelineItemVariants({ variant }), className)} {...props}>
        {/* Icon & Line Container */}
        <div className="relative flex flex-col items-center">
          {/* Icon */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full border-2 bg-background z-10"
            style={{ borderColor: iconColor }}
          >
            <div className="text-sm" style={{ color: iconColor }}>
              {icon}
            </div>
          </div>

          {/* Vertical Line */}
          {!isLast && (
            <div
              className="absolute top-8 bottom-0 w-[2px] bg-border"
              style={{ left: '50%', transform: 'translateX(-50%)' }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 pt-1">{children}</div>
      </div>
    );
  }
);

TimelineItem.displayName = 'TimelineItem';

// Timeline Content
export interface TimelineContentProps extends React.HTMLAttributes<HTMLDivElement> {
  timestamp?: string;
  title?: string;
  description?: string;
}

export const TimelineContent = forwardRef<HTMLDivElement, TimelineContentProps>(
  ({ className, timestamp, title, description, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-1', className)} {...props}>
        {timestamp && (
          <time className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
            {timestamp}
          </time>
        )}
        {title && <div className="font-medium text-sm text-white">{title}</div>}
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
        {children}
      </div>
    );
  }
);

TimelineContent.displayName = 'TimelineContent';

/**
 * Usage Example:
 *
 * import { Timeline, TimelineItem, TimelineContent } from '@/components/ui/timeline';
 * import { CheckCircle, Clock, XCircle } from 'lucide-react';
 *
 * <Timeline>
 *   <TimelineItem icon={<CheckCircle className="h-4 w-4" />} iconColor="#4ade80">
 *     <TimelineContent
 *       timestamp="2h ago"
 *       title="Task completed"
 *       description="Agent completed the deployment task successfully"
 *     />
 *   </TimelineItem>
 *
 *   <TimelineItem icon={<Clock className="h-4 w-4" />} iconColor="#60a5fa">
 *     <TimelineContent
 *       timestamp="5h ago"
 *       title="Task started"
 *       description="Agent began working on deployment"
 *     />
 *   </TimelineItem>
 *
 *   <TimelineItem icon={<XCircle className="h-4 w-4" />} iconColor="#f87171" isLast>
 *     <TimelineContent
 *       timestamp="1d ago"
 *       title="Previous attempt failed"
 *       description="Deployment failed due to missing credentials"
 *     />
 *   </TimelineItem>
 * </Timeline>
 *
 * Accessibility:
 * - Uses semantic <time> element for timestamps
 * - Proper heading hierarchy with title
 * - Clear visual hierarchy with colors
 * - Screen readers will announce chronological order
 */
