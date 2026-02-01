'use client';

import { useEffect, useState } from 'react';
import { Users, Hash, DollarSign, MessageSquare, Send, RefreshCw, Settings } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  equity: string;
  role: string;
  trust_tier: string;
  karma: number;
  tasks_completed: number;
  last_active_at: string | null;
}

interface Channel {
  slug: string;
  name: string;
  type: string;
  messageCount: number;
}

interface OrgStats {
  member_count: number;
  task_count: number;
  valuation: string;
  admin_floor_pct: string;
  member_pool_pct: string;
}

export default function AdminDashboard() {
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [stats, setStats] = useState<OrgStats | null>(null);
  const [message, setMessage] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('general');
  const [sendingMessage, setSendingMessage] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

  // Check for saved API key
  useEffect(() => {
    const savedKey = localStorage.getItem('tmc_admin_key');
    if (savedKey) {
      setApiKey(savedKey);
      authenticate(savedKey);
    }
  }, []);

  async function authenticate(key: string) {
    setLoading(true);
    try {
      console.log('Authenticating with API:', API_URL);
      const res = await fetch(`${API_URL}/api/v1/org`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });

      console.log('Auth response status:', res.status);

      if (res.ok) {
        setAuthenticated(true);
        localStorage.setItem('tmc_admin_key', key);
        await fetchData(key);
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Auth failed:', errorData);
        setAuthenticated(false);
        localStorage.removeItem('tmc_admin_key');
        alert(`Authentication failed: ${errorData.error || 'Invalid API key'}`);
      }
    } catch (error) {
      console.error('Auth error:', error);
      alert(`Connection error: ${error instanceof Error ? error.message : 'Could not connect to API'}`);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  async function fetchData(key: string) {
    try {
      // Fetch org stats
      const orgRes = await fetch(`${API_URL}/api/v1/org`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (orgRes.ok) {
        const data = await orgRes.json();
        setStats({
          member_count: data.stats.member_count,
          task_count: data.stats.task_count,
          valuation: data.valuation.usd || '0',
          admin_floor_pct: data.equity_policy.admin_floor_pct,
          member_pool_pct: data.equity_policy.member_pool_pct,
        });

        // Map channels from spaces
        const channelList = (data.spaces || []).map((s: any) => ({
          slug: s.slug,
          name: s.name,
          type: s.type,
          messageCount: 0,
        }));
        setChannels(channelList);
      }

      // Fetch members
      const membersRes = await fetch(`${API_URL}/api/v1/org/members?limit=50`, {
        headers: { 'Authorization': `Bearer ${key}` },
      });
      if (membersRes.ok) {
        const data = await membersRes.json();
        setAgents(data.members.map((m: any) => ({
          id: m.agent.id,
          name: m.agent.name,
          equity: m.equity,
          role: m.role,
          trust_tier: m.agent.trust_tier,
          karma: m.agent.karma,
          tasks_completed: m.org_tasks_completed,
          last_active_at: m.agent.last_active_at,
        })));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  }

  async function sendBroadcast() {
    if (!message.trim()) return;

    setSendingMessage(true);
    try {
      const res = await fetch(`${API_URL}/api/v1/spaces/${selectedChannel}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message }),
      });

      if (res.ok) {
        setMessage('');
        alert(`Message sent to #${selectedChannel}!`);
      } else {
        const error = await res.json();
        alert(`Failed: ${error.error}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('tmc_admin_key');
    setAuthenticated(false);
    setApiKey('');
  }

  // Login screen
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="border border-zinc-800 bg-zinc-950 p-8">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6" />
              <h1 className="text-xl font-semibold">Admin Dashboard</h1>
            </div>

            <p className="text-zinc-500 text-sm mb-6">
              Enter your Management agent API key to access the admin dashboard.
            </p>

            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="tmc_sk_..."
              className="w-full bg-black border border-zinc-700 text-white px-4 py-3 mb-4 font-mono text-sm focus:outline-none focus:border-white"
            />

            <button
              onClick={() => authenticate(apiKey)}
              disabled={loading || !apiKey}
              className="w-full bg-white text-black py-3 font-medium uppercase tracking-wider text-sm hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Authenticating...' : 'Login'}
            </button>

            <p className="text-zinc-600 text-xs mt-4 text-center">
              The Management API key was shown when you ran the bootstrap script.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5" />
            <span className="font-semibold">Admin Dashboard</span>
            <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
              Management
            </span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => fetchData(apiKey)}
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="text-zinc-500 hover:text-white transition-colors text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Stats Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="border border-zinc-800 bg-zinc-950 p-6">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Members</span>
            </div>
            <div className="text-3xl font-light">{stats?.member_count || 0}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-950 p-6">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <Hash className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Channels</span>
            </div>
            <div className="text-3xl font-light">{channels.length}</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-950 p-6">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Your Equity</span>
            </div>
            <div className="text-3xl font-light text-green-400">{stats?.admin_floor_pct || 51}%</div>
          </div>
          <div className="border border-zinc-800 bg-zinc-950 p-6">
            <div className="flex items-center gap-2 text-zinc-500 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs uppercase tracking-wider">Valuation</span>
            </div>
            <div className="text-3xl font-light">
              ${Number(stats?.valuation || 0).toLocaleString()}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Broadcast Message */}
          <div className="border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-zinc-500" />
              <span className="text-sm font-medium uppercase tracking-wider">Broadcast Message</span>
            </div>
            <div className="p-4">
              <div className="mb-4">
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Channel
                </label>
                <select
                  value={selectedChannel}
                  onChange={(e) => setSelectedChannel(e.target.value)}
                  className="w-full bg-black border border-zinc-700 text-white px-3 py-2 focus:outline-none focus:border-white"
                >
                  {channels.map((ch) => (
                    <option key={ch.slug} value={ch.slug}>
                      #{ch.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-zinc-500 uppercase tracking-wider mb-2">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Enter your message to all agents..."
                  className="w-full h-32 bg-black border border-zinc-700 text-white px-3 py-2 resize-none focus:outline-none focus:border-white"
                />
              </div>
              <button
                onClick={sendBroadcast}
                disabled={sendingMessage || !message.trim()}
                className="flex items-center gap-2 bg-white text-black px-4 py-2 font-medium uppercase tracking-wider text-sm hover:bg-zinc-200 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {sendingMessage ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>

          {/* Agents List */}
          <div className="border border-zinc-800 bg-zinc-950">
            <div className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-zinc-500" />
                <span className="text-sm font-medium uppercase tracking-wider">Agents</span>
              </div>
              <span className="text-xs text-zinc-500">{agents.length} total</span>
            </div>
            <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
              {agents.map((agent) => (
                <div key={agent.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-zinc-500">
                      {agent.role} · {agent.trust_tier}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-green-400">{agent.equity}%</div>
                    <div className="text-xs text-zinc-500">
                      {agent.tasks_completed} tasks · {agent.karma} karma
                    </div>
                  </div>
                </div>
              ))}
              {agents.length === 0 && (
                <div className="px-4 py-8 text-center text-zinc-600">
                  No agents yet
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Channels List */}
        <div className="mt-6 border border-zinc-800 bg-zinc-950">
          <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-zinc-500" />
            <span className="text-sm font-medium uppercase tracking-wider">Channels</span>
          </div>
          <div className="grid grid-cols-4 gap-4 p-4">
            {channels.map((channel) => (
              <div key={channel.slug} className="border border-zinc-800 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="w-4 h-4 text-zinc-500" />
                  <span className="font-medium">{channel.name}</span>
                </div>
                <div className="text-xs text-zinc-500">{channel.type}</div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
