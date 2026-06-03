import { extractOffer, ExtractionError, type AdapterContext } from "@pricepilot/scrapers";
import { prisma } from "@pricepilot/db";
import { alertMessage, shouldTriggerAlert } from "./alerts.js";
import { nextCadenceMinutes } from "./cadence.js";
import { pushToUser } from "./push.js";

const NEAR_TARGET_MARGIN = 1.05;

function dec(value: { toString(): string } | null): number | null {
  return value === null ? null : Number(value.toString());
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

async function rescheduleJob(
  offerId: string,
  status: "SUCCEEDED" | "FAILED",
  failureCount: number,
  cadenceMinutes: number,
): Promise<void> {
  const nextRunAt = new Date(Date.now() + cadenceMinutes * 60_000);
  await prisma.scrapeJob.upsert({
    where: { offerId },
    update: { status, failureCount, cadenceMinutes, nextRunAt },
    create: { offerId, status, failureCount, cadenceMinutes, nextRunAt },
  });
}

/**
 * Scrape one offer: re-extract, record the new price/stock + history point,
 * evaluate alerts for every list item tracking the product (notifying via Web
 * Push), then reschedule the offer's ScrapeJob with an adaptive cadence.
 */
export async function processOffer(offerId: string, ctx: AdapterContext): Promise<void> {
  const offer = await prisma.offer.findUnique({ where: { id: offerId } });
  if (!offer) return;

  const job = await prisma.scrapeJob.findUnique({ where: { offerId } });
  const prevPrice = dec(offer.price);
  const prevInStock = offer.inStock;

  let extracted;
  try {
    extracted = await extractOffer(offer.url, ctx);
  } catch (err) {
    if (!(err instanceof ExtractionError)) throw err;
    const failureCount = (job?.failureCount ?? 0) + 1;
    await rescheduleJob(offerId, "FAILED", failureCount, nextCadenceMinutes({
      failureCount,
      priceChanged: false,
      nearTarget: false,
    }));
    return;
  }

  // Median of history *before* this check (deal-scoring basis).
  const history = await prisma.priceHistory.findMany({ where: { offerId }, orderBy: { ts: "asc" } });
  const historyMedian = median(history.map((h) => Number(h.price.toString())));

  const newPrice = extracted.price;
  await prisma.offer.update({
    where: { id: offerId },
    data: {
      price: newPrice,
      currency: extracted.currency,
      inStock: extracted.inStock,
      lastCheckedAt: new Date(),
    },
  });
  if (newPrice !== null) {
    await prisma.priceHistory.create({
      data: { offerId, price: newPrice, currency: extracted.currency },
    });
  }

  const items = await prisma.listItem.findMany({
    where: { productId: offer.productId },
    include: { list: true, alerts: { where: { active: true } }, product: true },
  });

  let nearTarget = false;
  for (const item of items) {
    const target = dec(item.targetPrice);
    if (target !== null && newPrice !== null && newPrice <= target * NEAR_TARGET_MARGIN) {
      nearTarget = true;
    }
    for (const alert of item.alerts) {
      const threshold =
        dec(alert.threshold) ?? (alert.rule === "TARGET_HIT" ? target : null);
      const triggered = shouldTriggerAlert({
        rule: alert.rule,
        threshold,
        newPrice,
        prevInStock,
        newInStock: extracted.inStock,
        historyMedian,
      });
      if (triggered) {
        await pushToUser(item.list.userId, {
          title: "PricePilot",
          body: alertMessage(alert.rule, item.product.normalizedTitle, newPrice, extracted.currency),
          url: offer.url,
          rule: alert.rule,
        });
      }
    }
  }

  const priceChanged = prevPrice !== newPrice;
  await rescheduleJob(offerId, "SUCCEEDED", 0, nextCadenceMinutes({
    failureCount: 0,
    priceChanged,
    nearTarget,
  }));
}
