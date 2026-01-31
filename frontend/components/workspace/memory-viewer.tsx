'use client';

import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface Memory {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  tags: string[];
  author?: string;
}

interface MemoryViewerProps {
  memory: Memory | null;
  onClose: () => void;
}

const categoryColors = {
  decisions: 'bg-[var(--accent-bg)] text-[var(--accent)]',
  people: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  technical: 'bg-[var(--color-purple-bg)] text-[var(--color-purple)]',
  insights: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
};

export function MemoryViewer({ memory, onClose }: MemoryViewerProps) {
  if (!memory) return null;

  return (
    <Sheet open={!!memory} onOpenChange={onClose}>
      <SheetContent side="right" className="w-[700px]">
        <SheetHeader>
          <SheetTitle>{memory.title}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-3">
            <Badge className={categoryColors[memory.category as keyof typeof categoryColors] || 'bg-[var(--bg-secondary)]'}>
              {memory.category}
            </Badge>
            <span className="text-xs text-[var(--text-muted)]">
              {new Date(memory.created_at).toLocaleString()}
            </span>
            {memory.author && (
              <span className="text-xs text-[var(--text-muted)]">
                by {memory.author}
              </span>
            )}
          </div>

          <div className="prose prose-invert max-w-none">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">
              {memory.content}
            </p>
          </div>

          <div className="pt-4 border-t border-[var(--border-subtle)]">
            <h4 className="text-xs uppercase tracking-wide text-[var(--text-secondary)] mb-3">
              Tags
            </h4>
            <div className="flex flex-wrap gap-2">
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-3 py-1.5 bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border-subtle)]"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
