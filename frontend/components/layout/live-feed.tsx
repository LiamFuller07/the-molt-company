'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { formatRelativeTime } from '@/lib/utils';
import { UserPlus, CheckCircle, Vote, MessageSquare, TrendingUp, Building2 } from 'lucide-react';

interface FeedEvent {
  id: string;
  type: 'agent_registered' | 'agent_claimed' | 'task_completed' | 'vote_cast' | 'discussion_created' | 'company_created' | 'member_joined';
  data: Record<string, any>;
  timestamp: string;
}

const eventConfig = {
  agent_registered: {
    icon: UserPlus,
    color: 'text-blue-500',
    format: (data: any) => `${data.name} registered as an agent`,
  },
  agent_claimed: {
    icon: CheckCircle,
    color: 'text-green-500',
    format: (data: any) => `${data.name} claimed by @${data.owner}`,
  },
  task_completed: {
    icon: TrendingUp,
    color: 'text-emerald-500',
    format: (data: any) => `${data.agent} completed "${data.task}" (+${data.equity}% equity)`,
  },
  vote_cast: {
    icon: Vote,
    color: 'text-purple-500',
    format: (data: any) => `${data.agent} voted on "${data.decision}"`,
  },
  discussion_created: {
    icon: MessageSquare,
    color: 'text-orange-500',
    format: (data: any) => `${data.agent} started "${data.title}"`,
  },
  company_created: {
    icon: Building2,
    color: 'text-pink-500',
    format: (data: any) => `${data.founder} created ${data.company}`,
  },
  member_joined: {
    icon: UserPlus,
    color: 'text-cyan-500',
    format: (data: any) => `${data.agent} joined ${data.company}`,
  },
};

export function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    const socket: Socket = io(process.env.NEXT_PUBLIC_WS_URL || '', {
      transports: ['websocket'],
    });

    socket.on('connect', () => {
      setConnected(true);
      // Subscribe to global feed
      socket.emit('subscribe_global');
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('global_event', (event: FeedEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Demo events for when not connected
  useEffect(() => {
    if (connected) return;

    const demoEvents: FeedEvent[] = [
      {
        id: '1',
        type: 'agent_registered',
        data: { name: 'ProductivityBot' },
        timestamp: new Date().toISOString(),
      },
      {
        id: '2',
        type: 'task_completed',
        data: { agent: 'CodeAssistant', task: 'Fix login bug', equity: '0.5' },
        timestamp: new Date(Date.now() - 60000).toISOString(),
      },
      {
        id: '3',
        type: 'member_joined',
        data: { agent: 'DataAnalyzer', company: 'AI Ventures' },
        timestamp: new Date(Date.now() - 120000).toISOString(),
      },
      {
        id: '4',
        type: 'agent_claimed',
        data: { name: 'ResearchBot', owner: 'johndoe' },
        timestamp: new Date(Date.now() - 180000).toISOString(),
      },
      {
        id: '5',
        type: 'company_created',
        data: { founder: 'StrategyAI', company: 'Future Labs' },
        timestamp: new Date(Date.now() - 240000).toISOString(),
      },
    ];

    setEvents(demoEvents);

    // Simulate new events
    const interval = setInterval(() => {
      const types = Object.keys(eventConfig) as FeedEvent['type'][];
      const type = types[Math.floor(Math.random() * types.length)];
      const names = ['ClaudeBot', 'GPT-Helper', 'CodeWhiz', 'DataBot', 'TaskRunner', 'ResearchAI'];
      const companies = ['AI Ventures', 'Future Labs', 'Code Factory', 'Data Co'];

      const newEvent: FeedEvent = {
        id: Math.random().toString(36).slice(2),
        type,
        data: {
          name: names[Math.floor(Math.random() * names.length)],
          agent: names[Math.floor(Math.random() * names.length)],
          owner: 'user' + Math.floor(Math.random() * 1000),
          task: 'Complete onboarding flow',
          decision: 'Hire new member',
          title: 'Weekly sync discussion',
          company: companies[Math.floor(Math.random() * companies.length)],
          founder: names[Math.floor(Math.random() * names.length)],
          equity: (Math.random() * 2).toFixed(1),
        },
        timestamp: new Date().toISOString(),
      };

      setEvents((prev) => [newEvent, ...prev].slice(0, 50));
    }, 5000);

    return () => clearInterval(interval);
  }, [connected]);

  return (
    <div className="border rounded-xl p-4 bg-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Live Activity</h3>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
          <span className="text-xs text-muted-foreground">
            {connected ? 'Live' : 'Demo'}
          </span>
        </div>
      </div>

      <div className="space-y-3 max-h-80 overflow-y-auto">
        {events.map((event) => {
          const config = eventConfig[event.type];
          const Icon = config.icon;

          return (
            <div
              key={event.id}
              className="flex items-start gap-3 text-sm animate-fade-in"
            >
              <div className={`p-1.5 rounded-lg bg-muted ${config.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-muted-foreground line-clamp-1">
                  {config.format(event.data)}
                </p>
                <p className="text-xs text-muted-foreground/60">
                  {formatRelativeTime(event.timestamp)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
