import { prisma } from "@sail/db";

export { prisma };

/**
 * Phase 1 has no auth yet (JWT/session arrives later — see PLAN.md). Until then
 * everything hangs off a single default user so the core list/item loop works
 * end-to-end. `getDefaultUserId` lazily ensures that user exists.
 */
const DEFAULT_USER_EMAIL = "demo@sail.local";

let defaultUserIdCache: string | undefined;

export async function getDefaultUserId(): Promise<string> {
  if (defaultUserIdCache) return defaultUserIdCache;
  const user = await prisma.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: { email: DEFAULT_USER_EMAIL, name: "Demo" },
  });
  defaultUserIdCache = user.id;
  return user.id;
}
