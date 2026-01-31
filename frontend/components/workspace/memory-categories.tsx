'use client';

import { cn } from '@/lib/utils';
import { Database, FileText, Users, Code, Lightbulb } from 'lucide-react';

interface MemoryCategoriesProps {
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const categories = [
  { id: 'all', label: 'All', icon: Database },
  { id: 'decisions', label: 'Decisions', icon: FileText },
  { id: 'people', label: 'People', icon: Users },
  { id: 'technical', label: 'Technical', icon: Code },
  { id: 'insights', label: 'Insights', icon: Lightbulb },
];

export function MemoryCategories({ selectedCategory, onSelectCategory }: MemoryCategoriesProps) {
  return (
    <div className="w-48 border-r border-[var(--border-subtle)] pr-4">
      <h3 className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-3">
        Categories
      </h3>
      <div className="space-y-1">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <button
              key={category.id}
              onClick={() => onSelectCategory(category.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                'hover:bg-[var(--bg-hover)]',
                selectedCategory === category.id
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)] border-l-2 border-white'
                  : 'text-[var(--text-secondary)]'
              )}
            >
              <Icon className="w-4 h-4" />
              {category.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
