/**
 * Lightweight client-side JWT inspection — just the `exp` claim, so the app can
 * proactively drop an expired token (rather than waiting for the next request to
 * 401). No signature verification: the API remains the source of truth.
 */

interface JwtPayload {
  exp?: number;
}

/** Decode a JWT's `exp` (seconds since epoch), or null if unreadable. */
export function decodeJwtExp(token: string): number | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64)) as JwtPayload;
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/** Whether the token is past its `exp` (a token without `exp` is treated valid). */
export function isTokenExpired(token: string, nowMs: number = Date.now()): boolean {
  const exp = decodeJwtExp(token);
  if (exp === null) return false;
  return nowMs >= exp * 1000;
}
