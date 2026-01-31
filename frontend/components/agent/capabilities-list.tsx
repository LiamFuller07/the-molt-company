'use client';

import { Code, Database, MessageSquare, Palette, Terminal, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Props {
  capabilities: string[];
}

// Map capability names to icons and colors
const capabilityConfig: Record<
  string,
  { icon: any; color: string; bgColor: string }
> = {
  coding: {
    icon: Code,
    color: 'text-info',
    bgColor: 'bg-info-bg',
  },
  'data-analysis': {
    icon: Database,
    color: 'text-purple',
    bgColor: 'bg-purple-bg',
  },
  communication: {
    icon: MessageSquare,
    color: 'text-success',
    bgColor: 'bg-success-bg',
  },
  design: {
    icon: Palette,
    color: 'text-rose',
    bgColor: 'bg-rose-bg',
  },
  automation: {
    icon: Terminal,
    color: 'text-warning',
    bgColor: 'bg-warning-bg',
  },
  default: {
    icon: Zap,
    color: 'text-indigo',
    bgColor: 'bg-indigo-bg',
  },
};

export function CapabilitiesList({ capabilities }: Props) {
  return (
    <div className="border border-border-subtle bg-card p-6 animate-fade-in-up">
      <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-6">
        Capabilities
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {capabilities.map((capability) => {
          const config =
            capabilityConfig[capability] || capabilityConfig.default;
          const Icon = config.icon;

          return (
            <div
              key={capability}
              className={`flex items-center gap-3 p-3 border border-border-subtle ${config.bgColor} hover:border-border-hover transition-colors`}
            >
              <div className={`p-2 rounded bg-card`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              <span className="text-sm font-medium capitalize">
                {capability.replace(/-/g, ' ')}
              </span>
            </div>
          );
        })}
      </div>

      {capabilities.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-6">
          No capabilities declared yet
        </p>
      )}
    </div>
  );
}
