'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export interface EquityBreakdownProps extends React.HTMLAttributes<HTMLDivElement> {
  adminFloor: number;
  members: Array<{
    id: string;
    name: string;
    percentage: number;
    color?: string;
  }>;
  showChart?: boolean;
  showList?: boolean;
}

const EquityBreakdown = forwardRef<HTMLDivElement, EquityBreakdownProps>(
  ({ className, adminFloor, members, showChart = true, showList = true, ...props }, ref) => {
    // Calculate member pool
    const memberPool = 100 - adminFloor;

    // Prepare chart data
    const chartData = [
      {
        name: 'Admin Floor',
        value: adminFloor,
        color: '#f87171', // error color
      },
      ...members.map((member) => ({
        name: member.name,
        value: member.percentage,
        color: member.color || generateColor(member.id),
      })),
    ];

    // Generate a consistent color based on ID
    function generateColor(id: string): string {
      const colors = [
        '#60a5fa', // info
        '#4ade80', // success
        '#fb923c', // warning
        '#a855f7', // purple
        '#6366f1', // indigo
        '#f43f5e', // rose
        '#f97316', // orange
      ];
      const index = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      return colors[index % colors.length];
    }

    return (
      <Card ref={ref} className={cn('', className)} {...props}>
        <CardHeader className="p-4 px-5 border-b border-border">
          <CardTitle className="text-xs font-medium uppercase tracking-wide">
            Equity Distribution
          </CardTitle>
        </CardHeader>

        <CardContent className="p-5 space-y-6">
          {/* Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Admin Floor
              </div>
              <div className="text-2xl font-light text-white">{adminFloor.toFixed(1)}%</div>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground uppercase tracking-wider">
                Member Pool
              </div>
              <div className="text-2xl font-light text-white">{memberPool.toFixed(1)}%</div>
            </div>
          </div>

          {/* Pie Chart */}
          {showChart && (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, value }) => `${value.toFixed(1)}%`}
                    labelLine={false}
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#171717',
                      border: '1px solid #1a1a1a',
                      borderRadius: 0,
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => `${value.toFixed(2)}%`}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* List View */}
          {showList && (
            <div className="space-y-2">
              {/* Admin Floor */}
              <div className="flex items-center justify-between p-3 bg-card border border-border">
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: '#f87171' }}
                  />
                  <span className="text-sm font-medium text-white">Admin Floor</span>
                </div>
                <span className="text-sm font-mono text-white">{adminFloor.toFixed(2)}%</span>
              </div>

              {/* Members */}
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-card border border-border hover:bg-[#1f1f1f] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: member.color || generateColor(member.id) }}
                    />
                    <span className="text-sm text-white">{member.name}</span>
                  </div>
                  <span className="text-sm font-mono text-white">
                    {member.percentage.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

EquityBreakdown.displayName = 'EquityBreakdown';

export { EquityBreakdown };

/**
 * Usage Example:
 *
 * const members = [
 *   { id: '1', name: 'Agent-001', percentage: 15.5 },
 *   { id: '2', name: 'Agent-002', percentage: 12.3 },
 *   { id: '3', name: 'Agent-003', percentage: 10.2 },
 * ];
 *
 * <EquityBreakdown
 *   adminFloor={30}
 *   members={members}
 *   showChart
 *   showList
 * />
 *
 * Accessibility:
 * - Chart has tooltip for precise values
 * - List view provides alternative to chart
 * - Color + text labels (not just color)
 * - Semantic structure
 *
 * Performance:
 * - Recharts handles rendering efficiently
 * - Chart is memoized by React
 * - Minimal re-renders
 */
