import { z } from "zod";
import {
  AlertDTO,
  AuthResponse,
  HealthResponse,
  ImportResultDTO,
  ListDetailDTO,
  ListSummaryDTO,
  OfferDTO,
  PriceHistoryDTO,
  SearchResultDTO,
  UserDTO,
  VapidKeyDTO,
  type AddItemInput,
  type CreateAlertInput,
  type CreateListInput,
  type ImportInput,
  type LoginInput,
  type PushSubscriptionInput,
  type RegisterInput,
} from "@pricepilot/shared";
import { useAuthStore } from "@/store/useAuthStore";

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
/** Build request headers, attaching the bearer token when authenticated. */
function authHeaders(extra?: HeadersInit): HeadersInit {
  const token = useAuthStore.getState().token;
  return {
    "content-type": "application/json",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: authHeaders(init?.headers) });
  await throwIfNotOk(res);
  return schema.parse(await res.json());
}

/** Like `request`, for endpoints that return no body (204 No Content). */
async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const res = await fetch(`${API_URL}${path}`, { ...init, headers: authHeaders(init?.headers) });
  await throwIfNotOk(res);
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  // Drop a stale/invalid session so the UI returns to the login screen.
  if (res.status === 401) useAuthStore.getState().clear();
  let message = `${res.status} ${res.statusText}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (body.message) message = body.message;
  } catch {
    // Non-JSON error body; keep the status text.
  }
  throw new ApiError(res.status, message);
}

// --- Auth ----------------------------------------------------------------

export const authApi = {
  register: (input: RegisterInput) =>
    request("/api/auth/register", AuthResponse, { method: "POST", body: JSON.stringify(input) }),
  login: (input: LoginInput) =>
    request("/api/auth/login", AuthResponse, { method: "POST", body: JSON.stringify(input) }),
  me: (signal?: AbortSignal) => request("/api/auth/me", UserDTO, { signal }),
};

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

  remove: (id: string) => requestVoid(`/api/lists/${id}`, { method: "DELETE" }),

  addItem: (listId: string, input: AddItemInput) =>
    request(`/api/lists/${listId}/items`, ListDetailDTO, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  removeItem: (listId: string, itemId: string) =>
    requestVoid(`/api/lists/${listId}/items/${itemId}`, { method: "DELETE" }),

  import: (listId: string, input: ImportInput) =>
    request(`/api/lists/${listId}/import`, ImportResultDTO, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  importWishlist: (listId: string, url: string) =>
    request(`/api/lists/${listId}/import-wishlist`, ImportResultDTO, {
      method: "POST",
      body: JSON.stringify({ url }),
    }),

  refreshOffer: (offerId: string) =>
    request(`/api/offers/${offerId}/refresh`, OfferDTO, { method: "POST" }),

  offerHistory: (offerId: string, signal?: AbortSignal) =>
    request(`/api/offers/${offerId}/history`, PriceHistoryDTO, { signal }),

  // --- Alerts + Web Push ---
  pushKey: () => request("/api/push/key", VapidKeyDTO),

  pushSubscribe: (sub: PushSubscriptionInput) =>
    request(`/api/push/subscribe`, z.object({ ok: z.literal(true) }), {
      method: "POST",
      body: JSON.stringify(sub),
    }),

  itemAlerts: (listId: string, itemId: string, signal?: AbortSignal) =>
    request(`/api/lists/${listId}/items/${itemId}/alerts`, z.array(AlertDTO), { signal }),

  createAlert: (listId: string, itemId: string, input: CreateAlertInput) =>
    request(`/api/lists/${listId}/items/${itemId}/alerts`, AlertDTO, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  deleteAlert: (alertId: string) =>
    requestVoid(`/api/alerts/${alertId}`, { method: "DELETE" }),

  search: (query: string, signal?: AbortSignal) =>
    request(`/api/search?q=${encodeURIComponent(query)}`, z.array(SearchResultDTO), { signal }),
};
