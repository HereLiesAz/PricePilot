const HOUR = 60;
const DAY = 24 * HOUR;
const MIN_CADENCE = HOUR;
const MAX_CADENCE = 7 * DAY;

export interface CadenceInput {
  /** Consecutive scrape failures for this offer. */
  failureCount: number;
  /** Did the price change since the previous check? */
  priceChanged: boolean;
  /** Is the current price at/near (within ~5% above) the item's target? */
  nearTarget: boolean;
}

/**
 * Adaptive cadence (PLAN.md): check volatile / near-target offers more often;
 * back off stable ones and apply exponential backoff on repeated failures.
 * Returns minutes, clamped to [1h, 7d].
 */
export function nextCadenceMinutes(input: CadenceInput): number {
  let minutes: number;
  if (input.failureCount > 0) {
    minutes = DAY * 2 ** input.failureCount;
  } else if (input.nearTarget) {
    minutes = 3 * HOUR;
  } else if (input.priceChanged) {
    minutes = 6 * HOUR;
  } else {
    minutes = DAY;
  }
  return Math.min(Math.max(Math.round(minutes), MIN_CADENCE), MAX_CADENCE);
}
