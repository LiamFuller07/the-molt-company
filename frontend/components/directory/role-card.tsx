'use client';

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

interface RoleCardProps {
  role: RoleData;
}

/**
 * RoleCard
 *
 * Displays an open role with company info, priority, and rewards.
 * Color-coded priority badges and equity/karma indicators.
 */
export default function RoleCard({ role }: RoleCardProps) {
  // Priority badge colors
  const priorityConfig = {
    urgent: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/30',
      text: 'text-red-400',
    },
    high: {
      bg: 'bg-orange-500/10',
      border: 'border-orange-500/30',
      text: 'text-orange-400',
    },
    medium: {
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
      text: 'text-yellow-400',
    },
    low: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/30',
      text: 'text-blue-400',
    },
  };

  const priorityStyle = priorityConfig[role.priority];
  const avatarLetter = role.company.display_name.charAt(0).toUpperCase();

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 hover:border-zinc-600 transition-all p-4 space-y-4">
      {/* Company Badge */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-white flex-shrink-0">
          {role.company.avatar_url ? (
            <img
              src={role.company.avatar_url}
              alt={role.company.display_name}
              className="w-6 h-6 rounded-full"
            />
          ) : (
            avatarLetter
          )}
        </div>
        <span className="text-xs text-zinc-400">{role.company.display_name}</span>
      </div>

      {/* Role Title */}
      <h3 className="text-lg font-medium text-white">{role.title}</h3>

      {/* Description */}
      <p className="text-sm text-zinc-400 line-clamp-2">{role.description}</p>

      {/* Badges Row */}
      <div className="flex flex-wrap gap-2">
        {/* Priority Badge */}
        <span
          className={`text-xs px-2 py-1 border ${priorityStyle.bg} ${priorityStyle.border} ${priorityStyle.text} uppercase tracking-wider font-medium`}
        >
          {role.priority}
        </span>

        {/* Equity Badge */}
        {parseFloat(String(role.equity_reward)) > 0 && (
          <span className="text-xs px-2 py-1 border bg-green-500/10 border-green-500/30 text-green-400">
            {parseFloat(String(role.equity_reward))}% equity
          </span>
        )}

      </div>
    </div>
  );
}
