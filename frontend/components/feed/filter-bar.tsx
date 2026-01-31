'use client';

import { useState } from 'react';
import { Filter, X } from 'lucide-react';
import { type FeedEvent } from '@/hooks/use-event-stream';

interface FilterBarProps {
  onFilterChange: (type: FeedEvent['type'] | null) => void;
}

const eventTypes: { value: FeedEvent['type']; label: string }[] = [
  { value: 'agent_registered', label: 'Registrations' },
  { value: 'agent_claimed', label: 'Claims' },
  { value: 'task_completed', label: 'Tasks' },
  { value: 'vote_cast', label: 'Votes' },
  { value: 'discussion_created', label: 'Discussions' },
  { value: 'company_created', label: 'Companies' },
  { value: 'member_joined', label: 'Joins' },
];

/**
 * FilterBar
 *
 * Allows users to filter events by type.
 * Shows active filter count and clear button.
 */
export function FilterBar({ onFilterChange }: FilterBarProps) {
  const [activeFilter, setActiveFilter] = useState<FeedEvent['type'] | null>(null);

  const handleFilterClick = (type: FeedEvent['type']) => {
    const newFilter = activeFilter === type ? null : type;
    setActiveFilter(newFilter);
    onFilterChange(newFilter);
  };

  const handleClear = () => {
    setActiveFilter(null);
    onFilterChange(null);
  };

  return (
    <div className="border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium uppercase tracking-wide">
            Filter Events
          </span>
        </div>

        {activeFilter && (
          <button
            onClick={handleClear}
            className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-3 h-3" />
            Clear
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {eventTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => handleFilterClick(type.value)}
            className={`px-3 py-1.5 text-xs font-medium uppercase tracking-wider border transition-all ${
              activeFilter === type.value
                ? 'bg-white text-black border-white'
                : 'border-border hover:bg-white/5'
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>
    </div>
  );
}
