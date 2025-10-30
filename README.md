# GeoTool (LLM SERP Tracker)

GeoTool tracks how large language models surface your brand across geo-targeted queries. It orchestrates OpenAI and Claude searches, evaluates grounded answers, and exposes run results through a worker CLI and a Next.js dashboard.

## Highlights
- Weekly or on-demand GEO runs across OpenAI and Claude surfaces with deterministic settings.
- Typed connectors, evaluator, and scoring logic shared via the `@geo/core` workspace package.
- Prisma-backed database (`@geo/db`) with migrations, seed data, and reporting helpers.
- Next.js dashboard (`apps/web`) for scorecards, query tables, and run drill-downs.
- Worker CLI (`apps/worker`) to orchestrate runs, generate reports, and schedule jobs.

## Monorepo Layout

```
.
├─ apps/
│  ├─ web/        # Next.js dashboard
│  └─ worker/     # Run orchestrator CLI + scheduler
├─ packages/
│  ├─ core/       # Connectors, evaluator, scoring
│  └─ db/         # Prisma schema, migrations, data services
├─ seed/          # Example clients and query panels
├─ implementation.md
└─ package.json   # Root scripts and workspace config
```

## Prerequisites
- Node.js 20+
- pnpm 9+
- PostgreSQL database (Supabase works out of the box)
- API keys for OpenAI and Anthropic

## Setup
1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Create a `.env` file at the repository root and provide the following variables (see `implementation.md` for defaults):
   ```bash
   OPENAI_API_KEY=...
   ANTHROPIC_API_KEY=...
   DATABASE_URL=postgresql://...
   RUN_DEFAULT_BATCH=40
   RUN_SEED=42
   TEMPERATURE=0
   TOP_P=1
   OPENAI_MODEL=gpt-4o-mini
   ANTHROPIC_MODEL=claude-3-haiku-20240307
   ```
3. Prepare the database:
   ```bash
   pnpm --filter @geo/db prisma migrate deploy
   pnpm seed
   ```

## Common Commands
- `pnpm dev` – Launch the Next.js dashboard on localhost.
- `pnpm run:once` – Execute a one-off run via the worker CLI.
- `pnpm --filter worker report` – Generate a Markdown/HTML report for a given run.
- `pnpm build` – Build all workspace packages.
- `pnpm lint` / `pnpm test` – Run linting and tests across the monorepo.

## Worker CLI
Run orchestrations from the `apps/worker` package:

```bash
pnpm --filter worker run once -- --client <clientId> --surfaces openai,claude --limit 40
pnpm --filter worker schedule
pnpm --filter worker report -- --run <runId>
```

The CLI loads configuration via `@geo/core` and persists results with `@geo/db`.

## Dashboard
Start the dashboard locally:

```bash
pnpm dev
```

The app fetches run summaries, query scores, and answer details via the database services. Tailwind CSS and SWR power the UI.

## Database & Seeding
- Prisma schema and migrations live in `packages/db/prisma`.
- Example client + query panel lives under `seed/`.
- Run `pnpm seed` to load the demo data once your database connection is configured.

## Testing & Quality
- Vitest powers unit tests (`pnpm test`).
- ESLint + Prettier enforce formatting (`pnpm lint`, `pnpm format`).
- Deterministic config defaults (seed, temperature, top_p) support reproducible runs.

## Roadmap
The `implementation.md` file captures the staged plan for building out connectors, evaluator, dashboard features, reporting, and scheduling. Use it as the source of truth for next milestones.

## Contributing
1. Fork and clone the repository.
2. Create a branch for your change.
3. Run linting/tests before opening a pull request.
4. Document any new environment variables or migrations.

## License
This project does not yet specify a license. Open an issue if you require one for your use case.



