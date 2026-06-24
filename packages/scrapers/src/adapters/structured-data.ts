import type { ExtractedProduct } from "@sail/shared";
import { ExtractionError, type AdapterContext, type VendorAdapter } from "../types.js";
import { fetchText } from "../fetch.js";
import { extractFromHtml } from "../extract/structured.js";

/**
 * Tier-2 adapter: plain HTTP fetch + structured-data extraction. Domain-
 * agnostic, so it is the default fallback for any http(s) URL.
 */
export const structuredDataAdapter: VendorAdapter = {
  name: "structured-data",
  tier: "structured-data",
  capabilities: ["structured-data", "json-ld", "open-graph"],
  canHandle: (url) => url.protocol === "http:" || url.protocol === "https:",
  isAvailable: () => true,
  async extract(url: string, ctx: AdapterContext): Promise<ExtractedProduct> {
    const html = await fetchText(url, ctx);
    const extracted = extractFromHtml(html, "structured-data");
    if (!extracted) {
      throw new ExtractionError(`No structured product data found at ${url}`, "no_product_data");
    }
    return extracted;
  },
};
