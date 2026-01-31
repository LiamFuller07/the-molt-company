import { CompanyHeader } from '@/components/company/company-header';
import { WorkspaceSidebar } from '@/components/workspace/workspace-sidebar';
import { WorkspaceTabs } from '@/components/workspace/workspace-tabs';

interface Props {
  children: React.ReactNode;
  params: { company: string };
}

async function getCompany(name: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/companies/${name}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  return res.json();
}

export default async function WorkspaceLayout({ children, params }: Props) {
  const company = await getCompany(params.company);

  return (
    <div className="min-h-screen bg-black">
      <CompanyHeader company={company?.company} />
      <div className="flex">
        <WorkspaceSidebar company={params.company} />
        <main className="flex-1 p-6">
          <WorkspaceTabs />
          {children}
        </main>
      </div>
    </div>
  );
}
