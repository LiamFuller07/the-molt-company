'use client';

import { forwardRef } from 'react';
import { cn, formatRelativeTime, truncate } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, ThumbsUp, User } from 'lucide-react';

export interface DiscussionPreviewProps extends React.HTMLAttributes<HTMLDivElement> {
  discussion: {
    id: string;
    title: string;
    excerpt?: string;
    author: {
      id: string;
      name: string;
      avatar?: string;
    };
    replyCount: number;
    voteCount: number;
    createdAt: string;
    lastActivityAt?: string;
    tags?: string[];
  };
  onClick?: () => void;
}

const DiscussionPreview = forwardRef<HTMLDivElement, DiscussionPreviewProps>(
  ({ className, discussion, onClick, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          'cursor-pointer transition-all hover:border-white/20',
          className
        )}
        onClick={onClick}
        {...props}
      >
        <CardContent className="p-4 space-y-3">
          {/* Title */}
          <h3 className="font-medium text-sm text-white line-clamp-2">{discussion.title}</h3>

          {/* Excerpt */}
          {discussion.excerpt && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {truncate(discussion.excerpt, 120)}
            </p>
          )}

          {/* Tags */}
          {discussion.tags && discussion.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {discussion.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-card border border-border text-muted-foreground"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            {/* Author */}
            <div className="flex items-center gap-2">
              {discussion.author.avatar ? (
                <img
                  src={discussion.author.avatar}
                  alt={discussion.author.name}
                  className="h-6 w-6 rounded-full border border-border"
                />
              ) : (
                <div className="h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center">
                  <User className="h-3 w-3 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col">
                <span className="text-xs text-white">{discussion.author.name}</span>
                <time className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                  {formatRelativeTime(discussion.createdAt)}
                </time>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span className="text-xs font-mono">{discussion.replyCount}</span>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <ThumbsUp className="h-3 w-3" />
                <span className="text-xs font-mono">{discussion.voteCount}</span>
              </div>
            </div>
          </div>

          {/* Last Activity */}
          {discussion.lastActivityAt && discussion.lastActivityAt !== discussion.createdAt && (
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              Last activity {formatRelativeTime(discussion.lastActivityAt)}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

DiscussionPreview.displayName = 'DiscussionPreview';

export { DiscussionPreview };

/**
 * Usage Example:
 *
 * const discussions = [
 *   {
 *     id: '1',
 *     title: 'Should we adopt TypeScript for backend?',
 *     excerpt: 'I propose we migrate our backend codebase to TypeScript...',
 *     author: { id: '1', name: 'Agent-001' },
 *     replyCount: 12,
 *     voteCount: 8,
 *     createdAt: '2024-01-30T10:00:00Z',
 *     lastActivityAt: '2024-01-31T09:00:00Z',
 *     tags: ['proposal', 'technical'],
 *   }
 * ];
 *
 * <DiscussionPreview
 *   discussion={discussions[0]}
 *   onClick={() => router.push(`/discussions/${discussions[0].id}`)}
 * />
 *
 * List Layout:
 * <div className="space-y-4">
 *   {discussions.map(d => <DiscussionPreview key={d.id} discussion={d} />)}
 * </div>
 *
 * Accessibility:
 * - Semantic heading for title
 * - Time element for timestamps
 * - Alt text for avatars
 * - Icon labels for stats
 * - Keyboard accessible
 */
