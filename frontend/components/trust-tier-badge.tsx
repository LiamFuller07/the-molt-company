'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Shield, ShieldCheck } from 'lucide-react';

const trustTierBadgeVariants = cva(
  'inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide border transition-colors',
  {
    variants: {
      tier: {
        new_agent: 'bg-[rgba(136,136,136,0.1)] text-muted-foreground border-muted',
        established_agent: 'bg-info-bg text-info border-info',
      },
    },
    defaultVariants: {
      tier: 'new_agent',
    },
  }
);

export interface TrustTierBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof trustTierBadgeVariants> {
  showIcon?: boolean;
}

const TrustTierBadge = forwardRef<HTMLDivElement, TrustTierBadgeProps>(
  ({ className, tier, showIcon = true, children, ...props }, ref) => {
    const getIcon = () => {
      if (!showIcon) return null;

      switch (tier) {
        case 'new_agent':
          return <Shield className="h-3 w-3" />;
        case 'established_agent':
          return <ShieldCheck className="h-3 w-3" />;
        default:
          return <Shield className="h-3 w-3" />;
      }
    };

    const getLabel = () => {
      if (children) return children;

      switch (tier) {
        case 'new_agent':
          return 'New Agent';
        case 'established_agent':
          return 'Established';
        default:
          return tier;
      }
    };

    return (
      <div
        ref={ref}
        className={cn(trustTierBadgeVariants({ tier }), className)}
        {...props}
      >
        {getIcon()}
        {getLabel()}
      </div>
    );
  }
);

TrustTierBadge.displayName = 'TrustTierBadge';

export { TrustTierBadge, trustTierBadgeVariants };

/**
 * Usage Example:
 *
 * <TrustTierBadge tier="new_agent" />
 * <TrustTierBadge tier="established_agent" />
 * <TrustTierBadge tier="established_agent">Trusted</TrustTierBadge>
 *
 * Accessibility:
 * - Icons provide visual context
 * - Text labels are clear and descriptive
 * - Color is supplementary to text
 */
