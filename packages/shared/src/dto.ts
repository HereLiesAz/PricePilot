import { z } from "zod";
import { ListType } from "./schemas.js";

/**
 * API contract: request inputs and response DTOs shared by `apps/api` (zod
 * validation + serialization) and `apps/web` (typed client parsing).
 *
 * DTOs are serialization-friendly: money is a plain number, timestamps are ISO
 * strings. They are deliberately separate from the entity schemas in
 * `schemas.ts` (which mirror the Prisma row shapes).
 */

// --- Primitives ----------------------------------------------------------

export const Money = z.number().nonnegative();
const isoDate = z.string().datetime();

// --- Response DTOs -------------------------------------------------------

export const VendorDTO = z.object({
  id: z.string(),
  name: z.string(),
  domain: z.string(),
  adapter: z.string(),
});
export type VendorDTO = z.infer<typeof VendorDTO>;

export const OfferDTO = z.object({
  id: z.string(),
  vendor: VendorDTO,
  url: z.string().url(),
  price: Money.nullable(),
  currency: z.string(),
  shipping: Money.nullable(),
  inStock: z.boolean().nullable(),
  lastCheckedAt: isoDate.nullable(),
});
export type OfferDTO = z.infer<typeof OfferDTO>;

export const ProductDTO = z.object({
  id: z.string(),
  normalizedTitle: z.string(),
  brand: z.string().nullable(),
  image: z.string().nullable(),
  gtin: z.string().nullable(),
});
export type ProductDTO = z.infer<typeof ProductDTO>;

export const ListItemDTO = z.object({
  id: z.string(),
  qty: z.number().int(),
  targetPrice: Money.nullable(),
  notes: z.string().nullable(),
  priority: z.number().int(),
  product: ProductDTO,
  bestOffer: OfferDTO.nullable(),
  offers: z.array(OfferDTO),
  createdAt: isoDate,
});
export type ListItemDTO = z.infer<typeof ListItemDTO>;

export const ListSummaryDTO = z.object({
  id: z.string(),
  name: z.string(),
  type: ListType,
  itemCount: z.number().int().nonnegative(),
  createdAt: isoDate,
  updatedAt: isoDate,
});
export type ListSummaryDTO = z.infer<typeof ListSummaryDTO>;

export const ListDetailDTO = ListSummaryDTO.extend({
  items: z.array(ListItemDTO),
});
export type ListDetailDTO = z.infer<typeof ListDetailDTO>;

// --- Request inputs ------------------------------------------------------

export const CreateListInput = z.object({
  name: z.string().min(1).max(120),
  type: ListType.default("SHOPPING"),
});
export type CreateListInput = z.infer<typeof CreateListInput>;

export const UpdateListInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    type: ListType.optional(),
  })
  .refine((v) => v.name !== undefined || v.type !== undefined, {
    message: "Provide at least one field to update",
  });
export type UpdateListInput = z.infer<typeof UpdateListInput>;

/**
 * Add an item either by URL (server resolves an adapter and extracts the
 * product/offer) or by a manual title when no URL is available.
 */
export const AddItemInput = z
  .object({
    url: z.string().url().optional(),
    title: z.string().min(1).max(300).optional(),
    targetPrice: Money.optional(),
    qty: z.number().int().positive().max(999).default(1),
    notes: z.string().max(2000).optional(),
  })
  .refine((v) => Boolean(v.url) || Boolean(v.title), {
    message: "Provide a url or a title",
  });
export type AddItemInput = z.infer<typeof AddItemInput>;

/** Bulk import: raw CSV or JSON text, parsed server-side into rows. */
export const ImportInput = z.object({
  format: z.enum(["csv", "json"]),
  data: z.string().min(1).max(1_000_000),
});
export type ImportInput = z.infer<typeof ImportInput>;

export const ImportFailureDTO = z.object({
  row: z.number().int(),
  input: z.string(),
  error: z.string(),
});
export type ImportFailureDTO = z.infer<typeof ImportFailureDTO>;

export const ImportResultDTO = z.object({
  added: z.number().int().nonnegative(),
  failed: z.array(ImportFailureDTO),
  list: ListDetailDTO,
});
export type ImportResultDTO = z.infer<typeof ImportResultDTO>;

// --- Price history -------------------------------------------------------

export const PriceHistoryPointDTO = z.object({
  price: Money,
  currency: z.string(),
  ts: isoDate,
});
export type PriceHistoryPointDTO = z.infer<typeof PriceHistoryPointDTO>;

/**
 * Offer price history plus a small summary used by the web history chart and
 * (later) deal scoring: lowest / median / latest over the recorded window.
 */
export const PriceHistoryDTO = z.object({
  offerId: z.string(),
  currency: z.string(),
  points: z.array(PriceHistoryPointDTO),
  lowest: Money.nullable(),
  median: Money.nullable(),
  latest: Money.nullable(),
});
export type PriceHistoryDTO = z.infer<typeof PriceHistoryDTO>;

// --- Extraction ----------------------------------------------------------

/**
 * Normalized output of the structured-data extractor (JSON-LD / Open Graph).
 * Phase 1 reads `schema.org/Product` + `Offer`; later phases add the Playwright
 * and Claude-fallback tiers (see PLAN.md).
 */
export const ExtractedProduct = z.object({
  title: z.string().min(1),
  price: Money.nullable(),
  currency: z.string().min(1).default("USD"),
  inStock: z.boolean().nullable(),
  image: z.string().nullable(),
  gtin: z.string().nullable(),
  mpn: z.string().nullable().default(null),
  brand: z.string().nullable(),
  /** Which adapter tier produced this result (api | structured-data | headless). */
  source: z.string().default("structured-data"),
});
export type ExtractedProduct = z.infer<typeof ExtractedProduct>;
