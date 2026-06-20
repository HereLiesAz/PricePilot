import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { AuthResponse, UserDTO } from "@pricepilot/shared";
import { buildServer } from "../src/server.js";
import { prisma } from "../src/db.js";
import { hashPassword, verifyPassword } from "../src/auth.js";

describe("password hashing", () => {
  it("verifies a correct password and rejects a wrong one", () => {
    const stored = hashPassword("correct horse");
    expect(verifyPassword("correct horse", stored)).toBe(true);
    expect(verifyPassword("Tr0ub4dor", stored)).toBe(false);
  });
});

describe.skipIf(!process.env.DATABASE_URL)("auth API", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({
      env: {
        NODE_ENV: "test",
        API_HOST: "0.0.0.0",
        API_PORT: 3002,
        CORS_ORIGIN: "http://localhost:5173",
        DATABASE_URL: process.env.DATABASE_URL,
        ENABLE_AMAZON_ADAPTER: false,
        ENABLE_PLAYWRIGHT: false,
        JWT_SECRET: "test-secret",
        RESPECT_ROBOTS: false,
        REQUEST_INTERVAL_MS: 0,
        REQUEST_JITTER_MS: 0,
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.user.deleteMany();
  });

  it("registers, logs in, and returns the current user", async () => {
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { email: "Alice@Test.local", password: "password123", name: "Alice" },
    });
    expect(reg.statusCode).toBe(201);
    const registered = AuthResponse.parse(reg.json());
    expect(registered.user.email).toBe("alice@test.local"); // normalized

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "alice@test.local", password: "password123" },
    });
    expect(login.statusCode).toBe(200);
    const token = AuthResponse.parse(login.json()).token;

    const me = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(UserDTO.parse(me.json()).email).toBe("alice@test.local");
  });

  it("rejects duplicate email and bad credentials", async () => {
    const payload = { email: "dup@test.local", password: "password123" };
    expect((await app.inject({ method: "POST", url: "/api/auth/register", payload })).statusCode).toBe(201);
    expect((await app.inject({ method: "POST", url: "/api/auth/register", payload })).statusCode).toBe(409);
    expect(
      (await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "dup@test.local", password: "wrong" },
      })).statusCode,
    ).toBe(401);
  });

  it("rejects /api/auth/me without a token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
  });
});
