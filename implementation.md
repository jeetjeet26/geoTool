## LLM SERP Tracker (MVP) — Implementation Plan (OpenAI + Claude only)

This plan turns the conversation in `plan.md` into a concrete, step‑by‑step build for a shippable MVP that tracks brand visibility across two LLM “surfaces”: OpenAI and Claude. It mirrors classic rank tracking: fixed query panel → grounded answers → scoring → dashboard → report.

### Scope
- **In-scope**: OpenAI Responses API (with web search + structured outputs), Claude Messages API (with tool use + web search), Postgres/Supabase storage, evaluator + scoring, minimal dashboard, weekly scheduler, report export.
- **Out-of-scope (V1)**: Google AIO, Perplexity, Copilot UI scraping, enterprise SSO, advanced multi-tenant billing, complex permissions.

### Outcomes
- A weekly “LLM SERP” monitor producing: Presence, LLM Rank, Link Rank, SOV, Flags, and a 0–100 score per query × model, with an overall scorecard, diffs, and recommended actions.

### Non-goals
- We are not “increasing” LLM memory. We measure grounded outputs and recommend content/technical actions that affect what models cite.

## Architecture Overview
- **Frontend**: Next.js app for scorecards, query table, run diffs, answer previews.
- **Backend**: Node/TypeScript services: connectors (OpenAI, Claude), evaluator/scorer, orchestrator jobs.
- **Storage**: Postgres (Supabase recommended). Raw payloads kept as JSONB; computed fields stored in normalized tables.
- **Scheduling**: Weekly cron (Vercel/Next Cron or Supabase cron). Manual “Run now” trigger.
- **Config**: `.env` with API keys and run controls.

## Definitions
- **Surface**: One model/provider we benchmark, here `openai` and `claude`.
- **LLM Rank**: Ordinal position of the brand in the ordered entities block (1 = lead mention).
- **Link Rank**: Position of first citation/link pointing to any of the client’s domains.
- **SOV**: Share of Voice = brand-domain citation count ÷ all citations in the answer.

## Scoring (from plan.md)
`LLM_SERP_SCORE = 45% Position + 25% Link Rank + 20% SOV + 10% Accuracy/Safety (no flags)`
- Visibility = % queries with presence.
- Optional: Impression-weighted visibility using SEO volumes.

## Step-by-step Execution Plan

### 1) Repository bootstrap
- Initialize Node 20+ TypeScript project with pnpm.
- Create workspace structure:
  - `apps/web` (Next.js)
  - `apps/worker` (CLI/job runner for local runs)
  - `packages/core` (connectors, evaluator, scoring)
  - `packages/db` (Prisma schema + migrations) or `sql` if applying raw SQL
- Add linting/formatting and a simple Makefile/NPM scripts to run common tasks.

Acceptance criteria
- Repo runs `pnpm dev` for web, `pnpm ts-node apps/worker/src/run.ts` locally.

### 2) Environment & configuration
- Define `.env` keys: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `RUN_DEFAULT_BATCH=40`, `RUN_SEED=42`, `TEMPERATURE=0`, `TOP_P=1`.
- Add safe config loader (`zod`-validated) in `packages/core/config.ts`.

Acceptance criteria
- App fails fast with descriptive errors if required envs are missing.

### 3) Database schema & migrations
- Create minimal tables (see Appendix A for SQL):
  - `clients(id, name, domains text[], competitors text[])`
  - `queries(id, client_id, text, type, geo, weight)`
  - `runs(id, client_id, surface, model_name, started_at, finished_at)`
  - `answers(id, run_id, query_id, presence, llm_rank, link_rank, sov, flags jsonb, raw_json jsonb)`
  - `citations(id, answer_id, url, domain, is_brand_domain)`
  - `scores(id, run_id, overall_score, visibility_pct)`
- Add helpful indexes (client lookups, domains, run/date).

Acceptance criteria
- Migrations apply cleanly on Supabase or local Postgres. CRUD works via Prisma or SQL.

### 4) Seed data & query panel generator
- Create `seed/clients.example.json` and `seed/queries.example.yaml` (see Appendix C).
- Build a panel generator using client metadata: branded, category, comparisons, local, FAQs (40–80 total). Tag each query with `type`, `geo`, `weight`.

Acceptance criteria
- `pnpm seed` inserts a client and a 40+ query panel with correct tags.

### 5) Shared types and validators
- Define `AnswerBlock` TypeScript type and JSON Schema (Appendix B) shared by both connectors.
- Implement domain normalization helpers and brand-domain matching.

