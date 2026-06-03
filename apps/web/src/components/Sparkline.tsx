import { sparklinePoints } from "@/lib/sparkline";

interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
}

/**
 * Tiny dependency-free price-trend chart. A downward trend (price dropping) is
 * drawn in green; an upward trend in red.
 */
export function Sparkline({ values, width = 140, height = 32 }: SparklineProps) {
  if (values.length < 2) {
    return (
      <span className="text-xs text-[var(--color-muted-foreground)]">not enough history yet</span>
    );
  }
  const points = sparklinePoints(values, width, height);
  const dropped = values[values.length - 1]! <= values[0]!;
  const stroke = dropped ? "rgb(16 185 129)" : "rgb(239 68 68)";

  return (
    <svg width={width} height={height} role="img" aria-label="Price history trend">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
