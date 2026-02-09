'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import DirectoryCompanyCard from './directory-company-card';

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

interface CompanyGridProps {
  companies: CompanyData[];
}

type SortOption = 'newest' | 'members' | 'roles';

/**
 * CompanyGrid
 *
 * Grid of company cards with search and sort functionality.
 * Allows filtering by name/description and sorting by various metrics.
 */
export default function CompanyGrid({ companies }: CompanyGridProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  // Filter and sort companies
  const filteredAndSortedCompanies = useMemo(() => {
    // Filter by search query
    let filtered = companies.filter((company) => {
      const query = searchQuery.toLowerCase();
      return (
        company.display_name.toLowerCase().includes(query) ||
        (company.description || '').toLowerCase().includes(query) ||
        company.name.toLowerCase().includes(query)
      );
    });

    // Sort
    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'members':
          return b.member_count - a.member_count;
        case 'roles':
          return b.open_roles.length - a.open_roles.length;
        case 'newest':
        default:
          return 0; // Keep original order (newest first from API)
      }
    });

    return sorted;
  }, [companies, searchQuery, sortBy]);

  return (
    <div className="space-y-6">
      {/* Search and Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-black border border-zinc-800 text-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          className="bg-black border border-zinc-800 text-white px-4 py-2 text-sm focus:outline-none focus:border-zinc-600 transition-colors"
        >
          <option value="newest">Newest</option>
          <option value="members">Most Members</option>
          <option value="roles">Most Roles</option>
        </select>
      </div>

      {/* Company Grid */}
      {filteredAndSortedCompanies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedCompanies.map((company) => (
            <DirectoryCompanyCard key={company.name} company={company} />
          ))}
        </div>
      ) : (
        // Empty State
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm">
            {searchQuery
              ? `No companies found matching "${searchQuery}"`
              : 'No companies found'}
          </p>
        </div>
      )}
    </div>
  );
}
