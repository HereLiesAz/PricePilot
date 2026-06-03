import { Queue, Worker, type ConnectionOptions } from "bullmq";

export const SCRAPE_QUEUE = "pricepilot-scrape";

/** Job names handled on the scrape queue. */
export const JOB_TICK = "tick";
export const JOB_SCRAPE_OFFER = "scrape-offer";

export interface ScrapeOfferData {
  offerId: string;
}

/**
 * Build BullMQ connection options from a redis URL. We pass options (not an
 * IORedis instance) so BullMQ owns the connection; `maxRetriesPerRequest: null`
 * is required for blocking worker clients.
 */
export function connectionFromUrl(redisUrl: string): ConnectionOptions {
  const u = new URL(redisUrl);
  return {
    host: u.hostname,
    port: Number(u.port) || 6379,
    username: u.username || undefined,
    password: u.password || undefined,
    db: u.pathname.length > 1 ? Number(u.pathname.slice(1)) || 0 : 0,
    maxRetriesPerRequest: null,
    // Managed Redis (ElastiCache/Heroku/…) uses rediss:// and requires TLS.
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export function createScrapeQueue(connection: ConnectionOptions): Queue {
  return new Queue(SCRAPE_QUEUE, { connection });
}

export function createScrapeWorker(
  connection: ConnectionOptions,
  handler: (name: string, data: ScrapeOfferData) => Promise<void>,
  concurrency = 4,
): Worker {
  return new Worker<ScrapeOfferData>(
    SCRAPE_QUEUE,
    async (job) => handler(job.name, job.data),
    { connection, concurrency },
  );
}
