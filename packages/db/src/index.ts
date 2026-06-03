import { PrismaClient } from "../generated/client/index.js";

export * from "../generated/client/index.js";

/**
 * Create a configured Prisma client. Phase 0 keeps this a thin factory; later
 * phases can layer in logging, soft-delete middleware, and read replicas.
 */
export function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
  });
}

/**
 * Process-wide singleton, guarded against hot-reload duplication in dev.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
