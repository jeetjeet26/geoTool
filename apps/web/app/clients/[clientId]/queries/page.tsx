import Link from 'next/link';
import { notFound } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { formatDistanceToNow } from 'date-fns';

import type { Surface } from '@geo/core';
import {
  createClientQuery,
  deleteClientQuery,
  getClientWithQueries,
  getLatestRunDetailWithDiff,
  createQueryAnnotation,
  updateQueryAnnotation,
  deleteQueryAnnotation,
  addAnnotationEvidence,
  deleteAnnotationEvidence,
  type QueryAnnotationTag
} from '@geo/db';
import FilteredQueriesTable from '../../../../components/filtered-queries-table';
import ActionBar from '../../../../components/action-bar';
import EmptyState from '../../../../components/empty-state';

type QueryTypeValue = Parameters<typeof createClientQuery>[0]['type'];

const QUERY_TYPES = [
  { value: 'branded', label: 'Branded' },
  { value: 'category', label: 'Category' },
  { value: 'comparison', label: 'Comparison' },
  { value: 'local', label: 'Local' },
  { value: 'faq', label: 'FAQ' }
] as const satisfies ReadonlyArray<{ value: QueryTypeValue; label: string }>;

const SURFACES: Surface[] = ['openai', 'claude'];

const ANNOTATION_TAGS = [
  {
    value: 'win',
    label: 'Win',
    description: 'Highlight LLM answers that overdeliver or nail the storyline.'
  },
  {
    value: 'risk',
    label: 'Risk',
    description: 'Call out problematic answers that could confuse prospects.'
  },
  {
    value: 'gap',
    label: 'Gap',
    description: 'Document missing information you want the team to fill next run.'
  },
  {
    value: 'missing_citation',
    label: 'Missing citation',
    description: 'Flag responses without a trustworthy source or link.'
  },
  {
    value: 'visibility',
    label: 'Visibility watch',
    description: 'Track queries where the brand is present but needs higher prominence.'
  },
  {
    value: 'competitor',
    label: 'Competitor mention',
    description: 'Note when competitor positioning takes the spotlight.'
  }
] as const satisfies ReadonlyArray<{
  value: QueryAnnotationTag;
  label: string;
  description: string;
}>;

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

function parseTagValues(values: FormDataEntryValue[]): QueryAnnotationTag[] {
  const allowed = new Set(ANNOTATION_TAGS.map((tag) => tag.value));
  return Array.from(
    new Set(
      values
        .map((value) => value.toString())
        .filter((value): value is QueryAnnotationTag => allowed.has(value as QueryAnnotationTag))
    )
  );
}

async function createAnnotationAction(formData: FormData) {
  'use server';

  const clientId = formData.get('clientId')?.toString();
  const queryId = formData.get('queryId')?.toString();
  const surfaceValue = formData.get('surface')?.toString();
  const runIdValue = formData.get('runId')?.toString();
  const note = formData.get('note')?.toString() ?? null;
  const evidenceLabel = formData.get('evidenceLabel')?.toString();
  const evidenceUrl = formData.get('evidenceUrl')?.toString();
  const evidenceExcerpt = formData.get('evidenceExcerpt')?.toString();
  const tags = parseTagValues(formData.getAll('tags'));

  if (!clientId || !queryId) {
    throw new Error('Missing client or query identifier');
  }

  const surface = SURFACES.includes(surfaceValue as Surface) ? (surfaceValue as Surface) : undefined;
  const runId = runIdValue && runIdValue.length > 0 ? runIdValue : undefined;

  await createQueryAnnotation({
    clientId,
    queryId,
    surface,
    runId,
    tags,
    note,
    evidence:
      evidenceLabel && evidenceLabel.length > 0
        ? [
            {
              label: evidenceLabel,
              url: evidenceUrl && evidenceUrl.length > 0 ? evidenceUrl : null,
              excerpt: evidenceExcerpt && evidenceExcerpt.length > 0 ? evidenceExcerpt : null
            }
          ]
        : undefined
  });

  revalidatePath(`/clients/${clientId}/queries`);
  revalidatePath(`/clients/${clientId}`);
}

