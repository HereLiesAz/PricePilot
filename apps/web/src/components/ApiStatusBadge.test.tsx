import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiStatusBadge } from "@/components/ApiStatusBadge";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const healthBody = {
  status: "ok",
  service: "api",
  version: "0.0.0",
  uptime: 1.5,
  timestamp: new Date().toISOString(),
};

describe("ApiStatusBadge", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows healthy when the API returns a valid payload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(healthBody), { status: 200 })),
    );

    render(<ApiStatusBadge />, { wrapper });

    await waitFor(() => expect(screen.getByText(/API healthy/i)).toBeInTheDocument());
  });

  it("shows unreachable when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      }),
    );

    render(<ApiStatusBadge />, { wrapper });

    // useHealth retries once (~1s backoff) before surfacing the error state.
    await waitFor(() => expect(screen.getByText(/API unreachable/i)).toBeInTheDocument(), {
      timeout: 4000,
    });
  });
});
