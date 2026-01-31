import { notFound } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TaskList } from '@/components/company/task-list';
import { DiscussionList } from '@/components/company/discussion-list';
import { DecisionList } from '@/components/company/decision-list';
import { MemberList } from '@/components/company/member-list';
import { CompanyHeader } from '@/components/company/company-header';

interface Props {
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

async function getTasks(name: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/companies/${name}/tasks`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return { tasks: [] };
  return res.json();
}

async function getDiscussions(name: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/${name}/discussions`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return { discussions: [] };
  return res.json();
}

async function getDecisions(name: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/${name}/decisions`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return { decisions: [] };
  return res.json();
}

export default async function CompanyPage({ params }: Props) {
  const company = await getCompany(params.company);

  if (!company) {
    notFound();
  }

  const [tasksData, discussionsData, decisionsData] = await Promise.all([
    getTasks(params.company),
    getDiscussions(params.company),
    getDecisions(params.company),
  ]);

  return (
    <div className="min-h-screen">
      {/* Company Header */}
      <CompanyHeader company={company.company} />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Main Column */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList className="mb-6 w-full grid grid-cols-3 gap-2">
                <TabsTrigger value="tasks" className="text-xs sm:text-sm">
                  <span className="hidden sm:inline">Tasks </span>({tasksData.tasks?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="discussions" className="text-xs sm:text-sm">
                  <span className="hidden sm:inline">Discussions </span>({discussionsData.discussions?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="decisions" className="text-xs sm:text-sm">
                  <span className="hidden sm:inline">Decisions </span>({decisionsData.decisions?.length || 0})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tasks">
                <TaskList tasks={tasksData.tasks || []} company={params.company} />
              </TabsContent>

              <TabsContent value="discussions">
                <DiscussionList
                  discussions={discussionsData.discussions || []}
                  company={params.company}
                />
              </TabsContent>

              <TabsContent value="decisions">
                <DecisionList
                  decisions={decisionsData.decisions || []}
                  company={params.company}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-4 sm:space-y-6 order-1 lg:order-2">
            {/* About */}
            <div className="border border-border-subtle bg-card p-4 sm:p-6">
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wide">About</h3>
              <p className="text-sm text-muted-foreground">
                {company.company.description || 'No description yet.'}
              </p>
              {company.company.mission && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <h4 className="text-sm font-medium mb-2">Mission</h4>
                  <p className="text-sm text-muted-foreground">
                    {company.company.mission}
                  </p>
                </div>
              )}
            </div>

            {/* Members */}
            <div className="border border-border-subtle bg-card p-4 sm:p-6">
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wide">
                Members ({company.company.member_count})
              </h3>
              <MemberList company={params.company} />
            </div>

            {/* Equity */}
            <div className="border border-border-subtle bg-card p-4 sm:p-6">
              <h3 className="font-semibold mb-4 text-xs uppercase tracking-wide">Equity Distribution</h3>
              <a
                href={`/c/${params.company}/equity`}
                className="text-sm text-accent hover:text-accent-hover transition-colors inline-flex items-center gap-1"
              >
                View full breakdown →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
