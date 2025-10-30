import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';

import type { Surface } from '@geo/core';
import {
  createClientQuery,
  deleteClientQuery,
  getClientWithQueries,
  getLatestRunDetailWithDiff
} from '@geo/db';
import FilteredQueriesTable from '../../../../components/filtered-queries-table';

type QueryTypeValue = Parameters<typeof createClientQuery>[0]['type'];

const QUERY_TYPES = [
  { value: 'branded', label: 'Branded' },
  { value: 'category', label: 'Category' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'local', label: 'Local' },
  { value: 'faq', label: 'FAQ' }
] as const satisfies ReadonlyArray<{ value: QueryTypeValue; label: string }>;

const SURFACES: Surface[] = ['openai', 'claude'];

function isQueryType(value: string): value is QueryTypeValue {
  return QUERY_TYPES.some((option) => option.value === value);
}

function formatDelta(value: number | null | undefined, { percent = false } = {}) {
  if (value === null || value === undefined) return '—';
  const precision = percent ? 1 : Number.isInteger(value) ? 0 : 1;
  const formatted = value.toFixed(precision);
  if (value > 0) return `+${formatted}`;
  if (percent) return formatted;
  return formatted;
}

function formatSurface(surface: Surface) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

async function addQueryAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();
  const text = formData.get('text')?.toString().trim();
  const rawType = formData.get('type');
  const geo = formData.get('geo')?.toString().trim();
  const weightValue = formData.get('weight')?.toString().trim();

  if (!clientId) {
    throw new Error('Missing client ID');
  }

  if (!text) {
    throw new Error('Query text is required');
  }

  if (!rawType) {
    throw new Error('Query type is required');
  }

  const type = rawType.toString();

  if (!isQueryType(type)) {
    throw new Error('Invalid query type');
  }

  const weight = weightValue ? Number(weightValue) : null;

  await createClientQuery({
    clientId,
    text,
    type,
    geo: geo ?? null,
    weight
  });

  revalidatePath(`/clients/${clientId}/queries`);
  revalidatePath(`/clients/${clientId}`);
}

async function deleteQueryAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();
  const queryId = formData.get('queryId')?.toString();

  if (!clientId || !queryId) {
    throw new Error('Missing identifiers');
  }

  await deleteClientQuery(queryId);

  revalidatePath(`/clients/${clientId}/queries`);
  revalidatePath(`/clients/${clientId}`);
}

