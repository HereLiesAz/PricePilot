import type { ExtractedProduct } from "@pricepilot/shared";
import { extractFromHtml } from "./structured.js";

/**
 * Identifiable User-Agent (politeness — see PLAN.md). Real per-domain rate
 * limiting / robots.txt handling arrives with the worker in later phases.
 */
const USER_AGENT =
  "PricePilotBot/0.1 (+https://github.com/HereLiesAz/PricePilot; structured-data)";

const FETCH_TIMEOUT_MS = 10_000;

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code:
      | "amazon_disabled"
      | "fetch_failed"
      | "no_product_data"
      | "bad_url",
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

export interface AdapterOptions {
  /** Opt-in Amazon adapter; off by default (ToS risk, see PLAN.md). */
  enableAmazon?: boolean;
}

export function vendorDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    throw new ExtractionError(`Invalid URL: ${rawUrl}`, "bad_url");
  }
}

function isAmazon(domain: string): boolean {
  return /(^|\.)amazon\./.test(domain);
}

/**
 * Fetch a product page and extract structured data. Leads with API-friendly /
 * structured-data vendors; Amazon is gated behind `enableAmazon`.
 */
export async function fetchAndExtract(
  url: string,
  opts: AdapterOptions = {},
): Promise<ExtractedProduct> {
  const domain = vendorDomain(url);

  if (isAmazon(domain) && !opts.enableAmazon) {
    throw new ExtractionError(
      "Amazon adapter is opt-in and off by default (ToS risk). Set ENABLE_AMAZON_ADAPTER=true to enable.",
      "amazon_disabled",
    );
  }

  const html = await fetchHtml(url);
  const extracted = extractFromHtml(html);
  if (!extracted) {
    throw new ExtractionError(
      `No structured product data found at ${url}`,
      "no_product_data",
    );
  }
  return extracted;
}

async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ExtractionError(
        `Fetch failed: ${res.status} ${res.statusText}`,
        "fetch_failed",
      );
    }
    return await res.text();
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError(
      `Could not fetch ${url}: ${(err as Error).message}`,
      "fetch_failed",
    );
  } finally {
    clearTimeout(timer);
  }
}
