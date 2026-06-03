import { z } from "zod";
import {
  HealthResponse,
  ImportResultDTO,
  ListDetailDTO,
  ListSummaryDTO,
  OfferDTO,
  type AddItemInput,
  type CreateListInput,
  type ImportInput,
} from "@pricepilot/shared";

/**
 * Base URL of the PricePilot API. The PWA talks only to our own API
 * (see PLAN.md "core constraint"); vendor fetching happens server-side.
 */
export const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/** Error carrying the HTTP status so callers can branch on it. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Typed fetch helper: validates the response against a zod schema and surfaces
 * the API's error message on non-2xx responses.
 */
async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new ApiError(res.status, message);
  }
  return schema.parse(await res.json());
}

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request("/health", HealthResponse, { signal });
}

// --- Lists ---------------------------------------------------------------

export const listsApi = {
  list: (signal?: AbortSignal) =>
    request("/api/lists", z.array(ListSummaryDTO), { signal }),

  get: (id: string, signal?: AbortSignal) =>
    request(`/api/lists/${id}`, ListDetailDTO, { signal }),

  create: (input: CreateListInput) =>
    request("/api/lists", ListDetailDTO, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  remove: (id: string) =>
    fetch(`${API_URL}/api/lists/${id}`, { method: "DELETE" }).then((r) => {
      if (!r.ok) throw new ApiError(r.status, "Failed to delete list");
    }),

  addItem: (listId: string, input: AddItemInput) =>
    request(`/api/lists/${listId}/items`, ListDetailDTO, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  removeItem: (listId: string, itemId: string) =>
    fetch(`${API_URL}/api/lists/${listId}/items/${itemId}`, { method: "DELETE" }).then(
      (r) => {
        if (!r.ok) throw new ApiError(r.status, "Failed to remove item");
      },
    ),

  import: (listId: string, input: ImportInput) =>
    request(`/api/lists/${listId}/import`, ImportResultDTO, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  refreshOffer: (offerId: string) =>
    request(`/api/offers/${offerId}/refresh`, OfferDTO, { method: "POST" }),
};
