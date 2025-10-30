import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { getClientById, runClientOnce } from '@geo/db';
import RunStatusIndicator from '../../../components/run-status-indicator';

import ClientSubNav from '../../../components/client-sub-nav';

async function runClientAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();

  if (!clientId) {
    throw new Error('Missing client ID');
  }

  // Start the run asynchronously - don't await, let it run in background
  runClientOnce({ clientId, surfaces: ['openai', 'claude'] }).catch((error) => {
    console.error('[server action] Run failed:', error);
  });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath(`/clients/${clientId}/queries`);
  revalidatePath(`/clients/${clientId}/runs`);
  revalidatePath('/');
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

  return (
    <div className="flex flex-1 flex-col gap-10">
      <RunStatusIndicator clientId={client.id} />
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
              {client.domains.length > 0 && <span>Domains: {client.domains.join(', ')}</span>}
            </div>
          </div>

          <form action={runClientAction} className="flex flex-col items-start gap-3 lg:items-end">
            <input name="clientId" type="hidden" value={client.id} />
            <button
              className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              type="submit"
            >
              Prepare client report
            </button>
          </form>
        </div>

        <ClientSubNav clientId={client.id} />
      </div>

      <div className="flex flex-1 flex-col gap-10">{children}</div>
    </div>
  );
}

