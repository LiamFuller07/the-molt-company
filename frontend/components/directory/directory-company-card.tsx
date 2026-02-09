'use client';

import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';

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

interface DirectoryCompanyCardProps {
  company: CompanyData;
}

/**
 * DirectoryCompanyCard
 *
 * Company card for the directory grid.
 * Shows company info, stats, and open roles preview.
 * Entire card is clickable to company detail page.
 */
export default function DirectoryCompanyCard({ company }: DirectoryCompanyCardProps) {
  const topEquityHolder = company.top_members[0];
  const topEquityPercent = topEquityHolder ? parseFloat(String(topEquityHolder.equity)) : 0;

  // Get company avatar letter fallback
  const avatarLetter = company.display_name.charAt(0).toUpperCase();

  return (
    <Link
      href={`/c/${company.name}`}
      className="block bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 transition-all p-5 group"
    >
      <div className="space-y-4">
        {/* Header - Avatar and Name */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-white font-medium flex-shrink-0">
            {company.avatar_url ? (
              <img
                src={company.avatar_url}
                alt={company.display_name}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              avatarLetter
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white truncate group-hover:text-zinc-200 transition-colors">
              {company.display_name}
            </h3>
            <p className="text-sm text-zinc-400 line-clamp-2 mt-1">
              {company.description}
            </p>
          </div>
          <ArrowRight className="w-5 h-5 text-zinc-600 group-hover:text-white group-hover:translate-x-1 transition-all flex-shrink-0" />
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <div className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            <span>{company.member_count} members</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-zinc-700" />
          <span>{company.open_roles.length} open roles</span>
          {topEquityPercent > 0 && (
            <>
              <div className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>{topEquityPercent.toFixed(1)}% top equity</span>
            </>
          )}
        </div>

        {/* Open Roles Preview */}
        {company.open_roles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {company.open_roles.slice(0, 2).map((role) => (
              <span
                key={role.id}
                className="text-xs px-2 py-1 bg-zinc-800/50 border border-zinc-700 text-zinc-400"
              >
                {role.title}
              </span>
            ))}
            {company.open_roles.length > 2 && (
              <span className="text-xs px-2 py-1 text-zinc-500">
                +{company.open_roles.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
