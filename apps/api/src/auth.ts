import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import type { UserDTO } from "@pricepilot/shared";
import type { Prisma } from "@pricepilot/db";
import { AppError } from "./errors.js";

// --- Password hashing (scrypt, no external deps) -------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function toUserDTO(user: Prisma.UserGetPayload<object>): UserDTO {
  return { id: user.id, email: user.email, name: user.name };
}

/** The current user's id from the verified JWT (use after the auth hook). */
export function currentUserId(req: FastifyRequest): string {
  return req.user.sub;
}

/**
 * Register @fastify/jwt and an `authenticate` hook. Routes opt in via
 * `onRequest: app.authenticate`; failures become a 401 through the error handler.
 */
export async function registerAuth(app: FastifyInstance, secret: string): Promise<void> {
  await app.register(fastifyJwt, { secret, sign: { expiresIn: "30d" } });
  app.decorate("authenticate", async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      throw new AppError(401, "Authentication required");
    }
  });
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; email: string };
    user: { sub: string; email: string };
  }
}