export default async function ClientQueriesPage({
  params,
  searchParams
}: {
  params: { clientId: string };
  searchParams?: { surface?: Surface };
}) {
  const client = await getClientWithQueries(params.clientId);

  if (!client) {
    notFound();
  }

  const surfaceParam = searchParams?.surface;
  const surface = SURFACES.includes(surfaceParam as Surface) ? (surfaceParam as Surface) : 'openai';
  const runDetail = await getLatestRunDetailWithDiff(surface, client.id);

  const queryCount = runDetail?.queries.length ?? 0;
  const presenceRate = runDetail && queryCount
    ? Math.round((runDetail.queries.filter((query) => query.presence).length / queryCount) * 100)
    : 0;
  const flaggedQueries = runDetail ? runDetail.queries.filter((query) => query.flags.length > 0) : [];
  const movers = runDetail
    ? runDetail.queries
        .filter((query) => typeof query.deltas?.scoreDelta === 'number')
        .sort((a, b) => (b.deltas?.scoreDelta ?? 0) - (a.deltas?.scoreDelta ?? 0))
        .slice(0, 3)
    : [];

  return (
    <section className="flex flex-1 flex-col gap-10">
      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">{formatSurface(surface)} surface</div>
          <h2 className="page-title">Query performance workspace</h2>
          <p className="page-subtitle">
            Audit presence, ranking, and share-of-voice shifts to prep talking points before delivering your client report.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <nav className="flex flex-wrap gap-2">
            {SURFACES.map((item) => {
              const isActive = item === surface;
              return (
                <Link
                  key={item}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    isActive
                      ? 'bg-neutral-900 text-white shadow-card'
                      : 'border border-neutral-200 bg-white/80 text-slate-600 hover:border-neutral-300 hover:text-slate-900'
                  }`}
                  href={{ pathname: `/clients/${client.id}/queries`, query: { surface: item } } as any}
                >
                  {formatSurface(item)}
                </Link>
              );
            })}
          </nav>

          {runDetail && (
            <div className="text-sm text-slate-500">
              Latest run · Score {runDetail.run.overallScore.toFixed(1)} • Visibility {runDetail.run.visibilityPct.toFixed(1)}%
            </div>
          )}
        </div>
      </header>

      {!runDetail && (
        <div className="empty-state">
          <strong className="text-sm text-slate-600">No runs for {formatSurface(surface)} yet</strong>
          <span>Launch a crawl to populate the query table and unlock comparison deltas.</span>
        </div>
      )}

      {runDetail && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <div className="metric">
              <span className="metric-label">Overall score</span>
              <span className="metric-value">{runDetail.run.overallScore.toFixed(1)}</span>
              <p className="text-sm text-slate-500">Blended query performance for the latest {formatSurface(surface)} run.</p>
            </div>
            <div className="metric">
              <span className="metric-label">Share of voice</span>
              <span className="metric-value">{runDetail.run.visibilityPct.toFixed(1)}%</span>
              <p className="text-sm text-slate-500">Percentage of answers where the brand secured meaningful inclusion.</p>
            </div>
            <div className="metric">
              <span className="metric-label">Presence coverage</span>
              <span className="metric-value">{queryCount ? `${presenceRate}%` : '—'}</span>
              <p className="text-sm text-slate-500">Queries with brand mentions vs total tracked in this workspace.</p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-4">
              <FilteredQueriesTable queries={runDetail.queries} />
            </div>

            <div className="flex flex-col gap-6">
              <div className="card">
                <h2 className="text-base font-semibold text-slate-900">Opportunity highlights</h2>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {movers.length === 0 && <li>No score movement detected vs the previous run.</li>}
                  {movers.map((query) => {
                    const delta = query.deltas?.scoreDelta ?? 0;
                    const direction = delta > 0 ? 'improved by' : delta < 0 ? 'declined by' : 'held steady at';
                    const detail = delta !== 0 ? `${formatDelta(delta)} pts` : `${query.score.toFixed(1)} pts`;
                    return (
                      <li key={query.queryId}>
                        <span className="font-semibold text-slate-900">{query.text}</span> {direction} {detail}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="card">
                <h2 className="text-base font-semibold text-slate-900">Flags to resolve</h2>
                <ul className="mt-4 space-y-2 text-sm text-slate-600">
                  {flaggedQueries.length === 0 && <li>All queries are clear—no flags from the latest crawl.</li>}
                  {flaggedQueries.map((query) => (
                    <li key={query.queryId}>
                      <span className="font-semibold text-slate-900">{query.text}:</span> {query.flags.join(', ')}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      )}

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tracked queries</h2>
              <p className="text-sm text-slate-500">
                These prompts power the LLM crawl. Keep a balance across branded, local, and category intents.
              </p>
            </div>
          </div>

          <div className="table-wrapper mt-6">
            <table className="table">
              <thead>
                <tr>
                  <th>Query</th>
                  <th>Type</th>
                  <th>Geo</th>
                  <th>Weight</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {client.queries.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={5}>
                      No queries yet. Add some using the form to the right.
                    </td>
                  </tr>
                )}

                {client.queries.map((query) => (
                  <tr key={query.id}>
                    <td className="font-medium text-slate-900">{query.text}</td>
                    <td className="text-slate-500">{query.type}</td>
                    <td className="text-slate-500">{query.geo ?? '—'}</td>
                    <td className="text-slate-500">{query.weight ?? 1}</td>
                    <td className="text-right">
                      <form action={deleteQueryAction} className="inline">
                        <input name="clientId" type="hidden" value={client.id} />
                        <input name="queryId" type="hidden" value={query.id} />
                        <button
                          className="text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:text-rose-700"
                          type="submit"
                        >
                          Remove
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold text-slate-900">Add query</h2>
          <p className="mt-1 text-sm text-slate-500">
            Capture prompts your prospects might ask (e.g. “pet-friendly apartments in Costa Mesa”).
          </p>

          <form action={addQueryAction} className="mt-6 flex flex-col gap-4">
            <input name="clientId" type="hidden" value={client.id} />

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Query text
              <textarea
                className="min-h-[96px] w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                name="text"
                placeholder="e.g. best luxury apartments in costa mesa with ocean view"
                required
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Type
                <select
                  className="w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                  name="type"
                  required
                  defaultValue="branded"
                >
                  {QUERY_TYPES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
                Geo (optional)
                <input
                  className="w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                  name="geo"
                  placeholder="e.g. costa mesa, ca"
                  type="text"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Weight (optional)
              <input
                className="w-full rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                name="weight"
                placeholder="Default 1.0"
                step="0.1"
                type="number"
                min="0"
              />
            </label>

            <button
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              type="submit"
            >
              Add query
            </button>
          </form>
        </div>
      </section>
    </section>
  );
}

