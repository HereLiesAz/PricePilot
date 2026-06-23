import type { ExtractedProduct } from "@sail/shared";

/**
 * Vendor access tiers (PLAN.md): official API → structured data → headless
 * browser → (Claude fallback, later). Adapters declare their tier; the registry
 * prefers lower-cost, ToS-safe tiers first.
 */
export type AdapterTier = "api" | "structured-data" | "headless" | "claude";

export type ExtractionErrorCode =
  | "amazon_disabled"
  | "fetch_failed"
  | "no_product_data"
  | "bad_url"
  | "adapter_unavailable"
  | "robots_disallowed";

export class ExtractionError extends Error {
  constructor(
    message: string,
    readonly code: ExtractionErrorCode,
  ) {
    super(message);
    this.name = "ExtractionError";
  }
}

/** Per-vendor credentials, populated from env by the consumer (api/worker). */
export interface AdapterCredentials {
  /** eBay Browse API OAuth application token (client-credentials grant). */
  ebayOAuthToken?: string;
  /** Best Buy developer API key. */
  bestBuyApiKey?: string;
}

export interface AdapterContext {
  /** Amazon adapter is opt-in / off-by-default (ToS risk, see PLAN.md). */
  enableAmazon: boolean;
  /** Allow the headless (Playwright) tier as a fallback. */
  enablePlaywright: boolean;
  /** Playwright browser channel (e.g. "chrome") or executable path. */
  playwrightChannel?: string;
  playwrightExecutablePath?: string;
  credentials: AdapterCredentials;
  /** Injectable fetch (tests). Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /**
   * Optional tier-4 Claude extraction fallback (from @sail/intel), wired
   * by the consumer when ANTHROPIC_API_KEY is set. Given cleaned page HTML, it
   * returns a normalized product or null. Kept as a plain function so scrapers
   * stays free of the Anthropic SDK.
   */
  claudeFallback?: (input: { html: string; url: string }) => Promise<ExtractedProduct | null>;
  /**
   * Optional headless renderer override (tests). Defaults to the Playwright
   * adapter's launch-and-render. Returns the rendered HTML for a URL.
   */
  renderImpl?: (url: string) => Promise<string>;
  /** Politeness (PLAN.md): honor robots.txt on page fetches when true. */
  respectRobots?: boolean;
  /** Minimum spacing between page fetches to the same host (ms). 0 disables. */
  minRequestIntervalMs?: number;
  /** Random extra delay added on top of the per-host interval (ms). */
  requestJitterMs?: number;
}

export interface VendorAdapter {
  readonly name: string;
  readonly tier: AdapterTier;
  readonly capabilities: string[];
  /** Whether this adapter knows how to handle the given URL's domain. */
  canHandle(url: URL): boolean;
  /** Whether the adapter is usable in this context (e.g. has credentials). */
  isAvailable(ctx: AdapterContext): boolean;
  /** Fetch + normalize a product/offer. Throws `ExtractionError` on failure. */
  extract(url: string, ctx: AdapterContext): Promise<ExtractedProduct>;
}

export function getFetch(ctx: AdapterContext): typeof fetch {
  return ctx.fetchImpl ?? fetch;
}
