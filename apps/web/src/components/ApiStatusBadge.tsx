import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useHealth } from "@/hooks/useHealth";
import { Badge } from "@/components/ui/badge";

/**
 * Live indicator of the web↔api end-to-end health check. Drives the visible
 * confirmation that the PWA can reach (and validate) the API.
 */
export function ApiStatusBadge() {
  const { data, isPending, isError } = useHealth();

  if (isPending) {
    return (
      <Badge variant="secondary" aria-live="polite">
        <Loader2 className="animate-spin" aria-hidden /> Checking API…
      </Badge>
    );
  }

  if (isError || !data) {
    return (
      <Badge variant="destructive" aria-live="polite">
        <XCircle aria-hidden /> API unreachable
      </Badge>
    );
  }

  return (
    <Badge variant="success" aria-live="polite" title={`v${data.version}`}>
      <CheckCircle2 aria-hidden /> API healthy
    </Badge>
  );
}
