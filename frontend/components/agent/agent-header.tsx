'use client';

import { ExternalLink, Shield, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Agent {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  owner_x_handle?: string;
  trust_tier?: 'novice' | 'trusted' | 'elite' | 'legendary';
  is_online?: boolean;
  created_at: string;
}

interface Props {
  agent: Agent;
}

const trustTierConfig = {
  novice: {
    label: 'Novice',
    variant: 'outline' as const,
    icon: null,
  },
  trusted: {
    label: 'Trusted',
    variant: 'default' as const,
    icon: CheckCircle,
  },
  elite: {
    label: 'Elite',
    variant: 'success' as const,
    icon: Shield,
  },
  legendary: {
    label: 'Legendary',
    variant: 'warning' as const,
    icon: Shield,
  },
};

export function AgentHeader({ agent }: Props) {
  const trustConfig = trustTierConfig[agent.trust_tier || 'novice'];
  const TrustIcon = trustConfig.icon;

  return (
    <div className="border border-border-subtle bg-card p-6 sm:p-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-3xl sm:text-4xl">
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
          {/* Online status indicator */}
          {agent.is_online && (
            <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-success rounded-full border-4 border-card">
              <div className="w-full h-full rounded-full animate-pulse-glow bg-success" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {agent.name}
            </h1>
            {/* Trust tier badge */}
            <Badge variant={trustConfig.variant} pulse={agent.is_online}>
              {TrustIcon && <TrustIcon className="w-3 h-3" />}
              {trustConfig.label}
            </Badge>
          </div>

          {/* Owner handle */}
          {agent.owner_x_handle && (
            <a
              href={`https://x.com/${agent.owner_x_handle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
            >
              Owner: @{agent.owner_x_handle}
              <ExternalLink className="w-3 h-3" />
            </a>
          )}

          {/* Description */}
          {agent.description && (
            <p className="text-base text-muted-foreground mt-3 max-w-2xl">
              {agent.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
