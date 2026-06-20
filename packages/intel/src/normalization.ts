/**
 * Price normalization (PLAN.md "best price"): landed price (price + shipping +
 * tax), currency conversion to a common base for cross-vendor comparison, and
 * unit-price extraction (per item / per litre / per kilo) parsed from titles.
 * All pure and unit-tested.
 */

/** Total landed cost in the offer's own currency. */
export function landedPrice(price: number, shipping = 0, taxRate = 0): number {
  return Math.round((price + shipping) * (1 + taxRate) * 100) / 100;
}

/** Seed FX rates (units-per-USD) used until a live refresh succeeds. */
export const DEFAULT_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 156,
};

// Live rates cache, seeded with the static table and refreshed best-effort.
let liveRates: Record<string, number> = { ...DEFAULT_RATES };
let lastRefresh = 0;

/** Current FX rates (units-per-USD): live values when refreshed, else the seed. */
export function getRates(): Record<string, number> {
  return liveRates;
}

/** Reset the FX cache to the seed table (test isolation). */
export function resetRates(): void {
  liveRates = { ...DEFAULT_RATES };
  lastRefresh = 0;
}

interface ErApiResponse {
  result?: string;
  rates?: Record<string, number>;
}

export interface RefreshRatesOptions {
  fetchImpl?: typeof fetch;
  /** USD-base FX endpoint returning `{ rates: { ISO: perUsd } }`. */
  url?: string;
  /** Skip the network call if the cache is newer than this (default 12h). */
  ttlMs?: number;
  /** Abort the fetch after this long (default 10s). */
  timeoutMs?: number;
}

/**
 * Refresh the FX cache from a free USD-base feed (open.er-api.com by default).
 * New rates are **merged** into the cache (a partial response never wipes
 * known currencies). Throws on network/HTTP/format failure so the caller can
 * log it — the cache is left untouched, so `convertCurrency` keeps degrading
 * to the last-known (or seed) rates.
 */
export async function refreshRates(opts: RefreshRatesOptions = {}): Promise<Record<string, number>> {
  const ttl = opts.ttlMs ?? 12 * 60 * 60_000;
  if (lastRefresh !== 0 && Date.now() - lastRefresh < ttl) return liveRates;

  const doFetch = opts.fetchImpl ?? fetch;
  const url = opts.url ?? "https://open.er-api.com/v6/latest/USD";

  const res = await doFetch(url, { signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000) });
  if (!res.ok) {
    throw new Error(`Failed to fetch FX rates: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as ErApiResponse | null;
  const rates = json?.rates;
  if (!rates || typeof rates !== "object") {
    throw new Error("Invalid FX rates response format");
  }

  const next: Record<string, number> = { ...liveRates };
  for (const [code, value] of Object.entries(rates)) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      next[code.toUpperCase()] = value;
    }
  }
  next.USD = 1;
  liveRates = next;
  lastRefresh = Date.now();
  return liveRates;
}

/**
 * Convert `amount` from one ISO currency to another using a units-per-base rate
 * table (defaults to the live FX cache). Returns null if either currency is
 * unknown (caller can fall back to a raw compare).
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number> = getRates(),
): number | null {
  const fromUpper = from.toUpperCase();
  const toUpper = to.toUpperCase();
  if (fromUpper === toUpper) return amount;
  const f = rates[fromUpper];
  const t = rates[toUpper];
  if (!f || !t) return null;
  return Math.round(((amount / f) * t) * 100) / 100;
}

export interface UnitInfo {
  quantity: number;
  /** Normalized unit: "each" (count), "l" (volume), or "kg" (weight). */
  unit: "each" | "l" | "kg";
}

const VOLUME_TO_L: Record<string, number> = { ml: 0.001, cl: 0.01, l: 1, "fl oz": 0.0295735 };
const WEIGHT_TO_KG: Record<string, number> = { mg: 1e-6, g: 0.001, kg: 1, oz: 0.0283495, lb: 0.453592 };

/**
 * Parse a quantity/size from a product title. Recognizes pack counts
 * ("12 pack", "6 x"), volumes (ml/l/fl oz), and weights (g/kg/oz/lb), returning
 * the total normalized to litres / kilograms / item count.
 */
export function parseQuantity(title: string): UnitInfo | null {
  const t = title.toLowerCase();

  const pack = t.match(/(\d+)\s*(?:-|\s)?\s*(?:pack|pk|count|ct|pcs|pieces|x)\b/);
  const multiplier = pack ? Number(pack[1]) : 1;

  const vol = t.match(/(\d+(?:\.\d+)?)\s*(ml|cl|fl oz|l)\b/);
  if (vol) {
    const value = Number(vol[1]) * (VOLUME_TO_L[vol[2]!] ?? 1);
    return { quantity: value * multiplier, unit: "l" };
  }

  const weight = t.match(/(\d+(?:\.\d+)?)\s*(mg|kg|g|oz|lb)\b/);
  if (weight) {
    const value = Number(weight[1]) * (WEIGHT_TO_KG[weight[2]!] ?? 1);
    return { quantity: value * multiplier, unit: "kg" };
  }

  if (pack) return { quantity: multiplier, unit: "each" };
  return null;
}

export interface UnitPrice {
  value: number;
  unit: "each" | "l" | "kg";
}

/** Price per normalized unit, or null when no quantity can be parsed. */
export function unitPrice(price: number, title: string): UnitPrice | null {
  const info = parseQuantity(title);
  if (!info || info.quantity <= 0) return null;
  return { value: Math.round((price / info.quantity) * 100) / 100, unit: info.unit };
}
