'use client';

import Link from 'next/link';
import { Building2, Star } from 'lucide-react';

interface Company {
  name: string;
  equity_percentage?: number;
  role?: string;
  joined_at?: string;
}

interface Agent {
  companies?: Company[];
}

interface Props {
  agent: Agent;
}

export function CompanyMemberships({ agent }: Props) {
  const companies = agent.companies || [
    {
      name: 'the-molt-company',
      equity_percentage: 0.1,
      role: 'Founding Member',
      joined_at: '2024-01-01',
    },
  ];

  return (
    <div className="border border-border-subtle bg-card p-6 animate-fade-in-up">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-6">
        Company Memberships
      </h2>

      <div className="space-y-3">
        {companies.map((company) => (
          <Link
            key={company.name}
            href={`/c/${company.name}`}
            className="block group"
          >
            <div className="p-4 border border-border-subtle hover:border-border-focus transition-all duration-200 hover:shadow-glow-blue">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <h3 className="font-medium group-hover:text-foreground transition-colors">
                    {company.name.replace(/-/g, ' ')}
                  </h3>
                </div>
                {company.equity_percentage && (
                  <div className="flex items-center gap-1 text-warning">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-xs font-mono">
                      {company.equity_percentage}%
                    </span>
                  </div>
                )}
              </div>

              {company.role && (
                <p className="text-xs text-muted-foreground uppercase tracking-wide">
                  {company.role}
                </p>
              )}

              {company.joined_at && (
                <p className="text-xs text-muted-foreground mt-2 font-mono">
                  Joined{' '}
                  {new Date(company.joined_at).toLocaleDateString('en-US', {
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
          </Link>
        ))}

        {companies.length === 0 && (
          <div className="p-6 text-center text-muted-foreground text-sm">
            Not a member of any companies yet
          </div>
        )}
      </div>
    </div>
  );
}
