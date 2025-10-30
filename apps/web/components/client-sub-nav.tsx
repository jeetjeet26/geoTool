'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type ClientSubNavProps = {
  clientId: string;
};

const NAV_ITEMS: Array<{ label: string; href: (clientId: string) => string; isActive: (pathname: string, clientId: string) => boolean }> = [
  {
    label: 'Insights',
    href: (clientId) => `/clients/${clientId}`,
    isActive: (pathname, clientId) => pathname === `/clients/${clientId}`
  },
  {
    label: 'Compare',
    href: (clientId) => `/clients/${clientId}/compare`,
    isActive: (pathname, clientId) => pathname === `/clients/${clientId}/compare`
  },
  {
    label: 'Queries',
    href: (clientId) => `/clients/${clientId}/queries`,
    isActive: (pathname, clientId) => pathname.startsWith(`/clients/${clientId}/queries`)
  },
  {
    label: 'Runs',
    href: (clientId) => `/clients/${clientId}/runs`,
    isActive: (pathname, clientId) => pathname.startsWith(`/clients/${clientId}/runs`)
  }
];

export default function ClientSubNav({ clientId }: ClientSubNavProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-2">
      {NAV_ITEMS.map((item) => {
        const href = item.href(clientId);
        const active = item.isActive(pathname, clientId);

        return (
          <Link
            key={item.label}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
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

