import type { Queue } from "bullmq";
import { prisma } from "@sail/db";
import { JOB_SCRAPE_OFFER, type ScrapeOfferData } from "./queue.js";

/**
 * Enqueue offers whose ScrapeJob is due (nextRunAt in the past, or never run),
 * skipping paused jobs. Offers without a ScrapeJob yet are treated as due so a
 * newly added offer gets its first check promptly.
 */
export async function enqueueDueOffers(queue: Queue, batch: number): Promise<number> {
  const now = new Date();

  const dueJobs = await prisma.scrapeJob.findMany({
    where: {
      status: { not: "PAUSED" },
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    orderBy: { nextRunAt: { sort: "asc", nulls: "first" } },
    take: batch,
    select: { offerId: true },
  });

  // Offers that have no ScrapeJob row yet (e.g. created before the worker ran).
  const orphanOffers = await prisma.offer.findMany({
    where: { scrapeJob: null },
    take: batch,
    select: { id: true },
  });

  const offerIds = new Set<string>([
    ...dueJobs.map((j) => j.offerId),
    ...orphanOffers.map((o) => o.id),
  ]);

  for (const offerId of offerIds) {
    await queue.add(
      JOB_SCRAPE_OFFER,
      { offerId } satisfies ScrapeOfferData,
      // De-dupe in-flight jobs per offer (BullMQ forbids ":" in custom ids).
      // removeOnFail must be true: a kept failed job with this id would block
      // all future enqueues for the offer (status/backoff live in the DB).
      { jobId: `offer-${offerId}`, removeOnComplete: true, removeOnFail: true },
    );
  }
  return offerIds.size;
}
