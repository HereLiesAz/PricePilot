import { ExtractionError, getFetch, type AdapterContext } from "./types.js";

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
