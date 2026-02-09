'use client';

import { useState, useMemo } from 'react';
import RoleCard from './role-card';

interface Company {
  name: string;
  display_name: string;
  avatar_url: string | null;
}

interface RoleData {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  equity_reward: number | string;
  karma_reward: number;
  company: Company;
}

interface RolesListProps {
  roles: RoleData[];
}

type PriorityFilter = 'all' | 'urgent' | 'high' | 'medium' | 'low';

/**
 * RolesList
 *
 * List of open roles with filtering by priority and minimum equity.
 * Uses pill-style priority filters and an equity input.
 */
export default function RolesList({ roles }: RolesListProps) {
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [minEquity, setMinEquity] = useState<string>('');

  // Filter roles
  const filteredRoles = useMemo(() => {
    let filtered = roles;

    // Filter by priority
    if (priorityFilter !== 'all') {
      filtered = filtered.filter((role) => role.priority === priorityFilter);
    }

    // Filter by minimum equity
    const minEquityNum = parseFloat(minEquity);
    if (!isNaN(minEquityNum) && minEquityNum > 0) {
      filtered = filtered.filter((role) => parseFloat(String(role.equity_reward)) >= minEquityNum);
    }

    return filtered;
  }, [roles, priorityFilter, minEquity]);

  const priorityOptions: { value: PriorityFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' },
  ];

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Priority Pills */}
        <div className="flex flex-wrap gap-2">
          {priorityOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setPriorityFilter(option.value)}
              className={`px-3 py-1 text-xs font-medium uppercase tracking-wider transition-all ${
                priorityFilter === option.value
                  ? 'bg-white text-black border border-white'
                  : 'bg-transparent border border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Min Equity Input */}
        <div className="flex items-center gap-2">
          <label htmlFor="minEquity" className="text-xs text-zinc-500 uppercase tracking-wider whitespace-nowrap">
            Min Equity:
          </label>
          <input
            id="minEquity"
            type="number"
            min="0"
            step="0.1"
            placeholder="0"
            value={minEquity}
            onChange={(e) => setMinEquity(e.target.value)}
            className="w-20 bg-black border border-zinc-800 text-white px-3 py-1 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
          />
          <span className="text-xs text-zinc-500">%</span>
        </div>
      </div>

      {/* Roles List */}
      {filteredRoles.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filteredRoles.map((role) => (
            <RoleCard key={role.id} role={role} />
          ))}
        </div>
      ) : (
        // Empty State
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">No open roles match your filters</p>
        </div>
      )}
    </div>
  );
}
