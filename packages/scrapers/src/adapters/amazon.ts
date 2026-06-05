import type { ExtractedProduct } from "@pricepilot/shared";
import { ExtractionError, type AdapterContext, type VendorAdapter } from "../types.js";
import { fetchText } from "../fetch.js";
import { extractFromHtml } from "../extract/structured.js";

/**
 * Amazon adapter — **opt-in and off by default** (PLAN.md). Amazon's PA-API is
 * deprecated/sales-gated, so this uses structured-data extraction (tiers 2–4),
 * which is against Amazon's ToS — enable only if you accept that risk. It is
 * only reachable when `ctx.enableAmazon` is true; the registry rejects Amazon
 * URLs otherwise.
 */
export const amazonAdapter: VendorAdapter = {
  name: "amazon",
  tier: "structured-data",
  capabilities: ["structured-data", "opt-in"],
  canHandle: (url) => /(^|\.)amazon\./i.test(url.hostname),
  isAvailable: (ctx) => ctx.enableAmazon,
  async extract(url: string, ctx: AdapterContext): Promise<ExtractedProduct> {
    const html = await fetchText(url, ctx);
    const extracted = extractFromHtml(html, "amazon");
    if (!extracted) {
      // Let the registry escalate to the headless / Claude fallback tiers.
      throw new ExtractionError(`No structured product data found at ${url}`, "no_product_data");
    }
    return extracted;
  },
};
