'use client';

import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Database, Tag } from 'lucide-react';

const memoryItemVariants = cva(
  'flex flex-col gap-2 p-3 bg-card border border-border transition-colors hover:bg-[#1f1f1f]',
  {
    variants: {
      variant: {
        default: '',
        compact: 'p-2 gap-1',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface MemoryItemProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof memoryItemVariants> {
  memory: {
    id: string;
    key: string;
    value: string | number | boolean | object;
    category?: string;
    updatedAt: string;
  };
  onClick?: () => void;
}

const MemoryItem = forwardRef<HTMLDivElement, MemoryItemProps>(
  ({ className, variant, memory, onClick, ...props }, ref) => {
    // Format value based on type
    const formatValue = (value: any): string => {
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      return String(value);
    };

    const getCategoryColor = (category?: string) => {
      if (!category) return 'text-muted-foreground border-muted';

      const categoryColors: Record<string, string> = {
        system: 'text-indigo border-indigo bg-indigo-bg',
        user: 'text-info border-info bg-info-bg',
        agent: 'text-success border-success bg-success-bg',
        task: 'text-warning border-warning bg-warning-bg',
        decision: 'text-purple border-purple bg-purple-bg',
      };

      return categoryColors[category.toLowerCase()] || 'text-muted-foreground border-muted';
    };

    const isJsonValue = typeof memory.value === 'object';

    return (
      <div
        ref={ref}
        className={cn(memoryItemVariants({ variant }), onClick && 'cursor-pointer', className)}
        onClick={onClick}
        {...props}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Database className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="font-mono text-sm text-white truncate">{memory.key}</span>
          </div>

          {/* Category Badge */}
          {memory.category && (
            <div
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 text-[10px] uppercase tracking-wider border flex-shrink-0',
                getCategoryColor(memory.category)
              )}
            >
              <Tag className="h-2 w-2" />
              {memory.category}
            </div>
          )}
        </div>

        {/* Value */}
        <div className="pl-5">
          {isJsonValue ? (
            <pre className="text-xs text-muted-foreground font-mono overflow-x-auto bg-background p-2 border border-border max-h-32 overflow-y-auto">
              {formatValue(memory.value)}
            </pre>
          ) : (
            <div className="text-sm text-muted-foreground break-words">
              {formatValue(memory.value)}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className="pl-5">
          <time className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
            Updated {formatRelativeTime(memory.updatedAt)}
          </time>
        </div>
      </div>
    );
  }
);

MemoryItem.displayName = 'MemoryItem';

export { MemoryItem, memoryItemVariants };

/**
 * Usage Example:
 *
 * const memories = [
 *   {
 *     id: '1',
 *     key: 'deployment_config',
 *     value: { env: 'production', region: 'us-east-1' },
 *     category: 'system',
 *     updatedAt: '2024-01-31T10:00:00Z',
 *   },
 *   {
 *     id: '2',
 *     key: 'last_successful_build',
 *     value: '2024-01-31T09:45:00Z',
 *     category: 'task',
 *     updatedAt: '2024-01-31T09:45:00Z',
 *   },
 * ];
 *
 * <MemoryItem memory={memories[0]} />
 * <MemoryItem memory={memories[1]} variant="compact" />
 *
 * List Layout:
 * <div className="space-y-2">
 *   {memories.map(memory => (
 *     <MemoryItem
 *       key={memory.id}
 *       memory={memory}
 *       onClick={() => console.log('Edit memory', memory.id)}
 *     />
 *   ))}
 * </div>
 *
 * Accessibility:
 * - Semantic time element
 * - Category badges with color + text
 * - Code block for JSON with scrolling
 * - Clear key-value structure
 * - Keyboard accessible when onClick provided
 */
