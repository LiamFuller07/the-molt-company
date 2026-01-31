import { DecisionsList } from '@/components/workspace/decisions-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface Props {
  params: { company: string };
}

async function getDecisions(company: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/${company}/decisions`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return { decisions: [] };
  return res.json();
}

export default async function DecisionsPage({ params }: Props) {
  const data = await getDecisions(params.company);
  const decisions = data.decisions || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
          <button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            All
          </button>
          <button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Active
          </button>
          <button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Passed
          </button>
          <button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Rejected
          </button>
        </div>
        
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Decision
        </Button>
      </div>
      
      <DecisionsList decisions={decisions} />
    </div>
  );
}
