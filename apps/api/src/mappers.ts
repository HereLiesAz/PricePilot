import type {
  AlertDTO,
  ListItemDTO,
  ListDetailDTO,
  ListSummaryDTO,
  OfferDTO,
  PriceHistoryDTO,
} from "@sail/shared";
import type { Prisma } from "@sail/db";
import { convertCurrency, dealScore, landedPrice, unitPrice } from "@sail/intel";

/** Base currency used to compare offers priced in different currencies. */
const BASE_CURRENCY = "USD";

export function toAlertDTO(alert: Prisma.AlertGetPayload<object>): AlertDTO {
  return {
    id: alert.id,
    listItemId: alert.listItemId,
    rule: alert.rule,
    channel: alert.channel,
    threshold: alert.threshold === null ? null : Number(alert.threshold.toString()),
    active: alert.active,
    createdAt: alert.createdAt.toISOString(),
  };
}

/** Convert a Prisma Decimal (or null) to a plain number for DTO serialization. */
function dec(value: Prisma.Decimal | null): number | null {
  return value === null ? null : Number(value.toString());
}

type OfferWithVendor = Prisma.OfferGetPayload<{ include: { vendor: true } }>;

type ListItemWithRelations = Prisma.ListItemGetPayload<{
  include: { product: { include: { offers: { include: { vendor: true } } } } };
}>;

type ListWithItems = Prisma.ListGetPayload<{
  include: {
    items: {
      include: { product: { include: { offers: { include: { vendor: true } } } } };
    };
  };
}>;

export function toOfferDTO(offer: OfferWithVendor, productTitle?: string): OfferDTO {
  const price = dec(offer.price);
  const shipping = dec(offer.shipping);
  const landed = price === null ? null : landedPrice(price, shipping ?? 0);
  return {
    id: offer.id,
    vendor: {
      id: offer.vendor.id,
      name: offer.vendor.name,
      domain: offer.vendor.domain,
      adapter: offer.vendor.adapter,
    },
    url: offer.url,
    price,
    currency: offer.currency,
    shipping,
    landed,
    unitPrice: price !== null && productTitle ? unitPrice(price, productTitle) : null,
    inStock: offer.inStock,
    lastCheckedAt: offer.lastCheckedAt?.toISOString() ?? null,
  };
}

/**
 * Best offer = lowest landed cost, normalized to a base currency so offers in
 * different currencies compare fairly (PLAN.md). Offers without a price sort last.
 */
function pickBestOffer(offers: OfferDTO[]): OfferDTO | null {
  const priced = offers.filter((o) => o.price !== null);
  if (priced.length === 0) return null;
  return priced.reduce((best, o) => (comparableLanded(o) < comparableLanded(best) ? o : best));
}

function comparableLanded(o: OfferDTO): number {
  const landed = o.landed ?? o.price ?? Infinity;
  if (!Number.isFinite(landed)) return Infinity;
  return convertCurrency(landed, o.currency, BASE_CURRENCY) ?? landed;
}

export function toListItemDTO(item: ListItemWithRelations): ListItemDTO {
  const offers = item.product.offers.map((o) => toOfferDTO(o, item.product.normalizedTitle));
  return {
    id: item.id,
    qty: item.qty,
    targetPrice: dec(item.targetPrice),
    notes: item.notes,
    priority: item.priority,
    product: {
      id: item.product.id,
      normalizedTitle: item.product.normalizedTitle,
      brand: item.product.brand,
      image: item.product.image,
      gtin: item.product.gtin,
    },
    offers,
    bestOffer: pickBestOffer(offers),
    createdAt: item.createdAt.toISOString(),
  };
}

export function toListDetailDTO(list: ListWithItems): ListDetailDTO {
  return {
    id: list.id,
    name: list.name,
    type: list.type,
    itemCount: list.items.length,
    items: list.items.map(toListItemDTO),
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };
}

export function toListSummaryDTO(
  list: Prisma.ListGetPayload<{ include: { _count: { select: { items: true } } } }>,
): ListSummaryDTO {
  return {
    id: list.id,
    name: list.name,
    type: list.type,
    itemCount: list._count.items,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  };
}

/** Build the price-history DTO plus a lowest/median/latest summary. */
export function toPriceHistoryDTO(
  offerId: string,
  currency: string,
  rows: Prisma.PriceHistoryGetPayload<object>[],
): PriceHistoryDTO {
  const points = rows.map((r) => ({
    price: Number(r.price.toString()),
    currency: r.currency,
    ts: r.ts.toISOString(),
  }));
  const prices = points.map((p) => p.price);
  const latest = prices.length ? prices[prices.length - 1]! : null;
  // Score the latest price against the *prior* distribution (exclude itself).
  const deal = dealScore(latest, prices.slice(0, -1));
  return {
    offerId,
    currency,
    points,
    lowest: prices.length ? Math.min(...prices) : null,
    median: median(prices),
    latest,
    deal,
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/** Prisma include used wherever we return a full list detail. */
export const listDetailInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: { include: { offers: { include: { vendor: true } } } },
    },
  },
} satisfies Prisma.ListInclude;
