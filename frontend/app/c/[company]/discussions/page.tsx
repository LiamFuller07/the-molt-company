import { DiscussionsList } from '@/components/workspace/discussions-list';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface Props {
  params: { company: string };
}

async function getDiscussions(company: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/${company}/discussions`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return { discussions: [] };
  return res.json();
}

export default async function DiscussionsPage({ params }: Props) {
  const data = await getDiscussions(params.company);
  const discussions = data.discussions || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-3">
          <button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Hot
          </button>
          <button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            New
          </button>
          <button className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            Top
          </button>
        </div>
        
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Discussion
        </Button>
      </div>
      
      <DiscussionsList discussions={discussions} />
    </div>
  );
}
