# PricePilot

A smart, installable **price watcher / finder**: load shopping & wish lists from
many vendors and maintain the best-possible price via server-side fetching and an
intelligence layer. See [`PLAN.md`](./PLAN.md) for the full product plan and
roadmap.

> **Status: Phase 0 — Scaffold.** This repo currently ships the monorepo skeleton:
> an installable React PWA shell, a Fastify API with a `/health` endpoint, shared
> zod schemas, a Prisma schema stub, local infra, CI, and a SessionStart hook.
> Importing, scraping, and alerts arrive in later phases.

## Why a backend exists

A PWA is browser JavaScript, and browsers block cross-origin `fetch` (CORS) to
vendor sites; large vendors also deploy anti-bot defenses. So all price-fetching
runs **server-side** — the PWA talks only to our own API. We **lead with
API-friendly vendors** (eBay, Best Buy, etc.). The **Amazon adapter is opt-in and
off-by-default** because Amazon's PA-API is deprecated/sales-gated and scraping it
violates their ToS; see [`PLAN.md`](./PLAN.md) for the risk note.

## Monorepo layout

```
apps/
  web/        React 19 + TS + Vite + vite-plugin-pwa  (installable PWA shell)
  api/        Fastify 5 + TS + zod                     (/health, REST/JSON API)
packages/
  shared/     zod schemas + shared TS types  (@pricepilot/shared)
  db/         Prisma schema stub + client     (@pricepilot/db, Postgres)
infra/        docker-compose (Postgres + Redis)
```

Later phases add `apps/worker` (Playwright + BullMQ), `packages/scrapers`
(vendor adapters), and `packages/intel` (matching, normalization, Claude).

## Prerequisites

- **Node 22+** and **pnpm 10** (`corepack enable` activates the pinned version)
- **Docker** (for local Postgres + Redis)

## Quickstart

```bash
# 1. Install workspace dependencies (also generates the Prisma client)
pnpm install

# 2. Start local Postgres + Redis
docker compose -f infra/docker-compose.yml up -d

# 3. Configure env (defaults already match docker-compose)
cp .env.example .env

# 4. Run web + api together
pnpm dev
```

- Web: <http://localhost:5173>
- API: <http://localhost:3001> (try <http://localhost:3001/health>)

### End-to-end health check (web ↔ api)

The web app calls `GET /health`, validates the response against the shared
`HealthResponse` zod schema, and renders a live status badge in the header
("API healthy" / "API unreachable"). The **About** page shows the full payload.
This is the Phase 0 proof that the two apps talk to each other.

## Scripts

Run from the repo root (fan out across the workspace via `pnpm -r`):

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `pnpm dev`         | Run all apps in dev (web + api)                       |
| `pnpm build`       | Build every package/app                               |
| `pnpm typecheck`   | Type-check every package/app                          |
| `pnpm lint`        | ESLint across the workspace                           |
| `pnpm test`        | Run unit tests (Vitest)                               |
| `pnpm db:generate` | Generate the Prisma client from `packages/db`         |
| `pnpm format`      | Prettier write                                        |

Target a single workspace with `--filter`, e.g.
`pnpm --filter @pricepilot/api dev`.

## CI & web sessions

- **CI** (`.github/workflows/ci.yml`) installs deps, generates the Prisma client,
  then runs lint → typecheck → test → build on every push and PR.
- **SessionStart hook** (`.claude/hooks/session-start.sh`) installs dependencies
  and generates the Prisma client so Claude Code web sessions land ready to
  build/test.

## Ethics & ToS

Server-side fetching respects `robots.txt`, applies per-domain rate limits with
jitter, caches responses, and sends an identifiable User-Agent. Prefer official
vendor APIs; treat scraping adapters as best-effort and isolate breakage to the
adapter. The Amazon adapter ships **disabled by default** — enabling it is your
choice and your risk.
