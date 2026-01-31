'use client';

import { useState, useMemo } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, Loader2 } from 'lucide-react';

// Column definition interface
export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor: (row: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

// Table variants using CVA
const tableVariants = cva('w-full border-collapse', {
  variants: {
    density: {
      compact: '[&_td]:py-2 [&_th]:py-2',
      normal: '[&_td]:py-3 [&_th]:py-3',
      comfortable: '[&_td]:py-4 [&_th]:py-4',
    },
  },
  defaultVariants: {
    density: 'normal',
  },
});

const cellVariants = cva(
  'px-4 text-left border-b border-border transition-colors',
  {
    variants: {
      variant: {
        default: 'text-white',
        muted: 'text-muted-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface DataTableProps<T>
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof tableVariants> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  onRowClick?: (row: T) => void;
  rowKey?: (row: T) => string | number;
  emptyMessage?: string;
}

export function DataTable<T>({
  data,
  columns,
  loading,
  density,
  onRowClick,
  rowKey,
  emptyMessage = 'No data available',
  className,
  ...props
}: DataTableProps<T>) {
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sort handler
  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnKey);
      setSortDirection('asc');
    }
  };

  // Sorted data
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    const column = columns.find((col) => col.key === sortColumn);
    if (!column) return data;

    return [...data].sort((a, b) => {
      const aValue = column.accessor(a);
      const bValue = column.accessor(b);

      // Handle string comparison
      const aStr = String(aValue);
      const bStr = String(bValue);

      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [data, sortColumn, sortDirection, columns]);

  // Loading skeleton
  if (loading) {
    return (
      <div className={cn('relative overflow-x-auto', className)} {...props}>
        <table className={tableVariants({ density })}>
          <thead className="bg-card border-b border-border">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    cellVariants(),
                    'text-xs font-medium uppercase tracking-wider text-muted-foreground'
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i} className="bg-background">
                {columns.map((column) => (
                  <td key={column.key} className={cellVariants()}>
                    <div className="h-5 bg-card animate-shimmer bg-gradient-to-r from-card via-[#222] to-card bg-[length:200%_100%]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Empty state
  if (data.length === 0) {
    return (
      <div className={cn('relative overflow-x-auto', className)} {...props}>
        <table className={tableVariants({ density })}>
          <thead className="bg-card border-b border-border">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    cellVariants(),
                    'text-xs font-medium uppercase tracking-wider text-muted-foreground'
                  )}
                  style={{ width: column.width }}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
        </table>
        <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('relative overflow-x-auto', className)} {...props}>
      <table className={tableVariants({ density })}>
        <thead className="bg-card border-b border-border">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(
                  cellVariants(),
                  'text-xs font-medium uppercase tracking-wider text-muted-foreground',
                  column.sortable && 'cursor-pointer hover:text-white select-none'
                )}
                style={{ width: column.width }}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center gap-2">
                  {column.header}
                  {column.sortable && (
                    <span className="text-muted-foreground">
                      {sortColumn === column.key ? (
                        sortDirection === 'asc' ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => {
            const key = rowKey ? rowKey(row) : index;
            return (
              <tr
                key={key}
                className={cn(
                  'bg-background hover:bg-[#0f0f0f] transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className={cellVariants()}>
                    <div className="text-sm">{column.accessor(row)}</div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Usage Example:
 *
 * interface Task {
 *   id: string;
 *   title: string;
 *   status: string;
 *   priority: string;
 * }
 *
 * const columns: DataTableColumn<Task>[] = [
 *   {
 *     key: 'title',
 *     header: 'Title',
 *     accessor: (row) => row.title,
 *     sortable: true,
 *   },
 *   {
 *     key: 'status',
 *     header: 'Status',
 *     accessor: (row) => <StatusBadge status={row.status} />,
 *     sortable: true,
 *   },
 * ];
 *
 * <DataTable
 *   data={tasks}
 *   columns={columns}
 *   density="normal"
 *   loading={isLoading}
 *   onRowClick={(task) => router.push(`/tasks/${task.id}`)}
 *   rowKey={(task) => task.id}
 * />
 */
