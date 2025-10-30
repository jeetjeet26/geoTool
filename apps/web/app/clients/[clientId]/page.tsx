import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formatDistanceToNow } from 'date-fns';

import {
  createClientQuery,
  deleteClientQuery,
  getClientWithQueries,
  runClientOnce,
  getLatestRunSummaries
} from '@geo/db';

type QueryTypeValue = Parameters<typeof createClientQuery>[0]['type'];

const QUERY_TYPES = [
  { value: 'branded', label: 'Branded' },
  { value: 'category', label: 'Category' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'local', label: 'Local' },
  { value: 'faq', label: 'FAQ' }
] as const satisfies ReadonlyArray<{ value: QueryTypeValue; label: string }>;

function isQueryType(value: string): value is QueryTypeValue {
  return QUERY_TYPES.some((option) => option.value === value);
}

function formatTimestamp(value: Date | null | undefined) {
  if (!value) return 'In progress';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value);
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

  revalidatePath(`/clients/${clientId}`);
}

async function runClientAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();

  if (!clientId) {
    throw new Error('Missing client ID');
  }

  await runClientOnce({ clientId, surfaces: ['openai', 'claude'] });

  revalidatePath(`/clients/${clientId}`);
  revalidatePath('/', 'page');
  revalidatePath('/runs', 'page');
  revalidatePath('/queries', 'page');
}


export default async function ClientWorkspacePage({
  params
}: {
  params: { clientId: string };
}) {
  const client = await getClientWithQueries(params.clientId);

  if (!client) {
    notFound();
  }

  const runs = await getLatestRunSummaries(client.id);
  const lastTouchpoint = runs.reduce<Date | null>((latest, run) => {
    const reference = run.finishedAt ?? run.startedAt;
    if (!reference) return latest;
    return !latest || reference > latest ? reference : latest;
  }, null);

  const averageScore = runs.length
    ? runs.reduce((total, run) => total + run.overallScore, 0) / runs.length
    : 0;
  const averageVisibility = runs.length
    ? runs.reduce((total, run) => total + run.visibilityPct, 0) / runs.length
    : 0;

  return (
    <section className="flex flex-1 flex-col gap-10">
      <div className="flex items-center gap-3">
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-neutral-300 hover:text-slate-900"
          href="/clients"
        >
          ← Back to clients
        </Link>
      </div>

      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">{client.name}</div>
          <h1 className="page-title">Client workspace</h1>
          <p className="page-subtitle">
            Manage the query panel this team will use to benchmark OpenAI and Claude. When ready,
            launch a run to score visibility and share-of-voice for this client.
          </p>
          {client.primaryGeo && (
            <p className="text-sm text-slate-500">
              Primary market: {client.primaryGeo}
            </p>
          )}
        </div>

        <form action={runClientAction} className="flex flex-col items-start gap-3 md:items-end">
          <input name="clientId" type="hidden" value={client.id} />
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Domains: {client.domains.join(', ')}
          </span>
          <button
            className="inline-flex items-center justify-center rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            disabled={client.queries.length === 0}
            type="submit"
          >
            Run OpenAI + Claude crawl
          </button>
        </form>
      </header>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 font-medium text-slate-600 transition hover:border-neutral-300 hover:text-slate-900"
          href={{ pathname: '/', query: { clientId: client.id } } as any}
        >
          View insights dashboard
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 font-medium text-slate-600 transition hover:border-neutral-300 hover:text-slate-900"
          href={{ pathname: '/queries', query: { clientId: client.id } } as any}
        >
          Open query analysis
        </Link>
        <Link
          className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-4 py-2 font-medium text-slate-600 transition hover:border-neutral-300 hover:text-slate-900"
          href={{ pathname: '/runs', query: { clientId: client.id } } as any}
        >
          See run history
        </Link>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric">
          <span className="metric-label">Avg. visibility score</span>
          <span className="metric-value">{runs.length ? averageScore.toFixed(1) : '—'}</span>
          <p className="text-sm text-slate-500">Blended score across recent OpenAI + Claude crawls.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Share of voice</span>
          <span className="metric-value">{runs.length ? `${averageVisibility.toFixed(1)}%` : '—'}</span>
          <p className="text-sm text-slate-500">Average visibility percentage for this client.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Last synced</span>
          <span className="metric-value">
            {lastTouchpoint ? formatDistanceToNow(lastTouchpoint, { addSuffix: true }) : '—'}
          </span>
          <p className="text-sm text-slate-500">Most recent completion across tracked surfaces.</p>
        </div>
      </section>

      <div className="card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Latest runs</h2>
            <p className="text-sm text-slate-500">Snapshot of recent OpenAI and Claude crawls.</p>
          </div>
          <Link className="inline-link" href={{ pathname: '/runs', query: { clientId: client.id } } as any}>
            View full history
          </Link>
        </div>

        <div className="mt-6 space-y-3">
          {runs.length === 0 && (
            <div className="empty-state">
              <strong className="text-sm text-slate-600">No runs yet</strong>
              <span>Launch a crawl to populate visibility metrics for this client.</span>
            </div>
          )}

          {runs.map((run) => (
            <div
              key={run.runId}
              className="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white/90 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {run.surface.toUpperCase()} · {run.modelName}
                </p>
                <p className="text-xs text-slate-500">
                  Updated {formatTimestamp(run.finishedAt ?? run.startedAt)}
                </p>
              </div>
              <div className="flex flex-col items-start gap-1 text-right sm:items-end">
                <span className="text-sm font-semibold text-slate-900">Score {run.overallScore.toFixed(1)}</span>
                <span className="text-xs text-slate-500">Visibility {run.visibilityPct.toFixed(1)}%</span>
                <Link className="inline-link" href={`/runs/${run.runId}?clientId=${client.id}`}>
                  View detail
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Tracked queries</h2>
              <p className="text-sm text-slate-500">
                These prompts power the LLM crawl. Keep a balance across branded, local, and
                category intents.
              </p>
            </div>
            <Link className="inline-link" href={{ pathname: '/queries', query: { clientId: client.id } } as any}>
              View latest results
            </Link>
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
            Capture prompts your prospects might ask (e.g. “pet-friendly apartments in Costa
            Mesa”).
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
      </div>
    </section>
  );
}

