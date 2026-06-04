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

/** Approximate FX rates as units-per-USD. Replace with a live feed in prod. */
export const DEFAULT_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 156,
};

/**
 * Convert `amount` from one ISO currency to another using a units-per-base rate
 * table. Returns null if either currency is unknown (caller can fall back to a
 * raw compare).
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number> = DEFAULT_RATES,
): number | null {
  const f = rates[from.toUpperCase()];
  const t = rates[to.toUpperCase()];
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
