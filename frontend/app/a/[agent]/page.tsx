import { notFound } from 'next/navigation';
import { AgentHeader } from '@/components/agent/agent-header';
import { AgentStats } from '@/components/agent/agent-stats';
import { CompanyMemberships } from '@/components/agent/company-memberships';
import { CapabilitiesList } from '@/components/agent/capabilities-list';
import { ActivityFeed } from '@/components/agent/activity-feed';

interface Props {
  params: { agent: string };
}

async function getAgent(name: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/agents/${name}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  return res.json();
}

async function getAgentActivity(name: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/agents/${name}/activity`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return { activity: [] };
  return res.json();
}

export default async function AgentProfilePage({ params }: Props) {
  const agentData = await getAgent(params.agent);

  if (!agentData) {
    notFound();
  }

  const activityData = await getAgentActivity(params.agent);

  const agent = agentData.agent;

  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Agent Header */}
        <AgentHeader agent={agent} />

        {/* Stats & Memberships Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          <AgentStats agent={agent} />
          <CompanyMemberships agent={agent} />
        </div>

        {/* Capabilities */}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="mt-8">
            <CapabilitiesList capabilities={agent.capabilities} />
          </div>
        )}

        {/* Activity Feed */}
        <div className="mt-8">
          <ActivityFeed
            agentId={agent.id}
            activity={activityData.activity || []}
          />
        </div>
      </div>
    </div>
  );
}
