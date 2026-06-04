# PricePilot

A smart, installable **price watcher / finder**: load shopping & wish lists from
many vendors and maintain the best-possible price via server-side fetching and an
intelligence layer. See [`PLAN.md`](./PLAN.md) for the full product plan and
roadmap.

> **Status: Phase 5 — Polish (roadmap complete).** Adds **wishlist import**
> (scrape product links from a list page), **price normalization** (landed
> price, currency conversion to a common base for best-offer selection, and
> per-unit pricing), an **offline indicator**, the **opt-in / off-by-default
> Amazon adapter**, and **deploy** Dockerfiles for the API and worker. This
> completes the PLAN.md roadmap (Phases 0–5).

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
  web/        React 19 + TS + Vite + vite-plugin-pwa  (installable PWA; lists UI + chart)
  api/        Fastify 5 + TS + zod + Prisma            (lists/items/history/alerts/push API)
  worker/     BullMQ + Redis watcher                   (adaptive scrape schedule + Web Push)
packages/
  shared/     zod schemas + DTOs + shared TS types  (@pricepilot/shared)
  db/         Prisma schema + migrations + client    (@pricepilot/db, Postgres)
  scrapers/   tiered vendor-adapter interface + adapters  (@pricepilot/scrapers)
  intel/      matching, deal scoring, Claude extraction/match  (@pricepilot/intel)
infra/        docker-compose (Postgres + Redis)
```

`packages/intel` holds the pure heuristics (title normalization + Sørensen–Dice
matching, deal scoring) plus the Claude-backed extraction fallback and match
tie-break (prompt-cached, structured tool output; gated on `ANTHROPIC_API_KEY`).

### Watcher (`apps/worker`)

A BullMQ worker drives the price watch. A scheduler tick enqueues offers whose
`ScrapeJob` is due; each job re-extracts via `packages/scrapers`, appends a
`PriceHistory` point, evaluates each tracked item's **alerts**, and reschedules
with an **adaptive cadence** (near-target/volatile → hours; stable → daily;
failures → exponential backoff). Triggered alerts are delivered as **Web Push**
notifications (VAPID), so they arrive even when the app is closed.

Run it with `pnpm --filter @pricepilot/worker dev` (needs Redis + Postgres, and
`VAPID_*` keys for push — `npx web-push generate-vapid-keys`).

### Vendor adapters (`packages/scrapers`)

Each adapter declares a **tier**; the registry prefers the cleanest, ToS-safe
option that can handle a URL:

1. **Official API** — `ebay`, `bestbuy` (used when their credentials are set).
2. **Structured data** — universal HTTP + JSON-LD/Open Graph fallback.
3. **Headless** — Playwright render for JS-heavy pages (opt-in; needs a system
   browser, `playwright-core` doesn't bundle one). Used as a fallback when
   structured data is missing and `ENABLE_PLAYWRIGHT=true`.

Amazon stays gated behind `ENABLE_AMAZON_ADAPTER`. The same package will be
shared by the Phase 3 worker.

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
| `POST /api/lists/:id/import-wishlist`  | Scrape product links from a wishlist page           |
| `POST /api/offers/:offerId/refresh`    | Re-extract an offer; append price history          |
| `GET /api/offers/:offerId/history`     | Price points + lowest / median / latest summary    |
| `GET /api/push/key`                    | VAPID public key for Web Push subscription         |
| `POST /api/push/subscribe`             | Register a Web Push subscription                    |
| `GET·POST /api/lists/:id/items/:itemId/alerts` | List / create price alerts for an item     |
| `DELETE /api/alerts/:alertId`          | Delete an alert                                     |
| `GET /api/search?q=`                   | Name-search candidates from API-friendly vendors    |

The price-history response includes a **deal score** (great / good / normal /
above-typical + percentile). Add-by-URL escalates through the adapter tiers and,
when `ANTHROPIC_API_KEY` is set, falls back to **Claude extraction** for pages
the cheaper tiers can't parse; cross-vendor product grouping uses GTIN/MPN then
fuzzy title, with a Claude tie-break for ambiguous matches.

Add-by-URL runs through the tiered adapters in `packages/scrapers` (official API
→ structured data → headless). Amazon URLs are rejected unless
`ENABLE_AMAZON_ADAPTER=true`. The Claude-extraction fallback tier comes later.

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

## Deploy

Container images for the long-running services live in `infra/`:

```bash
docker build -f infra/Dockerfile.api    -t pricepilot-api .
docker build -f infra/Dockerfile.worker -t pricepilot-worker .
```

Run them against managed Postgres + Redis (Neon/Supabase, Upstash). The API
image applies pending migrations (`prisma migrate deploy`) on start; both read
config from env (`DATABASE_URL`, `REDIS_URL`, `CORS_ORIGIN`, `VAPID_*`, vendor
keys, `ANTHROPIC_API_KEY`). Build the web app (`pnpm --filter @pricepilot/web
build`) and host `apps/web/dist` on any static/CDN host with `VITE_API_URL`
pointing at the API.

## Ethics & ToS

Server-side fetching sends an identifiable User-Agent, caches responses, and
prefers official vendor APIs; treat scraping adapters as best-effort and isolate
breakage to the adapter. The **Amazon adapter** exists but ships **disabled by
default** (`ENABLE_AMAZON_ADAPTER=false`): Amazon's PA-API is deprecated and
sales-gated, so it relies on structured-data/headless/Claude tiers, which is
against Amazon's ToS. Enabling it is your choice and your risk.
