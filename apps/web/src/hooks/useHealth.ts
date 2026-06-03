import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "@/lib/api";

/**
 * End-to-end web↔api health check. Polls the API and exposes loading/error
 * state so the app shell can render a live connectivity badge.
 */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: 30_000,
    retry: 1,
    staleTime: 10_000,
  });
}