async function updateAnnotationAction(formData: FormData) {
  'use server';

  const annotationId = formData.get('annotationId')?.toString();
  const clientId = formData.get('clientId')?.toString();
  const runIdValue = formData.get('runId')?.toString();
  const surfaceValue = formData.get('surface')?.toString();
  const note = formData.get('note')?.toString() ?? null;
  const tags = parseTagValues(formData.getAll('tags'));

  if (!annotationId || !clientId) {
    throw new Error('Missing annotation identifier');
  }

  const surface = surfaceValue ? (surfaceValue as Surface) : undefined;
  const runId = runIdValue && runIdValue.length > 0 ? runIdValue : undefined;

  await updateQueryAnnotation({
    annotationId,
    tags,
    note,
    runId,
    surface
  });

  revalidatePath(`/clients/${clientId}/queries`);
  revalidatePath(`/clients/${clientId}`);
}

async function deleteAnnotationAction(formData: FormData) {
  'use server';

  const annotationId = formData.get('annotationId')?.toString();
  const clientId = formData.get('clientId')?.toString();

  if (!annotationId || !clientId) {
    throw new Error('Missing annotation identifier');
  }

  await deleteQueryAnnotation(annotationId);
  revalidatePath(`/clients/${clientId}/queries`);
  revalidatePath(`/clients/${clientId}`);
}

async function addEvidenceAction(formData: FormData) {
  'use server';

  const annotationId = formData.get('annotationId')?.toString();
  const clientId = formData.get('clientId')?.toString();
  const label = formData.get('label')?.toString();
  const url = formData.get('url')?.toString();
  const excerpt = formData.get('excerpt')?.toString();

  if (!annotationId || !clientId || !label) {
    throw new Error('Missing annotation evidence fields');
  }

  await addAnnotationEvidence({
    annotationId,
    label,
    url: url && url.length > 0 ? url : null,
    excerpt: excerpt && excerpt.length > 0 ? excerpt : null
  });

  revalidatePath(`/clients/${clientId}/queries`);
}

