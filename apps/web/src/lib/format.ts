/** Format a price (already in major units) with its ISO currency code. */
export function formatPrice(value: number | null, currency = "USD"): string {
  if (value === null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);
  } catch {
    // Unknown currency code: fall back to a plain number + code.
    return `${value.toFixed(2)} ${currency}`;
  }
}

/** Short relative-time label for an ISO timestamp ("just now", "3h ago"). */
export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