Acceptance criteria
- Type-safe parse of model responses into `AnswerBlock` with robust validation.

### 6) OpenAI connector (surface = openai)
- Use Responses API with web search enabled and Structured Outputs to request `AnswerBlock`.
- Prompting rules: never seed brand context; require citations; pin temperature/top_p/seed; reject ungrounded answers via `no_sources` flag.
- Persist raw JSON and parsed `AnswerBlock` per query.

Acceptance criteria
- For a test query set, connector returns validated `AnswerBlock` or an explicit “no_sources/no_results” flag.

### 7) Claude connector (surface = claude)
- Use Messages API with tool use + web search; require the same `AnswerBlock` shape.
- Mirror OpenAI prompting/controls; store raw + parsed.

Acceptance criteria
- Same as OpenAI: validated `AnswerBlock` or flagged no-sources path.

### 8) Evaluator & scorer
- Presence: detect brand mention via entity list and/or summary fallback.
- LLM Rank: position of brand’s first occurrence in `ordered_entities` (fallback to summary mention heuristic).
- Link Rank: first citation whose domain matches client domains.
- SOV: client-domain citations ÷ all citations.
- Flags: carry through `notes.flags` and add evaluator flags (nap_mismatch, conflicting_prices) using Client Truth Set (optional V1-lite: only domain/NAP checks).
- Compute per-query score and aggregate per run.

Acceptance criteria
- Deterministic scores for the same inputs; unit tests for edge cases (no citations, multiple brand domains, duplicate entities).

### 9) Orchestrator (run manager)
- Implement `run({ clientId, surfaces, queryLimit })` that:
  1. Creates a `runs` row per surface.
  2. Fans out queries (batched concurrency with rate limits).
  3. Invokes connectors → stores `answers` + `citations`.
  4. Invokes evaluator → stores `scores`.
  5. Marks run finished and emits summary.
- Add CLI: `pnpm run once --client <id> --surfaces openai,claude --limit 40`.

Acceptance criteria
- One command executes a full run across both surfaces and persists all artifacts.

### 10) Minimal dashboard (Next.js)
- Pages:
  - `/` Overall scorecard (per surface, overall), visibility, trends.
  - `/queries` Query table with Position, Link Rank, SOV, Flags, deltas.
  - `/runs/[id]` Drilldown: answer summary, ordered entities, citations, raw payload view.
- Keep server components simple; data fetched via REST/Next Route Handlers from the DB.

Acceptance criteria
- Loads last run, renders tables, supports filter by query type and surface.

### 11) Diffs & reporting
- Compute delta vs previous run per query and surface (presence gained/lost, rank up/down, link changes, SOV changes).
- Add `pnpm report --run <id>` to emit Markdown and HTML; optional PDF (Puppeteer) later.

Acceptance criteria
- Report contains Executive Summary, Scorecard, Top Wins/Losses, Fix-first recommendations, and an appendix with raw details.

### 12) Scheduler
- Add weekly cron (Vercel Cron or Supabase Cron) to call the orchestrator for each active client.
- Implement basic backoff/retry logging and alert on repeated failures.

Acceptance criteria
- Runs execute on schedule; failures are visible in logs with client/surface context.

### 13) QA, reproducibility, and telemetry
- Pin `temperature`, `top_p`, and seed (when supported); log model names and versions.
- Unit tests for evaluator and parser; integration tests for connectors (recorded fixtures).
- Telemetry: request counts, latency, failure types, token/cost estimates per surface.

Acceptance criteria
- CI runs tests; reproducibility within expected variance; telemetry dashboard table exists.

### 14) Security & costs
- Store only public data + derived analytics. Mask API keys in logs. Apply rate limits and concurrency caps.
- Implement per-run caps: max queries, max tokens, max duration; fail fast with clear status.

Acceptance criteria
- No secret leakage in logs; runs respect caps; cost estimates included in run summary.

### 15) Deployment
- Deploy web to Vercel (or equivalent). Point to Supabase DB. Configure cron.
- Provide `.env.example` and one-click seed script for demo.

Acceptance criteria
- Staging environment accessible with seeded demo client and working weekly schedule.

## Milestones & Deliverables
- M1 (Day 1–2): Repo, env, DB migrations, seed data.
- M2 (Day 3–4): Connectors (OpenAI, Claude) with validated `AnswerBlock` outputs.
- M3 (Day 5): Evaluator, scoring, run orchestrator CLI.
- M4 (Day 6): Minimal dashboard + diffs.
- M5 (Day 7): Scheduler + report export + QA pass.

