import { z } from "zod";
import type { AdapterContext } from "@pricepilot/scrapers";

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
  VAPID_SUBJECT: z.string().default("mailto:alerts@pricepilot.local"),
  // Adapter config (mirrors the API).
  ENABLE_AMAZON_ADAPTER: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  ENABLE_PLAYWRIGHT: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  PLAYWRIGHT_CHANNEL: z.string().optional(),
  PLAYWRIGHT_EXECUTABLE_PATH: z.string().optional(),
  EBAY_OAUTH_TOKEN: z.string().optional(),
  BESTBUY_API_KEY: z.string().optional(),
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
  };
}
