# PricePilot — React PWA Price Watcher / Finder

A smart, installable price watcher/finder: load shopping/wish lists from many
vendors and maintain the best-possible price via server-side scraping + an
intelligence layer.

## Decisions locked in
- **Backend:** Full backend API **+** a scheduled scraping worker (not client-only).
- **Intelligence:** **Hybrid** — heuristics (structured data, GTIN/UPC, fuzzy match)
  first; **Claude API** fallback only when pages are messy or matching is ambiguous.
- **List import:** all four — paste product URLs, vendor wishlist import, name
  search, and CSV/JSON upload.

## The core constraint (why a backend exists)
A PWA is browser JS; browsers block cross-origin `fetch` (CORS) to vendor sites,
and big vendors deploy anti-bot defenses. So scraping/price-fetching runs **server
side**. The PWA talks only to our own API.

## Vendor access strategy (tiered, per adapter)
1. **Official API** where it's sane: eBay Browse API, Best Buy API, Walmart/Impact,
   Kroger, etc. Cleanest + ToS-safe.
2. **Structured-data extraction** (no browser): plain HTTP + `cheerio`, read
   JSON-LD `schema.org/Product`+`Offer`, Open Graph, microdata. Covers a large
   share of stores cheaply.
3. **Headless browser** (Playwright) for JS-rendered / bot-protected pages.
4. **Claude extraction fallback** — when selectors/structured data fail, send
   cleaned HTML/text to Claude with a strict JSON schema to extract
   title/price/currency/availability/image/GTIN.
- **Amazon note:** PA-API is deprecated (May 15 2026) + sales-gated; Amazon must
  use tiers 2–4, which is against Amazon ToS. Make Amazon an **opt-in,
  off-by-default** adapter and document the risk. Lead with API-friendly vendors.
- **Politeness/legal:** respect `robots.txt`, per-domain rate limits + jitter,
  caching, identifiable User-Agent, optional proxy config. ToS/ethics note in README.

## Architecture (pnpm monorepo)
```
apps/
  web/      React 19 + TS + Vite + vite-plugin-pwa   (the installable PWA)
  api/      Fastify + TS REST/JSON API               (lists, items, history)
  worker/   Playwright + BullMQ consumer             (scrape + schedule)
packages/
  scrapers/ vendor adapter interface + adapters       (shared by api/worker)
  shared/   zod schemas + shared TS types
  db/       Prisma schema + client (Postgres)
  intel/    matching, price-normalization, Claude calls
infra/      docker-compose (Postgres + Redis), deploy config
```
- **Frontend:** React + Vite, `vite-plugin-pwa` (Workbox), Tailwind + shadcn/ui,
  TanStack Query, Zustand, React Router.
- **API:** Fastify, Prisma, zod validation, JWT/session auth.
- **Worker:** BullMQ (Redis) repeatable jobs + Playwright; shares `packages/scrapers`.
- **Data:** Postgres (Neon/Supabase), Redis (Upstash).
- **LLM:** Anthropic Claude (Sonnet for extraction/matching) with prompt caching.

## Data model (Prisma / Postgres)
- `User`
- `List` (type: SHOPPING | WISHLIST)
- `ListItem` (list↔product, targetPrice, qty, notes, priority)
- `Product` (canonical: gtin/upc, mpn, normalizedTitle, brand, category, image)
- `Vendor` (registry: name, domain, adapter, capabilities)
- `Offer` (product@vendor: url, price, currency, shipping, inStock, lastChecked)
- `PriceHistory` (offerId, price, ts) — drives "best price ever / typical" logic
- `Alert` (userId, rule: target-hit / good-deal / back-in-stock, channel)
- `ScrapeJob` (status, cadence, nextRunAt, failureCount/backoff)

## "Smart" / intelligence layer (hybrid)
- **Extraction:** JSON-LD/OG first → Claude structured fallback.
- **Cross-vendor matching:** exact GTIN/UPC/MPN → normalized-title fuzzy match →
  Claude tie-break for ambiguous cases. Same physical product groups its offers.
- **Best price:** normalize to **unit price**, add shipping/tax/coupon awareness,
  currency conversion, in-stock filtering → pick true best offer.
- **Deal scoring:** compare current price to the item's own history distribution
  (lowest, median, percentile) → "great/good/normal" + drop detection.
- **Adaptive cadence:** check volatile / near-target items more often; back off
  stable items and on repeated failures.
- **Import parsing:** Claude normalizes pasted text, CSV columns, and wishlist HTML
  into structured items.

## Import flows
- **Paste URLs:** resolve → pick adapter → create Product+Offer.
- **CSV/JSON upload:** map columns (Claude-assisted) → bulk create.
- **Name search:** query API-backed vendors → present candidates → user picks.
- **Wishlist import:** per-vendor importer (start with one structured-data vendor).

## PWA features
- Installable + offline shell (Workbox precache, network-first data).
- **Web Push** price alerts (VAPID) so alerts arrive when the app is closed.
- Periodic SW update + background refresh where supported.
- Responsive dark/light; list, product-detail, and price-history-chart views.

## Phased delivery
- **Phase 0 — Scaffold:** pnpm monorepo; React PWA in `apps/web`; docker-compose
  (PG+Redis); CI; SessionStart hook so web sessions can build/test.
- **Phase 1 — Core loop:** Prisma schema; API CRUD for lists/items; web UI with
  paste-URL + CSV import; structured-data extractor for 1–2 vendors; manual refresh.
- **Phase 2 — Scraping breadth:** adapter interface + Playwright tier; eBay/Best Buy
  API adapters; PriceHistory recording + history chart.
- **Phase 3 — Watcher:** BullMQ worker + adaptive scheduling; Web Push alerts on
  target-hit / good-deal / back-in-stock.
- **Phase 4 — Intelligence:** cross-vendor matching; Claude extraction + match
  fallback; name-search finder; deal scoring.
- **Phase 5 — Polish:** wishlist importers; unit-price/shipping/currency
  normalization; offline UX; opt-in Amazon adapter + docs; deploy.

## Risks / honest caveats
- **Anti-bot + ToS:** scraping breaks and may violate vendor ToS (esp. Amazon);
  adapters need maintenance. Isolate breakage to adapters and prefer APIs.
- **Cost/ops:** Postgres + Redis + worker + Claude calls cost money; cadence and
  prompt caching keep it modest.
- **Accuracy:** matching/extraction is best-effort; deal scoring needs history to
  accrue before it's meaningful.
