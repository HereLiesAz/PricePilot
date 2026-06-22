/**
 * Minimal fixed-window rate limiter (no external deps). Used to throttle the
 * auth endpoints per client IP against brute-force / enumeration. In-memory, so
 * it's per-instance — fine for a single API node; a multi-node deployment would
 * back this with Redis.
 */

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the current window resets (for a Retry-After header). */
  retryAfterMs: number;
}

export type RateLimiter = (key: string) => RateLimitResult;

export function createRateLimiter(
  max: number,
  windowMs: number,
  now: () => number = Date.now,
): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return (key) => {
    const t = now();
    let rec = windows.get(key);
    if (!rec || t >= rec.resetAt) {
      rec = { count: 0, resetAt: t + windowMs };
      windows.set(key, rec);
    }
    rec.count += 1;
    if (rec.count > max) {
      return { allowed: false, retryAfterMs: rec.resetAt - t };
    }
    return { allowed: true, retryAfterMs: 0 };
  };
}
