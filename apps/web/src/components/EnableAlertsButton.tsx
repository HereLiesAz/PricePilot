import { useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enablePush, pushSupported } from "@/lib/push";

type Status = "idle" | "working" | "enabled" | "error";

/** Header control to opt into Web Push price alerts. */
export function EnableAlertsButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string>("");

  if (!pushSupported()) return null;

  async function onClick() {
    setStatus("working");
    setMessage("");
    try {
      await enablePush();
      setStatus("enabled");
    } catch (err) {
      setStatus("error");
      setMessage((err as Error).message);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={status === "working" || status === "enabled"}
      title={message || undefined}
      aria-label="Enable price alerts"
    >
      {status === "working" ? (
        <Loader2 className="animate-spin" />
      ) : status === "enabled" ? (
        <BellRing />
      ) : (
        <Bell />
      )}
      {status === "enabled" ? "Alerts on" : "Enable alerts"}
    </Button>
  );
}
