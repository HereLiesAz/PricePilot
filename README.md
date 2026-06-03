# PricePilot

A smart, installable **price watcher / finder**: load shopping & wish lists from
many vendors and maintain the best-possible price via server-side fetching and an
intelligence layer. See [`PLAN.md`](./PLAN.md) for the full product plan and
roadmap.

> **Status: Phase 1 — Core loop.** On top of the Phase 0 scaffold, the API now
> exposes list/item CRUD, a structured-data (JSON-LD / Open Graph) product
> extractor, CSV/JSON bulk import, and a manual price-refresh path that records
> price history. The web app has real list and list-detail views (create lists,
> add by URL or name, bulk import, refresh prices). Scheduled scraping, alerts,
> and cross-vendor matching arrive in later phases — see [`PLAN.md`](./PLAN.md).

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
  web/        React 19 + TS + Vite + vite-plugin-pwa  (installable PWA; lists UI)
  api/        Fastify 5 + TS + zod + Prisma            (/health, lists/items API)
packages/
  shared/     zod schemas + DTOs + shared TS types  (@pricepilot/shared)
  db/         Prisma schema + migrations + client    (@pricepilot/db, Postgres)
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

> First time only: apply the database schema with
> `pnpm --filter @pricepilot/db db:migrate` (dev) or `db:deploy` (prod/CI).

### End-to-end health check (web ↔ api)

The web app calls `GET /health`, validates the response against the shared
`HealthResponse` zod schema, and renders a live status badge in the header
("API healthy" / "API unreachable"). The **About** page shows the full payload.

## API (Phase 1)

The PWA talks only to our own API; all vendor fetching is server-side.

| Method & path                          | Purpose                                            |
| -------------------------------------- | -------------------------------------------------- |
| `GET /health`                          | Liveness + version (shared `HealthResponse`)       |
| `GET /api/lists`                       | List summaries (with item counts)                  |
| `POST /api/lists`                      | Create a list (`SHOPPING` \| `WISHLIST`)           |
| `GET /api/lists/:id`                   | List detail with items, products, and best offer   |
| `PATCH /api/lists/:id`                 | Rename / retype a list                             |
| `DELETE /api/lists/:id`                | Delete a list                                      |
| `POST /api/lists/:id/items`            | Add by `url` (extracted) or `title` (manual)       |
| `DELETE /api/lists/:id/items/:itemId`  | Remove an item                                     |
| `POST /api/lists/:id/import`           | Bulk import CSV/JSON rows                           |
| `POST /api/offers/:offerId/refresh`    | Re-extract an offer; append price history          |

Add-by-URL uses tier-2 **structured-data extraction** (JSON-LD `schema.org/Product`
+ `Offer`, falling back to Open Graph). Amazon URLs are rejected unless
`ENABLE_AMAZON_ADAPTER=true`. The Playwright and Claude-fallback tiers come later.

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

## Testing

- `pnpm test` runs Vitest across the workspace. Extractor and import-parser
  tests are pure/network-free. The API list/item integration tests need Postgres
  and are **skipped unless `DATABASE_URL` is set** — start
  `infra/docker-compose.yml`, apply migrations, then
  `DATABASE_URL=… pnpm --filter @pricepilot/api test`.

## CI & web sessions

- **CI** (`.github/workflows/ci.yml`) spins up a Postgres service, installs deps,
  applies migrations, then runs lint → typecheck → test → build on every push and
  PR — so the integration tests run in CI too.
- **SessionStart hook** (`.claude/hooks/session-start.sh`) installs dependencies
  and generates the Prisma client so Claude Code web sessions land ready to
  build/test.

## Ethics & ToS

Server-side fetching respects `robots.txt`, applies per-domain rate limits with
jitter, caches responses, and sends an identifiable User-Agent. Prefer official
vendor APIs; treat scraping adapters as best-effort and isolate breakage to the
adapter. The Amazon adapter ships **disabled by default** — enabling it is your
choice and your risk.