async function deleteEvidenceAction(formData: FormData) {
  'use server';

  const evidenceId = formData.get('evidenceId')?.toString();
  const clientId = formData.get('clientId')?.toString();

  if (!evidenceId || !clientId) {
    throw new Error('Missing evidence identifier');
  }

  await deleteAnnotationEvidence(evidenceId);
  revalidatePath(`/clients/${clientId}/queries`);
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

  const annotationLabelMap = new Map(ANNOTATION_TAGS.map((tag) => [tag.value, tag.label]));
  const annotationsByQuery = Object.fromEntries(
    client.queries.map((query) => [
      query.id,
      query.annotations.map((annotation) => ({
        id: annotation.id,
        tags: annotation.tags.map((tag) => annotationLabelMap.get(tag) ?? tag),
        note: annotation.note,
        updatedAt: annotation.updatedAt.toISOString()
      }))
    ])
  );

  const annotationLog = client.queries
    .flatMap((query) =>
      query.annotations.map((annotation) => ({
        queryId: query.id,
        queryText: query.text,
        annotation,
        displayTags: annotation.tags.map((tag) => annotationLabelMap.get(tag) ?? tag)
      }))
    )
    .sort((a, b) => b.annotation.updatedAt.getTime() - a.annotation.updatedAt.getTime());

  const defaultAnnotationQueryId = client.queries[0]?.id ?? '';

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
        </div>
      </header>

      <ActionBar clientId={client.id} page="queries" latestRunId={runDetail?.run.runId} />

      {!runDetail && (
        <EmptyState
          title={`No runs for ${formatSurface(surface)} yet`}
          message="Launch a crawl to populate the query table and unlock comparison deltas."
          icon="📊"
        />
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
              <FilteredQueriesTable queries={runDetail.queries} annotations={annotationsByQuery} />

              <div className="card" id="add-query">
                <details className="group">
                  <summary className="cursor-pointer list-none text-base font-semibold text-slate-900">
                    <span className="flex items-center gap-2">
                      Log annotation
                      <span className="text-xs font-normal text-slate-500">
                        ({Object.keys(annotationsByQuery).filter((id) => (annotationsByQuery[id]?.length ?? 0) > 0).length} queries with notes)
                      </span>
                    </span>
                  </summary>
                  <div className="mt-4">
                    <p className="text-sm text-slate-500">
                      Turn workspace discoveries into tracked wins, risks, and follow-ups for future runs.
                    </p>

                <form action={createAnnotationAction} className="mt-4 flex flex-col gap-4 text-sm text-slate-700">
                  <input type="hidden" name="clientId" value={client.id} />
                  <input type="hidden" name="surface" value={surface} />
                  <input type="hidden" name="runId" value={runDetail.run.runId} />

                  <label className="flex flex-col gap-2 font-medium">
                    Query
                    <select
                      className="rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                      name="queryId"
                      defaultValue={defaultAnnotationQueryId}
                      required
                    >
                      {client.queries.map((query) => (
                        <option key={query.id} value={query.id}>
                          {query.text}
                        </option>
                      ))}
                    </select>
                  </label>

                  <fieldset className="space-y-2 rounded-xl border border-neutral-200 bg-white/70 p-4">
                    <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</legend>
                    <div className="grid gap-3 md:grid-cols-2">
                      {ANNOTATION_TAGS.map((tag) => (
                        <label key={tag.value} className="flex items-start gap-2 text-sm leading-5 text-slate-700">
                          <input className="mt-1" name="tags" type="checkbox" value={tag.value} />
                          <span>
                            <span className="font-semibold text-slate-900">{tag.label}</span>
                            <br />
                            <span className="text-xs text-slate-500">{tag.description}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label className="flex flex-col gap-2 font-medium">
                    Notes
                    <textarea
                      className="min-h-[96px] rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                      name="note"
                      placeholder="Summarize what happened, why it matters, and suggested follow-up."
                    />
                  </label>

                  <details className="group rounded-xl border border-dashed border-neutral-200 bg-white/50 p-4">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-700 transition group-open:text-slate-900">
                      Attach evidence (optional)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <label className="flex flex-col gap-2 font-medium">
                        Label
                        <input
                          className="rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                          name="evidenceLabel"
                          placeholder="e.g. Screenshot: Claude missing brand site"
                        />
                      </label>
                      <label className="flex flex-col gap-2 font-medium">
                        URL
                        <input
                          className="rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                          name="evidenceUrl"
                          type="url"
                          placeholder="https://..."
                        />
                      </label>
                      <label className="flex flex-col gap-2 font-medium">
                        Excerpt
                        <textarea
                          className="min-h-[72px] rounded-xl border border-neutral-200 bg-white/80 px-3 py-2 text-sm shadow-sm transition focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/40"
                          name="evidenceExcerpt"
                          placeholder="Optional snippet or transcript from the LLM response."
                        />
                      </label>
                    </div>
                  </details>

                  <button
                    className="inline-flex items-center justify-center self-start rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-card transition hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    type="submit"
                  >
                    Save annotation
                  </button>
                </form>
                  </div>
                </details>
              </div>
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

              <div className="card">
                <h2 className="text-base font-semibold text-slate-900">Annotation activity</h2>
                <p className="mt-2 text-sm text-slate-500">
                  Review and refine notes before packaging your recap deck or client email.
                </p>

                <div className="mt-4 space-y-4">
                  {annotationLog.length === 0 && <p className="text-sm text-slate-500">No annotations recorded yet.</p>}

                  {annotationLog.map(({ queryId, queryText, annotation, displayTags }) => (
                    <details key={annotation.id} className="rounded-xl border border-neutral-200 bg-white/70 p-4 text-sm text-slate-700">
                      <summary className="cursor-pointer list-none font-semibold text-slate-900">
                        {displayTags.join(', ') || 'Annotation'} · {queryText}
                        <span className="ml-2 text-xs text-slate-500">
                          Updated {formatDistanceToNow(annotation.updatedAt, { addSuffix: true })}
                        </span>
                      </summary>

                      <div className="mt-4 space-y-3">
                        <form action={updateAnnotationAction} className="flex flex-col gap-3">
                          <input type="hidden" name="clientId" value={client.id} />
                          <input type="hidden" name="annotationId" value={annotation.id} />
                          <input type="hidden" name="runId" value={annotation.runId ?? ''} />
                          <input type="hidden" name="surface" value={annotation.surface ?? ''} />

                          <fieldset className="space-y-2 rounded-lg border border-neutral-200 bg-white/80 p-3">
                            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Tags</legend>
                            <div className="grid gap-2 md:grid-cols-2">
                              {ANNOTATION_TAGS.map((tag) => (
                                <label key={tag.value} className="flex items-start gap-2 text-xs leading-5">
                                  <input
                                    className="mt-1"
                                    name="tags"
                                    type="checkbox"
                                    value={tag.value}
                                    defaultChecked={annotation.tags.includes(tag.value)}
                                  />
                                  <span className="text-slate-600">{tag.label}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>

                          <label className="flex flex-col gap-2 font-medium">
                            Notes
                            <textarea
                              className="min-h-[80px] rounded-lg border border-neutral-200 bg-white/80 px-3 py-2 text-sm shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                              name="note"
                              defaultValue={annotation.note ?? ''}
                            />
                          </label>

                          <div className="flex flex-wrap gap-3">
                            <button
                              className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white shadow-card transition hover:bg-neutral-800"
                              type="submit"
                            >
                              Update
                            </button>

                            <button
                              className="rounded-full border border-rose-100 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-600 transition hover:border-rose-200 hover:text-rose-700"
                              formAction={deleteAnnotationAction}
                              type="submit"
                            >
                              Remove
                            </button>
                          </div>
                        </form>

                        <div className="rounded-lg border border-dashed border-neutral-200 bg-white/60 p-3 text-xs">
                          <h3 className="mb-2 font-semibold text-slate-900">Evidence</h3>
                          <ul className="space-y-2">
                            {annotation.evidence.length === 0 && <li className="text-slate-500">No attachments.</li>}
                            {annotation.evidence.map((item) => (
                              <li key={item.id} className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="font-semibold text-slate-800">{item.label}</p>
                                  {item.url && (
                                    <Link className="inline-link text-xs" href={item.url} target="_blank">
                                      Open source
                                    </Link>
                                  )}
                                  {item.excerpt && <p className="text-slate-600">{item.excerpt}</p>}
                                </div>
                                <form action={deleteEvidenceAction} className="shrink-0">
                                  <input type="hidden" name="clientId" value={client.id} />
                                  <input type="hidden" name="evidenceId" value={item.id} />
                                  <button
                                    className="rounded-full border border-rose-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600 transition hover:border-rose-200 hover:text-rose-700"
                                    type="submit"
                                  >
                                    Delete
                                  </button>
                                </form>
                              </li>
                            ))}
                          </ul>

                          <form action={addEvidenceAction} className="mt-3 flex flex-col gap-2">
                            <input type="hidden" name="clientId" value={client.id} />
                            <input type="hidden" name="annotationId" value={annotation.id} />
                            <label className="flex flex-col gap-1 font-medium">
                              Label
                              <input
                                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                                name="label"
                                placeholder="Screenshot title"
                                required
                              />
                            </label>
                            <label className="flex flex-col gap-1 font-medium">
                              URL
                              <input
                                className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                                name="url"
                                type="url"
                                placeholder="https://..."
                              />
                            </label>
                            <label className="flex flex-col gap-1 font-medium">
                              Excerpt
                              <textarea
                                className="min-h-[60px] rounded-md border border-neutral-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
                                name="excerpt"
                              />
                            </label>
                            <button
                              className="self-start rounded-full bg-brand-subtle px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand transition hover:bg-brand/10"
                              type="submit"
                            >
                              Add evidence
                            </button>
                          </form>
                        </div>
                      </div>
                    </details>
                  ))}
                </div>
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

