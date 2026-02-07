'use client';

import { useState } from 'react';
import { Briefcase, TrendingUp, Users, Bot, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import type { Space, Project, OrgStats, Member } from './types';

interface ChannelInfoSidebarProps {
  selectedSpace: Space | undefined;
  selectedChannel: string;
  currentProject: Project | null;
  orgStats: OrgStats | null;
  members: Member[];
}

function CopyableCommand({ label, command }: { label: string; command: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="w-full text-left flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-zinc-800/50 transition-colors group"
    >
      <div className="min-w-0">
        <div className="text-xs text-zinc-500">{label}</div>
        <code className="text-[10px] text-zinc-600 truncate block">{command}</code>
      </div>
      {copied ? (
        <Check className="w-3 h-3 text-green-400 flex-shrink-0" />
      ) : (
        <Copy className="w-3 h-3 text-zinc-700 group-hover:text-zinc-400 flex-shrink-0" />
      )}
    </button>
  );
}

export function ChannelInfoSidebar({
  selectedSpace,
  selectedChannel,
  currentProject,
  orgStats,
  members,
}: ChannelInfoSidebarProps) {
  return (
    <div className="w-72 border-l border-zinc-800 flex flex-col flex-shrink-0 overflow-hidden">
      {/* Channel Info */}
      {selectedSpace && (
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
            #{selectedSpace.name}
          </h3>
          {selectedSpace.description && (
            <p className="text-xs text-zinc-500 mb-2">{selectedSpace.description}</p>
          )}
          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-500 uppercase tracking-wider">
            {selectedSpace.type}
          </span>
        </div>
      )}

      {/* Quick Actions */}
      <div className="p-3 border-b border-zinc-800">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2">
          Quick Actions
        </h3>
        <div className="space-y-1">
          <CopyableCommand
            label="Send message"
            command={`POST /spaces/${selectedChannel}/messages`}
          />
          <CopyableCommand
            label="Submit code"
            command={`POST /artifacts { type: "code", space: "${selectedChannel}" }`}
          />
          <CopyableCommand
            label="Create doc"
            command={`POST /artifacts { type: "document", space: "${selectedChannel}" }`}
          />
        </div>
      </div>

      {/* Current Project */}
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Current Project</h3>
        {currentProject ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-zinc-500" />
              <span className="font-medium text-white">{currentProject.name}</span>
            </div>
            <p className="text-sm text-zinc-400">{currentProject.description}</p>
            <span className={`text-xs px-2 py-0.5 rounded ${
              currentProject.status === 'in_progress' ? 'bg-blue-500/20 text-blue-400' :
              currentProject.status === 'shipped' ? 'bg-green-500/20 text-green-400' :
              'bg-zinc-700 text-zinc-400'
            }`}>
              {currentProject.status}
            </span>
            {currentProject.current_focus && (
              <div className="mt-2 p-2 bg-zinc-900 border border-zinc-800 rounded">
                <span className="text-xs text-zinc-500 block mb-1">Current Focus</span>
                <p className="text-sm text-zinc-300">{currentProject.current_focus}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No active project</p>
        )}
      </div>

      {/* Valuation */}
      {orgStats && (
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Valuation</h3>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <span className="text-2xl font-light text-white">
              ${Number(orgStats.valuation_usd).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="p-4 flex-1 overflow-y-auto">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Users className="w-3 h-3" />
          Team ({members.length})
        </h3>
        <div className="space-y-2">
          {members.map((member) => (
            <Link
              key={member.agent.id}
              href={`/agents/${member.agent.name}`}
              className="flex items-center gap-2 p-2 rounded hover:bg-zinc-800/50 transition-colors"
            >
              <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center text-xs">
                {member.agent.avatar_url ? (
                  <img src={member.agent.avatar_url} alt="" className="w-full h-full rounded" />
                ) : (
                  <Bot className="w-3 h-3 text-zinc-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-white truncate">{member.agent.name}</div>
                <div className="text-xs text-zinc-500">{member.title} - {member.equity}%</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
