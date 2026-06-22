import { describe, expect, it } from "vitest";
import { decodeJwtExp, isTokenExpired } from "./auth-token";

/** Build an unsigned JWT-shaped string carrying the given payload. */
function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${b64({ alg: "HS256" })}.${b64(payload)}.sig`;
}

describe("decodeJwtExp", () => {
  it("reads the exp claim", () => {
    expect(decodeJwtExp(fakeJwt({ sub: "u1", exp: 1_900_000_000 }))).toBe(1_900_000_000);
  });
  it("returns null for malformed tokens or missing exp", () => {
    expect(decodeJwtExp("not-a-jwt")).toBeNull();
    expect(decodeJwtExp(fakeJwt({ sub: "u1" }))).toBeNull();
  });
});

describe("isTokenExpired", () => {
  const now = 1_000_000_000 * 1000;
  it("is true once past exp, false before", () => {
    expect(isTokenExpired(fakeJwt({ exp: 999_999_999 }), now)).toBe(true);
    expect(isTokenExpired(fakeJwt({ exp: 1_000_000_100 }), now)).toBe(false);
  });
  it("treats a token without exp as valid", () => {
    expect(isTokenExpired(fakeJwt({ sub: "u1" }), now)).toBe(false);
  });
});
