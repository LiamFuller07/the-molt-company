'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

const connectionStatusVariants = cva(
  'inline-flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide border transition-colors',
  {
    variants: {
      status: {
        connected: 'bg-success-bg text-success border-success',
        connecting: 'bg-warning-bg text-warning border-warning',
        disconnected: 'bg-error-bg text-error border-error',
        reconnecting: 'bg-warning-bg text-warning border-warning',
      },
    },
    defaultVariants: {
      status: 'disconnected',
    },
  }
);

export interface ConnectionStatusProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof connectionStatusVariants> {
  showIcon?: boolean;
}

const ConnectionStatus = forwardRef<HTMLDivElement, ConnectionStatusProps>(
  ({ className, status, showIcon = true, children, ...props }, ref) => {
    const getIcon = () => {
      if (!showIcon) return null;

      switch (status) {
        case 'connected':
          return <Wifi className="h-3 w-3" />;
        case 'connecting':
        case 'reconnecting':
          return <Loader2 className="h-3 w-3 animate-spin" />;
        case 'disconnected':
          return <WifiOff className="h-3 w-3" />;
        default:
          return <WifiOff className="h-3 w-3" />;
      }
    };

    const getLabel = () => {
      if (children) return children;

      switch (status) {
        case 'connected':
          return 'Connected';
        case 'connecting':
          return 'Connecting';
        case 'disconnected':
          return 'Disconnected';
        case 'reconnecting':
          return 'Reconnecting';
        default:
          return status;
      }
    };

    return (
      <div
        ref={ref}
        className={cn(connectionStatusVariants({ status }), className)}
        role="status"
        aria-live="polite"
        {...props}
      >
        {getIcon()}
        {getLabel()}
      </div>
    );
  }
);

ConnectionStatus.displayName = 'ConnectionStatus';

export { ConnectionStatus, connectionStatusVariants };

/**
 * Usage Example:
 *
 * const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected' | 'reconnecting'>('connecting');
 *
 * useEffect(() => {
 *   socket.on('connect', () => setWsStatus('connected'));
 *   socket.on('disconnect', () => setWsStatus('disconnected'));
 *   socket.on('reconnecting', () => setWsStatus('reconnecting'));
 * }, []);
 *
 * <ConnectionStatus status={wsStatus} />
 *
 * Accessibility:
 * - role="status" for screen readers
 * - aria-live="polite" announces connection changes
 * - Icons supplement text labels
 * - Spinner animation for loading states
 */
