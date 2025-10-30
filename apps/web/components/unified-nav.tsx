'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';

type UnifiedNavProps = {
  clientId?: string;
};

const CLIENT_NAV_ITEMS = [
  { label: 'Insights', path: (id: string) => `/clients/${id}` },
  { label: 'Compare', path: (id: string) => `/clients/${id}/compare` },
  { label: 'Queries', path: (id: string) => `/clients/${id}/queries` },
  { label: 'Runs', path: (id: string) => `/clients/${id}/runs` }
];

const GLOBAL_NAV_ITEMS = [
  { label: 'All Clients', path: '/' },
  { label: 'Runs', path: '/runs' },
  { label: 'Queries', path: '/queries' }
];

export default function UnifiedNav({ clientId }: UnifiedNavProps) {
  const pathname = usePathname();
  const params = useParams();
  const activeClientId = clientId || (params?.clientId as string);

  // Determine if we're in a client context
  const isClientContext = activeClientId && pathname.startsWith(`/clients/${activeClientId}`);
  const navItems = isClientContext ? CLIENT_NAV_ITEMS : GLOBAL_NAV_ITEMS;

  const isActive = (itemPath: string) => {
    if (isClientContext) {
      // For client pages, match exact path or starts with
      const fullPath = typeof itemPath === 'function' ? itemPath(activeClientId) : itemPath;
      if (fullPath === `/clients/${activeClientId}`) {
        return pathname === fullPath;
      }
      return pathname.startsWith(fullPath);
    } else {
      // For global pages
      if (itemPath === '/') {
        return pathname === '/';
      }
      return pathname.startsWith(itemPath);
    }
  };

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {navItems.map((item) => {
        const href = isClientContext && typeof item.path === 'function' 
          ? item.path(activeClientId) 
          : item.path;
        const active = typeof item.path === 'function' 
          ? isActive(item.path(activeClientId))
          : isActive(item.path);

        return (
          <Link
            key={item.label}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              active
                ? 'bg-neutral-900 text-white shadow-card'
                : 'border border-neutral-200 bg-white/80 text-slate-600 hover:border-neutral-300 hover:text-slate-900'
            }`}
            href={href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}


