import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { HealthResponse } from "@pricepilot/shared";
import { buildServer } from "../src/server.js";

describe("GET /health", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({
      env: {
        NODE_ENV: "test",
        API_HOST: "0.0.0.0",
        API_PORT: 3001,
        CORS_ORIGIN: "http://localhost:5173",
        ENABLE_AMAZON_ADAPTER: false,
        ENABLE_PLAYWRIGHT: false,
        JWT_SECRET: "test-secret",
        AUTH_RATE_LIMIT_MAX: 1000,
        AUTH_RATE_WINDOW_MS: 60_000,
        RESPECT_ROBOTS: false,
        REQUEST_INTERVAL_MS: 0,
        REQUEST_JITTER_MS: 0,
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns a schema-valid 200 response", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);

    const body = HealthResponse.parse(res.json());
    expect(body.status).toBe("ok");
    expect(body.service).toBe("api");
  });

  it("reflects the configured CORS origin", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/health",
      headers: { origin: "http://localhost:5173" },
    });
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});
