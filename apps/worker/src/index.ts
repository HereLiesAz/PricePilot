import { adapterContext, loadEnv } from "./env.js";
import { configurePush } from "./push.js";
import { processOffer } from "./process.js";
import { enqueueDueOffers } from "./scheduler.js";
import {
  JOB_SCRAPE_OFFER,
  JOB_TICK,
  connectionFromUrl,
  createScrapeQueue,
  createScrapeWorker,
  type ScrapeOfferData,
} from "./queue.js";

async function main(): Promise<void> {
  const env = loadEnv();
  const ctx = adapterContext(env);

  const pushReady = configurePush(env);
  // eslint-disable-next-line no-console
  console.log(`[worker] starting; web-push ${pushReady ? "enabled" : "disabled (no VAPID keys)"}`);

  const connection = connectionFromUrl(env.REDIS_URL);
  const queue = createScrapeQueue(connection);

  const worker = createScrapeWorker(connection, async (name, data: ScrapeOfferData) => {
    if (name === JOB_TICK) {
      const n = await enqueueDueOffers(queue, env.SCHEDULER_BATCH);
      if (n > 0) console.log(`[worker] enqueued ${n} due offer(s)`); // eslint-disable-line no-console
      return;
    }
    if (name === JOB_SCRAPE_OFFER) {
      await processOffer(data.offerId, ctx);
    }
  });

  worker.on("failed", (job, err) => {
    // eslint-disable-next-line no-console
    console.error(`[worker] job ${job?.id ?? "?"} failed:`, err.message);
  });

  // Repeatable scheduler tick — enqueues due offers on an interval. Uses the
  // job-scheduler API (the legacy `repeat` option generates ":"-laden ids that
  // BullMQ now rejects).
  await queue.upsertJobScheduler(
    "scheduler-tick",
    { every: env.SCHEDULER_INTERVAL_MS },
    { name: JOB_TICK, data: { offerId: "" } },
  );

  const shutdown = async (): Promise<void> => {
    // eslint-disable-next-line no-console
    console.log("[worker] shutting down…");
    await worker.close();
    await queue.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[worker] fatal startup error:", err);
  process.exit(1);
});
