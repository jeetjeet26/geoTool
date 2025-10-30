-- Initial schema for LLM SERP Tracker

create extension if not exists pgcrypto;

do $$
begin
  create type surface_enum as enum ('openai', 'claude');
exception when duplicate_object then null;
end
$$;

do $$
begin
  create type query_type_enum as enum ('branded','category','comparison','local','faq');
exception when duplicate_object then null;
end
$$;

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domains text[] not null default '{}',
  competitors text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists queries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  text text not null,
  type query_type_enum not null,
  geo text,
  weight numeric default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  raw_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_answers_run_query on answers(run_id, query_id);

create table if not exists citations (
  id uuid primary key default gen_random_uuid(),
  answer_id uuid not null references answers(id) on delete cascade,
  url text not null,
  domain text not null,
  is_brand_domain boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_citations_domain on citations(domain);

create table if not exists scores (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  overall_score numeric not null,
  visibility_pct numeric not null,
  details jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_scores_run on scores(run_id);
