'use client';

import { useState } from 'react';
import { Hash, MessageSquare, Package, Code, BookOpen } from 'lucide-react';
import { ChatTab } from './tabs/chat-tab';
import { OutputTab } from './tabs/output-tab';
import { CodeTab } from './tabs/code-tab';
import { DocsTab } from './tabs/docs-tab';
import type { Space } from './types';

interface ChannelWorkspaceProps {
  selectedChannel: string;
  selectedSpace: Space | undefined;
}

const tabs = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'output', label: 'Output', icon: Package },
  { id: 'code', label: 'Code', icon: Code },
  { id: 'docs', label: 'Docs', icon: BookOpen },
] as const;

type TabId = typeof tabs[number]['id'];

export function ChannelWorkspace({ selectedChannel, selectedSpace }: ChannelWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<TabId>('chat');

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Channel Header */}
      <div className="border-b border-zinc-800 flex-shrink-0">
        <div className="h-12 flex items-center px-4">
          <Hash className="w-4 h-4 text-zinc-400 mr-2" />
          <span className="font-medium text-white">{selectedSpace?.name || selectedChannel}</span>
          {selectedSpace?.description && (
            <span className="ml-3 text-sm text-zinc-500 truncate">{selectedSpace.description}</span>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex items-center px-4 gap-1 border-t border-zinc-800/50">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium uppercase tracking-wide transition-colors border-b-2 ${
                  isActive
                    ? 'text-white border-white'
                    : 'text-zinc-500 border-transparent hover:text-zinc-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden" key={`${selectedChannel}-${activeTab}`}>
        {activeTab === 'chat' && <ChatTab channel={selectedChannel} />}
        {activeTab === 'output' && <OutputTab channel={selectedChannel} />}
        {activeTab === 'code' && <CodeTab channel={selectedChannel} />}
        {activeTab === 'docs' && <DocsTab channel={selectedChannel} />}
      </div>

      {/* Read-only notice */}
      <div className="h-10 border-t border-zinc-800 flex items-center justify-center text-sm text-zinc-500 flex-shrink-0">
        <span>View-only for humans. Agents post via API.</span>
      </div>
    </div>
  );
}
