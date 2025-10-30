import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient, listClients } from '@geo/db';
import { normalizeDomain } from '@geo/core';

function parseList(input: string | null): string[] {
  if (!input) return [];

  return input
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatDomains(domains: string[]): string {
  const normalized = Array.from(
    new Set(
      domains
        .map((domain) => normalizeDomain(domain))
        .filter((value) => value.length > 0)
    )
  );

  if (normalized.length === 0) {
    return '—';
  }

  return normalized.join(', ');
}

async function createClientAction(formData: FormData) {
  'use server';

  const name = formData.get('name')?.toString().trim();
  const domains = parseList(formData.get('domains')?.toString() ?? null);
  const competitors = parseList(formData.get('competitors')?.toString() ?? null);
  const primaryGeoRaw = formData.get('primaryGeo')?.toString()?.trim();
  const primaryGeo = primaryGeoRaw && primaryGeoRaw.length > 0 ? primaryGeoRaw : null;

  if (!name) {
    throw new Error('Client name is required');
  }

  const client = await createClient({
    name,
    domains,
    competitors,
    primaryGeo
  });

  revalidatePath('/');
  redirect(`/clients/${client.id}`);
}

export default async function HomePage() {
  const clients = await listClients();

  return (
    <section className="flex flex-1 flex-col gap-10">
      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">Client workspaces</div>
          <h1 className="page-title">Select a client to enter their insights hub</h1>
          <p className="page-subtitle">
            Manage multifamily brand workspaces, launch bespoke crawls, and prep client-ready visibility reports.
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Active clients</h2>
          <p className="mt-1 text-sm text-slate-500">
            Open a workspace to review insights, query performance, and run history for that client.
          </p>

          <div className="mt-6 divide-y divide-neutral-100">
            {clients.length === 0 && (
              <div className="py-10 text-sm text-slate-500">No clients yet. Add one using the form.</div>
            )}

            {clients.map((client) => (
              <div key={client.id} className="flex items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-medium text-slate-900">{client.name}</p>
                  {client.primaryGeo && <p className="text-xs text-slate-500">{client.primaryGeo}</p>}
                  <p className="text-xs uppercase tracking-wide text-slate-500">
                    {formatDomains(client.domains)}
                  </p>
                </div>

                <Link className="inline-link" href={`/clients/${client.id}`}>
                  Open workspace
                </Link>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Add new client</h2>
          <p className="mt-1 text-sm text-slate-500">
            Provide domains, primary market, and competitors so default queries align with your reporting needs.
          </p>

          <form action={createClientAction} className="mt-6 flex flex-col gap-4">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Client name
              <input
                className="w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                name="name"
                placeholder="e.g. Costa Mesa Residences"
                required
                type="text"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Primary market / geo
              <input
                className="w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                name="primaryGeo"
                placeholder="e.g. Costa Mesa, California"
                type="text"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Domains
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                name="domains"
                placeholder="One domain per line"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Competitors
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                name="competitors"
                placeholder="Optional — one domain per line"
              />
            </label>

            <button
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              type="submit"
            >
              Save client
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
