import type { ExtractedProduct } from "@pricepilot/shared";
import { ExtractionError, type AdapterContext, type VendorAdapter } from "../types.js";
import { fetchText } from "../fetch.js";

/**
 * Tier-4 adapter: when cheaper tiers fail, hand cleaned page HTML to the
 * Claude extractor (injected via `ctx.claudeFallback`). The SDK call itself
 * lives in @pricepilot/intel; this adapter only fetches + delegates.
 */
export const claudeAdapter: VendorAdapter = {
  name: "claude",
  tier: "claude",
  capabilities: ["claude", "llm-extraction"],
  canHandle: (url) => url.protocol === "http:" || url.protocol === "https:",
  isAvailable: (ctx) => typeof ctx.claudeFallback === "function",
  async extract(url: string, ctx: AdapterContext): Promise<ExtractedProduct> {
    if (!ctx.claudeFallback) {
      throw new ExtractionError("Claude fallback is not configured", "adapter_unavailable");
    }
    const html = await fetchText(url, ctx);
    const extracted = await ctx.claudeFallback({ html, url });
    if (!extracted) {
      throw new ExtractionError(`Claude could not extract a product from ${url}`, "no_product_data");
    }
    return extracted;
  },
};
