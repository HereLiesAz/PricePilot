import { HealthResponse } from "@pricepilot/shared";

/**
 * Base URL of the PricePilot API. The PWA talks only to our own API
 * (see PLAN.md "core constraint"); vendor fetching happens server-side.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * Fetch and validate the API health payload. Throws on network error or if the
 * response doesn't match the shared `HealthResponse` schema.
 */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/health`, { signal });
  if (!res.ok) {
    throw new Error(`API health check failed: ${res.status} ${res.statusText}`);
  }
  return HealthResponse.parse(await res.json());
}
