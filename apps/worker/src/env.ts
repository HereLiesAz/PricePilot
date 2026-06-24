import { z } from "zod";
import type { AdapterContext } from "@sail/scrapers";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  // How often the scheduler enqueues due offers.
  SCHEDULER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  // How many offers to enqueue per scheduler tick.
  SCHEDULER_BATCH: z.coerce.number().int().positive().default(50),
  // VAPID keys for Web Push (generate with `npx web-push generate-vapid-keys`).
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default("mailto:alerts@sail.local"),
  // Adapter config (mirrors the API).
  ENABLE_AMAZON_ADAPTER: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  ENABLE_PLAYWRIGHT: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  PLAYWRIGHT_CHANNEL: z.string().optional(),
  PLAYWRIGHT_EXECUTABLE_PATH: z.string().optional(),
  EBAY_OAUTH_TOKEN: z.string().optional(),
  BESTBUY_API_KEY: z.string().optional(),
  RESPECT_ROBOTS: z.enum(["true", "false"]).default("true").transform((v) => v === "true"),
  REQUEST_INTERVAL_MS: z.coerce.number().int().nonnegative().default(1000),
  REQUEST_JITTER_MS: z.coerce.number().int().nonnegative().default(500),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid worker environment:\n${issues}`);
  }
  return parsed.data;
}

export function adapterContext(env: Env): AdapterContext {
  return {
    enableAmazon: env.ENABLE_AMAZON_ADAPTER,
    enablePlaywright: env.ENABLE_PLAYWRIGHT,
    playwrightChannel: env.PLAYWRIGHT_CHANNEL,
    playwrightExecutablePath: env.PLAYWRIGHT_EXECUTABLE_PATH,
    credentials: {
      ebayOAuthToken: env.EBAY_OAUTH_TOKEN,
      bestBuyApiKey: env.BESTBUY_API_KEY,
    },
    respectRobots: env.RESPECT_ROBOTS,
    minRequestIntervalMs: env.REQUEST_INTERVAL_MS,
    requestJitterMs: env.REQUEST_JITTER_MS,
  };
}
