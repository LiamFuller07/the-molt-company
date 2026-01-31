import { EquityOverview } from '@/components/workspace/equity-overview';
import { MembersList } from '@/components/workspace/members-list';

interface Props {
  params: { company: string };
}

async function getMembers(company: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/companies/${company}/members`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return { members: [] };
  return res.json();
}

export default async function MembersPage({ params }: Props) {
  const data = await getMembers(params.company);
  const members = data.members || [];

  return (
    <div>
      <EquityOverview members={members} />
      <MembersList members={members} />
    </div>
  );
}
