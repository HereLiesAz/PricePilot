import type { ExtractedProduct } from "@pricepilot/shared";
import { ExtractionError, type AdapterContext, type VendorAdapter } from "./types.js";
import { vendorDomain } from "./fetch.js";
import { ebayAdapter } from "./adapters/ebay.js";
import { bestBuyAdapter } from "./adapters/bestbuy.js";
import { structuredDataAdapter } from "./adapters/structured-data.js";
import { playwrightAdapter } from "./adapters/playwright.js";

/**
 * API-tier adapters are tried first (cleanest + ToS-safe). The structured-data
 * adapter is the universal fallback; the headless adapter is a last resort,
 * invoked only when structured data is missing and Playwright is enabled.
 */
export const apiAdapters: VendorAdapter[] = [ebayAdapter, bestBuyAdapter];
export const allAdapters: VendorAdapter[] = [...apiAdapters, structuredDataAdapter, playwrightAdapter];

function isAmazon(domain: string): boolean {
  return /(^|\.)amazon\./.test(domain);
}

/**
 * Pick the primary adapter for a URL: a matching, available API adapter if one
 * exists, otherwise structured-data. (Amazon is gated by the caller.)
 */
export function resolveAdapter(url: string, ctx: AdapterContext): VendorAdapter {
  const parsed = new URL(url);
  const apiMatch = apiAdapters.find((a) => a.canHandle(parsed) && a.isAvailable(ctx));
  return apiMatch ?? structuredDataAdapter;
}

/**
 * Orchestrate extraction across tiers: primary adapter first; if it finds no
 * product data and Playwright is enabled, fall back to the headless tier.
 * Enforces the opt-in/off-by-default Amazon policy.
 */
export async function extractOffer(url: string, ctx: AdapterContext): Promise<ExtractedProduct> {
  const domain = vendorDomain(url);
  if (isAmazon(domain) && !ctx.enableAmazon) {
    throw new ExtractionError(
      "Amazon adapter is opt-in and off by default (ToS risk). Set ENABLE_AMAZON_ADAPTER=true to enable.",
      "amazon_disabled",
    );
  }

  const primary = resolveAdapter(url, ctx);
  try {
    return await primary.extract(url, ctx);
  } catch (err) {
    // Anti-bot blocks often surface as fetch_failed on plain HTTP; a headless
    // render can get past them, so fall back on that too (not just missing data).
    const shouldFallback =
      err instanceof ExtractionError &&
      (err.code === "no_product_data" || err.code === "fetch_failed");
    if (shouldFallback && primary.tier !== "headless" && playwrightAdapter.isAvailable(ctx)) {
      return playwrightAdapter.extract(url, ctx);
    }
    throw err;
  }
}
