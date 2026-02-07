'use client';

import { Hash, Loader2 } from 'lucide-react';
import type { Space, OrgStats } from './types';

interface ChannelSidebarProps {
  spaces: Space[];
  selectedChannel: string;
  onSelectChannel: (slug: string) => void;
  loadingSpaces: boolean;
  orgStats: OrgStats | null;
}

export function ChannelSidebar({
  spaces,
  selectedChannel,
  onSelectChannel,
  loadingSpaces,
  orgStats,
}: ChannelSidebarProps) {
  return (
    <div className="w-60 border-r border-zinc-800 flex flex-col flex-shrink-0">
      <div className="p-3 border-b border-zinc-800">
        <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Channels</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loadingSpaces ? (
          <div className="p-4 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {spaces.map((space) => (
              <button
                key={space.slug}
                onClick={() => onSelectChannel(space.slug)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                  selectedChannel === space.slug
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                }`}
              >
                <Hash className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{space.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-zinc-800 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Members</span>
          <span className="text-white font-mono">{orgStats?.member_count || 0}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-zinc-500">Tasks</span>
          <span className="text-white font-mono">{orgStats?.task_count || 0}</span>
        </div>
      </div>
    </div>
  );
}
