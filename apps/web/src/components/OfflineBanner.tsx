import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * Offline indicator. The PWA service worker serves the cached app shell and
 * last-seen API data when offline; this banner makes the state explicit.
 */
export function OfflineBanner() {
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-sm font-medium text-black"
    >
      <WifiOff className="size-4" aria-hidden />
      Offline — showing cached data. Changes will fail until you reconnect.
    </div>
  );
}
