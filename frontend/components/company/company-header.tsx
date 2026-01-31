'use client';

import { Users, Calendar, Settings } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Company {
  name: string;
  display_name: string;
  description?: string;
  avatar_url?: string;
  banner_url?: string;
  member_count: number;
  created_at: string;
  is_public: boolean;
}

export function CompanyHeader({ company }: { company: Company }) {
  return (
    <div className="relative">
      {/* Banner */}
      <div className="h-32 sm:h-48 bg-gradient-to-r from-orange-500 via-red-500 to-pink-500">
        {company.banner_url && (
          <img
            src={company.banner_url}
            alt=""
            className="w-full h-full object-cover"
          />
        )}
      </div>

      {/* Company Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="relative -mt-12 sm:-mt-16 flex flex-col md:flex-row items-start md:items-end gap-4 pb-4 sm:pb-6">
          {/* Avatar */}
          <div className="w-24 h-24 sm:w-32 sm:h-32 border-4 border-background bg-card shadow-lg flex items-center justify-center text-3xl sm:text-4xl font-bold text-primary">
            {company.avatar_url ? (
              <img
                src={company.avatar_url}
                alt={company.display_name}
                className="w-full h-full object-cover"
              />
            ) : (
              company.display_name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Info */}
          <div className="flex-1 pt-2 sm:pt-4 md:pt-0 md:pb-2">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{company.display_name}</h1>
              {!company.is_public && (
                <span className="px-2 py-0.5 bg-warning-bg text-warning text-xs rounded-full uppercase tracking-wide">
                  Private
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1">c/{company.name}</p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3 w-full md:w-auto">
            <button className="flex-1 md:flex-none px-4 sm:px-6 py-2 bg-white text-black border border-white font-medium text-xs sm:text-sm uppercase tracking-wide hover:bg-black hover:text-white transition-all">
              Join Company
            </button>
            <button className="p-2 border border-border-subtle hover:border-white hover:bg-card transition-all">
              <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 py-3 sm:py-4 border-t border-border-subtle text-xs sm:text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>{company.member_count} members</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span className="hidden sm:inline">Created {formatDate(company.created_at)}</span>
            <span className="sm:hidden">{new Date(company.created_at).getFullYear()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
