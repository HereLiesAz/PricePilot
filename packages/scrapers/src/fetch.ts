import { ExtractionError, getFetch, type AdapterContext } from "./types.js";
import { RateLimiter, isPathAllowed, parseRobots, type RobotsRules } from "./politeness.js";

/**
 * Identifiable User-Agent (politeness — see PLAN.md). Real per-domain rate
 * limiting / robots.txt handling arrives with the worker in later phases.
 */
export const USER_AGENT =
  "PricePilotBot/0.2 (+https://github.com/HereLiesAz/PricePilot; structured-data)";

const FETCH_TIMEOUT_MS = 10_000;

export function vendorDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "");
  } catch {
    throw new ExtractionError(`Invalid URL: ${rawUrl}`, "bad_url");
  }
}

/** Fetch text with a timeout, identifiable UA, and uniform error mapping. */
export async function fetchText(
  url: string,
  ctx: AdapterContext,
  headers: Record<string, string> = {},
): Promise<string> {
  const doFetch = getFetch(ctx);
  await applyPoliteness(url, ctx, doFetch);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await doFetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", ...headers },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ExtractionError(`Fetch failed: ${res.status} ${res.statusText}`, "fetch_failed");
    }
    return await res.text();
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError(`Could not fetch ${url}: ${(err as Error).message}`, "fetch_failed");
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch and parse JSON from an API, mapping failures to ExtractionError. */
export async function fetchJson<T>(
  url: string,
  ctx: AdapterContext,
  headers: Record<string, string> = {},
): Promise<T> {
  const doFetch = getFetch(ctx);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await doFetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "application/json", ...headers },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new ExtractionError(`API request failed: ${res.status} ${res.statusText}`, "fetch_failed");
    }
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    throw new ExtractionError(`Could not reach ${url}: ${(err as Error).message}`, "fetch_failed");
  } finally {
    clearTimeout(timer);
  }
}

// --- Politeness (per-host rate limiting + robots.txt) --------------------

let limiter: RateLimiter | undefined;
const robotsCache = new Map<string, RobotsRules>();

/**
 * Apply politeness before a page fetch: space requests to the same host and,
 * when `respectRobots` is set, honor robots.txt. Both are gated by context
 * flags, so injected-fetch unit tests (which set neither) are unaffected.
 */
async function applyPoliteness(url: string, ctx: AdapterContext, doFetch: typeof fetch): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return; // bad URLs fail later in the fetch with a clearer error
  }

  if (ctx.minRequestIntervalMs && ctx.minRequestIntervalMs > 0) {
    if (!limiter) limiter = new RateLimiter(ctx.minRequestIntervalMs, ctx.requestJitterMs ?? 0);
    await limiter.wait(parsed.host);
  }

  if (ctx.respectRobots) {
    const rules = await getRobots(parsed.origin, doFetch);
    if (!isPathAllowed(parsed.pathname, rules)) {
      throw new ExtractionError(`Blocked by robots.txt: ${url}`, "robots_disallowed");
    }
  }
}

async function getRobots(origin: string, doFetch: typeof fetch): Promise<RobotsRules> {
  const cached = robotsCache.get(origin);
  if (cached) return cached;
  let rules: RobotsRules = { allow: [], disallow: [] };
  try {
    const res = await doFetch(`${origin}/robots.txt`, { headers: { "user-agent": USER_AGENT } });
    if (res.ok) rules = parseRobots(await res.text(), USER_AGENT);
  } catch {
    // No robots.txt (or unreachable) → treat as allow-all.
  }
  robotsCache.set(origin, rules);
  return rules;
}
