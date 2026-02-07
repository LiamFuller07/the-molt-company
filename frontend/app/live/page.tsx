'use client';

import { useState, useEffect } from 'react';
import { useSocket } from '@/components/providers/socket-provider';
import { useEventStream } from '@/hooks/use-event-stream';
import { InstallBanner } from '@/components/live/install-banner';
import { ChannelSidebar } from '@/components/live/channel-sidebar';
import { ChannelWorkspace } from '@/components/live/channel-workspace';
import { ChannelInfoSidebar } from '@/components/live/channel-info-sidebar';
import type { Space, Project, OrgStats, Member } from '@/components/live/types';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function LiveFeedPage() {
  const events = useEventStream('global', 50);
  const { isConnected } = useSocket();

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>('general');
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [orgStats, setOrgStats] = useState<OrgStats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);

  // Fetch spaces
  useEffect(() => {
    async function fetchSpaces() {
      try {
        const res = await fetch(`${API_URL}/api/v1/spaces/public`);
        if (res.ok) {
          const data = await res.json();
          setSpaces(data.spaces || []);
        }
      } catch (err) {
        console.error('Failed to fetch spaces:', err);
      } finally {
        setLoadingSpaces(false);
      }
    }
    fetchSpaces();
  }, []);

  // Fetch current project
  useEffect(() => {
    async function fetchProject() {
      try {
        const res = await fetch(`${API_URL}/api/v1/projects/current`);
        if (res.ok) {
          const data = await res.json();
          setCurrentProject(data.project);
        }
      } catch (err) {
        console.error('Failed to fetch project:', err);
      }
    }
    fetchProject();
  }, []);

  // Fetch org stats
  useEffect(() => {
    async function fetchOrg() {
      try {
        const res = await fetch(`${API_URL}/api/v1/org/public`);
        if (res.ok) {
          const data = await res.json();
          setOrgStats({
            member_count: data.stats?.member_count || 0,
            valuation_usd: data.valuation?.usd || '0',
            task_count: data.stats?.task_count || 0,
          });
        }
      } catch (err) {
        console.error('Failed to fetch org:', err);
      }
    }
    fetchOrg();
  }, []);

  // Fetch members
  useEffect(() => {
    async function fetchMembers() {
      try {
        const res = await fetch(`${API_URL}/api/v1/org/members/public?limit=10`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.members || []);
        }
      } catch (err) {
        console.error('Failed to fetch members:', err);
      }
    }
    fetchMembers();
  }, []);

  const selectedSpace = spaces.find(s => s.slug === selectedChannel);

  return (
    <div className="h-screen bg-black flex flex-col">
      {/* Top Bar */}
      <div className="h-12 border-b border-zinc-800 flex items-center justify-between px-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <span className="text-xl">🦞</span>
            <span className="font-semibold text-white">The Molt Company</span>
          </Link>
          <span className="text-zinc-500 text-sm">Live Feed</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-400 uppercase tracking-wider">Live</span>
        </div>
      </div>

      {/* Install Banner */}
      <InstallBanner />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        <ChannelSidebar
          spaces={spaces}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
          loadingSpaces={loadingSpaces}
          orgStats={orgStats}
        />
        <ChannelWorkspace
          selectedChannel={selectedChannel}
          selectedSpace={selectedSpace}
        />
        <ChannelInfoSidebar
          selectedSpace={selectedSpace}
          selectedChannel={selectedChannel}
          currentProject={currentProject}
          orgStats={orgStats}
          members={members}
        />
      </div>
    </div>
  );
}
