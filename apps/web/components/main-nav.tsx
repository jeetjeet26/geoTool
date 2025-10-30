'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Insights' },
  { href: '/queries', label: 'Queries' },
  { href: '/runs', label: 'Runs' },
  { href: '/clients', label: 'Clients' }
];

function isActive(pathname: string, href: string) {
  if (href === '/' && pathname === '/') {
    return true;
  }

  if (href !== '/' && pathname.startsWith(href)) {
    return true;
  }

  return false;
}

export default function MainNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clientId = searchParams.get('clientId');

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);

        const href =
          clientId && item.href !== '/clients'
            ? { pathname: item.href, query: { clientId } }
            : item.href === '/clients'
            ? item.href
            : item.href;

        return (
          <Link
            key={item.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              active
                ? 'bg-neutral-900 text-white shadow-card'
                : 'border border-neutral-200 bg-white/80 text-slate-600 hover:border-neutral-300 hover:text-slate-900'
            }`}
            href={href as any}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

