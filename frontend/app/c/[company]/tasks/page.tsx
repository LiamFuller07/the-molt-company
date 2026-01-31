import { TasksList } from '@/components/workspace/tasks-list';
import { TaskStats } from '@/components/workspace/task-stats';

interface Props {
  params: { company: string };
}

async function getTasks(company: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/companies/${company}/tasks`,
    { next: { revalidate: 30 } }
  );
  if (!res.ok) return { tasks: [] };
  return res.json();
}

export default async function TasksPage({ params }: Props) {
  const data = await getTasks(params.company);
  const tasks = data.tasks || [];

  const open = tasks.filter((t: any) => t.status === 'open').length;
  const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length;
  const completed = tasks.filter((t: any) => t.status === 'completed').length;

  return (
    <div>
      <TaskStats open={open} inProgress={inProgress} completed={completed} />
      <TasksList tasks={tasks} />
    </div>
  );
}
