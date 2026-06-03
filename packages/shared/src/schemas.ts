import { z } from "zod";

/**
 * Shared zod schemas + inferred types for PricePilot.
 *
 * These mirror the Prisma data model in `packages/db` and the API contract.
 * Phase 0 keeps them intentionally light; later phases extend them as the
 * import flows, matching, and scraping layers come online.
 */

// --- Enums ---------------------------------------------------------------

export const ListType = z.enum(["SHOPPING", "WISHLIST"]);
export type ListType = z.infer<typeof ListType>;

export const AlertRule = z.enum(["TARGET_HIT", "GOOD_DEAL", "BACK_IN_STOCK"]);
export type AlertRule = z.infer<typeof AlertRule>;

export const AlertChannel = z.enum(["WEB_PUSH", "EMAIL"]);
export type AlertChannel = z.infer<typeof AlertChannel>;

export const ScrapeStatus = z.enum([
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "PAUSED",
]);
export type ScrapeStatus = z.infer<typeof ScrapeStatus>;

// --- Primitives ----------------------------------------------------------

const id = z.string().cuid();
const timestamp = z.coerce.date();

// --- Core entities (align with prisma/schema.prisma) ---------------------

export const User = z.object({
  id,
  email: z.string().email(),
  name: z.string().nullable().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type User = z.infer<typeof User>;

export const List = z.object({
  id,
  userId: id,
  name: z.string().min(1),
  type: ListType,
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type List = z.infer<typeof List>;

export const ListItem = z.object({
  id,
  listId: id,
  productId: id,
  targetPrice: z.number().nonnegative().nullable().optional(),
  qty: z.number().int().positive().default(1),
  notes: z.string().nullable().optional(),
  priority: z.number().int().default(0),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ListItem = z.infer<typeof ListItem>;

export const Product = z.object({
  id,
  gtin: z.string().nullable().optional(),
  upc: z.string().nullable().optional(),
  mpn: z.string().nullable().optional(),
  normalizedTitle: z.string(),
  brand: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  image: z.string().url().nullable().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Product = z.infer<typeof Product>;

export const Vendor = z.object({
  id,
  name: z.string(),
  domain: z.string(),
  adapter: z.string(),
  capabilities: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Vendor = z.infer<typeof Vendor>;

export const Offer = z.object({
  id,
  productId: id,
  vendorId: id,
  url: z.string().url(),
  price: z.number().nonnegative().nullable().optional(),
  currency: z.string().length(3).default("USD"),
  shipping: z.number().nonnegative().nullable().optional(),
  inStock: z.boolean().nullable().optional(),
  lastCheckedAt: timestamp.nullable().optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Offer = z.infer<typeof Offer>;

export const PriceHistory = z.object({
  id,
  offerId: id,
  price: z.number().nonnegative(),
  currency: z.string().length(3).default("USD"),
  ts: timestamp,
});
export type PriceHistory = z.infer<typeof PriceHistory>;

export const Alert = z.object({
  id,
  userId: id,
  listItemId: id.nullable().optional(),
  rule: AlertRule,
  channel: AlertChannel.default("WEB_PUSH"),
  threshold: z.number().nonnegative().nullable().optional(),
  active: z.boolean().default(true),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Alert = z.infer<typeof Alert>;

export const ScrapeJob = z.object({
  id,
  offerId: id,
  status: ScrapeStatus.default("PENDING"),
  cadenceMinutes: z.number().int().positive().default(1440),
  nextRunAt: timestamp.nullable().optional(),
  failureCount: z.number().int().nonnegative().default(0),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ScrapeJob = z.infer<typeof ScrapeJob>;

// --- API contract --------------------------------------------------------

/**
 * Response shape for `GET /health`. Shared so the web app can validate what the
 * API returns and drive the end-to-end health check in the app shell.
 */
export const HealthResponse = z.object({
  status: z.literal("ok"),
  service: z.string(),
  version: z.string(),
  uptime: z.number().nonnegative(),
  timestamp: z.string().datetime(),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
