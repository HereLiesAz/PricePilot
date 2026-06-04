import type {
  AlertDTO,
  ListItemDTO,
  ListDetailDTO,
  ListSummaryDTO,
  OfferDTO,
  PriceHistoryDTO,
} from "@pricepilot/shared";
import type { Prisma } from "@pricepilot/db";
import { dealScore } from "@pricepilot/intel";

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

export function toOfferDTO(offer: OfferWithVendor): OfferDTO {
  return {
    id: offer.id,
    vendor: {
      id: offer.vendor.id,
      name: offer.vendor.name,
      domain: offer.vendor.domain,
      adapter: offer.vendor.adapter,
    },
    url: offer.url,
    price: dec(offer.price),
    currency: offer.currency,
    shipping: dec(offer.shipping),
    inStock: offer.inStock,
    lastCheckedAt: offer.lastCheckedAt?.toISOString() ?? null,
  };
}

/** Lowest landed price wins; offers without a price sort last. */
function pickBestOffer(offers: OfferDTO[]): OfferDTO | null {
  const priced = offers.filter((o) => o.price !== null);
  if (priced.length === 0) return null;
  return priced.reduce((best, o) =>
    landed(o) < landed(best) ? o : best,
  );
}

function landed(o: OfferDTO): number {
  return (o.price ?? Infinity) + (o.shipping ?? 0);
}

export function toListItemDTO(item: ListItemWithRelations): ListItemDTO {
  const offers = item.product.offers.map(toOfferDTO);
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
