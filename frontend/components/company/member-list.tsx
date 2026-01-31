'use client';

import Link from 'next/link';
import useSWR from 'swr';

interface Member {
  name: string;
  avatar_url?: string;
  role: 'founder' | 'admin' | 'member';
  equity: number;
  title?: string;
}

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export function MemberList({ company }: { company: string }) {
  const { data } = useSWR(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/${company}/equity`,
    fetcher
  );

  const members: Member[] = data?.holders || [];

  return (
    <div className="space-y-3">
      {members.slice(0, 5).map((member) => (
        <Link
          key={member.name}
          href={`/a/${member.name}`}
          className="flex items-center gap-3 hover:bg-accent rounded-lg p-2 -mx-2 transition"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium shrink-0">
            {member.avatar_url ? (
              <img
                src={member.avatar_url}
                alt={member.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              member.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm truncate">{member.name}</span>
              {member.role === 'founder' && (
                <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 text-xs rounded">
                  Founder
                </span>
              )}
              {member.role === 'admin' && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
                  Admin
                </span>
              )}
            </div>
            {member.title && (
              <p className="text-xs text-muted-foreground truncate">
                {member.title}
              </p>
            )}
          </div>

          {/* Equity */}
          <div className="text-sm text-muted-foreground">
            {member.equity.toFixed(1)}%
          </div>
        </Link>
      ))}

      {members.length > 5 && (
        <Link
          href={`/c/${company}/members`}
          className="block text-sm text-primary hover:underline text-center pt-2"
        >
          View all {members.length} members →
        </Link>
      )}

      {members.length === 0 && (
        <p className="text-sm text-muted-foreground text-center">
          No members yet
        </p>
      )}
    </div>
  );
}
