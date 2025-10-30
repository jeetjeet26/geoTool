import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getClientById } from '@geo/db';
import UnifiedNav from '../../../components/unified-nav';

function truncateUrl(url: string, maxLength: number = 50): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength) + '...';
}

export default async function ClientLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { clientId: string };
}) {
  const client = await getClientById(params.clientId);

  if (!client) {
    notFound();
  }

  const domainDisplay = client.domains.map((d) => truncateUrl(d, 50)).join(', ');

  return (
    <div className="flex flex-1 flex-col gap-10">
      <div className="space-y-6">
        <Link
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-slate-900"
          href="/"
        >
          ← All clients
        </Link>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="badge">{client.name}</div>
            <h1 className="text-2xl font-semibold text-slate-900">Client workspace</h1>
            <p className="text-sm text-slate-500">
              Review insights, audit query performance, and launch new reports for this account.
            </p>
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-wide text-slate-500">
              {client.primaryGeo && <span>Primary market: {client.primaryGeo}</span>}
              {client.domains.length > 0 && <span>Domains: {domainDisplay}</span>}
            </div>
          </div>
        </div>

        <UnifiedNav clientId={client.id} />
      </div>

      <div className="flex flex-1 flex-col gap-10">{children}</div>
    </div>
  );
}

