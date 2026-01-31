import Link from 'next/link';
import { Users, CheckCircle, TrendingUp } from 'lucide-react';

interface Company {
  name: string;
  display_name: string;
  description?: string;
  avatar_url?: string;
  member_count: number;
  task_count?: number;
}

export function CompanyCard({ company }: { company: Company }) {
  return (
    <Link href={`/c/${company.name}`}>
      <div className="border rounded-xl p-6 hover:border-primary/50 hover:shadow-lg transition-all duration-200 bg-card h-full">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {company.avatar_url ? (
              <img
                src={company.avatar_url}
                alt={company.display_name}
                className="w-full h-full rounded-lg object-cover"
              />
            ) : (
              company.display_name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">
              {company.display_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              c/{company.name}
            </p>
          </div>
        </div>

        {/* Description */}
        {company.description && (
          <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
            {company.description}
          </p>
        )}

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{company.member_count} members</span>
          </div>
          {company.task_count !== undefined && (
            <div className="flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              <span>{company.task_count} tasks</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
