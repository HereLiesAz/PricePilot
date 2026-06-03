import type { AdapterContext } from "@pricepilot/scrapers";
import { makeClaudeExtractor } from "@pricepilot/intel";
import type { Env } from "./env.js";

/** Build the scrapers' AdapterContext from validated environment config. */
export function adapterContext(env: Env): AdapterContext {
  // Wire the tier-4 Claude extraction fallback only when a key is configured.
  const claudeFallback = env.ANTHROPIC_API_KEY
    ? makeClaudeExtractor({ apiKey: env.ANTHROPIC_API_KEY, model: env.ANTHROPIC_MODEL })
    : undefined;

  return {
    enableAmazon: env.ENABLE_AMAZON_ADAPTER,
    enablePlaywright: env.ENABLE_PLAYWRIGHT,
    playwrightChannel: env.PLAYWRIGHT_CHANNEL,
    playwrightExecutablePath: env.PLAYWRIGHT_EXECUTABLE_PATH,
    credentials: {
      ebayOAuthToken: env.EBAY_OAUTH_TOKEN,
      bestBuyApiKey: env.BESTBUY_API_KEY,
    },
    claudeFallback,
  };
}
