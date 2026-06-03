import type { ExtractedProduct } from "@pricepilot/shared";
import { ExtractionError, type AdapterContext, type VendorAdapter } from "../types.js";
import { USER_AGENT } from "../fetch.js";
import { extractFromHtml } from "../extract/structured.js";

/**
 * Tier-3 adapter: render the page in a headless browser, then run the same
 * structured-data extraction over the rendered DOM. Used as a fallback for
 * JS-rendered pages. `playwright-core` does not download browsers, so a system
 * browser must be provided via channel (e.g. "chrome") or executable path.
 *
 * Off by default; enabled per-context via `enablePlaywright`.
 */
export const playwrightAdapter: VendorAdapter = {
  name: "playwright",
  tier: "headless",
  capabilities: ["headless", "js-render"],
  canHandle: (url) => url.protocol === "http:" || url.protocol === "https:",
  isAvailable: (ctx) => ctx.enablePlaywright,
  async extract(url: string, ctx: AdapterContext): Promise<ExtractedProduct> {
    const html = await renderHtml(url, ctx);
    const extracted = extractFromHtml(html, "headless");
    if (!extracted) {
      throw new ExtractionError(
        `No product data found after rendering ${url}`,
        "no_product_data",
      );
    }
    return extracted;
  },
};

async function renderHtml(url: string, ctx: AdapterContext): Promise<string> {
  let chromium: typeof import("playwright-core").chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    throw new ExtractionError("playwright-core is not installed", "adapter_unavailable");
  }

  if (!ctx.playwrightChannel && !ctx.playwrightExecutablePath) {
    throw new ExtractionError(
      "Playwright needs a browser channel or executablePath (none configured)",
      "adapter_unavailable",
    );
  }

  const browser = await chromium.launch({
    channel: ctx.playwrightChannel,
    executablePath: ctx.playwrightExecutablePath,
    headless: true,
  });
  try {
    const page = await browser.newPage({ userAgent: USER_AGENT });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
    return await page.content();
  } catch (err) {
    throw new ExtractionError(`Headless render failed for ${url}: ${(err as Error).message}`, "fetch_failed");
  } finally {
    await browser.close();
  }
}
