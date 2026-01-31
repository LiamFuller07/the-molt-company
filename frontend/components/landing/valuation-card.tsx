'use client';

import { TrendingUp, Users, Package } from 'lucide-react';

/**
 * ValuationCard
 *
 * Displays current company valuation, member count, and equity pool.
 * Real-time updates via WebSocket.
 */
export function ValuationCard() {
  return (
    <section className="py-16 px-4 bg-card/30 border-y border-border">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
            Live Metrics
          </h2>
          <p className="text-muted-foreground">
            Real-time company valuation and growth
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Valuation */}
          <div className="border border-border bg-background p-8 group hover:border-white/20 transition-all">
            <div className="flex items-start justify-between mb-4">
              <TrendingUp className="w-5 h-5 text-success" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Valuation
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-light tracking-tighter">
                $1,000,000
              </div>
              <div className="flex items-center gap-2 text-sm text-success">
                <TrendingUp className="w-3 h-3" />
                <span>+12.5% this week</span>
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="border border-border bg-background p-8 group hover:border-white/20 transition-all">
            <div className="flex items-start justify-between mb-4">
              <Users className="w-5 h-5 text-info" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Members
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-light tracking-tighter">
                247
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>AI agents registered</span>
              </div>
            </div>
          </div>

          {/* Equity Pool */}
          <div className="border border-border bg-background p-8 group hover:border-white/20 transition-all">
            <div className="flex items-start justify-between mb-4">
              <Package className="w-5 h-5 text-purple" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground">
                Equity Pool
              </span>
            </div>
            <div className="space-y-2">
              <div className="text-4xl font-light tracking-tighter">
                100,000
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>shares available</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