## Acceptance Gates
1) A single CLI command executes a full run across both surfaces and stores: runs, answers, citations, scores.
2) Dashboard shows position, link rank, SOV, flags, with deltas vs previous run.
3) Weekly schedule triggers successfully; report generated with clear Fix-first recommendations.

---

## Appendix A — SQL (Postgres/Supabase)

```sql
-- Enable UUIDs (Supabase supports gen_random_uuid())
create extension if not exists pgcrypto;

-- Enums
do $$ begin
  create type surface_enum as enum ('openai', 'claude');
exception when duplicate_object then null; end $$;

do $$ begin
  create type query_type_enum as enum ('branded','category','comparison','local','faq');
exception when duplicate_object then null; end $$;

-- Tables
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domains text[] not null default '{}',
  competitors text[] not null default '{}'
);

create table if not exists queries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  text text not null,
  type query_type_enum not null,
  geo text,
  weight numeric default 1
);
create index if not exists idx_queries_client on queries(client_id);

create table if not exists runs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  surface surface_enum not null,
  model_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists idx_runs_client_started on runs(client_id, started_at desc);

create table if not exists answers (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  query_id uuid not null references queries(id) on delete cascade,
  presence boolean not null,
  llm_rank int,
  link_rank int,
  sov numeric,
  flags jsonb not null default '{}'::jsonb,
  raw_json jsonb not null
);
create index if not exists idx_answers_run_query on answers(run_id, query_id);

create table if not exists citations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references answers(id) on delete cascade,
  url text not null,
  domain text not null,
  is_brand_domain boolean not null default false
);
create index if not exists idx_citations_domain on citations(domain);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  overall_score numeric not null,
  visibility_pct numeric not null,
  details jsonb default '{}'::jsonb
);
create index if not exists idx_scores_run on scores(run_id);
```

## Appendix B — AnswerBlock JSON Schema (shared by OpenAI and Claude)

```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "title": "AnswerBlock",
  "type": "object",
  "required": ["ordered_entities", "citations", "answer_summary", "notes"],
  "properties": {
    "ordered_entities": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "domain", "rationale", "position"],
        "properties": {
          "name": { "type": "string" },
          "domain": { "type": "string" },
          "rationale": { "type": "string" },
          "position": { "type": "integer", "minimum": 1 }
        }
      }
    },
    "citations": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["url", "domain"],
        "properties": {
          "url": { "type": "string" },
          "domain": { "type": "string" },
          "entity_ref": { "type": "string" }
        }
      }
    },
    "answer_summary": { "type": "string" },
    "notes": {
      "type": "object",
      "properties": {
        "flags": {
          "type": "array",
          "items": {
            "type": "string",
            "enum": [
              "no_sources",
              "possible_hallucination",
              "outdated_info",
              "nap_mismatch",
              "conflicting_prices"
            ]
          }
        }
      }
    }
  }
}
```

## Appendix C — Sample client and queries seed

```yaml
# seed/queries.example.yaml
client: "Acme Dental"
domains: ["acmedental.com", "acme-dental.com"]
competitors: ["smileco.com", "dentistryplus.com"]
queries:
  - text: "who is Acme Dental"
    type: branded
    weight: 1
  - text: "is Acme Dental good for family dentistry"
    type: branded
    weight: 1
  - text: "best dentists in seattle"
    type: category
    geo: "seattle wa"
    weight: 1.5
  - text: "Acme Dental vs SmileCo"
    type: comparison
  - text: "dentist near capitol hill"
    type: local
  - text: "what is the price of teeth cleaning in seattle"
    type: faq
```

## Appendix D — Prompting outline (provider-agnostic)

System guidelines (both providers)
- You are evaluating public web information to answer the user’s query. Do not assume ungrounded facts. Prefer authoritative, current sources. Return the required JSON exactly matching the schema.

User message template
- “<query_text>”
- Requirements:
  - Run a web search.
  - Produce an ordered list of providers/brands (name + domain) with rationales.
  - Include citations/links for each when available.
  - Emit the AnswerBlock JSON only. If sources are missing, use `notes.flags = ["no_sources"]`.

Controls
- `temperature=0`, `top_p=1`, `seed=42` (or provider equivalent). Enforce max output tokens and strict JSON.

## Appendix E — Runbook
- To run locally:
  1) Set `.env` keys. 2) `pnpm i`. 3) Apply migrations. 4) `pnpm seed`. 5) `pnpm run once --client <id> --surfaces openai,claude --limit 40`.
- To view dashboard: `pnpm dev` in `apps/web` and open the local URL.
- To schedule: configure cron to call the orchestrator endpoint weekly.


