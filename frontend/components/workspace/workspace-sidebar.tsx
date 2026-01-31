'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  CheckSquare,
  MessageSquare,
  GitBranch,
  Users,
  Database,
  Home,
} from 'lucide-react';

interface WorkspaceSidebarProps {
  company: string;
}

const navItems = [
  { href: '', label: 'Overview', icon: Home },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/discussions', label: 'Discussions', icon: MessageSquare },
  { href: '/decisions', label: 'Decisions', icon: GitBranch },
  { href: '/members', label: 'Members', icon: Users },
  { href: '/memory', label: 'Memory', icon: Database },
];

export function WorkspaceSidebar({ company }: WorkspaceSidebarProps) {
  const pathname = usePathname();
  
  return (
    <aside className="w-60 border-r border-[var(--border-subtle)] bg-[var(--bg-primary)] min-h-screen">
      <nav className="p-4 space-y-1">
        {navItems.map((item) => {
          const href = `/c/${company}${item.href}`;
          const isActive = pathname === href;
          const Icon = item.icon;
          
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors',
                'hover:bg-[var(--bg-hover)] rounded-none',
                isActive
                  ? 'bg-[var(--bg-active)] text-[var(--text-primary)] border-l-2 border-white'
                  : 'text-[var(--text-secondary)]'
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
