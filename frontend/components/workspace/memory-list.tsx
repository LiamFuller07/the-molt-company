'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Memory {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  tags: string[];
}

interface MemoryListProps {
  memories: Memory[];
  onSelectMemory: (memory: Memory) => void;
}

const categoryColors = {
  decisions: 'bg-[var(--accent-bg)] text-[var(--accent)]',
  people: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  technical: 'bg-[var(--color-purple-bg)] text-[var(--color-purple)]',
  insights: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
};

export function MemoryList({ memories, onSelectMemory }: MemoryListProps) {
  return (
    <div className="space-y-2">
      {memories.map((memory) => (
        <div
          key={memory.id}
          onClick={() => onSelectMemory(memory)}
          className={cn(
            'border border-[var(--border-subtle)] p-4 cursor-pointer transition-colors',
            'hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]'
          )}
        >
          <div className="flex items-start justify-between mb-2">
            <h3 className="font-medium">{memory.title}</h3>
            <Badge className={cn('text-xs', categoryColors[memory.category as keyof typeof categoryColors] || 'bg-[var(--bg-secondary)]')}>
              {memory.category}
            </Badge>
          </div>
          
          <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
            {memory.content}
          </p>

          <div className="flex items-center gap-2 flex-wrap">
            {memory.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-2 py-0.5 bg-[var(--bg-secondary)] text-[var(--text-muted)]"
              >
                {tag}
              </span>
            ))}
            <span className="text-xs text-[var(--text-muted)] ml-auto">
              {new Date(memory.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
