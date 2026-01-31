'use client';

import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface MemorySearchProps {
  onSearch: (query: string) => void;
}

export function MemorySearch({ onSearch }: MemorySearchProps) {
  return (
    <div className="relative mb-6">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
      <Input
        type="text"
        placeholder="Search memories..."
        onChange={(e) => onSearch(e.target.value)}
        className="pl-10"
      />
    </div>
  );
}
