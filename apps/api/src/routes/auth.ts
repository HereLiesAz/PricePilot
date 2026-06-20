import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { AuthResponse, LoginInput, RegisterInput, UserDTO } from "@pricepilot/shared";
import { prisma } from "../db.js";
import { AppError } from "../errors.js";
import {
  currentUserId,
  DUMMY_PASSWORD_HASH,
  hashPassword,
  toUserDTO,
  verifyPassword,
} from "../auth.js";

export function registerAuthRoutes(fastify: FastifyInstance): void {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    "/api/auth/register",
    { schema: { body: RegisterInput, response: { 201: AuthResponse } } },
    async (req, reply) => {
      const email = req.body.email.toLowerCase();
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) throw new AppError(409, "Email already registered");
      const user = await prisma.user.create({
        data: { email, name: req.body.name ?? null, passwordHash: await hashPassword(req.body.password) },
      });
      const token = app.jwt.sign({ sub: user.id, email: user.email });
      return reply.code(201).send({ token, user: toUserDTO(user) });
    },
  );

  app.post(
    "/api/auth/login",
    { schema: { body: LoginInput, response: { 200: AuthResponse } } },
    async (req) => {
      const email = req.body.email.toLowerCase();
      const user = await prisma.user.findUnique({ where: { email } });
      // Always run a verification (dummy hash for unknown emails) so response
      // time doesn't leak whether the account exists (username enumeration).
      const isValid = await verifyPassword(req.body.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
      if (!user?.passwordHash || !isValid) {
        throw new AppError(401, "Invalid email or password");
      }
      const token = app.jwt.sign({ sub: user.id, email: user.email });
      return { token, user: toUserDTO(user) };
    },
  );

  app.get(
    "/api/auth/me",
    { onRequest: fastify.authenticate, schema: { response: { 200: UserDTO } } },
    async (req) => {
      const user = await prisma.user.findUnique({ where: { id: currentUserId(req) } });
      if (!user) throw new AppError(401, "Unauthorized");
      return toUserDTO(user);
    },
  );
}
