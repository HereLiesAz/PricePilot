import type { DealTier } from "@sail/shared";
import { Badge, type BadgeProps } from "@/components/ui/badge";

const TIER: Record<DealTier, { label: string; variant: BadgeProps["variant"] }> = {
  great: { label: "Great deal", variant: "success" },
  good: { label: "Good deal", variant: "default" },
  normal: { label: "Typical price", variant: "secondary" },
  high: { label: "Above typical", variant: "destructive" },
};

/** Visual deal-score indicator (from the offer's price-history distribution). */
export function DealBadge({ tier, percentile }: { tier: DealTier; percentile: number }) {
  const t = TIER[tier];
  return (
    <Badge variant={t.variant} title={`Cheaper than ${100 - percentile}% of recorded prices`}>
      {t.label}
    </Badge>
  );
}
