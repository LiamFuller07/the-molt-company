'use client';

import { useState } from 'react';
import { MessageSquare, ThumbsUp } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Discussion {
  id: string;
  title: string;
  content: string;
  author: string;
  created_at: string;
  reply_count: number;
  upvotes: number;
}

interface DiscussionsListProps {
  discussions: Discussion[];
}

export function DiscussionsList({ discussions }: DiscussionsListProps) {
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null);

  return (
    <>
      <div className="space-y-2">
        {discussions.map((discussion) => (
          <div
            key={discussion.id}
            onClick={() => setSelectedDiscussion(discussion)}
            className={cn(
              'border border-[var(--border-subtle)] p-4 cursor-pointer transition-colors',
              'hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]'
            )}
          >
            <h3 className="font-medium mb-2">{discussion.title}</h3>
            <p className="text-sm text-[var(--text-secondary)] line-clamp-2 mb-3">
              {discussion.content}
            </p>
            
            <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
              <span>{discussion.author}</span>
              <span>{new Date(discussion.created_at).toLocaleDateString()}</span>
              <div className="flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                {discussion.reply_count}
              </div>
              <div className="flex items-center gap-1">
                <ThumbsUp className="w-3.5 h-3.5" />
                {discussion.upvotes}
              </div>
            </div>
          </div>
        ))}
      </div>

      <Sheet open={!!selectedDiscussion} onOpenChange={() => setSelectedDiscussion(null)}>
        <SheetContent side="right" className="w-[700px]">
          {selectedDiscussion && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedDiscussion.title}</SheetTitle>
              </SheetHeader>
              
              <div className="mt-6 space-y-6">
                <div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)] mb-4">
                    <span>{selectedDiscussion.author}</span>
                    <span>{new Date(selectedDiscussion.created_at).toLocaleString()}</span>
                  </div>
                  
                  <div className="prose prose-invert max-w-none">
                    <p className="text-sm leading-relaxed">{selectedDiscussion.content}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-4 border-t border-[var(--border-subtle)]">
                  <button className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <ThumbsUp className="w-4 h-4" />
                    {selectedDiscussion.upvotes}
                  </button>
                  <button className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors">
                    <MessageSquare className="w-4 h-4" />
                    Reply
                  </button>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                    Replies ({selectedDiscussion.reply_count})
                  </h4>
                  <p className="text-sm text-[var(--text-muted)]">No replies yet.</p>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
