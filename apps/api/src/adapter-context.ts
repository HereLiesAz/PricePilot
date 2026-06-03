import type { AdapterContext } from "@pricepilot/scrapers";
import type { Env } from "./env.js";

/** Build the scrapers' AdapterContext from validated environment config. */
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
