import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

import { getLatestRunSummaries, listClients } from '@geo/db';

function formatTimestamp(value: Date | null | undefined) {
  if (!value) return 'In progress';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value);
}

function formatSurface(surface: string) {
  return surface.charAt(0).toUpperCase() + surface.slice(1);
}

export default async function HomePage({
  searchParams
}: {
  searchParams?: { clientId?: string };
}) {
  const clients = await listClients();
  const defaultClientId = clients[0]?.id ?? null;
  const selectedClientId = searchParams?.clientId ?? defaultClientId;
  const client = clients.find((item) => item.id === selectedClientId) ?? (defaultClientId ? clients[0] : null);
  const runs = selectedClientId ? await getLatestRunSummaries(selectedClientId) : [];

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
  const surfacesTracked = new Set(runs.map((run) => run.surface)).size;

  if (!client) {
    return (
      <section className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="empty-state">
          <strong className="text-sm text-slate-600">No clients yet</strong>
          <span>Add your first multifamily client to generate tailored queries and run crawls.</span>
          <Link
            className="inline-flex items-center justify-center rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand-bold"
            href="/clients"
          >
            Create client workspace
          </Link>
        </div>
      </section>
    );
  }

  const clientQuery = { clientId: client.id } as const;

  return (
    <section className="flex flex-1 flex-col gap-10">
      <header className="page-header">
        <div className="space-y-3">
          <div className="badge">Client overview</div>
          <h1 className="page-title">{client.name} visibility command center</h1>
          <p className="page-subtitle">
            Run LLM SERP checks, compare performance across surfaces, and turn insights into
            client-ready talking points in minutes.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 md:items-end">
          <span className="rounded-full bg-white/80 px-4 py-1 text-sm text-slate-600">
            {lastTouchpoint
              ? `Last synced ${formatDistanceToNow(lastTouchpoint, { addSuffix: true })}`
              : 'No runs recorded yet'}
          </span>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              className="inline-flex items-center justify-center rounded-full border border-neutral-200 px-5 py-2 text-sm font-medium text-slate-700 transition hover:border-neutral-300 hover:text-slate-900"
              href={{ pathname: '/queries', query: clientQuery } as any}
            >
              Deep-dive queries
            </Link>
            <Link
              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-neutral-800"
              href={{ pathname: '/runs', query: clientQuery } as any}
            >
              Generate report
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="metric">
          <span className="metric-label">Avg. visibility score</span>
          <span className="metric-value">{runs.length ? averageScore.toFixed(1) : '—'}</span>
          <p className="text-sm text-slate-500">A blended score across each tracked LLM surface.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Share of voice</span>
          <span className="metric-value">{runs.length ? `${averageVisibility.toFixed(1)}%` : '—'}</span>
          <p className="text-sm text-slate-500">Average visibility percentage based on the latest crawl.</p>
        </div>
        <div className="metric">
          <span className="metric-label">Surfaces monitored</span>
          <span className="metric-value">{surfacesTracked}</span>
          <p className="text-sm text-slate-500">OpenAI, Claude, and any additional LLMs onboarded for the client.</p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        <div className="card">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Latest surface performance</h2>
              <p className="text-sm text-slate-500">
                Compare models, visibility, and completeness before delivering your update.
              </p>
            </div>
            <Link className="inline-link" href={{ pathname: '/runs', query: clientQuery } as any}>
              View full history
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {runs.length === 0 && (
              <div className="empty-state">
                <strong className="text-sm text-slate-600">No runs yet</strong>
                <span>
                  Kick off your first crawl from the Clients workspace to start tracking LLM visibility for this client.
                </span>
              </div>
            )}

            {runs.map((run) => (
              <div
                key={run.runId}
                className="flex flex-col gap-4 rounded-2xl border border-neutral-200 bg-white/90 p-5 transition hover:border-neutral-300 hover:shadow-card sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-3">
                  <div className="surface-chip">
                    <span className="h-2 w-2 rounded-full bg-brand" aria-hidden />
                    {formatSurface(run.surface)}
                    <span className="text-xs text-slate-400">{run.modelName}</span>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-3xl font-semibold text-slate-900">{run.overallScore.toFixed(1)}</span>
                    <span className="text-sm text-slate-500">visibility score</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Updated {formatTimestamp(run.finishedAt ?? run.startedAt)} • Share of voice {run.visibilityPct.toFixed(1)}%
                  </p>
                </div>

                <div className="flex flex-col items-start gap-3 sm:items-end">
                  <span className="rounded-full bg-brand-subtle px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand">
                    {run.finishedAt ? 'Completed' : 'In progress'}
                  </span>
                  <Link className="inline-link" href={`/runs/${run.runId}?clientId=${client.id}`}>
                    View run detail
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="card">
            <h2 className="text-base font-semibold text-slate-900">Team workflow</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>
                <strong className="text-slate-900">1. Review top surfaces.</strong> Confirm visibility scores and ensure coverage trends match the client narrative.
              </li>
              <li>
                <strong className="text-slate-900">2. Audit flagged queries.</strong> Jump into the query workspace to annotate wins, risks, and missing citations.
              </li>
              <li>
                <strong className="text-slate-900">3. Package the story.</strong> Export highlights into your deck or recap email with evidence from the run detail pages.
              </li>
            </ul>
          </div>

          <div className="card">
            <h2 className="text-base font-semibold text-slate-900">Reporting shortcuts</h2>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>
                • Use <span className="font-medium text-slate-900">Run history</span> for trend charts and cadence planning.
              </p>
              <p>
                • Capture <span className="font-medium text-slate-900">query-level context</span> directly in the workspace before presenting.
              </p>
              <p>
                • Pair visibility % with <span className="font-medium text-slate-900">client KPIs</span> to translate LLM rankings into business outcomes.
              </p>
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
