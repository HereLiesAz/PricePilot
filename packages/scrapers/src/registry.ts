import type { ExtractedProduct } from "@pricepilot/shared";
import { ExtractionError, type AdapterContext, type VendorAdapter } from "./types.js";
import { vendorDomain } from "./fetch.js";
import { ebayAdapter } from "./adapters/ebay.js";
import { bestBuyAdapter } from "./adapters/bestbuy.js";
import { extractFromHtml } from "./extract/structured.js";
import { structuredDataAdapter } from "./adapters/structured-data.js";
import { playwrightAdapter, playwrightAvailable, renderHtml } from "./adapters/playwright.js";
import { claudeAdapter } from "./adapters/claude.js";
import { amazonAdapter } from "./adapters/amazon.js";

/**
 * API-tier adapters are tried first (cleanest + ToS-safe). The structured-data
 * adapter is the universal fallback; the headless adapter is a last resort,
 * invoked only when structured data is missing and Playwright is enabled.
 */
export const apiAdapters: VendorAdapter[] = [ebayAdapter, bestBuyAdapter];
/** Fallback tiers tried (in order) when the primary adapter finds no data. */
export const fallbackAdapters: VendorAdapter[] = [playwrightAdapter, claudeAdapter];
export const allAdapters: VendorAdapter[] = [
  ...apiAdapters,
  amazonAdapter,
  structuredDataAdapter,
  ...fallbackAdapters,
];

function isAmazon(domain: string): boolean {
  return /(^|\.)amazon\./.test(domain);
}

/**
 * Pick the primary adapter for a URL: a matching, available API adapter if one
 * exists, otherwise structured-data. (Amazon is gated by the caller.)
 */
export function resolveAdapter(url: string, ctx: AdapterContext): VendorAdapter {
  const parsed = new URL(url);
  // Amazon is opt-in; when enabled it uses its own (structured-data) adapter.
  if (isAmazon(parsed.hostname) && ctx.enableAmazon) return amazonAdapter;
  const apiMatch = apiAdapters.find((a) => a.canHandle(parsed) && a.isAvailable(ctx));
  return apiMatch ?? structuredDataAdapter;
}

/**
 * Orchestrate extraction across tiers: primary adapter first; on no-data /
 * fetch-failed, escalate to the headless tier, then Claude. The headless tier's
 * rendered HTML is reused for the Claude tier so it doesn't re-fetch (and
 * re-fail) on anti-bot pages. Enforces the opt-in/off-by-default Amazon policy.
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
    // Anti-bot blocks often surface as fetch_failed on plain HTTP; the headless
    // and Claude tiers can recover those too (not just missing data).
    const shouldFallback =
      err instanceof ExtractionError &&
      (err.code === "no_product_data" || err.code === "fetch_failed");
    if (!shouldFallback) throw err;

    const canClaude = typeof ctx.claudeFallback === "function";

    // Tier 3 (headless) — render once and reuse the HTML for tier 4 (Claude).
    // The render is isolated from the Claude call: a render failure should fall
    // through to a plain-fetch Claude attempt, but once we've rendered, Claude
    // works off that HTML and we must NOT re-fetch (the whole point).
    if (primary.tier !== "headless" && playwrightAvailable(ctx)) {
      let html: string | undefined;
      try {
        html = await renderHtml(url, ctx);
      } catch {
        html = undefined; // rendering failed — leave Claude's plain fetch below
      }
      if (html !== undefined) {
        const viaStructured = extractFromHtml(html, "headless");
        if (viaStructured) return viaStructured;
        if (canClaude) {
          try {
            const viaClaude = await ctx.claudeFallback!({ html, url });
            if (viaClaude) return viaClaude;
          } catch {
            // Claude failed on the rendered HTML — don't re-fetch a blocked page.
          }
          throw err;
        }
      }
    }

    // Tier 4 standalone: Claude over a plain fetch (no headless, or it failed).
    if (canClaude) {
      try {
        return await claudeAdapter.extract(url, ctx);
      } catch {
        // Surface the original error below.
      }
    }

    throw err;
  }
}
