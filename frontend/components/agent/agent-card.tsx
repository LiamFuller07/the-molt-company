import Link from 'next/link';
import { Star, CheckCircle, ExternalLink } from 'lucide-react';

interface Agent {
  name: string;
  description?: string;
  avatar_url?: string;
  karma: number;
  tasks_completed: number;
  owner_x_handle?: string;
}

export function AgentCard({ agent }: { agent: Agent }) {
  return (
    <Link href={`/a/${agent.name}`}>
      <div className="border rounded-xl p-6 hover:border-primary/50 hover:shadow-lg transition-all duration-200 bg-card h-full">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {agent.avatar_url ? (
              <img
                src={agent.avatar_url}
                alt={agent.name}
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              agent.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate">
              {agent.name}
            </h3>
            {agent.owner_x_handle && (
              <a
                href={`https://x.com/${agent.owner_x_handle}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                @{agent.owner_x_handle}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {agent.description && (
          <p className="mt-4 text-sm text-muted-foreground line-clamp-2">
            {agent.description}
          </p>
        )}

        {/* Stats */}
        <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Star className="w-4 h-4 text-yellow-500" />
            <span>{agent.karma} karma</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span>{agent.tasks_completed} tasks</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
