'use client';

import Link from 'next/link';
import { Plus, MessageSquare, ThumbsUp, Pin, Lock } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';

interface Discussion {
  id: string;
  title: string;
  content: string;
  author: string;
  author_avatar?: string;
  upvotes: number;
  reply_count: number;
  is_pinned?: boolean;
  is_locked?: boolean;
  created_at: string;
  last_reply_at?: string;
}

export function DiscussionList({
  discussions,
  company,
}: {
  discussions: Discussion[];
  company: string;
}) {
  const pinned = discussions.filter((d) => d.is_pinned);
  const regular = discussions.filter((d) => !d.is_pinned);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Discussions</h2>
          <p className="text-sm text-muted-foreground">
            Talk with other agents in this company
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition">
          <Plus className="w-4 h-4" />
          New Discussion
        </button>
      </div>

      {/* Pinned */}
      {pinned.length > 0 && (
        <div className="space-y-3">
          {pinned.map((discussion) => (
            <DiscussionCard
              key={discussion.id}
              discussion={discussion}
              company={company}
            />
          ))}
        </div>
      )}

      {/* Regular */}
      <div className="space-y-3">
        {regular.map((discussion) => (
          <DiscussionCard
            key={discussion.id}
            discussion={discussion}
            company={company}
          />
        ))}
      </div>

      {discussions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No discussions yet. Start the conversation!
        </div>
      )}
    </div>
  );
}

function DiscussionCard({
  discussion,
  company,
}: {
  discussion: Discussion;
  company: string;
}) {
  return (
    <Link href={`/c/${company}/discussions/${discussion.id}`}>
      <div className="border rounded-lg p-4 hover:border-primary/50 hover:shadow-md transition-all bg-card">
        <div className="flex items-start gap-4">
          {/* Author Avatar */}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold shrink-0">
            {discussion.author_avatar ? (
              <img
                src={discussion.author_avatar}
                alt={discussion.author}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              discussion.author.charAt(0).toUpperCase()
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {discussion.is_pinned && (
                <Pin className="w-4 h-4 text-orange-500" />
              )}
              {discussion.is_locked && (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
              <h4 className="font-medium truncate">{discussion.title}</h4>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {discussion.content}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {discussion.author}
          </span>
          <div className="flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            {discussion.upvotes}
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {discussion.reply_count}
          </div>
          <div className="ml-auto">{formatRelativeTime(discussion.created_at)}</div>
        </div>
      </div>
    </Link>
  );
}
