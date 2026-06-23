import type { ExtractedProduct } from "@sail/shared";
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
  isAvailable: playwrightAvailable,
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

/** Whether the headless tier can render (Playwright enabled, or a test override). */
export function playwrightAvailable(ctx: AdapterContext): boolean {
  return ctx.enablePlaywright || typeof ctx.renderImpl === "function";
}

/**
 * Render a URL to HTML. Uses `ctx.renderImpl` when provided (tests), otherwise
 * launches a headless browser via playwright-core. Exported so the registry can
 * reuse the rendered HTML for the Claude tier instead of re-fetching.
 */
export async function renderHtml(url: string, ctx: AdapterContext): Promise<string> {
  if (ctx.renderImpl) return ctx.renderImpl(url);

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

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    browser = await chromium.launch({
      channel: ctx.playwrightChannel,
      executablePath: ctx.playwrightExecutablePath,
      headless: true,
    });
    const page = await browser.newPage({ userAgent: USER_AGENT });
    // Wait for `load` (not just `domcontentloaded`) so client-side scripts that
    // render product data / inject JSON-LD have a chance to run.
    await page.goto(url, { waitUntil: "load", timeout: 20_000 });
    return await page.content();
  } catch (err) {
    throw new ExtractionError(`Headless render failed for ${url}: ${(err as Error).message}`, "fetch_failed");
  } finally {
    if (browser) await browser.close();
  }
}
