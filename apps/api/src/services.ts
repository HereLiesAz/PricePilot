import type { AddItemInput, ExtractedProduct } from "@pricepilot/shared";
import { extractOffer, vendorDomain, type AdapterContext } from "@pricepilot/scrapers";
import { prisma } from "./db.js";

/**
 * Resolve an add-item input into a Product (and, when a URL is given, a Vendor
 * + Offer with a PriceHistory point), then attach it to the list as a ListItem.
 *
 * Cross-vendor grouping is basic in Phase 1: products are matched by GTIN when
 * available, otherwise created fresh. Full fuzzy/Claude matching is a later
 * phase (see PLAN.md).
 */
export async function addItemToList(
  listId: string,
  input: AddItemInput,
  ctx: AdapterContext,
): Promise<string> {
  const productId = input.url
    ? await upsertFromUrl(input.url, ctx)
    : await createManualProduct(input.title!);

  const item = await prisma.listItem.upsert({
    where: { listId_productId: { listId, productId } },
    update: {
      qty: input.qty,
      ...(input.targetPrice !== undefined ? { targetPrice: input.targetPrice } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    },
    create: {
      listId,
      productId,
      qty: input.qty,
      targetPrice: input.targetPrice ?? null,
      notes: input.notes ?? null,
    },
  });
  return item.id;
}

async function createManualProduct(title: string): Promise<string> {
  const product = await prisma.product.create({
    data: { normalizedTitle: title.trim() },
  });
  return product.id;
}

async function upsertFromUrl(url: string, ctx: AdapterContext): Promise<string> {
  const domain = vendorDomain(url);
  const extracted = await extractOffer(url, ctx);

  // The extractor reports which tier produced the result (e.g. "api:ebay",
  // "structured-data"); record it as the vendor's adapter.
  const adapter = extracted.source;
  const vendor = await prisma.vendor.upsert({
    where: { domain },
    update: { adapter, capabilities: [adapter] },
    create: {
      domain,
      name: domain,
      adapter,
      capabilities: [adapter],
    },
  });

  // If this exact offer (vendor + url) already exists, keep its product so we
  // refresh in place instead of creating a duplicate product with no offers.
  const existingOffer = await prisma.offer.findUnique({
    where: { vendorId_url: { vendorId: vendor.id, url } },
  });
  const productId = existingOffer ? existingOffer.productId : await resolveProduct(extracted);

  await recordOffer(productId, vendor.id, url, extracted);
  return productId;
}

async function resolveProduct(extracted: ExtractedProduct): Promise<string> {
  if (extracted.gtin) {
    const existing = await prisma.product.findFirst({
      where: { gtin: extracted.gtin },
    });
    if (existing) return existing.id;
  }
  const product = await prisma.product.create({
    data: {
      normalizedTitle: extracted.title.trim(),
      brand: extracted.brand,
      image: extracted.image,
      gtin: extracted.gtin,
      mpn: extracted.mpn,
    },
  });
  return product.id;
}

/** Upsert the offer and append a PriceHistory point when a price is known. */
async function recordOffer(
  productId: string,
  vendorId: string,
  url: string,
  extracted: ExtractedProduct,
): Promise<void> {
  const now = new Date();
  const offer = await prisma.offer.upsert({
    where: { vendorId_url: { vendorId, url } },
    update: {
      price: extracted.price,
      currency: extracted.currency,
      inStock: extracted.inStock,
      lastCheckedAt: now,
    },
    create: {
      productId,
      vendorId,
      url,
      price: extracted.price,
      currency: extracted.currency,
      inStock: extracted.inStock,
      lastCheckedAt: now,
    },
  });

  if (extracted.price !== null) {
    await prisma.priceHistory.create({
      data: { offerId: offer.id, price: extracted.price, currency: extracted.currency },
    });
  }

  // Ensure the offer is tracked by the watcher (apps/worker schedules from this).
  await prisma.scrapeJob.upsert({
    where: { offerId: offer.id },
    update: {},
    create: { offerId: offer.id, status: "PENDING", nextRunAt: new Date() },
  });
}

/**
 * Re-run extraction for an existing offer, update it, and append price history.
 * This is the manual "refresh price" path; the scheduled worker arrives later.
 */
export async function refreshOffer(offerId: string, ctx: AdapterContext): Promise<void> {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) throw new Error("offer_not_found");

  const extracted = await extractOffer(offer.url, ctx);
  await recordOffer(offer.productId, offer.vendorId, offer.url, extracted);
}
