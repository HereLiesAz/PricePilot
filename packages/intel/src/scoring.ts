/**
 * Deal scoring (PLAN.md): compare the current price to the offer's own price
 * history distribution to label it great / good / normal / high, plus the
 * percentile of the current price within history. Pure and unit-tested.
 */

export type DealTier = "great" | "good" | "normal" | "high";

export interface DealScore {
  tier: DealTier;
  /** Percentile (0–100) of the current price within history; lower is cheaper. */
  percentile: number;
  lowest: number | null;
  median: number | null;
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!;
}

/**
 * Score `current` against the historical `prices` (any order). With no history
 * the tier is "normal" at the 50th percentile.
 */
export function dealScore(current: number | null, prices: number[]): DealScore {
  if (current === null || prices.length === 0) {
    return { tier: "normal", percentile: 50, lowest: prices.length ? Math.min(...prices) : null, median: null };
  }
  const sorted = [...prices].sort((a, b) => a - b);
  const lowest = sorted[0]!;
  const med = median(sorted);

  const below = sorted.filter((p) => p < current).length;
  const percentile = Math.round((below / sorted.length) * 100);

  let tier: DealTier;
  if (current <= lowest * 1.02 || percentile <= 10) tier = "great";
  else if (current <= med * 0.9) tier = "good";
  else if (current <= med * 1.1) tier = "normal";
  else tier = "high";

  return { tier, percentile, lowest, median: med };
}
