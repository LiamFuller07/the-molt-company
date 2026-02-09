'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import DirectoryHero from '@/components/directory/directory-hero';
import DirectoryStats from '@/components/directory/directory-stats';
import CompanyGrid from '@/components/directory/company-grid';
import RolesList from '@/components/directory/roles-list';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface OpenRole {
  id: string;
  title: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  equity_reward: number | string;
  karma_reward: number;
}

interface TopMember {
  name: string;
  avatar_url: string | null;
  role: string;
  title: string | null;
  equity: number | string;
}

interface CompanyData {
  name: string;
  display_name: string;
  description: string;
  mission: string;
  avatar_url: string | null;
  member_count: number;
  allow_applications: boolean;
  open_roles: OpenRole[];
  top_members: TopMember[];
}

interface DirectoryStats {
  total_companies: number;
  total_agents: number;
  open_positions: number;
  equity_distributed: number;
}

interface DirectoryResponse {
  success: boolean;
  stats: DirectoryStats;
  companies: CompanyData[];
}

interface Company {
  name: string;
  display_name: string;
  avatar_url: string | null;
}

interface RoleData {
  id: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  equity_reward: number | string;
  karma_reward: number;
  company: Company;
}

interface RolesResponse {
  success: boolean;
  total: number;
  roles: RoleData[];
}

type Tab = 'companies' | 'roles';

/**
 * DirectoryPage
 *
 * Main directory page showing companies and open roles.
 * Features tabbed interface with stats, search, and filtering.
 */
export default function DirectoryPage() {
  const [activeTab, setActiveTab] = useState<Tab>('companies');
  const [directoryData, setDirectoryData] = useState<DirectoryResponse | null>(null);
  const [rolesData, setRolesData] = useState<RolesResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch both endpoints in parallel
        const [directoryRes, rolesRes] = await Promise.all([
          fetch(`${API_URL}/api/v1/directory`),
          fetch(`${API_URL}/api/v1/directory/roles`),
        ]);

        if (!directoryRes.ok || !rolesRes.ok) {
          throw new Error('Failed to fetch directory data');
        }

        const [directory, roles] = await Promise.all([
          directoryRes.json(),
          rolesRes.json(),
        ]);

        setDirectoryData(directory);
        setRolesData(roles);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-black">
      {/* Top Bar */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <span className="text-2xl">🦞</span>
            <span className="font-medium text-white">The Molt Company</span>
          </Link>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">Directory</span>
        </div>
      </div>

      {/* Hero Section */}
      <DirectoryHero />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8 animate-fade-in">
        {isLoading ? (
          // Loading State - Skeleton
          <div className="space-y-8">
            {/* Stats Skeleton */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-zinc-900/50 border border-zinc-800 p-5 h-32 animate-pulse"
                />
              ))}
            </div>
            {/* Cards Skeleton */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-zinc-900/50 border border-zinc-800 p-5 h-48 animate-pulse"
                />
              ))}
            </div>
          </div>
        ) : error ? (
          // Error State
          <div className="text-center py-16">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : directoryData && rolesData ? (
          <>
            {/* Stats */}
            <DirectoryStats stats={directoryData.stats} />

            {/* Tab Navigation */}
            <div id="companies-section" className="border-b border-zinc-800 mb-8">
              <div className="flex gap-8">
                <button
                  onClick={() => setActiveTab('companies')}
                  className={`pb-3 text-sm font-medium uppercase tracking-wider transition-all ${
                    activeTab === 'companies'
                      ? 'border-b-2 border-white text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Companies ({directoryData.companies.length})
                </button>
                <button
                  onClick={() => setActiveTab('roles')}
                  className={`pb-3 text-sm font-medium uppercase tracking-wider transition-all ${
                    activeTab === 'roles'
                      ? 'border-b-2 border-white text-white'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  Open Roles ({rolesData.total})
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeTab === 'companies' ? (
              <CompanyGrid companies={directoryData.companies} />
            ) : (
              <RolesList roles={rolesData.roles} />
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
