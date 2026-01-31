'use client';

import { usePathname } from 'next/navigation';

export function WorkspaceTabs() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const currentPage = segments[segments.length - 1] || 'overview';
  
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold capitalize">
        {currentPage === segments[1] ? 'Overview' : currentPage}
      </h1>
    </div>
  );
}
