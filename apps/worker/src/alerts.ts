import type { AlertRule } from "@pricepilot/shared";

/** A price drop of this fraction below the historical median counts as a deal. */
export const GOOD_DEAL_FRACTION = 0.85;

export interface AlertEvalInput {
  rule: AlertRule;
  threshold: number | null;
  newPrice: number | null;
  prevInStock: boolean | null;
  newInStock: boolean | null;
  /** Median price across history *before* this check (deal scoring basis). */
  historyMedian: number | null;
}

/**
 * Pure alert predicate. Kept free of DB/IO so cadence and rule logic stay
 * unit-testable; the worker wires it to offers, items, and push delivery.
 */
export function shouldTriggerAlert(i: AlertEvalInput): boolean {
  switch (i.rule) {
    case "TARGET_HIT":
      return i.newPrice !== null && i.threshold !== null && i.newPrice <= i.threshold;
    case "BACK_IN_STOCK":
      return i.prevInStock === false && i.newInStock === true;
    case "GOOD_DEAL":
      return (
        i.newPrice !== null &&
        i.historyMedian !== null &&
        i.newPrice <= i.historyMedian * GOOD_DEAL_FRACTION
      );
  }
}

export function alertMessage(rule: AlertRule, title: string, price: number | null, currency: string): string {
  const priceStr = price !== null ? `${currency} ${price.toFixed(2)}` : "an unknown price";
  switch (rule) {
    case "TARGET_HIT":
      return `${title} hit your target price (${priceStr}).`;
    case "GOOD_DEAL":
      return `${title} is a great deal right now (${priceStr}).`;
    case "BACK_IN_STOCK":
      return `${title} is back in stock (${priceStr}).`;
  }
}
